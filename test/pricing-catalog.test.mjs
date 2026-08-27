import test from 'node:test'
import assert from 'node:assert/strict'
import { sha256 } from '../src/lib/hash.mjs'
import {
  catalogFromRemoteText,
  loadPricingSnapshot,
  pricingEvidence,
  PricingCatalogService
} from '../src/lib/pricing-catalog.mjs'

function remoteEntry(input, cached, cacheCreate, output) {
  return {
    input_cost_per_token: input,
    cache_read_input_token_cost: cached,
    cache_creation_input_token_cost: cacheCreate,
    output_cost_per_token: output
  }
}

function remoteFixture() {
  return JSON.stringify({
    'gpt-5.6-sol': remoteEntry(0.000005, 0.0000005, 0.00000625, 0.00003),
    'gpt-5.6-terra': remoteEntry(0.000002, 0.0000002, 0.0000025, 0.000012),
    'gpt-5.6-luna': remoteEntry(0.0000002, 0.00000002, 0.00000025, 0.0000012),
    'claude-sonnet-5': remoteEntry(0.000002, 0.0000002, 0.0000025, 0.00001),
    'claude-opus-4-8': remoteEntry(0.000005, 0.0000005, 0.00000625, 0.000025),
    'claude-haiku-4-5': remoteEntry(0.000001, 0.0000001, 0.00000125, 0.000005),
    'claude-3-opus-20240229': remoteEntry(0.000015, 0.0000015, 0.00001875, 0.000075),
    'claude-3-haiku-20240307': remoteEntry(0.00000025, 0.00000003, 0.0000003, 0.00000125),
    'gemini-2.5-pro': remoteEntry(0.00000125, 0.000000125, 0, 0.00001),
    'gemini-2.5-flash': remoteEntry(0.0000003, 0.00000003, 0, 0.0000025),
    'gemini-2.0-flash': remoteEntry(0.0000001, 0.000000025, 0, 0.0000004)
  })
}

test('远程价格文件校验哈希后转换为每百万 Token 价格', () => {
  const source = remoteFixture()
  const catalog = catalogFromRemoteText(source, sha256(source), '2026-08-14T00:00:00.000Z')
  assert.deepEqual(catalog.models['gpt-5.6-terra'], {
    model: 'gpt-5.6-terra',
    input: 2,
    cached: 0.2,
    cacheCreate: 2.5,
    output: 12
  })
  assert.deepEqual(catalog.models['gpt-5.6-luna'], {
    model: 'gpt-5.6-luna',
    input: 0.2,
    cached: 0.02,
    cacheCreate: 0.25,
    output: 1.2
  })
  assert.equal(catalog.source.mode, 'remote')
})

test('远程价格文件与公布哈希不一致时拒绝使用', () => {
  assert.throws(
    () => catalogFromRemoteText(remoteFixture(), '0'.repeat(64)),
    /SHA-256 校验失败/
  )
})

test('内置快照包含三个受支持模型的最近有效价格', async () => {
  const catalog = await loadPricingSnapshot()
  assert.equal(catalog.source.mode, 'snapshot')
  assert.equal(catalog.source.sha256.length, 64)
  assert.deepEqual(Object.keys(catalog.models), [
    'gpt-5.6-sol',
    'gpt-5.6-terra',
    'gpt-5.6-luna',
    'claude-sonnet-5',
    'claude-opus-4-8',
    'claude-haiku-4-5',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash'
  ])
})

test('价格与目录一致时记录来源，不一致时标记为手工价格', async () => {
  const catalog = await loadPricingSnapshot()
  const matched = pricingEvidence(catalog, 'gpt-5.6-sol', {
    inputPerMillion: 5,
    cachedInputPerMillion: 0.5,
    cacheCreationPerMillion: 6.25,
    outputPerMillion: 30
  })
  assert.equal(matched.mode, 'snapshot')
  assert.equal(matched.model, 'gpt-5.6-sol')
  assert.equal(pricingEvidence(catalog, 'gpt-5.6-sol', {
    inputPerMillion: 4,
    cachedInputPerMillion: 0.5,
    cacheCreationPerMillion: 6.25,
    outputPerMillion: 30
  }).mode, 'manual')
})

test('远程价格不可用时继续返回最近有效快照', async () => {
  const fallback = await loadPricingSnapshot()
  const service = new PricingCatalogService(fallback, {
    fetchImpl: async () => { throw new Error('network unavailable') }
  })
  const catalog = await service.refresh()
  assert.equal(catalog.source.mode, 'snapshot')
  assert.equal(catalog.source.sha256, fallback.source.sha256)
})
