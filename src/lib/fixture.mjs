import { sha256 } from './hash.mjs'

const FIXTURE_VERSION = 'billing-fixture-v1'
const CUSTOM_FIXTURE_VERSION = 'custom-fixture-v1'
const LINE_TEMPLATE = 'Billing verification fixture line {line}. Use this text only as immutable input evidence.'
const SYSTEM_MESSAGE = 'You are running a billing verification fixture. Reply with BILLING_TEST_OK only.'

export function buildFixture(lineCount, customContent = '') {
  const normalizedCustomContent = String(customContent ?? '').trim()
  if (normalizedCustomContent) {
    return {
      version: CUSTOM_FIXTURE_VERSION,
      source: 'custom',
      lineCount: normalizedCustomContent.split(/\r?\n/).length,
      characterCount: normalizedCustomContent.length,
      content: normalizedCustomContent,
      sha256: sha256(normalizedCustomContent)
    }
  }
  const safeLineCount = Math.min(Math.max(Number(lineCount) || 200, 20), 2000)
  const lines = []
  for (let index = 1; index <= safeLineCount; index += 1) {
    lines.push(LINE_TEMPLATE.replace('{line}', String(index).padStart(4, '0')))
  }
  const content = lines.join('\n')
  return {
    version: FIXTURE_VERSION,
    source: 'built_in',
    lineCount: safeLineCount,
    characterCount: content.length,
    content,
    sha256: sha256(content)
  }
}

export function buildRoundMessages(fixture, roundMarker) {
  return [
    {
      role: 'system',
      content: SYSTEM_MESSAGE
    },
    {
      role: 'user',
      content: [
        `Fixture version: ${fixture.version}`,
        fixture.content,
        `Paired round marker: ${roundMarker}`,
        'Reply with BILLING_TEST_OK only.'
      ].join('\n\n')
    }
  ]
}

export function buildMultiTurnMessages(fixture, conversationMarker, turnNumber) {
  const safeTurn = Math.max(1, Math.floor(Number(turnNumber) || 1))
  const messages = [
    { role: 'system', content: SYSTEM_MESSAGE },
    {
      role: 'user',
      content: [
        `Fixture version: ${fixture.version}`,
        fixture.content,
        `Conversation marker: ${conversationMarker}`,
        'Conversation turn: 1',
        'Reply with BILLING_TEST_OK only.'
      ].join('\n\n')
    }
  ]
  for (let turn = 2; turn <= safeTurn; turn += 1) {
    messages.push(
      { role: 'assistant', content: 'BILLING_TEST_OK' },
      {
        role: 'user',
        content: `Conversation turn: ${turn}\nConversation marker: ${conversationMarker}\nReply with BILLING_TEST_OK only.`
      }
    )
  }
  return messages
}

export function buildCacheReuseMessages(fixture, cacheMarker) {
  return buildRoundMessages(fixture, `cache-reuse-${cacheMarker}`)
}
