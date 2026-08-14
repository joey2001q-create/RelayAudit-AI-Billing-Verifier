import test from 'node:test'
import assert from 'node:assert/strict'
import { MODEL_PRESETS } from '../public/js/presets.js'

test('5.6 模型预设包含模型名和四项价格', () => {
  assert.deepEqual(Object.keys(MODEL_PRESETS), ['sol', 'terra', 'luna'])
  assert.deepEqual(MODEL_PRESETS.sol, {
    model: 'gpt-5.6-sol',
    input: 5,
    cached: 0.5,
    cacheCreate: 6.25,
    output: 30
  })
})
