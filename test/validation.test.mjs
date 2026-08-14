import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeBenchmarkRequest, normalizeEndpoint } from '../src/lib/validation.mjs'

test('Base URL 自动补齐 chat completions 路径', () => {
  assert.equal(normalizeEndpoint('https://relay.example'), 'https://relay.example/v1/chat/completions')
  assert.equal(normalizeEndpoint('https://relay.example/v1/'), 'https://relay.example/v1/chat/completions')
  assert.equal(normalizeEndpoint('https://relay.example/openai/v1'), 'https://relay.example/openai/v1/chat/completions')
  assert.equal(normalizeEndpoint('https://relay.example/v1/chat/completions'), 'https://relay.example/v1/chat/completions')
})

test('Base URL 拒绝非 HTTP 协议', () => {
  assert.throws(() => normalizeEndpoint('file:///tmp/secret'), /只允许 HTTP 或 HTTPS/)
})

test('核验请求允许一个或两个平台', () => {
  const provider = {
    name: '单平台',
    baseUrl: 'https://relay.example/v1',
    apiKey: 'secret',
    model: 'model'
  }
  const base = {
    canonicalModel: 'model',
    pricing: {},
    settings: {},
    providers: [provider]
  }
  assert.equal(normalizeBenchmarkRequest(base).providers.length, 1)
  assert.equal(normalizeBenchmarkRequest({ ...base, providers: [provider, provider] }).providers.length, 2)
  assert.throws(() => normalizeBenchmarkRequest({ ...base, providers: [] }), /一个或两个中转站/)
  assert.equal(normalizeBenchmarkRequest(base).settings.testSuite, 'standard')
  assert.equal(
    normalizeBenchmarkRequest({ ...base, settings: { testSuite: 'professional' } }).settings.testSuite,
    'professional'
  )
  assert.equal(
    normalizeBenchmarkRequest({ ...base, settings: { maxOutputTokens: 64, fixtureText: ' custom fixture ' } }).settings.maxOutputTokens,
    64
  )
  assert.equal(
    normalizeBenchmarkRequest({ ...base, settings: { fixtureText: ' custom fixture ' } }).settings.fixtureText,
    'custom fixture'
  )
  assert.throws(
    () => normalizeBenchmarkRequest({ ...base, settings: { fixtureText: 'x'.repeat(200_001) } }),
    /不能超过 200,000/
  )
})
