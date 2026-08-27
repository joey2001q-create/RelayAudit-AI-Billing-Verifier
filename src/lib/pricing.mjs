const MILLION = 1_000_000

function finiteNonNegative(value, field) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${field} 必须是非负数`)
  }
  return numeric
}

export function normalizePricing(input) {
  return {
    inputPerMillion: finiteNonNegative(input?.inputPerMillion, '普通输入单价'),
    cachedInputPerMillion: finiteNonNegative(input?.cachedInputPerMillion, '缓存读取单价'),
    cacheCreationPerMillion: finiteNonNegative(input?.cacheCreationPerMillion ?? 0, '缓存创建单价'),
    outputPerMillion: finiteNonNegative(input?.outputPerMillion, '输出单价'),
    currency: 'CNY_EQUIVALENT'
  }
}

export function calculateStandardCost(usage, pricingInput) {
  const pricing = normalizePricing(pricingInput)
  const inputCost = (usage.inputTokens * pricing.inputPerMillion) / MILLION
  const cachedInputCost = (usage.cachedInputTokens * pricing.cachedInputPerMillion) / MILLION
  const cacheCreationCost = (usage.cacheCreationTokens * pricing.cacheCreationPerMillion) / MILLION
  const outputCost = (usage.outputTokens * pricing.outputPerMillion) / MILLION
  return {
    inputCost,
    cachedInputCost,
    cacheCreationCost,
    outputCost,
    standardCost: inputCost + cachedInputCost + cacheCreationCost + outputCost
  }
}
