import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import {
  createExampleSandboxBrowserScript,
  createExampleSandboxDocument,
  isExampleSandboxBrowserCommandMessage,
  isExampleSandboxBrowserMessage,
} from '../src/utils/example-sandbox.client'

test('keeps fragment links inside the sandbox document', () => {
  const document = createExampleSandboxDocument({
    compiled: {
      css: '',
      imports: {},
      javascript: '',
    },
    document: undefined,
    browserChannel: 'test-browser',
    entry: '/src/main.ts',
    files: { '/src/main.ts': '' },
    runToken: 'test-run',
    theme: 'light',
  })

  assert.match(document, /getClientHash\(href\)/)
  assert.match(document, /event\.preventDefault\(\)/)
  assert.match(document, /target\?\.scrollIntoView\(\)/)
  assert.match(document, /const channel = "test-browser"/)
})

test('instruments browser navigation in every preview environment', () => {
  const client = createExampleSandboxBrowserScript({
    channel: 'client-browser',
    mode: 'client',
  })
  const webContainer = createExampleSandboxBrowserScript({
    channel: 'container-browser',
    mode: 'webcontainer',
  })

  new vm.Script(client)
  new vm.Script(webContainer)

  for (const script of [client, webContainer]) {
    assert.match(script, /history\.pushState =/)
    assert.match(script, /history\.replaceState =/)
    assert.match(script, /'pageshow'/)
    assert.match(script, /navigation\?\.type === 'back_forward'/)
    assert.match(
      script,
      /navigation\?\.type === 'back_forward' \? 'pop' : 'load',\s+true,/,
    )
    assert.match(script, /'popstate'/)
    assert.match(script, /'hashchange'/)
    assert.match(script, /'tanstack-example-sandbox:browser-command'/)
    assert.match(script, /value\.kind === 'annotation'/)
    assert.match(script, /closest\('a\[href\]'\)/)
    assert.match(script, /event\.defaultPrevented/)
    assert.match(script, /new URL\(href, document\.baseURI\)/)
    assert.match(script, /getClientHash\(href\)/)
    assert.match(script, /event\.target instanceof HTMLFormElement/)
  }

  assert.match(client, /only supports in-page links/)
  assert.match(webContainer, /url\.origin !== location\.origin/)
  assert.match(webContainer, /location\.assign\(url\.href\)/)
})

test('strictly validates browser state and annotation messages by channel', () => {
  assert.equal(
    isExampleSandboxBrowserMessage(
      {
        channel: 'browser-1',
        kind: 'browser-state',
        navigationKind: 'push',
        title: 'Chart',
        type: 'tanstack-example-sandbox:browser',
        url: '/reports?range=week#sales',
      },
      'browser-1',
    ),
    true,
  )
  assert.equal(
    isExampleSandboxBrowserMessage(
      {
        channel: 'browser-2',
        kind: 'browser-state',
        navigationKind: 'push',
        title: 'Chart',
        type: 'tanstack-example-sandbox:browser',
        url: '/reports',
      },
      'browser-1',
    ),
    false,
  )
  assert.equal(
    isExampleSandboxBrowserMessage(
      {
        channel: 'browser-1',
        kind: 'annotation-target',
        rect: { height: 40, width: 120, x: 12, y: 16 },
        selector: 'main > button.primary',
        tag: 'button',
        text: 'Save',
        type: 'tanstack-example-sandbox:browser',
      },
      'browser-1',
    ),
    true,
  )
  assert.equal(
    isExampleSandboxBrowserMessage(
      {
        channel: 'browser-1',
        kind: 'annotation-target',
        rect: { height: 40, width: Number.NaN, x: 12, y: 16 },
        selector: 'button',
        tag: 'button',
        text: 'Save',
        type: 'tanstack-example-sandbox:browser',
      },
      'browser-1',
    ),
    false,
  )
})

test('strictly validates browser commands by channel', () => {
  assert.equal(
    isExampleSandboxBrowserCommandMessage(
      {
        channel: 'browser-1',
        kind: 'navigate',
        type: 'tanstack-example-sandbox:browser-command',
        url: '/dashboard',
      },
      'browser-1',
    ),
    true,
  )
  assert.equal(
    isExampleSandboxBrowserCommandMessage(
      {
        channel: 'browser-1',
        enabled: 'yes',
        kind: 'annotation',
        type: 'tanstack-example-sandbox:browser-command',
      },
      'browser-1',
    ),
    false,
  )
  assert.equal(
    isExampleSandboxBrowserCommandMessage(
      {
        channel: 'browser-1',
        kind: 'capture',
        requestId: 'capture-1',
        type: 'tanstack-example-sandbox:browser-command',
      },
      'browser-1',
    ),
    true,
  )
})

test('caps screenshot payloads returned by the sandbox', () => {
  assert.equal(
    isExampleSandboxBrowserMessage(
      {
        bytes: new ArrayBuffer(64),
        channel: 'browser-1',
        kind: 'capture-result',
        mimeType: 'image/png',
        requestId: 'capture-1',
        type: 'tanstack-example-sandbox:browser',
      },
      'browser-1',
    ),
    true,
  )
  assert.equal(
    isExampleSandboxBrowserMessage(
      {
        bytes: new ArrayBuffer(8_000_001),
        channel: 'browser-1',
        kind: 'capture-result',
        mimeType: 'image/png',
        requestId: 'capture-1',
        type: 'tanstack-example-sandbox:browser',
      },
      'browser-1',
    ),
    false,
  )
})
