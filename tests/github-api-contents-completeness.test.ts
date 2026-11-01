import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runWithHostRuntimeEnv } from '../src/server/runtime/host.server'
import { fetchApiContents } from '../src/utils/documents.server'
import { resetGitHubContentCacheForTest } from '../src/utils/github-content-cache.server'
import { createMockR2Bucket } from './github-cache-test-utils'

test('directory fallback rejects missing children, then recovers with deep docs intact', async () => {
  resetGitHubContentCacheForTest()
  const mockR2 = createMockR2Bucket()
  const originalFetch = globalThis.fetch
  const leaf = 'docs/framework/react/course/project/checkpoints/final/index.md'
  let missingChild = true
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input)
    if (url.pathname.includes('/git/trees/')) {
      return new Response('rate limited', { status: 403 })
    }
    const directory = url.pathname.split('/contents/')[1]
    if (!directory || (missingChild && directory === 'docs/framework')) {
      return new Response('not found', { status: 404 })
    }
    assert.ok(leaf.startsWith(`${directory}/`))
    const name = leaf.slice(directory.length + 1).split('/')[0]
    const path = `${directory}/${name}`
    return Response.json([
      {
        name,
        path,
        type: path === leaf ? 'file' : 'dir',
        _links: {
          self: `https://api.github.com/repos/tanstack/router/contents/${path}`,
        },
      },
    ])
  }
  const load = () =>
    runWithHostRuntimeEnv({ GITHUB_CONTENT_CACHE: mockR2.bucket }, () =>
      fetchApiContents('tanstack/router', 'main', 'docs'),
    )
  try {
    await assert.rejects(
      load(),
      /Listed directory disappeared.*docs\/framework/,
    )
    assert.equal(
      mockR2.objects.has('github:dir/tanstack/router/main/docs'),
      false,
    )
    // A legacy depth-limited cache must not hide the deeper recovered paths.
    mockR2.objects.set('github:dir/tanstack/router/main/docs', {
      customMetadata: {},
      uploaded: new Date(),
      value: JSON.stringify({
        value: [
          {
            name: 'framework',
            path: 'docs/framework',
            type: 'dir',
            depth: 0,
            _links: { self: 'docs/framework' },
          },
        ],
      }),
    })
    missingChild = false
    let nodes = await load()
    assert.ok(nodes)
    for (const name of [
      'framework',
      'react',
      'course',
      'project',
      'checkpoints',
      'final',
    ]) {
      assert.equal(nodes[0]?.name, name)
      assert.ok(nodes[0].children)
      nodes = nodes[0].children
    }
    assert.equal(nodes[0]?.path, leaf)
    assert.ok(mockR2.objects.has('github:dir/tanstack/router/main/docs'))
  } finally {
    globalThis.fetch = originalFetch
  }
})
