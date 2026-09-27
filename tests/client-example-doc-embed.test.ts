import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderMarkdownReact } from '@tanstack/markdown/react'
import { parseClientExampleAttributes } from '../src/components/examples/ClientExampleDocEmbed'
import { parseSiteMarkdown } from '../src/utils/markdown'

test('client example comments parse into the markdown comment component', () => {
  const document = parseSiteMarkdown(
    '<!-- ::client-example library=ai framework=react slug=basic-chat -->',
  )
  const block = document.children[0]
  assert.equal(block?.type, 'component')
  if (block?.type !== 'component') return

  assert.equal(block.name, 'client-example')
  assert.deepEqual(parseClientExampleAttributes(block.attributes), {
    library: 'ai',
    framework: 'react',
    slug: 'basic-chat',
  })

  const html = renderToStaticMarkup(
    createElement(Fragment, null, renderMarkdownReact(document)),
  )
  assert.match(html, /<md-comment-component/)
  assert.match(html, /data-component="client-example"/)
})

test('client example comments reject unsafe or extra attributes', () => {
  for (const attributes of [
    { library: 'ai', framework: 'react', slug: '../secret' },
    { library: 'ai', framework: 'react', slug: '' },
    {
      library: 'ai',
      framework: 'react',
      slug: 'basic-chat',
      src: 'https://example.com',
    },
  ]) {
    assert.equal(parseClientExampleAttributes(attributes), null)
  }
})
