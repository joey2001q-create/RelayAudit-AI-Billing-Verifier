import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

function blockedIPv4(address) {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

function blockedIPv6(address) {
  const normalized = address.toLowerCase().split('%')[0]
  if (normalized === '::' || normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (/^fe[89ab]/.test(normalized)) return true
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length)
    return isIP(mapped) !== 4 || blockedIPv4(mapped)
  }
  return false
}

export function isBlockedAddress(address) {
  const family = isIP(address)
  if (family === 4) return blockedIPv4(address)
  if (family === 6) return blockedIPv6(address)
  return true
}

export async function assertHostedEndpoint(endpoint, options = {}) {
  const url = new URL(endpoint)
  if (url.protocol !== 'https:') throw new Error('托管版只允许 HTTPS 中转站地址')
  if (url.username || url.password) throw new Error('中转站地址不能包含用户名或密码')

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '')
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('托管版不能访问本机或内网地址')
  }

  const literalFamily = isIP(hostname)
  const addresses = literalFamily
    ? [{ address: hostname }]
    : await (options.lookupImpl ?? lookup)(hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new Error('托管版不能访问本机或内网地址')
  }
}
