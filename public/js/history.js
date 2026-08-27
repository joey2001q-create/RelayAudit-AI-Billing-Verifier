const HISTORY_KEY = 'relayaudit.history.v1'
export const HISTORY_LIMIT = 20

function availableStorage(storage) {
  return storage ?? globalThis.localStorage
}

function validNumber(value) {
  return Number.isFinite(value) ? value : null
}

function normalizeProvider(provider) {
  if (!provider || typeof provider.id !== 'string') return null
  return {
    id: provider.id,
    name: typeof provider.name === 'string' ? provider.name : '未命名平台',
    model: typeof provider.model === 'string' ? provider.model : '未知模型',
    status: typeof provider.status === 'string' ? provider.status : 'partial',
    requestedCalls: validNumber(provider.requestedCalls) ?? 0,
    successfulCalls: validNumber(provider.successfulCalls) ?? 0,
    totalInputTokens: validNumber(provider.totalInputTokens) ?? 0,
    outputTokens: validNumber(provider.outputTokens) ?? 0,
    cacheReadShare: validNumber(provider.cacheReadShare),
    advertisedExpectedCost: validNumber(provider.advertisedExpectedCost),
    actualDeduction: validNumber(provider.actualDeduction),
    advertisedMultiplier: validNumber(provider.advertisedMultiplier) ?? 1,
    conclusion: typeof provider.conclusion === 'string' ? provider.conclusion : null
  }
}

function normalizeRecord(item) {
  if (!item || typeof item.testId !== 'string' || typeof item.completedAt !== 'string' || !Array.isArray(item.providers)) return null
  const providers = item.providers.map(normalizeProvider).filter(Boolean)
  if (providers.length === 0) return null
  return {
    version: 1,
    testId: item.testId,
    startedAt: typeof item.startedAt === 'string' ? item.startedAt : null,
    completedAt: item.completedAt,
    providers
  }
}

export function buildHistoryRecord(benchmark, verification) {
  return {
    version: 1,
    testId: benchmark.testId,
    startedAt: benchmark.startedAt,
    completedAt: benchmark.completedAt,
    providers: benchmark.providers.map((provider) => {
      const result = verification.providers.find((item) => item.id === provider.id)
      const totalInputTokens = provider.usage.inputTokens + provider.usage.cachedInputTokens + provider.usage.cacheCreationTokens
      const cacheReadShare = provider.usage.cacheReadMetricsReported && totalInputTokens > 0
        ? provider.usage.cachedInputTokens / totalInputTokens
        : null
      return {
        id: provider.id,
        name: provider.name,
        model: provider.model,
        status: provider.status,
        requestedCalls: provider.requestedCalls,
        successfulCalls: provider.successfulCalls,
        totalInputTokens,
        outputTokens: provider.usage.outputTokens,
        cacheReadShare,
        advertisedExpectedCost: result?.advertisedExpectedCost ?? null,
        actualDeduction: result?.actualDeduction ?? null,
        advertisedMultiplier: result?.advertisedMultiplier ?? 1,
        conclusion: result?.conclusion ?? null
      }
    })
  }
}

export function readHistory(storage) {
  try {
    const parsed = JSON.parse(availableStorage(storage).getItem(HISTORY_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeRecord).filter(Boolean).slice(0, HISTORY_LIMIT)
  } catch {
    return []
  }
}

export function saveHistoryRecord(record, storage) {
  const target = availableStorage(storage)
  const next = [record, ...readHistory(target).filter((item) => item.testId !== record.testId)]
    .slice(0, HISTORY_LIMIT)
  try {
    target.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch {
    return readHistory(target)
  }
  return next
}

export function clearHistory(storage) {
  try {
    availableStorage(storage).removeItem(HISTORY_KEY)
  } catch {
    return false
  }
  return true
}
