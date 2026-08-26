import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Panel, PanelContent } from '../src/components/Panel'

function createContent(children: React.ReactNode) {
  const props: React.ComponentProps<typeof PanelContent> = { children }
  return React.createElement(PanelContent, props)
}

test('panel remains vertical by default', () => {
  const props: React.ComponentProps<typeof Panel> = {
    open: true,
    children: createContent('Details'),
  }
  const markup = renderToStaticMarkup(React.createElement(Panel, props))

  assert.match(markup, /grid-rows-\[1fr\]/)
})
