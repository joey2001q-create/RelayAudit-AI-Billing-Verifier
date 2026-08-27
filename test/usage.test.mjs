import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeUsage, normalizeUsage } from '../src/lib/usage.mjs'

test('OpenAI usage 从 prompt_tokens 中扣除 cached tokens', () => {
  assert.deepEqual(
    normalizeUsage({
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 25,
        prompt_tokens_details: { cached_tokens: 600 }
      }
    }),
    {
      inputTokens: 400,
      cachedInputTokens: 600,
      cacheCreationTokens: 0,
      outputTokens: 25,
      totalTokens: 1025,
      providerReportedTotal: 0,
      cacheReadMetricsReported: true
    }
  )
})

test('Anthropic 风格 usage 将 input_tokens 视为普通输入', () => {
  assert.deepEqual(
    normalizeUsage({
      usage: {
        input_tokens: 400,
        output_tokens: 25,
        cache_read_input_tokens: 600,
        cache_creation_input_tokens: 100
      }
    }),
    {
      inputTokens: 400,
      cachedInputTokens: 600,
      cacheCreationTokens: 100,
      outputTokens: 25,
      totalTokens: 1125,
      providerReportedTotal: 0,
      cacheReadMetricsReported: true
    }
  )
})

test('合并 usage 不改变四项分类', () => {
  assert.deepEqual(
    mergeUsage([
      { inputTokens: 2, cachedInputTokens: 3, cacheCreationTokens: 4, outputTokens: 5, totalTokens: 14, cacheReadMetricsReported: false },
      { inputTokens: 7, cachedInputTokens: 11, cacheCreationTokens: 13, outputTokens: 17, totalTokens: 48, cacheReadMetricsReported: true }
    ]),
    { inputTokens: 9, cachedInputTokens: 14, cacheCreationTokens: 17, outputTokens: 22, totalTokens: 62, cacheReadMetricsReported: true }
  )
})
