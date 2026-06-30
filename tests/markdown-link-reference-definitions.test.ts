import assert from 'node:assert/strict'
import { parseSiteMarkdown } from '../src/utils/markdown'

const markdownCases = [
  {
    name: 'single-quoted title',
    markdown: "[//]: # 'SomeLabel'\n\nVisible content.",
  },
  {
    name: 'double-quoted title',
    markdown: '[//]: # "SomeLabel"\n\nVisible content.',
  },
  {
    name: 'parenthesized title',
    markdown: '[//]: # (SomeLabel)\n\nVisible content.',
  },
]

for (const testCase of markdownCases) {
  const document = parseSiteMarkdown(testCase.markdown)

  assert.equal(
    document.children.length,
    1,
    `${testCase.name} reference definition is not rendered`,
  )

  const paragraph = document.children[0]

  assert.equal(paragraph?.type, 'paragraph', `${testCase.name} content remains`)

  if (paragraph?.type !== 'paragraph') {
    throw new Error(`${testCase.name} did not produce a paragraph`)
  }

  assert.deepEqual(
    paragraph.children,
    [{ type: 'text', value: 'Visible content.' }],
    `${testCase.name} visible paragraph is preserved`,
  )
}

console.log('markdown link reference definition tests passed')
