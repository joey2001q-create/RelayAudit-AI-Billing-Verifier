const maxRequestBytes = 1_000_000

export function applyApiHeaders(response, contentType = 'application/json; charset=utf-8') {
  response.setHeader('Content-Type', contentType)
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Referrer-Policy', 'no-referrer')
}

export function sendJson(response, status, payload) {
  applyApiHeaders(response)
  response.statusCode = status
  response.end(JSON.stringify(payload))
}

export function requireMethod(request, response, method) {
  if (request.method === method) return true
  response.setHeader('Allow', method)
  sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
  return false
}

export async function readJsonBody(request) {
  if (request.body !== undefined) {
    const body = Buffer.isBuffer(request.body) ? request.body.toString('utf8') : request.body
    const source = typeof body === 'string' ? body : JSON.stringify(body)
    if (Buffer.byteLength(source, 'utf8') > maxRequestBytes) throw new Error('请求内容过大')
    try {
      return typeof body === 'string' ? JSON.parse(body) : body
    } catch {
      throw new Error('请求 JSON 格式无效')
    }
  }

  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxRequestBytes) throw new Error('请求内容过大')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('请求 JSON 格式无效')
  }
}

export function sendRequestError(response, error) {
  sendJson(response, 400, {
    error: 'REQUEST_FAILED',
    message: error instanceof Error ? error.message : '请求失败'
  })
}

export function writeNdjson(response, payload) {
  if (!response.destroyed && !response.writableEnded) {
    response.write(`${JSON.stringify(payload)}\n`)
  }
}
