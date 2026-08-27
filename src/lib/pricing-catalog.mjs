import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { sha256 } from './hash.mjs'

export const PRICING_REPOSITORY = 'https://github.com/Wei-Shaw/model-price-repo'
export const PRICING_REMOTE_URL = `${PRICING_REPOSITORY.replace('github.com', 'raw.githubusercontent.com')}/main/model_prices_and_context_window.json`
export const PRICING_HASH_URL = `${PRICING_REPOSITORY.replace('github.com', 'raw.githubusercontent.com')}/main/model_prices_and_context_window.sha256`

const defaultSnapshotPath = fileURLToPath(
  new URL('../../data/model-pricing.snapshot.json', import.meta.url)
)
const claudeModelsPath = fileURLToPath(
  new URL('../../data/claude-models.json', import.meta.url)
)
const geminiModelsPath = fileURLToPath(
  new URL('../../data/gemini-models.json', import.meta.url)
)
const supportedModels = [
  'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna',
  'claude-opus-4-8', 'claude-sonnet-5',
  'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'gemini-2.0-flash-exp', 'gemini-1.5-pro',
  'gemini-1.5-flash', 'gemini-1.5-flash-8b'
]
const remoteFields = {
  input: 'input_cost_per_token',
  cached: 'cache_read_input_token_cost',
  cacheCreate: 'cache_creation_input_token_cost',
  output: 'output_cost_per_token'
}

function validPrice(value, label) {
  const price = Number(value)
  if (!Number.isFinite(price) || price < 0) throw new Error(`${label}价格无效`)
  return Number((price * 1_000_000).toPrecision(12))
}

function normalizeModels(rawModels, sourceType) {
  return Object.fromEntries(supportedModels.map((model) => {
    const raw = rawModels?.[model]
    if (!raw || typeof raw !== 'object') throw new Error(`价格源缺少 ${model}`)
    if (sourceType === 'snapshot') {
      return [model, {
        model,
        input: validSnapshotPrice(raw.input, `${model} 普通输入`),
        cached: validSnapshotPrice(raw.cached, `${model} 缓存读取`),
        cacheCreate: validSnapshotPrice(raw.cacheCreate, `${model} 缓存创建`),
        output: validSnapshotPrice(raw.output, `${model} 输出`)
      }]
    }
    return [model, {
      model,
      ...Object.fromEntries(Object.entries(remoteFields).map(([name, field]) => [
        name,
        validPrice(raw[field], `${model} ${name}`)
      ]))
    }]
  }))
}

function validSnapshotPrice(value, label) {
  const price = Number(value)
  if (!Number.isFinite(price) || price < 0) throw new Error(`${label}价格无效`)
  return price
}

function expectedHash(source) {
  const match = String(source).trim().match(/^[a-f0-9]{64}/i)
  if (!match) throw new Error('远程价格哈希格式无效')
  return match[0].toLowerCase()
}

export function catalogFromRemoteText(pricingText, hashText, syncedAt = new Date().toISOString()) {
  const hash = expectedHash(hashText)
  if (sha256(pricingText) !== hash) throw new Error('远程价格文件 SHA-256 校验失败')
  let raw
  try {
    raw = JSON.parse(pricingText)
  } catch {
    throw new Error('远程价格文件不是有效 JSON')
  }
  return {
    schemaVersion: 1,
    models: normalizeModels(raw, 'remote'),
    source: {
      mode: 'remote',
      repository: PRICING_REPOSITORY,
      pricingUrl: PRICING_REMOTE_URL,
      hashUrl: PRICING_HASH_URL,
      sha256: hash,
      syncedAt
    }
  }
}

export function catalogFromSnapshot(snapshot) {
  if (snapshot?.schemaVersion !== 1) throw new Error('内置价格快照版本不受支持')
  return {
    schemaVersion: 1,
    models: normalizeModels(snapshot.models, 'snapshot'),
    source: {
      ...snapshot.source,
      mode: 'snapshot',
      repository: PRICING_REPOSITORY,
      pricingUrl: PRICING_REMOTE_URL,
      hashUrl: PRICING_HASH_URL
    }
  }
}

export async function loadPricingSnapshot(snapshotPath = defaultSnapshotPath) {
  const gptSnapshot = JSON.parse(await readFile(snapshotPath, 'utf8'))
  const claudeModels = JSON.parse(await readFile(claudeModelsPath, 'utf8'))
  const geminiModels = JSON.parse(await readFile(geminiModelsPath, 'utf8'))

  const combinedSnapshot = {
    schemaVersion: 1,
    source: gptSnapshot.source,
    models: {
      ...gptSnapshot.models,
      ...claudeModels.models,
      ...geminiModels.models
    }
  }

  return catalogFromSnapshot(combinedSnapshot)
}

export async function fetchRemotePricingCatalog(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch
  const signal = options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 8_000)
  const [pricingResponse, hashResponse] = await Promise.all([
    fetchImpl(options.remoteUrl ?? PRICING_REMOTE_URL, { signal }),
    fetchImpl(options.hashUrl ?? PRICING_HASH_URL, { signal })
  ])
  if (!pricingResponse.ok) throw new Error(`远程价格请求失败（HTTP ${pricingResponse.status}）`)
  if (!hashResponse.ok) throw new Error(`远程价格哈希请求失败（HTTP ${hashResponse.status}）`)
  return catalogFromRemoteText(
    await pricingResponse.text(),
    await hashResponse.text(),
    options.syncedAt ?? new Date().toISOString()
  )
}

function samePrice(left, right) {
  return Number.isFinite(Number(left)) && Math.abs(Number(left) - right) < 1e-12
}

export function pricingEvidence(catalog, canonicalModel, pricing) {
  const expected = catalog.models[canonicalModel]
  const matches = expected &&
    samePrice(pricing?.inputPerMillion, expected.input) &&
    samePrice(pricing?.cachedInputPerMillion, expected.cached) &&
    samePrice(pricing?.cacheCreationPerMillion, expected.cacheCreate) &&
    samePrice(pricing?.outputPerMillion, expected.output)
  if (!matches) return { mode: 'manual', model: String(canonicalModel ?? '') }
  return { ...catalog.source, model: canonicalModel }
}

export class PricingCatalogService {
  constructor(fallbackCatalog, options = {}) {
    this.catalog = fallbackCatalog
    this.fetchOptions = options
    this.refreshPromise = null
  }

  current() {
    return this.catalog
  }

  async refresh() {
    if (this.refreshPromise) return this.refreshPromise
    this.refreshPromise = fetchRemotePricingCatalog(this.fetchOptions)
      .then((catalog) => {
        this.catalog = catalog
        return catalog
      })
      .catch(() => this.catalog)
      .finally(() => { this.refreshPromise = null })
    return this.refreshPromise
  }
}

export function snapshotFromCatalog(catalog) {
  return {
    schemaVersion: 1,
    source: {
      repository: PRICING_REPOSITORY,
      pricingUrl: PRICING_REMOTE_URL,
      hashUrl: PRICING_HASH_URL,
      sha256: catalog.source.sha256,
      syncedAt: catalog.source.syncedAt
    },
    models: catalog.models
  }
}
