import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { SandboxBrowser } from '../src/components/examples/SandboxBrowser.client'

function renderBrowser(
  reloadDisabled: boolean,
  error?: string,
  currentUrl = '/',
) {
  const props = {
    canGoBack: false,
    canGoForward: false,
    currentUrl,
    history: ['/'],
    error,
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

test('renders a fixed preview origin beside an editable path', () => {
  const page = load(
    renderBrowser(
      false,
      undefined,
      'https://3000-example.webcontainer-api.io/products?sort=name#list',
    ),
  )
  const input = page('input[type="text"]')
  const label = input.closest('label')
  const origin = label.find('span[aria-hidden="true"]')

  assert.match(label.text(), /Preview address\s*localhost:3000/)
  assert.equal(origin.text().trim(), 'localhost:3000')
  assert.equal(input.attr('value'), '/products?sort=name#list')
})

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

test('renders preview errors with neutral details and a concise announcement', () => {
  const page = load(
    renderBrowser(
      false,
      "SyntaxError: Missing export 'band'\n    at /index.tsx:4:10",
    ),
  )
  const error = page('[role="group"][aria-label="Preview error"]')
  const details = error.find('pre[aria-label="Preview error details"]')

  assert.equal(error.length, 1)
  assert.equal(
    error.find('[role="alert"]').text().trim(),
    'Preview failed. Error details are shown.',
  )
  assert.match(details.attr('class') ?? '', /text-text-secondary/)
  assert.doesNotMatch(error.attr('class') ?? '', /border-l-border-error/)
  assert.match(details.text(), /Missing export 'band'\n\s+at \/index\.tsx/)
})
