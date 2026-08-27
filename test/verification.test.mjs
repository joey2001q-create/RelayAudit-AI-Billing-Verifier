import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyProvider } from '../public/js/verification.js'

const provider = {
  id: 'a',
  name: '测试平台',
  status: 'success',
  costs: { standardCost: 0.1 }
}

function approximatelyEqual(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-12)
}

test('第三步倍率决定标称应扣金额', () => {
  const result = verifyProvider(provider, 0.08, 0.8)
  approximatelyEqual(result.advertisedExpectedCost, 0.08)
  approximatelyEqual(result.effectiveMultiplier, 0.8)
  approximatelyEqual(result.differenceRate, 0)
  assert.equal(result.conclusion, '与标称倍率一致')
})

test('账单金额高于第三步填写的标称倍率时给出提示', () => {
  const result = verifyProvider(provider, 0.1, 0.8)
  approximatelyEqual(result.advertisedExpectedCost, 0.08)
  assert.equal(result.conclusion, '高于标称倍率')
})

test('拒绝无效标称倍率', () => {
  const result = verifyProvider(provider, 0.1, 0)
  assert.equal(result.advertisedExpectedCost, null)
  assert.equal(result.conclusion, '标称倍率无效')
})
