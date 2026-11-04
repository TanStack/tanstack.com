import assert from 'node:assert/strict'
import test from 'node:test'
import { getDocsEmbedRuntimeHeaders } from '../src/utils/docs-embed-headers'
import { webContainerHeaders } from '../src/utils/stackblitz-embed'

test('docs with an AI client-example get WebContainer isolation headers', () => {
  const headers = getDocsEmbedRuntimeHeaders({
    content: [
      '# Basic Chat',
      '',
      '<!-- ::client-example library=ai framework=react slug=basic-chat -->',
    ].join('\n'),
    version: 'latest',
  })

  assert.deepEqual(headers, webContainerHeaders)
})

test('docs without a client-example get no isolation headers', () => {
  const headers = getDocsEmbedRuntimeHeaders({
    content: '# Overview\n\nNo sandbox here.',
    version: 'latest',
  })

  assert.deepEqual(headers, {})
})

test('docs with a bad client-example comment get no isolation headers', () => {
  const headers = getDocsEmbedRuntimeHeaders({
    content:
      '<!-- ::client-example library=ai framework=react slug=../secret -->',
    version: 'latest',
  })

  assert.deepEqual(headers, {})
})
