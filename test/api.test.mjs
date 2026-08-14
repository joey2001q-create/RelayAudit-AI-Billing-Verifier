import test from 'node:test'
import assert from 'node:assert/strict'
import { runBenchmark } from '../public/js/api.js'

test('前端 API 客户端消费进度流并返回最终结果', async () => {
  const originalFetch = globalThis.fetch
  const events = []
  globalThis.fetch = async () => new Response([
    JSON.stringify({ type: 'benchmark_started', totalRequests: 1, completedRequests: 0, scenarios: [] }),
    JSON.stringify({ type: 'request_completed', totalRequests: 1, completedRequests: 1 }),
    JSON.stringify({ type: 'result', result: { testId: 'stream-test' } })
  ].join('\n'), { status: 200, headers: { 'content-type': 'application/x-ndjson' } })

  try {
    const result = await runBenchmark({}, { onProgress: (event) => events.push(event) })
    assert.equal(result.testId, 'stream-test')
    assert.deepEqual(events.map((event) => event.type), ['benchmark_started', 'request_completed'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('前端 API 客户端把进度流错误转换为异常', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(
    `${JSON.stringify({ type: 'error', message: '模拟失败' })}\n`,
    { status: 200, headers: { 'content-type': 'application/x-ndjson' } }
  )
  try {
    await assert.rejects(() => runBenchmark({}), /模拟失败/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
