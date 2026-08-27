import { pricingCatalog } from '../src/lib/pricing-runtime.mjs'
import {
  requireMethod,
  sendJson,
  sendRequestError
} from '../src/lib/vercel-http.mjs'

export default async function handler(request, response) {
  if (!requireMethod(request, response, 'GET')) return
  try {
    const url = new URL(request.url ?? '/api/model-pricing', 'https://relayaudit.local')
    if (url.searchParams.get('refresh') === '1') await pricingCatalog.refresh()
    sendJson(response, 200, pricingCatalog.current())
  } catch (error) {
    sendRequestError(response, error)
  }
}
