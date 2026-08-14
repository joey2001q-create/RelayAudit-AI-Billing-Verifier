function requiredText(value, field, maxLength = 500) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`${field}不能为空`)
  if (text.length > maxLength) throw new Error(`${field}过长`)
  return text
}

function optionalFixtureText(value) {
  const text = String(value ?? '').trim()
  if (text.length > 200_000) throw new Error('自定义测试语料不能超过 200,000 个字符')
  return text
}

export function normalizeEndpoint(baseUrl) {
  const source = requiredText(baseUrl, 'Base URL', 1000)
  let url
  try {
    url = new URL(source)
  } catch {
    throw new Error('Base URL 格式无效')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Base URL 只允许 HTTP 或 HTTPS')
  }
  url.hash = ''
  url.search = ''
  let path = url.pathname.replace(/\/+$/, '')
  if (path.endsWith('/chat/completions')) {
    url.pathname = path
  } else if (path.endsWith('/v1')) {
    url.pathname = `${path}/chat/completions`
  } else {
    url.pathname = `${path}/v1/chat/completions`.replace(/\/+/g, '/')
  }
  return url.toString()
}

export function normalizeProvider(provider, index) {
  const label = index === 0 ? '平台 A' : '平台 B'
  return {
    id: index === 0 ? 'a' : 'b',
    name: requiredText(provider?.name, `${label}名称`, 80),
    endpoint: normalizeEndpoint(provider?.baseUrl),
    apiKey: requiredText(provider?.apiKey, `${label} API Key`, 2000),
    model: requiredText(provider?.model, `${label}模型`, 200)
  }
}

export function normalizeBenchmarkRequest(input) {
  if (!Array.isArray(input?.providers) || ![1, 2].includes(input.providers.length)) {
    throw new Error('必须配置一个或两个中转站')
  }
  const providers = input.providers.map(normalizeProvider)
  const rounds = Math.min(Math.max(Number(input?.settings?.rounds) || 3, 1), 20)
  const fixtureLines = Math.min(Math.max(Number(input?.settings?.fixtureLines) || 200, 20), 2000)
  const maxOutputTokens = Math.min(Math.max(Number(input?.settings?.maxOutputTokens) || 16, 8), 128)
  const testSuite = input?.settings?.testSuite === 'professional' ? 'professional' : 'standard'
  const fixtureText = optionalFixtureText(input?.settings?.fixtureText)
  return {
    providers,
    pricing: input.pricing,
    settings: { rounds, fixtureLines, maxOutputTokens, testSuite, fixtureText },
    canonicalModel: requiredText(input?.canonicalModel, '语义模型标识', 200)
  }
}
