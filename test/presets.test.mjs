import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPricingCatalog, MODEL_PRESETS } from '../public/js/presets.js'

test('5.6 模型预设只内置模型名，价格由动态目录填入', () => {
  assert.deepEqual(Object.keys(MODEL_PRESETS), [
    'sol', 'terra', 'luna',
    'claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5',
    'claude-3-opus-20240229', 'claude-3-haiku-20240307',
    'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'
  ])
  assert.deepEqual(MODEL_PRESETS.sol, { model: 'gpt-5.6-sol' })
  assert.deepEqual(MODEL_PRESETS['claude-sonnet-5'], { model: 'claude-sonnet-5' })
  assert.deepEqual(MODEL_PRESETS['gemini-2.5-flash'], { model: 'gemini-2.5-flash' })
  applyPricingCatalog({
    models: {
      'gpt-5.6-sol': { input: 5, cached: 0.5, cacheCreate: 6.25, output: 30 },
      'gpt-5.6-terra': { input: 2, cached: 0.2, cacheCreate: 2.5, output: 12 },
      'gpt-5.6-luna': { input: 0.2, cached: 0.02, cacheCreate: 0.25, output: 1.2 },
      'claude-sonnet-5': { input: 2, cached: 0.2, cacheCreate: 2.5, output: 10 },
      'claude-opus-4-8': { input: 5, cached: 0.5, cacheCreate: 6.25, output: 25 },
      'claude-haiku-4-5': { input: 1, cached: 0.1, cacheCreate: 1.25, output: 5 },
      'claude-3-opus-20240229': { input: 15, cached: 1.5, cacheCreate: 18.75, output: 75 },
      'claude-3-haiku-20240307': { input: 0.25, cached: 0.03, cacheCreate: 0.3, output: 1.25 },
      'gemini-2.5-pro': { input: 1.25, cached: 0.125, cacheCreate: 0, output: 10 },
      'gemini-2.5-flash': { input: 0.3, cached: 0.03, cacheCreate: 0, output: 2.5 },
      'gemini-2.0-flash': { input: 0.1, cached: 0.025, cacheCreate: 0, output: 0.4 }
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
  assert.equal(MODEL_PRESETS['claude-sonnet-5'].output, 10)
  assert.equal(MODEL_PRESETS['gemini-2.5-flash'].output, 2.5)
})
