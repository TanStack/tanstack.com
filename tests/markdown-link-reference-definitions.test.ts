import assert from 'node:assert/strict'
import { parseSiteMarkdown } from '../src/utils/markdown'

const markdownCases = [
  {
    name: 'single-quoted title',
    markdown: "[//]: # 'SomeLabel'\n\nVisible content.",
    referenceMarkdown:
      "[example]: https://example.com 'Example title'\n\n[Example][example]",
    title: 'Example title',
  },
  {
    name: 'double-quoted title',
    markdown: '[//]: # "SomeLabel"\n\nVisible content.',
    referenceMarkdown:
      '[example]: https://example.com "Example title"\n\n[Example][example]',
    title: 'Example title',
  },
  {
    name: 'parenthesized title',
    markdown: '[//]: # (SomeLabel)\n\nVisible content.',
    referenceMarkdown:
      '[example]: https://example.com (Example title)\n\n[Example][example]',
    title: 'Example title',
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

  const referenceDocument = parseSiteMarkdown(testCase.referenceMarkdown)
  const referenceParagraph = referenceDocument.children[0]

  assert.equal(
    referenceParagraph?.type,
    'paragraph',
    `${testCase.name} reference link paragraph is parsed`,
  )

  if (referenceParagraph?.type !== 'paragraph') {
    throw new Error(`${testCase.name} did not produce a reference paragraph`)
  }

  const link = referenceParagraph.children[0]

  assert.equal(link?.type, 'link', `${testCase.name} reference link resolves`)

  if (link?.type !== 'link') {
    throw new Error(`${testCase.name} did not produce a reference link`)
  }

  assert.equal(
    link.href,
    'https://example.com',
    `${testCase.name} reference link href is preserved`,
  )

  assert.equal(
    link.title,
    testCase.title,
    `${testCase.name} reference link title is preserved`,
  )

  assert.deepEqual(
    link.children,
    [{ type: 'text', value: 'Example' }],
    `${testCase.name} reference link label is preserved`,
  )
}

console.log('markdown link reference definition tests passed')
