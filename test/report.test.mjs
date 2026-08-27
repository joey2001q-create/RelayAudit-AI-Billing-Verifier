import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHtmlReport } from '../public/js/report.js'

function evidence(actualDeduction = null) {
  return {
    generatedAt: '2026-08-16T00:00:00.000Z',
    benchmark: {
      testId: 'test-report-order',
      manifestSha256: 'manifest-sha',
      manifest: {
        executionMode: 'local',
        fixture: { source: 'built_in', lineCount: 200, characterCount: 1000, sha256: 'fixture-sha' },
        pricingSource: { mode: 'snapshot', sha256: 'pricing-sha' }
      },
      providers: [{
        id: 'a',
        status: 'success',
        endpoint: 'https://relay.example/v1/chat/completions',
        model: 'gpt-test',
        successfulCalls: 3,
        requestedCalls: 3,
        usage: {
          inputTokens: 800,
          cachedInputTokens: 200,
          cacheCreationTokens: 0,
          outputTokens: 30,
          cacheReadMetricsReported: true
        },
        scenarios: [{
          id: 'single_turn',
          name: '单轮稳定性',
          successfulCalls: 3,
          requestedCalls: 3,
          usage: { inputTokens: 800, cachedInputTokens: 200, cacheCreationTokens: 0, outputTokens: 30 },
          cacheReadShare: 0.2,
          inputGrowthTokens: 0,
          costs: { standardCost: 0.1 }
        }]
      }],
      rounds: []
    },
    verification: {
      providers: [{
        id: 'a',
        name: '测试平台',
        actualDeduction,
        advertisedExpectedCost: 0.1,
        advertisedMultiplier: 1,
        difference: actualDeduction === null ? null : actualDeduction - 0.1,
        differenceRate: actualDeduction === null ? null : (actualDeduction - 0.1) / 0.1,
        effectiveMultiplier: actualDeduction === null ? null : actualDeduction / 0.1,
        conclusion: actualDeduction === null ? '等待账单金额' : '与标称倍率一致',
        verdict: actualDeduction === null ? '请求已完成。' : '账单金额与标称应扣金额一致。'
      }]
    }
  }
}

test('HTML 报告先展示标称结果，再展示分维度和 Token 汇总', () => {
  const html = buildHtmlReport(evidence())

  assert.ok(html.indexOf('标称应扣金额') < html.indexOf('分维度结果'))
  assert.ok(html.indexOf('分维度结果') < html.indexOf('Token 汇总'))
  assert.doesNotMatch(html, /账单核验结论/)
  assert.doesNotMatch(html, /待填写/)
})

test('填写实际消费后 HTML 报告追加账单核验结论', () => {
  const html = buildHtmlReport(evidence(0.1))

  assert.match(html, /账单核验结论/)
  assert.ok(html.indexOf('Token 汇总') < html.indexOf('账单核验结论'))
  assert.match(html, /实际消费/)
})
