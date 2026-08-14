import { pricingEvidence } from '../src/lib/pricing-catalog.mjs'
import { pricingCatalog } from '../src/lib/pricing-runtime.mjs'
import { runBenchmark } from '../src/lib/runner.mjs'
import {
  readJsonBody,
  requireMethod,
  sendJson,
  sendRequestError
} from '../src/lib/vercel-http.mjs'

export default async function handler(request, response) {
  if (!requireMethod(request, response, 'POST')) return
  try {
    const input = await readJsonBody(request)
    const evidence = pricingEvidence(pricingCatalog.current(), input.canonicalModel, input.pricing)
    sendJson(response, 200, await runBenchmark(input, {
      pricingEvidence: evidence,
      executionMode: 'hosted_vercel'
    }))
  } catch (error) {
    sendRequestError(response, error)
  }
}
