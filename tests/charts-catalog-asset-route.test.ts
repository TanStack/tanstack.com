import assert from 'node:assert/strict'
import test from 'node:test'
import { serveCatalogAsset } from '../src/routes/charts.catalog_.assets.$artifactRevision.$'
import { ChartsCatalogIntegrityError } from '../src/utils/charts-catalog.server'
import { resetGitHubContentCacheForTest } from '../src/utils/github-content-cache.server'
import {
  artifactRevision,
  createChartsCatalogManifest,
  createChartsCatalogManifestV5,
  previewAsset,
  previewSvg,
  tanstackAsset,
} from './charts-catalog-test-fixture'

const notFoundBody = 'Charts catalog asset not found'
const catalogDistRefUrl =
  'https://api.github.com/repos/tanstack/charts/git/ref/heads/catalog-dist'

test('catalog asset handler serves verified v5 SVG previews', async () => {
  resetGitHubContentCacheForTest()

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)

    if (url === catalogDistRefUrl) {
      return Response.json({ object: { sha: artifactRevision } })
    }
    if (
      url.startsWith('https://api.github.com/repos/tanstack/charts/commits?')
    ) {
      return Response.json([{ sha: artifactRevision }])
    }
    if (
      url ===
      `https://raw.githubusercontent.com/tanstack/charts/${artifactRevision}/catalog.json`
    ) {
      return Response.json(createChartsCatalogManifestV5())
    }
    if (
      url ===
      `https://raw.githubusercontent.com/tanstack/charts/${artifactRevision}/${previewAsset}`
    ) {
      return new Response(previewSvg)
    }

    return new Response('Not found', { status: 404 })
  }

  try {
    const response = await requestCatalogAsset({
      artifactRevision,
      assetPath: previewAsset,
      method: 'GET',
    })

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('Content-Type'),
      'image/svg+xml; charset=utf-8',
    )
    assert.equal(response.headers.get('Content-Length'), '68')
    assert.equal(
      response.headers.get('Cache-Control'),
      'public, max-age=31536000, immutable',
    )
    assert.equal(await response.text(), previewSvg)
  } finally {
    globalThis.fetch = originalFetch
    resetGitHubContentCacheForTest()
  }
})

test('catalog asset handler returns explicit no-store 404 responses', async () => {
  resetGitHubContentCacheForTest()

  const originalFetch = globalThis.fetch
  const unpublishedRevision = '4'.repeat(40)
  const requests = new Array<string>()

  globalThis.fetch = async (input) => {
    const url = String(input)
    requests.push(url)

    if (
      url.startsWith('https://api.github.com/repos/tanstack/charts/commits?')
    ) {
      return Response.json([{ sha: artifactRevision }])
    }

    if (url === catalogDistRefUrl) {
      return Response.json({ object: { sha: artifactRevision } })
    }

    if (
      url ===
      `https://raw.githubusercontent.com/tanstack/charts/${artifactRevision}/catalog.json`
    ) {
      return Response.json(createChartsCatalogManifest())
    }

    return new Response('Not found', { status: 404 })
  }

  try {
    const invalidRevision = await requestCatalogAsset({
      artifactRevision: 'main',
      assetPath: tanstackAsset,
      method: 'GET',
    })
    await assertNotFoundResponse(invalidRevision, 'GET')

    const unpublished = await requestCatalogAsset({
      artifactRevision: unpublishedRevision,
      assetPath: tanstackAsset,
      method: 'GET',
    })
    await assertNotFoundResponse(unpublished, 'GET')

    const unlisted = await requestCatalogAsset({
      artifactRevision,
      assetPath: 'assets/tanstack-invalid.js',
      method: 'GET',
    })
    await assertNotFoundResponse(unlisted, 'GET')

    const unlistedHead = await requestCatalogAsset({
      artifactRevision,
      assetPath: 'assets/tanstack-invalid.js',
      method: 'HEAD',
    })
    await assertNotFoundResponse(unlistedHead, 'HEAD')

    assert.deepEqual(requests, [
      catalogDistRefUrl,
      `https://raw.githubusercontent.com/tanstack/charts/${artifactRevision}/catalog.json`,
      'https://api.github.com/repos/tanstack/charts/commits?sha=catalog-dist&per_page=100',
    ])
    assert.equal(
      requests.some((url) => url.includes(unpublishedRevision)),
      false,
    )
  } finally {
    globalThis.fetch = originalFetch
    resetGitHubContentCacheForTest()
  }
})

test('catalog asset handler returns 404 for missing manifests and files', async () => {
  const originalFetch = globalThis.fetch

  try {
    resetGitHubContentCacheForTest()
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url === catalogDistRefUrl) {
        return Response.json({ object: { sha: artifactRevision } })
      }
      if (
        url.startsWith('https://api.github.com/repos/tanstack/charts/commits?')
      ) {
        return Response.json([{ sha: artifactRevision }])
      }
      return new Response('Not found', { status: 404 })
    }

    const missingManifest = await requestCatalogAsset({
      artifactRevision,
      assetPath: tanstackAsset,
      method: 'GET',
    })
    await assertNotFoundResponse(missingManifest, 'GET')

    resetGitHubContentCacheForTest()
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url === catalogDistRefUrl) {
        return Response.json({ object: { sha: artifactRevision } })
      }
      if (
        url.startsWith('https://api.github.com/repos/tanstack/charts/commits?')
      ) {
        return Response.json([{ sha: artifactRevision }])
      }
      if (
        url ===
        `https://raw.githubusercontent.com/tanstack/charts/${artifactRevision}/catalog.json`
      ) {
        return Response.json(createChartsCatalogManifest())
      }
      return new Response('Not found', { status: 404 })
    }

    const missingAsset = await requestCatalogAsset({
      artifactRevision,
      assetPath: tanstackAsset,
      method: 'GET',
    })
    await assertNotFoundResponse(missingAsset, 'GET')
  } finally {
    globalThis.fetch = originalFetch
    resetGitHubContentCacheForTest()
  }
})

test('catalog asset handler preserves transient and integrity failures', async () => {
  const originalFetch = globalThis.fetch
  const originalConsoleError = console.error

  try {
    console.error = () => undefined
    resetGitHubContentCacheForTest()
    globalThis.fetch = async () => new Response('Unavailable', { status: 500 })

    const unavailable = await requestCatalogAsset({
      artifactRevision,
      assetPath: tanstackAsset,
      method: 'GET',
    })
    assert.equal(unavailable.status, 503)
    assert.equal(unavailable.headers.get('Cache-Control'), 'no-store')
    assert.equal(
      unavailable.headers.get('Cloudflare-CDN-Cache-Control'),
      'no-store',
    )
    assert.equal(unavailable.headers.get('Retry-After'), '60')
    assert.equal(
      await unavailable.text(),
      'Charts catalog asset temporarily unavailable',
    )

    resetGitHubContentCacheForTest()
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url === catalogDistRefUrl) {
        return Response.json({ object: { sha: artifactRevision } })
      }
      if (
        url.startsWith('https://api.github.com/repos/tanstack/charts/commits?')
      ) {
        return Response.json([{ sha: artifactRevision }])
      }
      if (
        url ===
        `https://raw.githubusercontent.com/tanstack/charts/${artifactRevision}/catalog.json`
      ) {
        return Response.json(createChartsCatalogManifest())
      }
      return new Response('tampered asset')
    }

    await assert.rejects(
      requestCatalogAsset({
        artifactRevision,
        assetPath: tanstackAsset,
        method: 'GET',
      }),
      ChartsCatalogIntegrityError,
    )
  } finally {
    globalThis.fetch = originalFetch
    console.error = originalConsoleError
    resetGitHubContentCacheForTest()
  }
})

function requestCatalogAsset({
  artifactRevision,
  assetPath,
  method,
}: {
  artifactRevision: string
  assetPath: string
  method: 'GET' | 'HEAD'
}) {
  return serveCatalogAsset({
    request: new Request(
      `https://tanstack.com/charts/catalog/assets/${artifactRevision}/${assetPath}`,
      { method },
    ),
    params: {
      artifactRevision,
      _splat: assetPath,
    },
  })
}

async function assertNotFoundResponse(
  response: Response,
  method: 'GET' | 'HEAD',
) {
  assert.equal(response.status, 404)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store')
  assert.equal(
    response.headers.get('Content-Type'),
    'text/plain; charset=utf-8',
  )
  assert.equal(
    response.headers.get('Content-Length'),
    String(new TextEncoder().encode(notFoundBody).byteLength),
  )
  assert.equal(await response.text(), method === 'HEAD' ? '' : notFoundBody)
}
