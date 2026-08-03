import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchRepoFile, fetchRepoRawFile } from '../src/utils/documents.server'
import {
  InvalidCacheKeyError,
  resetGitHubContentCacheForTest,
} from '../src/utils/github-content-cache.server'

test('raw GitHub content remains byte-for-byte text-equivalent', async () => {
  resetGitHubContentCacheForTest()

  const originalFetch = globalThis.fetch
  const revision = '3'.repeat(40)
  const path = 'assets/raw-contract-AbC_1.js'
  const source = `const marker = "![chart](https://raw.githubusercontent.com/tanstack/charts/main/chart.svg)"\n`
  let requestUrl = ''
  let originCalls = 0

  globalThis.fetch = async (input) => {
    originCalls += 1
    requestUrl = String(input)
    return new Response(source, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }

  try {
    const transformed = await fetchRepoFile('tanstack/charts', revision, path)
    assert.notEqual(transformed, source)

    const result = await fetchRepoRawFile('tanstack/charts', revision, path)

    assert.equal(result, source)
    assert.equal(originCalls, 2)
    assert.equal(
      requestUrl,
      `https://raw.githubusercontent.com/tanstack/charts/${revision}/${path}`,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('raw GitHub content rejects unsafe inputs before fetching', async () => {
  const originalFetch = globalThis.fetch
  let originCalls = 0

  globalThis.fetch = async () => {
    originCalls += 1
    return new Response('unexpected')
  }

  try {
    const invalidInputs = [
      ['tanstack/charts/extra', 'main', 'catalog.json'],
      ['tanstack/..', 'main', 'catalog.json'],
      ['tanstack/charts', '../main', 'catalog.json'],
      ['tanstack/charts', 'main', ''],
      ['tanstack/charts', 'main', '../catalog.json'],
      ['tanstack/charts', 'main', '/catalog.json'],
      ['tanstack/charts', 'main', 'assets//catalog.js'],
      ['tanstack/charts', 'main', 'assets\\catalog.js'],
    ] as const

    for (const [repo, ref, path] of invalidInputs) {
      await assert.rejects(
        fetchRepoRawFile(repo, ref, path),
        InvalidCacheKeyError,
      )
    }

    assert.equal(originCalls, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})
