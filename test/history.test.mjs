import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHistoryRecord, clearHistory, HISTORY_LIMIT, readHistory, saveHistoryRecord } from '../public/js/history.js'

function memoryStorage(initialValue) {
  const values = new Map(initialValue ? [['relayaudit.history.v1', initialValue]] : [])
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  }
}

function record(testId, completedAt = '2026-08-16T08:30:00.000Z') {
  return {
    version: 1,
    testId,
    startedAt: '2026-08-16T08:29:00.000Z',
    completedAt,
    providers: [{
      id: 'a',
      name: '平台 A',
      model: 'gpt-5.6-sol',
      status: 'success',
      requestedCalls: 9,
      successfulCalls: 9,
      totalInputTokens: 31638,
      outputTokens: 81,
      cacheReadShare: 0.267,
      advertisedExpectedCost: 0.122604,
      actualDeduction: null,
      advertisedMultiplier: 1,
      conclusion: null
    }]
  }
}

test('历史记录只保存核验摘要，不保存接口、API Key 或语料', () => {
  const history = buildHistoryRecord({
    testId: 'history-safe',
    startedAt: '2026-08-16T08:29:00.000Z',
    completedAt: '2026-08-16T08:30:00.000Z',
    providers: [{
      id: 'a', name: '平台 A', model: 'gpt-5.6-sol', status: 'success', endpoint: 'https://secret.example/v1',
      requestedCalls: 9, successfulCalls: 9,
      usage: { inputTokens: 20000, cachedInputTokens: 10000, cacheCreationTokens: 1638, outputTokens: 81, cacheReadMetricsReported: true }
    }]
  }, {
    providers: [{ id: 'a', advertisedExpectedCost: 0.122604, actualDeduction: 0.1226, advertisedMultiplier: 1, conclusion: '与标称倍率一致' }]
  })

  const serialized = JSON.stringify(history)
  assert.equal(serialized.includes('endpoint'), false)
  assert.equal(serialized.includes('apiKey'), false)
  assert.equal(serialized.includes('fixture'), false)
  assert.equal(history.providers[0].totalInputTokens, 31638)
})

test('同一测试 ID 更新原记录，新的测试排在最前', () => {
  const storage = memoryStorage()
  saveHistoryRecord(record('first'), storage)
  saveHistoryRecord(record('second'), storage)
  const updated = record('first')
  updated.providers[0].actualDeduction = 0.1226
  saveHistoryRecord(updated, storage)

  const history = readHistory(storage)
  assert.deepEqual(history.map((item) => item.testId), ['first', 'second'])
  assert.equal(history[0].providers[0].actualDeduction, 0.1226)
})

test('最多保留最近 20 次测试', () => {
  const storage = memoryStorage()
  for (let index = 0; index < HISTORY_LIMIT + 3; index += 1) saveHistoryRecord(record(`test-${index}`), storage)
  const history = readHistory(storage)
  assert.equal(history.length, HISTORY_LIMIT)
  assert.equal(history[0].testId, 'test-22')
  assert.equal(history.at(-1).testId, 'test-3')
})

test('损坏或不完整的本地数据不会中断页面', () => {
  assert.deepEqual(readHistory(memoryStorage('{broken')), [])
  const storage = memoryStorage(JSON.stringify([{ testId: 'bad', completedAt: 'now', providers: [{}] }, record('valid')]))
  assert.deepEqual(readHistory(storage).map((item) => item.testId), ['valid'])
})

test('可以清空本机历史记录', () => {
  const storage = memoryStorage()
  saveHistoryRecord(record('first'), storage)
  assert.equal(clearHistory(storage), true)
  assert.deepEqual(readHistory(storage), [])
})
