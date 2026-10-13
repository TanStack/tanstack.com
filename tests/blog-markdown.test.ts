import assert from 'node:assert/strict'
import test from 'node:test'
import { parseBlogMarkdown } from '../src/utils/blogMarkdown'
import { parseSiteMarkdown } from '../src/utils/markdown'

test('blog title removal preserves code comments and later headings', () => {
  for (const content of [
    '```bash\n# Install dependencies\npnpm install\n```',
    'Introduction\n\n# How to install\n\nInstructions',
  ]) {
    assert.deepEqual(parseBlogMarkdown(content), parseSiteMarkdown(content))
  }
})

test('removes a leading title and its TOC entry, including after a comment', () => {
  for (const prefix of ['', '<!-- Editorial note -->\n\n']) {
    const markdown = parseBlogMarkdown(
      prefix + '# Article\n\n## Details\n\nText',
    )
    assert.deepEqual(
      markdown.headings.map((heading) => heading.level),
      [2],
    )
    assert.equal(
      markdown.children.some(
        (block) => block.type === 'heading' && block.depth === 1,
      ),
      false,
    )
  }
})

test('preserves a later heading with the same text and its existing anchor', () => {
  const markdown = parseBlogMarkdown('# Title\n\n# Title\n\nText')
  assert.deepEqual(markdown.headings.map((heading) => heading.id), ['title-2'])
})

test('does not skip visible HTML when looking for the article title', () => {
  const content = '<div>Introduction</div>\n\n# Keep this heading'
  assert.deepEqual(parseBlogMarkdown(content), parseSiteMarkdown(content))
})
