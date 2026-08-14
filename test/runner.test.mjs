import test from 'node:test'
import assert from 'node:assert/strict'
import { runBenchmark } from '../src/lib/runner.mjs'

function input(rounds = 2) {
  return {
    canonicalModel: 'same-model',
    pricing: {
      inputPerMillion: 5,
      cachedInputPerMillion: 0.5,
      cacheCreationPerMillion: 6.25,
      outputPerMillion: 30
    },
    settings: { rounds, fixtureLines: 20, maxOutputTokens: 16 },
    providers: [
      { name: 'A', baseUrl: 'https://a.example/v1', apiKey: 'secret-a', model: 'alias-a' },
      { name: 'B', baseUrl: 'https://b.example/v1', apiKey: 'secret-b', model: 'alias-b' }
    ]
  }
}

test('双平台使用相同语义请求且只各执行一次', async () => {
  const requests = []
  const fetchImpl = async (url, options) => {
    requests.push({
      url,
      body: JSON.parse(options.body),
      authorization: options.headers.Authorization,
      userAgent: options.headers['User-Agent']
    })
    return new Response(JSON.stringify({
      id: `req-${requests.length}`,
      model: 'upstream-model',
      choices: [{ message: { content: 'BILLING_TEST_OK' } }],
      usage: { prompt_tokens: 100, completion_tokens: 4, prompt_tokens_details: { cached_tokens: 20 } }
    }), { status: 200, headers: { 'x-request-id': `header-${requests.length}` } })
  }

  const result = await runBenchmark(input(2), {
    fetchImpl,
    testId: 'fixed-test',
    pricingEvidence: { mode: 'remote', sha256: 'verified-price-hash', model: 'same-model' }
  })
  assert.equal(requests.length, 4)
  assert.deepEqual(requests.map((item) => new URL(item.url).host), ['a.example', 'b.example', 'b.example', 'a.example'])
  assert.deepEqual(requests.map((item) => item.authorization), ['Bearer secret-a', 'Bearer secret-b', 'Bearer secret-b', 'Bearer secret-a'])
  assert.equal(requests.every((item) => item.userAgent === 'RelayAudit/0.1.0'), true)
  assert.deepEqual(requests[0].body.messages, requests[1].body.messages)
  assert.deepEqual(requests[2].body.messages, requests[3].body.messages)
  assert.equal(result.rounds[0].calls[0].semanticRequestSha256, result.rounds[0].calls[1].semanticRequestSha256)
  assert.equal(result.rounds[1].calls[0].semanticRequestSha256, result.rounds[1].calls[1].semanticRequestSha256)
  assert.equal(result.readyForBalanceVerification, true)
  assert.equal(result.version, '0.1.0')
  assert.equal(result.manifest.pricingSource.sha256, 'verified-price-hash')
  assert.equal(JSON.stringify(result).includes('secret-a'), false)
  assert.equal(result.providers[0].usage.inputTokens, 160)
  assert.equal(result.providers[0].usage.cachedInputTokens, 40)
})

test('失败请求被记录且不会自动重试', async () => {
  let calls = 0
  const fetchImpl = async (url) => {
    calls += 1
    if (new URL(url).host === 'a.example') {
      return new Response(JSON.stringify({ error: { message: 'upstream failed' } }), { status: 500 })
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'BILLING_TEST_OK' } }],
      usage: { prompt_tokens: 10, completion_tokens: 2 }
    }), { status: 200 })
  }
  const result = await runBenchmark(input(1), { fetchImpl, testId: 'failure-test' })
  assert.equal(calls, 2)
  assert.equal(result.providers[0].failedCalls, 1)
  assert.equal(result.readyForBalanceVerification, false)
})

test('单平台模式每轮只发送一次请求', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return new Response(JSON.stringify({
      id: `single-${calls}`,
      choices: [{ message: { content: 'BILLING_TEST_OK' } }],
      usage: { prompt_tokens: 100, completion_tokens: 4 }
    }), { status: 200 })
  }
  const singleInput = input(3)
  singleInput.providers = singleInput.providers.slice(0, 1)
  const result = await runBenchmark(singleInput, { fetchImpl, testId: 'single-test' })
  assert.equal(calls, 3)
  assert.equal(result.providers.length, 1)
  assert.equal(result.rounds.every((round) => round.calls.length === 1), true)
  assert.equal(result.readyForBalanceVerification, true)
})

test('专业核验执行单轮、多轮和缓存复用三个维度', async () => {
  const requests = []
  const fetchImpl = async (url, options) => {
    requests.push(JSON.parse(options.body))
    return new Response(JSON.stringify({
      id: `professional-${requests.length}`,
      choices: [{ message: { content: 'BILLING_TEST_OK' } }],
      usage: { prompt_tokens: 100, completion_tokens: 4, prompt_tokens_details: { cached_tokens: 50 } }
    }), { status: 200 })
  }
  const professionalInput = input(3)
  professionalInput.providers = professionalInput.providers.slice(0, 1)
  professionalInput.settings.testSuite = 'professional'
  const result = await runBenchmark(professionalInput, { fetchImpl, testId: 'professional-test' })

  assert.equal(requests.length, 9)
  assert.deepEqual(result.providers[0].scenarios.map((scenario) => scenario.id), [
    'single_turn',
    'multi_turn',
    'cache_reuse'
  ])
  assert.deepEqual(requests.slice(3, 6).map((request) => request.messages.length), [2, 4, 6])
  assert.equal(JSON.stringify(requests[6].messages), JSON.stringify(requests[7].messages))
  assert.equal(JSON.stringify(requests[7].messages), JSON.stringify(requests[8].messages))
  assert.equal(result.rounds.filter((round) => round.scenarioId === 'cache_reuse').length, 3)
  assert.equal(result.providers[0].scenarios[2].cacheReadShare, 0.5)
  assert.equal(JSON.stringify(result).includes('durationMs'), false)
  assert.equal(result.readyForBalanceVerification, true)
})

test('进度事件覆盖每次请求且完成数准确', async () => {
  const events = []
  const singleInput = input(2)
  singleInput.providers = singleInput.providers.slice(0, 1)
  const result = await runBenchmark(singleInput, {
    testId: 'progress-test',
    onProgress: (event) => events.push(event),
    fetchImpl: async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'BILLING_TEST_OK' } }],
      usage: { prompt_tokens: 100, completion_tokens: 4 }
    }), { status: 200 })
  })

  assert.equal(events[0].type, 'benchmark_started')
  assert.equal(events[0].totalRequests, 2)
  assert.deepEqual(
    events.filter((event) => event.type === 'request_completed').map((event) => event.completedRequests),
    [1, 2]
  )
  assert.equal(events.at(-1).type, 'benchmark_completed')
  assert.equal(events.at(-1).completedRequests, 2)
  assert.equal(result.providers[0].successfulCalls, 2)
})

test('自定义语料进入请求但不进入返回证据', async () => {
  const requests = []
  const customInput = input(1)
  customInput.providers = customInput.providers.slice(0, 1)
  customInput.settings.fixtureText = 'PRIVATE_FIXTURE_ALPHA\nPRIVATE_FIXTURE_BETA'
  const result = await runBenchmark(customInput, {
    testId: 'custom-fixture-test',
    fetchImpl: async (url, options) => {
      requests.push(JSON.parse(options.body))
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'BILLING_TEST_OK' } }],
        usage: { prompt_tokens: 100, completion_tokens: 4 }
      }), { status: 200 })
    }
  })

  assert.equal(requests[0].messages[1].content.includes('PRIVATE_FIXTURE_ALPHA'), true)
  assert.equal(result.manifest.fixture.source, 'custom')
  assert.equal(result.manifest.fixture.lineCount, 2)
  assert.equal(result.manifest.fixture.characterCount, 42)
  assert.equal(JSON.stringify(result).includes('PRIVATE_FIXTURE_ALPHA'), false)
})
