import { randomUUID } from 'node:crypto'
import {
  buildCacheReuseMessages,
  buildFixture,
  buildMultiTurnMessages,
  buildRoundMessages
} from './fixture.mjs'
import { sha256 } from './hash.mjs'
import { APP_VERSION, USER_AGENT } from './meta.mjs'
import { calculateStandardCost, normalizePricing } from './pricing.mjs'
import { extractOutputText, mergeUsage, normalizeUsage } from './usage.mjs'
import { normalizeBenchmarkRequest } from './validation.mjs'

const REQUEST_TIMEOUT_MS = 120_000

function requestIdFromResponse(response, payload) {
  return (
    response.headers.get('x-request-id') ??
    response.headers.get('request-id') ??
    payload?.id ??
    payload?.request_id ??
    null
  )
}

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').slice(0, 500)
}

async function executeProviderRequest(provider, requestBody, pricing, fetchImpl, signal) {
  const startedAt = new Date().toISOString()
  let response
  try {
    signal?.throwIfAborted()
    const requestSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
      : AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    response = await fetchImpl(provider.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': USER_AGENT
      },
      body: JSON.stringify(requestBody),
      signal: requestSignal
    })
    const rawBody = await response.text()
    let payload
    try {
      payload = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      throw new Error(`上游返回了非 JSON 响应（HTTP ${response.status}）`)
    }
    if (!response.ok) {
      const upstreamMessage = payload?.error?.message ?? payload?.message ?? `HTTP ${response.status}`
      throw new Error(`请求失败：${String(upstreamMessage).slice(0, 300)}`)
    }
    const usage = normalizeUsage(payload)
    const costs = calculateStandardCost(usage, pricing)
    const outputText = extractOutputText(payload)
    return {
      status: 'success',
      startedAt,
      completedAt: new Date().toISOString(),
      httpStatus: response.status,
      requestId: requestIdFromResponse(response, payload),
      responseModel: payload?.model ?? payload?.response?.model ?? null,
      responseSha256: sha256(rawBody),
      outputText: outputText.slice(0, 300),
      outputCompliant: outputText === 'BILLING_TEST_OK',
      usage,
      costs
    }
  } catch (error) {
    if (signal?.aborted) throw new Error('测试已取消')
    return {
      status: 'failed',
      startedAt,
      completedAt: new Date().toISOString(),
      httpStatus: response?.status ?? null,
      error: safeErrorMessage(error)
    }
  }
}

function totalInputTokens(usage) {
  return usage.inputTokens + usage.cachedInputTokens + usage.cacheCreationTokens
}

function summarizeScenario(definition, calls, pricing) {
  const successfulCalls = calls.filter((call) => call.status === 'success')
  const usage = mergeUsage(successfulCalls.map((call) => call.usage))
  const costs = calculateStandardCost(usage, pricing)
  const inputByStep = successfulCalls.map((call) => totalInputTokens(call.usage))
  const firstInputTokens = inputByStep[0] ?? 0
  const lastInputTokens = inputByStep.at(-1) ?? 0
  const cacheReadShare = usage.cacheReadMetricsReported && totalInputTokens(usage) > 0
    ? usage.cachedInputTokens / totalInputTokens(usage)
    : null
  return {
    id: definition.id,
    name: definition.name,
    requestedCalls: calls.length,
    successfulCalls: successfulCalls.length,
    failedCalls: calls.length - successfulCalls.length,
    compliantCalls: successfulCalls.filter((call) => call.outputCompliant).length,
    usage,
    costs,
    cacheReadShare,
    averageInputTokens: successfulCalls.length > 0 ? totalInputTokens(usage) / successfulCalls.length : 0,
    inputGrowthTokens: lastInputTokens - firstInputTokens,
    inputByStep
  }
}

function buildScenarioDefinitions(input, fixture, testId) {
  const rounds = input.settings.rounds
  const definitions = [
    {
      id: 'single_turn',
      name: '单轮稳定性',
      messages: (step) => buildRoundMessages(
        fixture,
        `${testId}-single-${String(step).padStart(2, '0')}`
      )
    }
  ]
  if (input.settings.testSuite === 'professional') {
    definitions.push(
      {
        id: 'multi_turn',
        name: '多轮上下文',
        messages: (step) => buildMultiTurnMessages(fixture, `${testId}-conversation`, step)
      },
      {
        id: 'cache_reuse',
        name: '缓存复用',
        messages: () => buildCacheReuseMessages(fixture, testId)
      }
    )
  }
  return definitions.map((definition) => ({
    ...definition,
    steps: Array.from({ length: rounds }, (_, index) => index + 1)
  }))
}

function summarizeProvider(provider, calls, pricing, scenarioDefinitions) {
  const successfulCalls = calls.filter((call) => call.status === 'success')
  const usage = mergeUsage(successfulCalls.map((call) => call.usage))
  const costs = calculateStandardCost(usage, pricing)
  return {
    id: provider.id,
    name: provider.name,
    endpoint: provider.endpoint,
    model: provider.model,
    advertisedMultiplier: provider.advertisedMultiplier,
    status:
      successfulCalls.length === calls.length
        ? 'success'
        : successfulCalls.length > 0
          ? 'partial'
          : 'failed',
    requestedCalls: calls.length,
    successfulCalls: successfulCalls.length,
    failedCalls: calls.length - successfulCalls.length,
    compliantCalls: successfulCalls.filter((call) => call.outputCompliant).length,
    usage,
    costs,
    advertisedExpectedCost: costs.standardCost * provider.advertisedMultiplier,
    scenarios: scenarioDefinitions.map((definition) =>
      summarizeScenario(
        definition,
        calls.filter((call) => call.scenarioId === definition.id),
        pricing
      )
    ),
    calls
  }
}

export async function runBenchmark(rawInput, options = {}) {
  const input = normalizeBenchmarkRequest(rawInput)
  const pricing = normalizePricing(input.pricing)
  const fetchImpl = options.fetchImpl ?? fetch
  const signal = options.signal
  const testId = options.testId ?? randomUUID()
  const fixture = buildFixture(input.settings.fixtureLines, input.settings.fixtureText)
  const startedAt = new Date().toISOString()
  const providerCalls = new Map(input.providers.map((provider) => [provider.id, []]))
  const rounds = []
  const scenarioDefinitions = buildScenarioDefinitions(input, fixture, testId)
  const totalRequests = scenarioDefinitions.reduce(
    (total, scenario) => total + scenario.steps.length * input.providers.length,
    0
  )
  let completedRequests = 0
  let executionSequence = 0

  const emitProgress = async (event) => {
    if (!options.onProgress) return
    await options.onProgress({ testId, totalRequests, completedRequests, ...event })
  }

  await emitProgress({
    type: 'benchmark_started',
    scenarios: scenarioDefinitions.map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      totalRequests: scenario.steps.length * input.providers.length
    }))
  })

  for (const scenario of scenarioDefinitions) {
    for (const step of scenario.steps) {
      const executionMarker = `${testId}-${scenario.id}-${String(step).padStart(2, '0')}`
      const semanticBody = {
        model: input.canonicalModel,
        messages: scenario.messages(step),
        max_completion_tokens: input.settings.maxOutputTokens,
        stream: false
      }
      const semanticRequestSha256 = sha256(semanticBody)
      const order = executionSequence % 2 === 0 ? input.providers : [...input.providers].reverse()
      const callResults = []

      for (const provider of order) {
        signal?.throwIfAborted()
        await emitProgress({
          type: 'request_started',
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          step,
          totalSteps: scenario.steps.length,
          providerId: provider.id,
          providerName: provider.name
        })
        const requestBody = { ...semanticBody, model: provider.model }
        const result = await executeProviderRequest(provider, requestBody, pricing, fetchImpl, signal)
        const recorded = {
          providerId: provider.id,
          providerName: provider.name,
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          step,
          round: step,
          semanticRequestSha256,
          actualRequestSha256: sha256(requestBody),
          ...result
        }
        providerCalls.get(provider.id).push(recorded)
        callResults.push(recorded)
        completedRequests += 1
        await emitProgress({
          type: 'request_completed',
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          step,
          totalSteps: scenario.steps.length,
          providerId: provider.id,
          providerName: provider.name,
          status: result.status
        })
      }
      rounds.push({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        step,
        round: step,
        executionMarker,
        semanticRequestSha256,
        calls: callResults
      })
      executionSequence += 1
    }
  }

  const providers = input.providers.map((provider) =>
    summarizeProvider(provider, providerCalls.get(provider.id), pricing, scenarioDefinitions)
  )
  const completedAt = new Date().toISOString()
  const { fixtureText: _fixtureText, ...manifestSettings } = input.settings
  const manifest = {
    version: 'relay-billing-verifier-manifest-v1',
    testId,
    canonicalModel: input.canonicalModel,
    fixture: {
      version: fixture.version,
      source: fixture.source,
      lineCount: fixture.lineCount,
      characterCount: fixture.characterCount,
      sha256: fixture.sha256
    },
    pricing,
    settings: manifestSettings,
    scenarios: scenarioDefinitions.map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      steps: scenario.steps.length
    })),
    providers: input.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      endpoint: provider.endpoint,
      model: provider.model,
      advertisedMultiplier: provider.advertisedMultiplier
    }))
  }

  const result = {
    version: APP_VERSION,
    testId,
    startedAt,
    completedAt,
    manifest,
    manifestSha256: sha256(manifest),
    rounds,
    providers,
    readyForBalanceVerification: providers.every(
      (provider) => provider.status === 'success' && provider.successfulCalls === executionSequence
    )
  }
  await emitProgress({ type: 'benchmark_completed' })
  return result
}
