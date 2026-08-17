import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { SandboxBrowser } from '../src/components/examples/SandboxBrowser.client'

function renderBrowser(reloadDisabled: boolean) {
  const props = {
    canGoBack: false,
    canGoForward: false,
    currentUrl: '/',
    history: ['/'],
    children: createElement('div'),
    onBack() {},
    onForward() {},
    onNavigate() {},
    onReload() {},
    reloadDisabled,
  }
  return renderToStaticMarkup(createElement(SandboxBrowser, props))
}

test('disables only the preview reload action when requested', () => {
  const disabled = load(renderBrowser(true))
  const enabled = load(renderBrowser(false))

  assert.equal(
    disabled('button[aria-label="Reload preview"]').attr('disabled'),
    'disabled',
  )
  assert.equal(
    enabled('button[aria-label="Reload preview"]').attr('disabled'),
    undefined,
  )
  assert.equal(
    disabled('button[aria-label="Preview actions"]').attr('disabled'),
    undefined,
  )
})
