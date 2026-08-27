import { APP_NAME, APP_VERSION } from '../src/lib/meta.mjs'
import { requireMethod, sendJson } from '../src/lib/vercel-http.mjs'

export default function handler(request, response) {
  if (!requireMethod(request, response, 'GET')) return
  sendJson(response, 200, { status: 'ok', name: APP_NAME, version: APP_VERSION })
}
