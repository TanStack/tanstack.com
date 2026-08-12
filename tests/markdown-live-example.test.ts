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

test('groups adjacent runnable files into an environment workspace', () => {
  const document =
    parseSiteMarkdown(`\`\`\`tsx group=counter env=charts-react file=/src/App.tsx entry
import { label } from './data'

export default function App() { return <button>{label}</button> }
\`\`\`

\`\`\`ts group=counter file=/src/data.ts collapsed
export const label = 'Count'
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
  assert.equal(component.children[0].file, '/src/App.tsx')
  assert.equal(component.children[1].file, '/src/data.ts')

  const workspace = readWorkspace(component)
  assert.equal(workspace.entry, '/src/App.tsx')
  assert.equal(workspace.environment, 'charts-react')
  assert.equal(
    workspace.imports?.['@tanstack/charts'],
    'https://esm.sh/@tanstack/charts@0.10.0',
  )
  assert.equal(
    workspace.imports?.['@tanstack/charts/react'],
    'https://esm.sh/@tanstack/charts@0.10.0/react?external=react,react-dom',
  )
  assert.equal(workspace.imports?.react, 'https://esm.sh/react@19.2.3')
  assert.deepEqual(Object.keys(workspace.files).sort(), [
    '/src/App.tsx',
    '/src/data.ts',
  ])
  assert.equal(component.properties?.['data-example-group'], 'counter')
  assert.equal(component.properties?.['data-collapsed-indexes'], '[1]')
})

test('supports a visible source file before an explicit entry file', () => {
  const document =
    parseSiteMarkdown(`\`\`\`tsx group=letter-frequency file=/src/LetterFrequencyChart.tsx
import { Chart } from '@tanstack/charts/react'

export function LetterFrequencyChart() {
  return <Chart definition={letterFrequencyChart} height={320} />
}
\`\`\`

\`\`\`tsx group=letter-frequency env=charts-react file=/src/App.tsx entry
import { LetterFrequencyChart } from './LetterFrequencyChart'

export default function App() { return <LetterFrequencyChart /> }
\`\`\``)

  const component = requireComponent(document.children[0])
  const workspace = readWorkspace(component)

  assert.equal(workspace.entry, '/src/App.tsx')
  assert.equal(workspace.environment, 'charts-react')
  assert.deepEqual(Object.keys(workspace.files).sort(), [
    '/src/App.tsx',
    '/src/LetterFrequencyChart.tsx',
  ])
})

test('builds a realistic multi-file Markdown and Highlight workspace', () => {
  const document =
    parseSiteMarkdown(`\`\`\`ts group=markdown-highlight file=/src/render-markdown.ts
import { createHighlighter } from '@tanstack/highlight/core'
import { ts } from '@tanstack/highlight/languages/ts'
import { createTanStackMarkdownHighlighter } from '@tanstack/highlight/markdown'
import { renderHtml } from '@tanstack/markdown/html'

const highlighter = createHighlighter({ languages: [ts] })
const highlightMarkdownCode = createTanStackMarkdownHighlighter(highlighter)

export function render(source: string) {
  return renderHtml(source, {
    highlighter: highlightMarkdownCode,
  })
}
\`\`\`

\`\`\`ts group=markdown-highlight env=client file=/src/main.ts entry
import { render } from './render-markdown'
import './styles.css'

export default function mount(output: HTMLElement) {
  output.innerHTML = render('# TypeScript\\n\\n\`const answer: number = 42\`')
}
\`\`\`

\`\`\`css group=markdown-highlight file=/src/styles.css collapsed
pre { overflow: auto; }
\`\`\``)

  const component = requireComponent(document.children[0])
  const workspace = readWorkspace(component)

  assert.equal(workspace.entry, '/src/main.ts')
  assert.equal(workspace.environment, 'client')
  assert.deepEqual(Object.keys(workspace.files).sort(), [
    '/src/main.ts',
    '/src/render-markdown.ts',
    '/src/styles.css',
  ])
  assert.match(
    workspace.files['/src/render-markdown.ts'] ?? '',
    /@tanstack\/highlight\/languages\/ts/,
  )
  assert.match(
    workspace.files['/src/render-markdown.ts'] ?? '',
    /@tanstack\/markdown\/html/,
  )
})

test('keeps separate runnable groups and ordinary blocks separate', () => {
  const document =
    parseSiteMarkdown(`\`\`\`tsx group=first env=charts file=/main.tsx entry
console.log('first')
\`\`\`

Between examples.

\`\`\`tsx group=first env=charts file=/other.tsx entry
console.log('other')
\`\`\``)

  assert.deepEqual(
    document.children.map((child) => child.type),
    ['component', 'paragraph', 'component'],
  )

  const adjacentIds =
    parseSiteMarkdown(`\`\`\`tsx group=first env=charts file=/first.tsx entry
console.log('first')
\`\`\`

\`\`\`tsx group=second env=charts file=/second.tsx entry
console.log('second')
\`\`\`

\`\`\`tsx
console.log('ordinary')
\`\`\`

\`\`\`tsx group=first env=charts file=/third.tsx entry
console.log('third')
\`\`\``)

  assert.deepEqual(
    adjacentIds.children.map((child) => child.type),
    ['component', 'component', 'code', 'component'],
  )
  assert.equal(
    requireComponent(adjacentIds.children[0]).properties?.[
      'data-example-group'
    ],
    'first',
  )
  assert.equal(
    requireComponent(adjacentIds.children[1]).properties?.[
      'data-example-group'
    ],
    'second',
  )
  assert.equal(
    requireComponent(adjacentIds.children[0]).attributes.id,
    'first-1',
  )
  assert.equal(
    requireComponent(adjacentIds.children[1]).attributes.id,
    'second-1',
  )
  assert.equal(
    requireComponent(adjacentIds.children[3]).attributes.id,
    'first-2',
  )
  assert.equal(
    requireComponent(adjacentIds.children[3]).properties?.[
      'data-example-group'
    ],
    'first',
  )
})

test('groups runnable files inside nested block containers', () => {
  const quoteDocument =
    parseSiteMarkdown(`> \`\`\`tsx group=quote env=charts file=/main.tsx entry
> console.log('main')
> \`\`\`
>
> \`\`\`tsx group=quote file=/support.tsx collapsed
> export const support = true
> \`\`\``)

  const quote = quoteDocument.children[0]
  assert.equal(quote?.type, 'blockquote')
  if (quote?.type !== 'blockquote') return
  const quoteExample = requireComponent(quote.children[0])
  assert.equal(quoteExample.children.length, 2)
  assert.equal(readWorkspace(quoteExample).entry, '/main.tsx')

  const listDocument = parseSiteMarkdown(`- Example

  \`\`\`tsx group=list env=charts file=/main.tsx entry
  console.log('main')
  \`\`\`

  \`\`\`json group=list file=/package.json collapsed
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

test('invalid runnable metadata fails open to static code', () => {
  const invalidMetadata = [
    'group=counter env=charts file=../main.tsx entry',
    'group=counter env=charts file=/ entry',
    'group=counter env=charts file=/src\\main.tsx entry',
    'group="not valid" env=charts file=/main.tsx entry',
    'group=counter env=unknown file=/main.tsx entry',
    'group=counter env=charts file=/main.tsx entry=/main.tsx',
    'group=counter env=charts file=/main.tsx entry collapsed',
    'group=counter env=charts file=/main.tsx entry=false',
    'group=counter env=charts file=/main.tsx entry collapsed=false',
    'group=counter env=charts file=/__tanstack-example-entry.ts entry',
    'live=counter file=/main.tsx',
  ]

  for (const metadata of invalidMetadata) {
    const document = parseSiteMarkdown(`\`\`\`tsx ${metadata}
console.log('static')
\`\`\``)

    assert.equal(document.children[0]?.type, 'code', metadata)
  }

  const duplicateFiles =
    parseSiteMarkdown(`\`\`\`tsx group=counter env=charts file=/main.tsx entry
console.log('first')
\`\`\`

\`\`\`tsx group=counter file=/main.tsx
console.log('second')
\`\`\``)

  assert.deepEqual(
    duplicateFiles.children.map((child) => child.type),
    ['code', 'code'],
  )

  const environmentOnSupport =
    parseSiteMarkdown(`\`\`\`tsx group=counter env=charts file=/main.tsx entry
console.log('main')
\`\`\`

\`\`\`tsx group=counter env=charts file=/support.tsx
console.log('support')
\`\`\``)

  assert.deepEqual(
    environmentOnSupport.children.map((child) => child.type),
    ['code', 'code'],
  )

  const missingEnvironment =
    parseSiteMarkdown(`\`\`\`tsx group=counter file=/main.tsx entry
console.log('main')
\`\`\``)

  assert.equal(missingEnvironment.children[0]?.type, 'code')

  const duplicateEnvironment =
    parseSiteMarkdown(`\`\`\`tsx group=counter env=charts env=charts-react file=/main.tsx entry
console.log('main')
\`\`\``)

  assert.equal(duplicateEnvironment.children[0]?.type, 'code')

  const reservedEnvironmentFile =
    parseSiteMarkdown(`\`\`\`tsx group=counter env=charts file=/main.tsx entry
console.log('main')
\`\`\`

\`\`\`ts group=counter file=/__tanstack-example-entry.ts
console.log('reserved')
\`\`\``)

  assert.deepEqual(
    reservedEnvironmentFile.children.map((child) => child.type),
    ['code', 'code'],
  )

  const malformedSupport =
    parseSiteMarkdown(`\`\`\`tsx group=counter env=charts file=/main.tsx entry
console.log('main')
\`\`\`

\`\`\`tsx group=counter file=../support.tsx
console.log('support')
\`\`\``)

  assert.deepEqual(
    malformedSupport.children.map((child) => child.type),
    ['code', 'code'],
  )
})

test('server rendering retains static source without loading the workbench', () => {
  const document =
    parseSiteMarkdown(`\`\`\`tsx group=ssr env=charts file=/main.tsx entry
console.log('server-static-marker')
\`\`\`

\`\`\`ts group=ssr file=/support.ts collapsed
console.log('collapsed-support-marker')
\`\`\``)

  const rendered = renderMarkdownReact(document, {
    components: { 'md-live-example': LiveExample },
  })
  const html = renderToStaticMarkup(createElement(Fragment, null, rendered))

  assert.match(html, /server-static-marker/)
  assert.match(html, /collapsed-support-marker/)
  assert.match(html, /<details/)
  assert.match(html, /Support files/)
  assert.match(html, />Run</)
  assert.match(html, /data-live-example-state="static"/)
  assert.doesNotMatch(html, /data-workspace/)
  assert.doesNotMatch(html, /<iframe/)
})
