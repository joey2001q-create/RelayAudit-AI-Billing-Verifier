async function responseError(response) {
  const payload = await response.json().catch(() => ({}))
  return new Error(payload.message || `本机服务请求失败（HTTP ${response.status}）`)
}

export async function loadModelPricing(options = {}) {
  const path = options.refresh ? '/api/model-pricing?refresh=1' : '/api/model-pricing'
  const response = await fetch(path, {
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) throw await responseError(response)
  return response.json()
}

export async function runBenchmark(payload, options = {}) {
  const response = await fetch('/api/benchmark/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
    body: JSON.stringify(payload),
    signal: options.signal
  })
  if (!response.ok) throw await responseError(response)
  if (!response.body) throw new Error('本机服务未返回可读取的进度流')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null

  const consumeLine = async (line) => {
    if (!line.trim()) return
    let event
    try {
      event = JSON.parse(line)
    } catch {
      throw new Error('本机服务返回了无效的进度数据')
    }
    if (event.type === 'error') throw new Error(event.message || '计费测试失败')
    if (event.type === 'result') {
      result = event.result
      return
    }
    await options.onProgress?.(event)
  }

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) await consumeLine(line)
    if (done) break
  }
  await consumeLine(buffer)
  if (!result) throw new Error('计费测试结束，但没有收到完整结果')
  return result
}
