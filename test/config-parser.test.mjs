import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProviderConfig } from '../public/js/config-parser.js'

test('从 JSON 配置识别接口、Key 和模型', () => {
  assert.deepEqual(
    parseProviderConfig(JSON.stringify({ base_url: 'https://relay.example/v1', api_key: 'secret-json', model: 'alias-json' })),
    { baseUrl: 'https://relay.example/v1', apiKey: 'secret-json', model: 'alias-json' }
  )
})

test('从 cURL 配置识别接口、Bearer Key 和模型', () => {
  const result = parseProviderConfig(`curl 'https://relay.example/v1/chat/completions' \\
    -H 'Authorization: Bearer secret-curl' \\
    -d '{"model":"alias-curl","messages":[]}'`)
  assert.deepEqual(result, {
    baseUrl: 'https://relay.example/v1/chat/completions',
    apiKey: 'secret-curl',
    model: 'alias-curl'
  })
})

test('从 URL、Key、模型三行文本识别配置', () => {
  assert.deepEqual(
    parseProviderConfig('https://relay.example/v1\nsecret-lines\nalias-lines'),
    { baseUrl: 'https://relay.example/v1', apiKey: 'secret-lines', model: 'alias-lines' }
  )
})
