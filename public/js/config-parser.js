const KEY_NAMES = {
  baseUrl: new Set(['baseurl', 'apibase', 'endpoint', 'url']),
  apiKey: new Set(['apikey', 'token', 'accesstoken']),
  model: new Set(['model', 'modelname'])
}

function normalizedKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findObjectValue(value, names, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 4) return null
  for (const [key, item] of Object.entries(value)) {
    if (names.has(normalizedKey(key)) && typeof item === 'string' && item.trim()) return item.trim()
  }
  for (const item of Object.values(value)) {
    const found = findObjectValue(item, names, depth + 1)
    if (found) return found
  }
  return null
}

function parseJson(source) {
  try {
    const value = JSON.parse(source)
    return {
      baseUrl: findObjectValue(value, KEY_NAMES.baseUrl),
      apiKey: findObjectValue(value, KEY_NAMES.apiKey),
      model: findObjectValue(value, KEY_NAMES.model)
    }
  } catch {
    return null
  }
}

function cleanShellValue(value) {
  return value?.trim().replace(/^['"]|['"\\,;]+$/g, '') || null
}

export function parseProviderConfig(text) {
  const source = String(text ?? '').trim()
  if (!source) throw new Error('请先粘贴配置内容')

  const json = parseJson(source)
  if (json?.baseUrl || json?.apiKey || json?.model) return json

  const urlMatch = source.match(/https?:\/\/[^\s'"\\]+/i)
  const bearerMatch = source.match(/(?:authorization\s*:\s*bearer|bearer)\s+([^\s'"\\]+)/i)
  const apiKeyMatch = source.match(/(?:x-api-key|api[_ -]?key)\s*[:=]\s*['"]?([^\s'"\\,}]+)/i)
  const modelMatch = source.match(/["']model["']\s*:\s*["']([^"']+)["']/i)
  const modelFlagMatch = source.match(/--model(?:=|\s+)['"]?([^\s'"]+)/i)

  const result = {
    baseUrl: cleanShellValue(urlMatch?.[0]),
    apiKey: cleanShellValue(bearerMatch?.[1] ?? apiKeyMatch?.[1]),
    model: cleanShellValue(modelMatch?.[1] ?? modelFlagMatch?.[1])
  }

  const lines = source.split(/\r?\n/).map((line) => cleanShellValue(line)).filter(Boolean)
  if (!result.baseUrl && lines[0]?.match(/^https?:\/\//i)) result.baseUrl = lines[0]
  if (!result.apiKey && result.baseUrl === lines[0] && lines.length >= 2) result.apiKey = lines[1]
  if (!result.model && result.baseUrl === lines[0] && lines.length >= 3) result.model = lines[2]

  if (!result.baseUrl && !result.apiKey && !result.model) {
    throw new Error('没有识别到 Base URL、API Key 或模型')
  }
  return result
}
