import assert from 'node:assert/strict'
import test from 'node:test'
import type { InlineNode } from '@tanstack/markdown'
import { autolinkInlineNodes } from '../src/components/markdown/autolinkBareUrls'

function autolink(value: string) {
  return autolinkInlineNodes([{ type: 'text', value }])
}

function hrefs(nodes: Array<InlineNode>) {
  return nodes.flatMap((node) => (node.type === 'link' ? [node.href] : []))
}

test('bare URLs in prose become links', () => {
  const nodes = autolink('See https://tanstack.com/router for details.')

  assert.deepEqual(hrefs(nodes), ['https://tanstack.com/router'])
  assert.deepEqual(nodes[0], { type: 'text', value: 'See ' })
  assert.deepEqual(nodes[2], { type: 'text', value: ' for details.' })
})

test('balanced parentheses stay part of the URL', () => {
  assert.deepEqual(
    hrefs(autolink('https://github.com/x/y/blob/main/routes/(auth)')),
    ['https://github.com/x/y/blob/main/routes/(auth)'],
  )
})

test('a wrapping parenthesis is not part of the URL', () => {
  assert.deepEqual(hrefs(autolink('(see https://tanstack.com/start).')), [
    'https://tanstack.com/start',
  ])
  assert.deepEqual(hrefs(autolink('(https://tanstack.com/routes/(auth))')), [
    'https://tanstack.com/routes/(auth)',
  ])
})

test('non-text inline nodes are left alone', () => {
  const code: InlineNode = {
    type: 'inlineCode',
    value: 'https://tanstack.com',
  }
  const link: InlineNode = {
    type: 'link',
    href: 'https://tanstack.com',
    children: [{ type: 'text', value: 'https://tanstack.com' }],
  }

  assert.deepEqual(autolinkInlineNodes([code, link]), [code, link])
})
