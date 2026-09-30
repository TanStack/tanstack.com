import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement as createReactElement } from 'react'
import { renderToStaticMarkup as renderReactMarkup } from 'react-dom/server'
import { createElement } from '@tanstack/redact'
import { renderToStaticMarkup } from '@tanstack/redact/server'
import {
  shouldReloadExampleDocument,
  stackBlitzIframeProps,
} from '../src/utils/stackblitz-embed'

test('reloads an unisolated example entry once without creating a reload loop', () => {
  const entries = new Map<string, string>()
  const browser = {
    isSecureContext: true,
    crossOriginIsolated: false,
    sessionStorage: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value)
      },
      removeItem: (key: string) => {
        entries.delete(key)
      },
    },
  }
  const path = '/table/latest/docs/framework/svelte/examples/header-groups'

  assert.equal(shouldReloadExampleDocument(browser, path), true)
  assert.equal(shouldReloadExampleDocument(browser, path), false)
  browser.crossOriginIsolated = true
  assert.equal(shouldReloadExampleDocument(browser, path), false)
  assert.equal(entries.size, 0)
  browser.crossOriginIsolated = false
  browser.isSecureContext = false
  assert.equal(shouldReloadExampleDocument(browser, path), false)
})

test('does not automatically reload when storage cannot prevent a loop', () => {
  const browser = {
    isSecureContext: true,
    crossOriginIsolated: false,
    get sessionStorage(): Storage {
      throw new Error('Storage blocked')
    },
  }
  assert.equal(shouldReloadExampleDocument(browser, '/example'), false)
})

test('preserves credentialless in the production Redact renderer', () => {
  const markup = renderToStaticMarkup(
    createElement('iframe', stackBlitzIframeProps),
  )
  assert.match(markup, / credentialless="[^"]*"/)
  assert.match(markup, / allow="cross-origin-isolated"/)
})

test('preserves credentialless when Redact is disabled', () => {
  const markup = renderReactMarkup(
    createReactElement('iframe', stackBlitzIframeProps),
  )
  assert.match(markup, / credentialless="[^"]*"/)
})
