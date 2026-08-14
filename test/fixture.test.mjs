import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFixture } from '../src/lib/fixture.mjs'

test('默认语料按指定行数生成', () => {
  const fixture = buildFixture(20)
  assert.equal(fixture.source, 'built_in')
  assert.equal(fixture.lineCount, 20)
  assert.equal(fixture.content.includes('Billing verification fixture line 0020.'), true)
})

test('自定义语料保留正文并生成独立摘要', () => {
  const fixture = buildFixture(200, '  first line\nsecond line  ')
  assert.equal(fixture.source, 'custom')
  assert.equal(fixture.version, 'custom-fixture-v1')
  assert.equal(fixture.lineCount, 2)
  assert.equal(fixture.characterCount, 22)
  assert.equal(fixture.content, 'first line\nsecond line')
  assert.equal(fixture.sha256.length, 64)
})
