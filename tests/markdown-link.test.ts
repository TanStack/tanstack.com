import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MarkdownLink } from '../src/components/markdown/MarkdownLink'

function renderLink(href: string) {
  return renderToStaticMarkup(
    createElement(MarkdownLink, { href }, 'Documentation'),
  )
}

test('external HTTPS Markdown links open in a new tab', () => {
  const html = renderLink('https://example.com/docs')

  assert.match(html, /target="_blank"/)
  assert.match(html, /rel="noopener"/)
  assert.doesNotMatch(html, /noreferrer/)
})

test('TanStack HTTPS Markdown links stay in the current tab', () => {
  for (const href of [
    'https://tanstack.com/table/latest',
    'https://docs.tanstack.com/reference',
  ]) {
    const html = renderLink(href)

    assert.doesNotMatch(html, /target=/)
    assert.doesNotMatch(html, /rel=/)
  }
})

test('lookalike TanStack hostnames still open in a new tab', () => {
  const html = renderLink('https://tanstack.com.example.org/docs')

  assert.match(html, /target="_blank"/)
  assert.match(html, /rel="noopener"/)
  assert.doesNotMatch(html, /noreferrer/)
})

test('non-HTTPS Markdown links keep their existing behavior', () => {
  const html = renderLink('http://example.com/docs')

  assert.doesNotMatch(html, /target=/)
  assert.doesNotMatch(html, /rel=/)
})
