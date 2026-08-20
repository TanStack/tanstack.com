import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Collapsible, CollapsibleContent } from '../src/components/Collapsible'

function createContent(children: React.ReactNode) {
  const props: React.ComponentProps<typeof CollapsibleContent> = { children }
  return React.createElement(CollapsibleContent, props)
}

test('collapsible supports horizontal disclosure', () => {
  const openProps: React.ComponentProps<typeof Collapsible> = {
    open: true,
    orientation: 'horizontal',
    children: createContent('Side panel'),
  }
  const closedProps: React.ComponentProps<typeof Collapsible> = {
    open: false,
    orientation: 'horizontal',
    children: createContent('Side panel'),
  }
  const openMarkup = renderToStaticMarkup(
    React.createElement(Collapsible, openProps),
  )
  const closedMarkup = renderToStaticMarkup(
    React.createElement(Collapsible, closedProps),
  )

  assert.match(openMarkup, /data-orientation="horizontal"/)
  assert.match(openMarkup, /grid-cols-\[1fr\]/)
  assert.match(closedMarkup, /grid-cols-\[0fr\]/)
  assert.match(closedMarkup, /aria-hidden="true"/)
})

test('collapsible remains vertical by default', () => {
  const props: React.ComponentProps<typeof Collapsible> = {
    open: true,
    children: createContent('Details'),
  }
  const markup = renderToStaticMarkup(React.createElement(Collapsible, props))

  assert.match(markup, /data-orientation="vertical"/)
  assert.match(markup, /grid-rows-\[1fr\]/)
})
