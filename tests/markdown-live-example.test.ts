import assert from 'node:assert/strict'
import test from 'node:test'
import { renderMarkdownReact } from '@tanstack/markdown/react'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { BlockNode, ComponentNode } from '@tanstack/markdown'
import { LiveExample } from '../src/components/markdown/LiveExample'
import { parseSiteMarkdown } from '../src/utils/markdown'
import { parseExampleWorkspace } from '../src/utils/example-workspace'

function requireComponent(block: BlockNode | undefined): ComponentNode {
  if (block?.type !== 'component') {
    throw new Error('Expected a component')
  }
  return block
}

function readWorkspace(component: ComponentNode) {
  const serialized = component.properties?.['data-workspace']
  assert.equal(typeof serialized, 'string')
  if (typeof serialized !== 'string') {
    throw new Error('Expected a serialized workspace')
  }
  return parseExampleWorkspace(JSON.parse(serialized))
}

test('groups adjacent live files into a versioned workspace', () => {
  const document = parseSiteMarkdown(`\`\`\`tsx live=counter file=/src/main.tsx
import { App } from './App'
\`\`\`

\`\`\`tsx live=counter file=/src/App.tsx
export function App() { return <button>Count</button> }
\`\`\``)

  const component = requireComponent(document.children[0])

  assert.equal(component.tagName, 'md-live-example')
  assert.equal(component.children.length, 2)
  assert.equal(component.children[0]?.type, 'code')
  assert.equal(component.children[1]?.type, 'code')
  if (
    component.children[0]?.type !== 'code' ||
    component.children[1]?.type !== 'code'
  ) {
    return
  }
  assert.equal(component.children[0].lang, 'tsx')
  assert.equal(component.children[0].file, '/src/main.tsx')
  assert.equal(component.children[1].file, '/src/App.tsx')

  const workspace = readWorkspace(component)
  assert.equal(workspace.entry, '/src/main.tsx')
  assert.deepEqual(Object.keys(workspace.files).sort(), [
    '/src/App.tsx',
    '/src/main.tsx',
  ])
})

test('supports a visible source file before an explicit entry file', () => {
  const document =
    parseSiteMarkdown(`\`\`\`tsx live=letter-frequency file=/src/LetterFrequencyChart.tsx entry=/src/main.tsx
import { Chart } from '@tanstack/react-charts'

export function LetterFrequencyChart() {
  return <Chart definition={letterFrequencyChart} height={320} />
}
\`\`\`

\`\`\`tsx live=letter-frequency file=/src/main.tsx
import { createRoot } from 'react-dom/client'
import { LetterFrequencyChart } from './LetterFrequencyChart'

createRoot(document.getElementById('root')!).render(<LetterFrequencyChart />)
\`\`\``)

  const component = requireComponent(document.children[0])
  const workspace = readWorkspace(component)

  assert.equal(workspace.entry, '/src/main.tsx')
  assert.deepEqual(Object.keys(workspace.files).sort(), [
    '/src/LetterFrequencyChart.tsx',
    '/src/main.tsx',
  ])
})

test('keeps separate live groups and ordinary blocks separate', () => {
  const document = parseSiteMarkdown(`\`\`\`tsx live=first file=/main.tsx
console.log('first')
\`\`\`

Between examples.

\`\`\`tsx live=first file=/other.tsx
console.log('other')
\`\`\``)

  assert.deepEqual(
    document.children.map((child) => child.type),
    ['component', 'paragraph', 'component'],
  )

  const adjacentIds = parseSiteMarkdown(`\`\`\`tsx live=first file=/first.tsx
console.log('first')
\`\`\`

\`\`\`tsx live=second file=/second.tsx
console.log('second')
\`\`\`

\`\`\`tsx
console.log('ordinary')
\`\`\`

\`\`\`tsx live=first file=/third.tsx
console.log('third')
\`\`\``)

  assert.deepEqual(
    adjacentIds.children.map((child) => child.type),
    ['component', 'component', 'code', 'component'],
  )
  assert.equal(
    requireComponent(adjacentIds.children[0]).properties?.['data-live-id'],
    'first',
  )
  assert.equal(
    requireComponent(adjacentIds.children[1]).properties?.['data-live-id'],
    'second',
  )
})

test('groups live files inside nested block containers', () => {
  const quoteDocument = parseSiteMarkdown(`> \`\`\`tsx live=quote file=/main.tsx
> console.log('main')
> \`\`\`
>
> \`\`\`tsx live=quote file=/support.tsx
> export const support = true
> \`\`\``)

  const quote = quoteDocument.children[0]
  assert.equal(quote?.type, 'blockquote')
  if (quote?.type !== 'blockquote') return
  const quoteExample = requireComponent(quote.children[0])
  assert.equal(quoteExample.children.length, 2)
  assert.equal(readWorkspace(quoteExample).entry, '/main.tsx')

  const listDocument = parseSiteMarkdown(`- Example

  \`\`\`tsx live=list file=/main.tsx
  console.log('main')
  \`\`\`

  \`\`\`json live=list file=/package.json
  {"private": true}
  \`\`\``)

  const list = listDocument.children[0]
  assert.equal(list?.type, 'list')
  if (list?.type !== 'list') return
  const listExample = requireComponent(list.items[0]?.children[1])
  assert.equal(listExample.children.length, 2)
  assert.deepEqual(Object.keys(readWorkspace(listExample).files).sort(), [
    '/main.tsx',
    '/package.json',
  ])
})

test('invalid live metadata fails open to static code', () => {
  const invalidMetadata = [
    'live=counter file=../main.tsx',
    'live=counter file=/',
    'live=counter file=/src\\main.tsx',
    'live="not valid" file=/main.tsx',
    'live=counter title=/main.tsx',
    'live=counter file=/main.tsx entry=../main.tsx',
  ]

  for (const metadata of invalidMetadata) {
    const document = parseSiteMarkdown(`\`\`\`tsx ${metadata}
console.log('static')
\`\`\``)

    assert.equal(document.children[0]?.type, 'code', metadata)
  }

  const duplicateFiles =
    parseSiteMarkdown(`\`\`\`tsx live=counter file=/main.tsx
console.log('first')
\`\`\`

\`\`\`tsx live=counter file=/main.tsx
console.log('second')
\`\`\``)

  assert.deepEqual(
    duplicateFiles.children.map((child) => child.type),
    ['code', 'code'],
  )
})

test('server rendering retains static source without loading the workbench', () => {
  const document = parseSiteMarkdown(`\`\`\`tsx live=ssr file=/main.tsx
console.log('server-static-marker')
\`\`\``)

  const rendered = renderMarkdownReact(document, {
    components: { 'md-live-example': LiveExample },
  })
  const html = renderToStaticMarkup(createElement(Fragment, null, rendered))

  assert.match(html, /server-static-marker/)
  assert.match(html, />Run</)
  assert.doesNotMatch(html, /data-workspace/)
  assert.doesNotMatch(html, /<iframe/)
})
