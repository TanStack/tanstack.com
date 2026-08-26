import * as React from 'react'
import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  BuilderAiSkeleton,
  BuilderProjectDraftSkeleton,
  BuilderEditorSkeleton,
  BuilderEmbeddedSkeleton,
  BuilderIndexSkeleton,
  BuilderRouteFrame,
  BuilderRouteReady,
  BuilderRouteSkeleton,
} from '../src/components/builder/BuilderLoading'
import { Route as BuilderRoute } from '../src/routes/builder'
import { Route as BuilderProjectRoute } from '../src/routes/builder_.$id'
import { Route as BuilderAiRoute } from '../src/routes/builder_.ai'
import { Route as BuilderEsbuildRoute } from '../src/routes/builder_.esbuild'
import { Route as BuilderNewRoute } from '../src/routes/builder_.new'
import { Route as BuilderSnapshotRoute } from '../src/routes/builder_.p.$hash'

const routeCases = [
  [
    'index',
    BuilderRoute,
    BuilderIndexSkeleton,
    'index',
    () => renderToStaticMarkup(<BuilderIndexSkeleton />),
  ],
  [
    'saved project',
    BuilderProjectRoute,
    BuilderEditorSkeleton,
    'editor',
    () => renderToStaticMarkup(<BuilderEditorSkeleton />),
  ],
  [
    'new project',
    BuilderNewRoute,
    BuilderProjectDraftSkeleton,
    'editor',
    () => renderToStaticMarkup(<BuilderProjectDraftSkeleton />),
  ],
  [
    'AI project',
    BuilderAiRoute,
    BuilderAiSkeleton,
    'editor',
    () => renderToStaticMarkup(<BuilderAiSkeleton />),
  ],
  [
    'shared project',
    BuilderSnapshotRoute,
    BuilderEmbeddedSkeleton,
    'embedded',
    () => renderToStaticMarkup(<BuilderEmbeddedSkeleton />),
  ],
  [
    'esbuild fixture',
    BuilderEsbuildRoute,
    BuilderEmbeddedSkeleton,
    'embedded',
    () => renderToStaticMarkup(<BuilderEmbeddedSkeleton />),
  ],
] as const

for (const [label, route, Pending, layout, renderPending] of routeCases) {
  test(`${label} route renders a server pending shell`, () => {
    assert.equal(route.options.ssr, false)
    assert.equal(route.options.pendingComponent, Pending)

    const html = renderPending()
    assert.match(html, new RegExp(`data-builder-loading="${layout}"`))
    assert.match(html, /aria-busy="true"/)
  })
}

test('builder skeletons reserve their final route geometry', () => {
  const index = renderToStaticMarkup(<BuilderIndexSkeleton />)
  const editor = renderToStaticMarkup(<BuilderEditorSkeleton />)
  const embedded = renderToStaticMarkup(<BuilderEmbeddedSkeleton />)
  const ai = renderToStaticMarkup(<BuilderAiSkeleton />)

  assert.match(index, /min-h-\[calc\(100dvh-var\(--navbar-height\)\)\]/)
  assert.match(
    editor,
    /fixed inset-x-0 top-\[var\(--navbar-height\)\] bottom-0/,
  )
  assert.match(embedded, /h-\[clamp\(520px,75dvh,720px\)\]/)
  assert.match(ai, /AI builder spike/)
  assert.match(ai, /Local spike/)
  assert.match(ai, /motion-safe:animate-pulse/)
  assert.doesNotMatch(
    `${index}${editor}${embedded}${ai}`,
    /(?:^|\s)animate-pulse(?:\s|&quot;|")/,
  )
})

test('the editor skeleton reserves the tabbed workspace and chat dock', () => {
  const editor = renderToStaticMarkup(<BuilderEditorSkeleton />)
  const draft = renderToStaticMarkup(<BuilderProjectDraftSkeleton />)
  const embedded = renderToStaticMarkup(<BuilderEmbeddedSkeleton />)

  assert.match(editor, /data-builder-tab-skeleton="preview"/)
  assert.match(editor, /data-builder-workspace-skeleton=""/)
  assert.match(editor, /data-builder-chat-skeleton=""/)
  assert.match(editor, /data-builder-chat-controls-skeleton=""/)
  assert.match(editor, /grid-rows-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/)
  assert.match(
    editor,
    /@min-\[900px\]:grid-cols-\[minmax\(280px,38fr\)_minmax\(0,62fr\)\]/,
  )
  assert.match(editor, /@min-\[900px\]:order-1/)
  assert.match(editor, /@min-\[900px\]:order-2/)
  assert.match(editor, /@min-\[900px\]:right-0/)
  assert.match(editor, /@min-\[900px\]:w-\[62%\]/)
  assert.match(editor, /@min-\[900px\]:pt-9/)
  assert.match(editor, /border-b border-border-subtle/)
  assert.match(editor, /rounded-none/)
  assert.doesNotMatch(
    editor,
    /overflow-hidden border border-border-default bg-background-default/,
  )
  assert.doesNotMatch(editor, /border-x-0 border-b-0/)
  assert.match(draft, /data-builder-chat-skeleton=""/)
  assert.match(draft, /data-builder-tab-skeleton="preview"/)
  assert.doesNotMatch(embedded, /data-builder-chat-skeleton=""/)
  assert.doesNotMatch(embedded, /data-builder-tab-skeleton="preview"/)
})

test('the synchronous router fallback selects each builder layout', () => {
  assert.match(
    renderToStaticMarkup(<BuilderRouteSkeleton pathname="/builder" />),
    /data-builder-loading="index"/,
  )
  assert.match(
    renderToStaticMarkup(<BuilderRouteSkeleton pathname="/builder/ai" />),
    /data-builder-loading="editor"/,
  )
  assert.match(
    renderToStaticMarkup(<BuilderRouteSkeleton pathname="/builder/new" />),
    /data-builder-chat-skeleton=""/,
  )
  assert.match(
    renderToStaticMarkup(
      <BuilderRouteSkeleton pathname="/builder/p/project-hash" />,
    ),
    /data-builder-loading="embedded"/,
  )
  assert.match(
    renderToStaticMarkup(
      <BuilderRouteSkeleton pathname="/builder/builder-id" />,
    ),
    /data-builder-loading="editor"/,
  )
  assert.equal(
    renderToStaticMarkup(<BuilderRouteSkeleton pathname="/blog" />),
    '',
  )
})

test('the root frame reserves builder space before its route module mounts', () => {
  const html = renderToStaticMarkup(
    <BuilderRouteFrame pathname="/builder/ai">
      <BuilderRouteReady>
        <main data-loaded-builder="" />
      </BuilderRouteReady>
    </BuilderRouteFrame>,
  )

  assert.match(html, /data-builder-shell=""/)
  assert.match(html, /data-builder-initial=""/)
  assert.match(html, /data-builder-ready=""/)
  assert.ok(
    html.indexOf('data-builder-initial') < html.indexOf('data-loaded-builder'),
  )
})
