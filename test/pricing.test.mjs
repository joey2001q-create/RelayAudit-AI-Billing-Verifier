import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateStandardCost } from '../src/lib/pricing.mjs'

test('标准费用按四类 token 独立计价', () => {
  const result = calculateStandardCost(
    { inputTokens: 1_000_000, cachedInputTokens: 2_000_000, cacheCreationTokens: 3_000_000, outputTokens: 4_000_000 },
    { inputPerMillion: 5, cachedInputPerMillion: 0.5, cacheCreationPerMillion: 6.25, outputPerMillion: 30 }
  )
  assert.deepEqual(result, {
    inputCost: 5,
    cachedInputCost: 1,
    cacheCreationCost: 18.75,
    outputCost: 120,
    standardCost: 144.75
  })
})
