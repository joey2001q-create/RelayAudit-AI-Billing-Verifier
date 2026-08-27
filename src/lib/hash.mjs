import { createHash } from 'node:crypto'

export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

export function sha256(value) {
  const source = typeof value === 'string' ? value : stableStringify(value)
  return createHash('sha256').update(source, 'utf8').digest('hex')
}
