import { expect, it } from 'vitest'
import { renderHtml } from '@tanstack/markdown/html'
import { streamingMarkdownExtension } from '@tanstack/markdown/extensions/streaming'
import { webLinksExtension } from '../../src/chat/core/markdown-links'
const render = (text: string) =>
  renderHtml(text, {
    allowHtml: false,
    extensions: [streamingMarkdownExtension(), webLinksExtension],
  })

it('links plain sources while keeping trailing punctuation outside the link', () => {
  expect(
    render(
      'Source: https://learn.microsoft.com/azure/azure-functions/functions-overview.',
    ),
  ).toContain(
    '<a href="https://learn.microsoft.com/azure/azure-functions/functions-overview">https://learn.microsoft.com/azure/azure-functions/functions-overview</a>.',
  )
})
it('does not nest anchors or link code, email, domains or executable protocols', () => {
  const html = render(
    '[https://example.com](https://other.example)\n\n`https://example.com`\n\n```txt\nhttps://example.com\n```\n\nuser@example.com example.com javascript:alert(1) ftp://example.com',
  )
  expect(html.match(/<a /g)).toHaveLength(1)
  expect(html).toContain('<code>https://example.com</code>')
  expect(html).toContain('href="https://other.example"')
})
it('handles emphasis, lists and tables while keeping quoted evidence inert', () => {
  const html = render(
    '**https://example.com/a**\n\n- https://example.com/b\n\n> https://example.com/c\n\n| Source |\n| --- |\n| https://example.com/d |',
  )
  expect(html.match(/<a /g)).toHaveLength(3)
})
it('keeps balanced URL parentheses and escapes URL query attributes', () => {
  const html = render(
    'See (https://example.com/wiki/A_(B)). https://example.com/?a=1&b=2',
  )
  expect(html).toContain('href="https://example.com/wiki/A_(B)"')
  expect(html).toContain('href="https://example.com/?a=1&amp;b=2"')
})
