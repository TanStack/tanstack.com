import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ensureCacheableFetchExampleFilesResponse,
  fetchExampleFiles,
  isFetchExampleFilesResponse,
} from '../src/utils/github-example.server'
import {
  getCachedDocsArtifact,
  resetGitHubContentCacheForTest,
} from '../src/utils/github-content-cache.server'

test('preserves repository text and binary file contents', async () => {
  resetGitHubContentCacheForTest()

  const originalFetch = globalThis.fetch
  const requestedUrls: Array<string> = []
  const source = 'export const message = "Hello, 世界"\n'
  const bomSource = '\uFEFFexport const value = 1\n'
  const faviconBytes = new Uint8Array([0, 1, 2, 3, 255])
  const invalidUtf8Bytes = new Uint8Array([0xc3, 0x28])

  globalThis.fetch = async (input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    requestedUrls.push(url)

    if (url.includes('/git/trees/main?recursive=1')) {
      return Response.json({
        tree: [
          {
            path: 'examples/react/binary/public/favicon.ico',
            sha: 'favicon-sha',
            size: faviconBytes.byteLength,
            type: 'blob',
            url: 'https://api.github.com/blob/favicon-sha',
          },
          {
            path: 'examples/react/binary/src/main.ts',
            sha: 'main-sha',
            size: new TextEncoder().encode(source).byteLength,
            type: 'blob',
            url: 'https://api.github.com/blob/main-sha',
          },
          {
            path: 'examples/react/binary/src/bom.ts',
            sha: 'bom-sha',
            size: new TextEncoder().encode(bomSource).byteLength,
            type: 'blob',
            url: 'https://api.github.com/blob/bom-sha',
          },
          {
            path: 'examples/react/binary/public/invalid.bin',
            sha: 'invalid-sha',
            size: invalidUtf8Bytes.byteLength,
            type: 'blob',
            url: 'https://api.github.com/blob/invalid-sha',
          },
        ],
        truncated: false,
      })
    }

    if (url.endsWith('/examples/react/binary/public/favicon.ico')) {
      return new Response(faviconBytes, {
        headers: { 'content-type': 'application/octet-stream' },
      })
    }

    if (url.endsWith('/examples/react/binary/src/main.ts')) {
      return new Response(source, {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }

    if (url.endsWith('/examples/react/binary/src/bom.ts')) {
      return new Response(new TextEncoder().encode(bomSource), {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }

    if (url.endsWith('/examples/react/binary/public/invalid.bin')) {
      return new Response(invalidUtf8Bytes, {
        headers: { 'content-type': 'application/octet-stream' },
      })
    }

    return new Response('not found', { status: 404 })
  }

  try {
    const result = await fetchExampleFiles(
      'tanstack/router',
      'main',
      'examples/react/binary',
      { preserveBinary: true },
    )

    assert.deepEqual(result, {
      success: true,
      files: {
        'src/bom.ts': bomSource,
        'src/main.ts': source,
      },
      binaryFiles: {
        'public/favicon.ico': 'AAECA/8=',
        'public/invalid.bin': 'wyg=',
      },
    })
    assert.ok(
      requestedUrls.some((url) =>
        url.endsWith('/examples/react/binary/public/favicon.ico'),
      ),
    )
  } finally {
    globalThis.fetch = originalFetch
    resetGitHubContentCacheForTest()
  }
})

test('validates cached repository workspace payloads', () => {
  assert.equal(
    isFetchExampleFilesResponse({
      success: true,
      files: { 'src/main.ts': 'export {}' },
      binaryFiles: { 'public/favicon.ico': 'AAE=' },
    }),
    true,
  )
  assert.equal(
    isFetchExampleFilesResponse({
      success: true,
      files: { 'src/main.ts': 42 },
    }),
    false,
  )
})

test('does not cache transient repository workspace failures', async () => {
  resetGitHubContentCacheForTest()

  let buildCalls = 0
  const getWorkspace = () =>
    getCachedDocsArtifact({
      artifactKey: 'workspace-v1',
      artifactType: 'client-example',
      build: async () => {
        buildCalls += 1
        return ensureCacheableFetchExampleFilesResponse(
          buildCalls === 1
            ? {
                success: false,
                error: 'temporary network failure',
                reason: 'fetch-failed',
              }
            : {
                success: true,
                files: { 'src/main.ts': 'export {}' },
              },
        )
      },
      docsRoot: 'examples/react/transient',
      gitRef: 'main',
      isValue: isFetchExampleFilesResponse,
      repo: 'tanstack/router',
    })

  await assert.rejects(getWorkspace(), /temporary network failure/)
  assert.deepEqual(await getWorkspace(), {
    success: true,
    files: { 'src/main.ts': 'export {}' },
  })
  assert.deepEqual(await getWorkspace(), {
    success: true,
    files: { 'src/main.ts': 'export {}' },
  })
  assert.equal(buildCalls, 2)

  resetGitHubContentCacheForTest()
})
