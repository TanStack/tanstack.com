import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Panel, PanelContent } from '../src/components/Panel'

function createContent(children: React.ReactNode) {
  const props: React.ComponentProps<typeof PanelContent> = { children }
  return React.createElement(PanelContent, props)
}

test('panel supports horizontal disclosure', () => {
  const openProps: React.ComponentProps<typeof Panel> = {
    open: true,
    orientation: 'horizontal',
    children: createContent('Side panel'),
  }
  const closedProps: React.ComponentProps<typeof Panel> = {
    open: false,
    orientation: 'horizontal',
    children: createContent('Side panel'),
  }
  const openMarkup = renderToStaticMarkup(
    React.createElement(Panel, openProps),
  )
  const closedMarkup = renderToStaticMarkup(
    React.createElement(Panel, closedProps),
  )

  assert.match(openMarkup, /data-orientation="horizontal"/)
  assert.match(openMarkup, /grid-cols-\[1fr\]/)
  assert.match(closedMarkup, /grid-cols-\[0fr\]/)
  assert.match(closedMarkup, /aria-hidden="true"/)
})

test('panel remains vertical by default', () => {
  const props: React.ComponentProps<typeof Panel> = {
    open: true,
    children: createContent('Details'),
  }
  const markup = renderToStaticMarkup(React.createElement(Panel, props))

  assert.match(markup, /data-orientation="vertical"/)
  assert.match(markup, /grid-rows-\[1fr\]/)
})
