import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertHostedEndpoint,
  isBlockedAddress
} from '../src/lib/network-policy.mjs'

test('托管版网络策略识别常见内网地址', () => {
  assert.equal(isBlockedAddress('127.0.0.1'), true)
  assert.equal(isBlockedAddress('10.0.0.8'), true)
  assert.equal(isBlockedAddress('172.16.0.1'), true)
  assert.equal(isBlockedAddress('192.168.1.1'), true)
  assert.equal(isBlockedAddress('169.254.169.254'), true)
  assert.equal(isBlockedAddress('::1'), true)
  assert.equal(isBlockedAddress('8.8.8.8'), false)
  assert.equal(isBlockedAddress('2606:4700:4700::1111'), false)
})

test('托管版拒绝 HTTP、本机域名和解析到内网的域名', async () => {
  await assert.rejects(() => assertHostedEndpoint('http://relay.example/v1'), /只允许 HTTPS/)
  await assert.rejects(() => assertHostedEndpoint('https://localhost/v1'), /不能访问本机或内网/)
  await assert.rejects(() => assertHostedEndpoint('https://relay.example/v1', {
    lookupImpl: async () => [{ address: '10.0.0.2', family: 4 }]
  }), /不能访问本机或内网/)
})

test('托管版允许解析到公网地址的 HTTPS 中转站', async () => {
  await assertHostedEndpoint('https://relay.example/v1', {
    lookupImpl: async () => [
      { address: '104.18.1.1', family: 4 },
      { address: '2606:4700::1111', family: 6 }
    ]
  })
})
