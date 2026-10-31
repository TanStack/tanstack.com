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

test('package-relative references resolve from the published skill file', () => {
  const baseUrl =
    'https://app.unpkg.com/%40tanstack/react-table@9.3.1/files/skills/getting-started/SKILL.md'
  for (const [href, expected] of [
    [
      'references/create-table-hook.md',
      'getting-started/references/create-table-hook.md',
    ],
    ['../table-state/SKILL.md', 'table-state/SKILL.md'],
    [
      './references/setup.md#example',
      'getting-started/references/setup.md#example',
    ],
  ]) {
    const html = renderToStaticMarkup(
      createElement(MarkdownLink, { href, baseUrl }, 'Reference'),
    )
    assert.ok(
      html.includes(
        `href="https://app.unpkg.com/%40tanstack/react-table@9.3.1/files/skills/${expected}"`,
      ),
    )
    assert.match(html, /target="_blank"/)
  }
})

test('a package source does not replace absolute links or allow unsafe schemes', () => {
  const baseUrl = 'https://app.unpkg.com/pkg@1.0.0/files/skills/setup/SKILL.md'
  const external = renderToStaticMarkup(
    createElement(
      MarkdownLink,
      { href: 'https://example.com/guide.md', baseUrl },
      'Reference',
    ),
  )
  assert.match(external, /href="https:\/\/example.com\/guide.md"/)
  const unsafe = renderToStaticMarkup(
    createElement(
      MarkdownLink,
      { href: 'javascript:alert(1)', baseUrl },
      'Reference',
    ),
  )
  assert.doesNotMatch(unsafe, /href=/)
})
