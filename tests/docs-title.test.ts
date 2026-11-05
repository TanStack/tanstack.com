import assert from 'node:assert/strict'
import test from 'node:test'
import { getDocsTitle } from '../src/utils/docs-title'

test('docs metadata preserves explicit titles and derives missing titles from actual headings', () => {
  assert.equal(getDocsTitle('Explicit title', '# Body title'), 'Explicit title')
  assert.equal(
    getDocsTitle(
      undefined,
      '# How to Set Up Testing with Code-Based Routing\n\nGuide body',
    ),
    'How to Set Up Testing with Code-Based Routing',
  )
  assert.equal(
    getDocsTitle(
      undefined,
      '```md\n# Code example\n```\n\n# **Real** `guide` [title](/guide)',
    ),
    'Real guide title',
  )
  assert.equal(
    getDocsTitle(
      undefined,
      '# Content temporarily unavailable\n\nPlease try again.',
    ),
    'Content temporarily unavailable',
  )
  assert.equal(
    getDocsTitle(undefined, 'A document without a heading.'),
    'Documentation',
  )
})
