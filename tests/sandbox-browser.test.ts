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
    onBack() {},
    onForward() {},
    onNavigate() {},
    onReload() {},
    reloadDisabled,
  }
  return renderToStaticMarkup(
    createElement(SandboxBrowser, props, createElement('div')),
  )
}

function renderAnnotatedBrowser(annotationMode: boolean) {
  return renderToStaticMarkup(
    createElement(
      SandboxBrowser,
      {
        annotationAvailable: true,
        annotationMode,
        canGoBack: false,
        canGoForward: false,
        currentUrl: '/',
        history: ['/'],
        onAnnotationModeChange() {},
        onBack() {},
        onForward() {},
        onNavigate() {},
        onReload() {},
      },
      createElement('div'),
    ),
  )
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

test('uses an icon-only preview commenting control', () => {
  const inactive = load(renderAnnotatedBrowser(false))
  const active = load(renderAnnotatedBrowser(true))
  const inactiveButton = inactive('button[aria-label="Comment on preview"]')
  const activeButton = active('button[aria-label="Stop commenting"]')

  assert.equal(inactiveButton.text().trim(), '')
  assert.equal(inactiveButton.attr('aria-pressed'), 'false')
  assert.equal(activeButton.text().trim(), '')
  assert.equal(activeButton.attr('aria-pressed'), 'true')
  assert.doesNotMatch(inactive.html(), /Commenting/)
})
