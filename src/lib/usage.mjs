function nonNegativeInteger(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) return 0
  return Math.floor(numeric)
}

export function normalizeUsage(payload) {
  const usage = payload?.usage ?? payload?.response?.usage
  if (!usage || typeof usage !== 'object') {
    throw new Error('响应未包含 usage，无法进行价格核验')
  }

  const hasOpenAiInputTotal = usage.prompt_tokens != null
  const reportedInput = nonNegativeInteger(
    usage.prompt_tokens ?? usage.input_tokens ?? usage.input_token_count
  )
  const outputTokens = nonNegativeInteger(
    usage.completion_tokens ?? usage.output_tokens ?? usage.output_token_count
  )
  const inputDetails = usage.prompt_tokens_details ?? usage.input_tokens_details ?? {}
  const cacheReadMetricsReported = [
    inputDetails.cached_tokens,
    usage.cache_read_input_tokens,
    usage.cache_read_tokens,
    usage.cached_tokens
  ].some((value) => value != null)
  const cachedInputTokens = nonNegativeInteger(
    inputDetails.cached_tokens ??
      usage.cache_read_input_tokens ??
      usage.cache_read_tokens ??
      usage.cached_tokens
  )
  const cacheCreationTokens = nonNegativeInteger(
    usage.cache_creation_input_tokens ??
      usage.cache_creation_tokens ??
      inputDetails.cache_creation_tokens
  )
  // OpenAI includes cached reads in prompt_tokens. Anthropic-style input_tokens
  // reports ordinary input separately from cache read/create fields.
  const regularInputTokens = hasOpenAiInputTotal
    ? Math.max(reportedInput - cachedInputTokens, 0)
    : reportedInput

  return {
    inputTokens: regularInputTokens,
    cachedInputTokens,
    cacheCreationTokens,
    outputTokens,
    totalTokens: regularInputTokens + cachedInputTokens + cacheCreationTokens + outputTokens,
    providerReportedTotal: nonNegativeInteger(usage.total_tokens),
    cacheReadMetricsReported
  }
}

export function extractOutputText(payload) {
  const chatContent = payload?.choices?.[0]?.message?.content
  if (typeof chatContent === 'string') return chatContent.trim()
  if (Array.isArray(chatContent)) {
    return chatContent.map((item) => item?.text ?? '').join('').trim()
  }
  if (typeof payload?.output_text === 'string') return payload.output_text.trim()
  return ''
}

export function mergeUsage(items) {
  return items.reduce(
    (total, item) => ({
      inputTokens: total.inputTokens + item.inputTokens,
      cachedInputTokens: total.cachedInputTokens + item.cachedInputTokens,
      cacheCreationTokens: total.cacheCreationTokens + item.cacheCreationTokens,
      outputTokens: total.outputTokens + item.outputTokens,
      totalTokens: total.totalTokens + item.totalTokens,
      cacheReadMetricsReported: total.cacheReadMetricsReported || item.cacheReadMetricsReported === true
    }),
    {
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheCreationTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheReadMetricsReported: false
    }
  )
}
