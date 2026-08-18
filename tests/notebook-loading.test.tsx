import * as React from 'react'
import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  NotebookAiSkeleton,
  NotebookDraftSkeleton,
  NotebookEditorSkeleton,
  NotebookEmbeddedSkeleton,
  NotebookIndexSkeleton,
  NotebookRouteFrame,
  NotebookRouteReady,
  NotebookRouteSkeleton,
} from '../src/components/notebook/NotebookLoading'
import { Route as NotebookRoute } from '../src/routes/notebook'
import { Route as NotebookRecordRoute } from '../src/routes/notebook_.$id'
import { Route as NotebookAiRoute } from '../src/routes/notebook_.ai'
import { Route as NotebookEsbuildRoute } from '../src/routes/notebook_.esbuild'
import { Route as NotebookNewRoute } from '../src/routes/notebook_.new'
import { Route as NotebookProjectRoute } from '../src/routes/notebook_.p.$hash'

const routeCases = [
  [
    'index',
    NotebookRoute,
    NotebookIndexSkeleton,
    'index',
    () => renderToStaticMarkup(<NotebookIndexSkeleton />),
  ],
  [
    'saved notebook',
    NotebookRecordRoute,
    NotebookEditorSkeleton,
    'editor',
    () => renderToStaticMarkup(<NotebookEditorSkeleton />),
  ],
  [
    'new notebook',
    NotebookNewRoute,
    NotebookDraftSkeleton,
    'editor',
    () => renderToStaticMarkup(<NotebookDraftSkeleton />),
  ],
  [
    'AI notebook',
    NotebookAiRoute,
    NotebookAiSkeleton,
    'editor',
    () => renderToStaticMarkup(<NotebookAiSkeleton />),
  ],
  [
    'shared project',
    NotebookProjectRoute,
    NotebookEmbeddedSkeleton,
    'embedded',
    () => renderToStaticMarkup(<NotebookEmbeddedSkeleton />),
  ],
  [
    'esbuild fixture',
    NotebookEsbuildRoute,
    NotebookEmbeddedSkeleton,
    'embedded',
    () => renderToStaticMarkup(<NotebookEmbeddedSkeleton />),
  ],
] as const

for (const [label, route, Pending, layout, renderPending] of routeCases) {
  test(`${label} route renders a server pending shell`, () => {
    assert.equal(route.options.ssr, false)
    assert.equal(route.options.pendingComponent, Pending)

    const html = renderPending()
    assert.match(html, new RegExp(`data-notebook-loading="${layout}"`))
    assert.match(html, /aria-busy="true"/)
  })
}

test('notebook skeletons reserve their final route geometry', () => {
  const index = renderToStaticMarkup(<NotebookIndexSkeleton />)
  const editor = renderToStaticMarkup(<NotebookEditorSkeleton />)
  const embedded = renderToStaticMarkup(<NotebookEmbeddedSkeleton />)
  const ai = renderToStaticMarkup(<NotebookAiSkeleton />)

  assert.match(index, /min-h-\[calc\(100dvh-var\(--navbar-height\)\)\]/)
  assert.match(
    editor,
    /fixed inset-x-0 top-\[var\(--navbar-height\)\] bottom-0/,
  )
  assert.match(embedded, /h-\[clamp\(520px,75dvh,720px\)\]/)
  assert.match(ai, /AI notebook spike/)
  assert.match(ai, /Local spike/)
  assert.match(ai, /motion-safe:animate-pulse/)
  assert.doesNotMatch(
    `${index}${editor}${embedded}${ai}`,
    /(?:^|\s)animate-pulse(?:\s|&quot;|")/,
  )
})

test('the editor skeleton reserves the tabbed workspace and chat dock', () => {
  const editor = renderToStaticMarkup(<NotebookEditorSkeleton />)
  const draft = renderToStaticMarkup(<NotebookDraftSkeleton />)
  const embedded = renderToStaticMarkup(<NotebookEmbeddedSkeleton />)

  assert.match(editor, /data-notebook-tab-skeleton="preview"/)
  assert.match(editor, /data-notebook-workspace-skeleton=""/)
  assert.match(editor, /data-notebook-chat-skeleton=""/)
  assert.match(editor, /data-notebook-chat-controls-skeleton=""/)
  assert.match(editor, /grid-rows-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/)
  assert.match(
    editor,
    /@min-\[900px\]:grid-cols-\[minmax\(280px,38fr\)_minmax\(0,62fr\)\]/,
  )
  assert.match(editor, /@min-\[900px\]:order-1/)
  assert.match(editor, /@min-\[900px\]:order-2/)
  assert.match(editor, /@min-\[900px\]:right-0/)
  assert.match(editor, /@min-\[900px\]:w-\[62%\]/)
  assert.match(editor, /@min-\[900px\]:pt-10/)
  assert.doesNotMatch(embedded, /data-notebook-chat-skeleton=""/)
  assert.doesNotMatch(draft, /data-notebook-chat-skeleton=""/)
  assert.doesNotMatch(embedded, /data-notebook-tab-skeleton="preview"/)
  assert.doesNotMatch(draft, /data-notebook-tab-skeleton="preview"/)
})

test('the synchronous router fallback selects each notebook layout', () => {
  assert.match(
    renderToStaticMarkup(<NotebookRouteSkeleton pathname="/notebook" />),
    /data-notebook-loading="index"/,
  )
  assert.match(
    renderToStaticMarkup(<NotebookRouteSkeleton pathname="/notebook/ai" />),
    /data-notebook-loading="editor"/,
  )
  assert.doesNotMatch(
    renderToStaticMarkup(<NotebookRouteSkeleton pathname="/notebook/new" />),
    /data-notebook-chat-skeleton=""/,
  )
  assert.match(
    renderToStaticMarkup(
      <NotebookRouteSkeleton pathname="/notebook/p/project-hash" />,
    ),
    /data-notebook-loading="embedded"/,
  )
  assert.match(
    renderToStaticMarkup(
      <NotebookRouteSkeleton pathname="/notebook/notebook-id" />,
    ),
    /data-notebook-loading="editor"/,
  )
  assert.equal(
    renderToStaticMarkup(<NotebookRouteSkeleton pathname="/blog" />),
    '',
  )
})

test('the root frame reserves notebook space before its route module mounts', () => {
  const html = renderToStaticMarkup(
    <NotebookRouteFrame pathname="/notebook/ai">
      <NotebookRouteReady>
        <main data-loaded-notebook="" />
      </NotebookRouteReady>
    </NotebookRouteFrame>,
  )

  assert.match(html, /data-notebook-shell=""/)
  assert.match(html, /data-notebook-initial=""/)
  assert.match(html, /data-notebook-ready=""/)
  assert.ok(
    html.indexOf('data-notebook-initial') <
      html.indexOf('data-loaded-notebook'),
  )
})
