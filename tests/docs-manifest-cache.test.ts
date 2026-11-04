import assert from 'node:assert/strict'
import test from 'node:test'
import { dehydrate, hydrate, QueryClient } from '@tanstack/react-query'
import { docsPathManifestQueryOptions } from '../src/queries/docsManifest'
import { resolveDocsRoutePath } from '../src/utils/docs'

const request = {
  repo: 'tanstack/router',
  branch: 'main',
  docsRoot: 'docs/router',
}

test('docs navigation reuses the manifest hydrated by the server', async () => {
  const serverClient = new QueryClient()
  serverClient.setQueryData(docsPathManifestQueryOptions(request).queryKey, {
    paths: ['routing/routing-concepts', 'routing/route-trees'],
    redirects: {},
  })
  const browserClient = new QueryClient()
  hydrate(browserClient, dehydrate(serverClient))

  try {
    // These resolve entirely from hydrated data, without a server request.
    for (const docsPath of [
      'routing/routing-concepts',
      'routing/route-trees',
    ]) {
      assert.deepEqual(
        await resolveDocsRoutePath({
          ...request,
          queryClient: browserClient,
          defaultDocs: 'overview',
          frameworks: ['react', 'solid'],
          docsPath,
        }),
        { type: 'render', docsPath },
      )
    }

    assert.deepEqual(
      await resolveDocsRoutePath({
        ...request,
        queryClient: browserClient,
        defaultDocs: 'overview',
        frameworks: ['react', 'solid'],
        docsPath: 'framework/react/routing/route-trees',
      }),
      { type: 'redirect', docsPath: 'routing/route-trees' },
    )
  } finally {
    serverClient.clear()
    browserClient.clear()
  }
})

test('cached manifests stay separate for each repository, branch, and docs root', async () => {
  const queryClient = new QueryClient()
  const requests = [
    request,
    { ...request, repo: 'tanstack/query' },
    { ...request, branch: 'v0' },
    { ...request, docsRoot: 'docs/start' },
  ]

  try {
    for (const [index, data] of requests.entries()) {
      queryClient.setQueryData(docsPathManifestQueryOptions(data).queryKey, {
        paths: [`page-${index}`],
        redirects: {},
      })
    }

    for (const [index, data] of requests.entries()) {
      const opts = {
        ...data,
        queryClient,
        defaultDocs: 'overview',
        frameworks: ['react'],
      }
      assert.deepEqual(
        await resolveDocsRoutePath({ ...opts, docsPath: `page-${index}` }),
        { type: 'render', docsPath: `page-${index}` },
      )
      assert.deepEqual(
        await resolveDocsRoutePath({ ...opts, docsPath: 'missing' }),
        { type: 'not-found' },
      )
    }
  } finally {
    queryClient.clear()
  }
})
