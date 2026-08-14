import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPricingCatalog, MODEL_PRESETS } from '../public/js/presets.js'

test('5.6 模型预设只内置模型名，价格由动态目录填入', () => {
  assert.deepEqual(Object.keys(MODEL_PRESETS), ['sol', 'terra', 'luna'])
  assert.deepEqual(MODEL_PRESETS.sol, { model: 'gpt-5.6-sol' })
  applyPricingCatalog({
    models: {
      'gpt-5.6-sol': { input: 5, cached: 0.5, cacheCreate: 6.25, output: 30 },
      'gpt-5.6-terra': { input: 2, cached: 0.2, cacheCreate: 2.5, output: 12 },
      'gpt-5.6-luna': { input: 0.2, cached: 0.02, cacheCreate: 0.25, output: 1.2 }
    }
  })
  assert.deepEqual(MODEL_PRESETS.sol, {
    model: 'gpt-5.6-sol',
    input: 5,
    cached: 0.5,
    cacheCreate: 6.25,
    output: 30
  })
  assert.equal(MODEL_PRESETS.luna.output, 1.2)
})
