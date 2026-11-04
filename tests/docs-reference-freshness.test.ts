import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyReferencedDocsFreshness,
  extractFrontMatter,
} from '../src/utils/documents.server'

const source =
  '---\ntitle: Shared\nupdated: "2026-09-01"\ntestedWith:\n  react: "19.2.3"\n---\nThe body stays unchanged.\n'

test('references do not inherit source-only freshness claims', () => {
  const result = extractFrontMatter(
    applyReferencedDocsFreshness(source, [{ ref: 'shared.md' }]),
  )
  assert.equal(result.data.updated, undefined)
  assert.equal(result.data.testedWith, undefined)
  assert.equal(result.data.title, 'Shared')
  assert.equal(result.content, 'The body stays unchanged.\n')
})

test('all known source dates contribute but tested versions belong to the visible wrapper', () => {
  const result = extractFrontMatter(
    applyReferencedDocsFreshness(source, [
      { updated: '2026-09-02', testedWith: { react: '19.2.4' } },
      { updated: '2026-09-03', testedWith: { react: '19.1.0' } },
    ]),
  )
  assert.equal(result.data.updated, '2026-09-03')
  assert.deepEqual(result.data.testedWith, { react: '19.2.4' })
  assert.equal(
    extractFrontMatter(
      applyReferencedDocsFreshness(source, [{ updated: '2026-09-02' }, {}]),
    ).data.updated,
    undefined,
  )
})
