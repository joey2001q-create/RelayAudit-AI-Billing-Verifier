import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_NAME, APP_VERSION } from './lib/meta.mjs'
import {
  loadPricingSnapshot,
  pricingEvidence,
  PricingCatalogService
} from './lib/pricing-catalog.mjs'
import { runBenchmark } from './lib/runner.mjs'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const publicDir = join(rootDir, 'public')
const port = Number(process.env.PORT) || 4312
const host = '127.0.0.1'
const maxRequestBytes = 1_000_000
const pricingCatalog = new PricingCatalogService(await loadPricingSnapshot())
void pricingCatalog.refresh()

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.woff2', 'font/woff2']
])

function securityHeaders(contentType) {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'"
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, securityHeaders('application/json; charset=utf-8'))
  response.end(JSON.stringify(payload))
}

function writeNdjson(response, payload) {
  if (!response.destroyed && !response.writableEnded) {
    response.write(`${JSON.stringify(payload)}\n`)
  }
}

async function readJsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxRequestBytes) throw new Error('请求内容过大')
    chunks.push(chunk)
  }
  const source = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(source)
  } catch {
    throw new Error('请求 JSON 格式无效')
  }
}

async function serveStatic(requestPath, response) {
  if (requestPath === '/vendor/lucide.js') {
    const vendorPath = join(rootDir, 'node_modules/lucide/dist/umd/lucide.js')
    const content = await readFile(vendorPath)
    response.writeHead(200, securityHeaders('text/javascript; charset=utf-8'))
    response.end(content)
    return
  }
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '')
  const safePath = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '')
  const filePath = join(publicDir, safePath)
  const content = await readFile(filePath)
  response.writeHead(200, securityHeaders(mimeTypes.get(extname(filePath)) ?? 'application/octet-stream'))
  response.end(content)
}

async function streamBenchmark(request, response) {
  const input = await readJsonBody(request)
  const evidence = pricingEvidence(pricingCatalog.current(), input.canonicalModel, input.pricing)
  const abortController = new AbortController()
  response.on('close', () => {
    if (!response.writableEnded) abortController.abort()
  })
  response.writeHead(200, securityHeaders('application/x-ndjson; charset=utf-8'))
  try {
    const result = await runBenchmark(input, {
      signal: abortController.signal,
      pricingEvidence: evidence,
      onProgress: (event) => writeNdjson(response, event)
    })
    writeNdjson(response, { type: 'result', result })
  } catch (error) {
    writeNdjson(response, {
      type: 'error',
      message: error instanceof Error ? error.message : '请求失败'
    })
  } finally {
    if (!response.destroyed && !response.writableEnded) response.end()
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`)
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, { status: 'ok', name: APP_NAME, version: APP_VERSION })
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/model-pricing') {
      if (url.searchParams.get('refresh') === '1') await pricingCatalog.refresh()
      sendJson(response, 200, pricingCatalog.current())
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/benchmark') {
      const input = await readJsonBody(request)
      const evidence = pricingEvidence(pricingCatalog.current(), input.canonicalModel, input.pricing)
      const result = await runBenchmark(input, { pricingEvidence: evidence })
      sendJson(response, 200, result)
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/benchmark/stream') {
      await streamBenchmark(request, response)
      return
    }
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
      return
    }
    await serveStatic(url.pathname, response)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      sendJson(response, 404, { error: 'NOT_FOUND' })
      return
    }
    sendJson(response, 400, {
      error: 'REQUEST_FAILED',
      message: error instanceof Error ? error.message : '请求失败'
    })
  }
})

server.listen(port, host, () => {
  console.log(`${APP_NAME}: http://${host}:${port}`)
})
