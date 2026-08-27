import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPricingCatalog, MODEL_PRESETS } from '../public/js/presets.js'

test('5.6 模型预设只内置模型名，价格由动态目录填入', () => {
  assert.deepEqual(Object.keys(MODEL_PRESETS), [
    'sol', 'terra', 'luna',
    'claude-opus-4-8', 'claude-sonnet-5',
    'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'gemini-2.0-flash-exp', 'gemini-1.5-pro',
    'gemini-1.5-flash', 'gemini-1.5-flash-8b'
  ])
  assert.deepEqual(MODEL_PRESETS.sol, { model: 'gpt-5.6-sol' })
  assert.deepEqual(MODEL_PRESETS['claude-sonnet-5'], { model: 'claude-sonnet-5' })
  assert.deepEqual(MODEL_PRESETS['gemini-1.5-flash'], { model: 'gemini-1.5-flash' })
  applyPricingCatalog({
    models: {
      'gpt-5.6-sol': { input: 5, cached: 0.5, cacheCreate: 6.25, output: 30 },
      'gpt-5.6-terra': { input: 2, cached: 0.2, cacheCreate: 2.5, output: 12 },
      'gpt-5.6-luna': { input: 0.2, cached: 0.02, cacheCreate: 0.25, output: 1.2 },
      'claude-opus-4-8': { input: 15, cached: 1.5, cacheCreate: 18.75, output: 75 },
      'claude-sonnet-5': { input: 3, cached: 0.3, cacheCreate: 3.75, output: 15 },
      'claude-3-5-sonnet-20241022': { input: 3, cached: 0.3, cacheCreate: 3.75, output: 15 },
      'claude-3-5-haiku-20241022': { input: 0.8, cached: 0.08, cacheCreate: 1.0, output: 4 },
      'claude-3-opus-20240229': { input: 15, cached: 1.5, cacheCreate: 18.75, output: 75 },
      'gemini-2.0-flash-exp': { input: 0, cached: 0, cacheCreate: 0, output: 0 },
      'gemini-1.5-pro': { input: 1.25, cached: 0.3125, cacheCreate: 1.5625, output: 5 },
      'gemini-1.5-flash': { input: 0.075, cached: 0.01875, cacheCreate: 0.09375, output: 0.3 },
      'gemini-1.5-flash-8b': { input: 0.0375, cached: 0.009375, cacheCreate: 0.046875, output: 0.15 }
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
  assert.equal(MODEL_PRESETS['claude-sonnet-5'].output, 15)
  assert.equal(MODEL_PRESETS['gemini-1.5-flash'].output, 0.3)
})
