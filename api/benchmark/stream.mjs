import { pricingEvidence } from '../../src/lib/pricing-catalog.mjs'
import { pricingCatalog } from '../../src/lib/pricing-runtime.mjs'
import { runBenchmark } from '../../src/lib/runner.mjs'
import {
  applyApiHeaders,
  readJsonBody,
  requireMethod,
  sendRequestError,
  writeNdjson
} from '../../src/lib/vercel-http.mjs'

export default async function handler(request, response) {
  if (!requireMethod(request, response, 'POST')) return

  let input
  try {
    input = await readJsonBody(request)
  } catch (error) {
    sendRequestError(response, error)
    return
  }

  const abortController = new AbortController()
  request.on?.('aborted', () => abortController.abort())
  applyApiHeaders(response, 'application/x-ndjson; charset=utf-8')
  response.statusCode = 200
  response.flushHeaders?.()

  try {
    const evidence = pricingEvidence(pricingCatalog.current(), input.canonicalModel, input.pricing)
    const result = await runBenchmark(input, {
      signal: abortController.signal,
      pricingEvidence: evidence,
      executionMode: 'hosted_vercel',
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
