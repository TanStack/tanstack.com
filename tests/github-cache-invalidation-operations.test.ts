import assert from 'node:assert/strict'
import test from 'node:test'
import { runWithHostRuntimeEnv } from '../src/server/runtime/host.server'
import {
  getCachedGitHubTextFile,
  markGitHubContentStale,
  resetGitHubContentCacheForTest,
} from '../src/utils/github-content-cache.server'
import { createMockR2Bucket } from './github-cache-test-utils'

test('push invalidation includes inherited docs and raw cache paths without affecting other refs', async () => {
  resetGitHubContentCacheForTest()
  const mock = createMockR2Bucket()
  const repo = 'tanstack/router'
  const gitRef = 'main'
  const files = ['docs/base.md', 'docs/alias.md', '.tanstack-raw/docs/base.md']
  await runWithHostRuntimeEnv(
    { GITHUB_CONTENT_CACHE: mock.bucket },
    async () => {
      for (const path of files) {
        await getCachedGitHubTextFile({
          repo,
          gitRef,
          path,
          origin: async () => 'before push',
        })
      }
      await getCachedGitHubTextFile({
        repo,
        gitRef: 'other',
        path: files[0],
        origin: async () => 'other ref',
      })
      assert.equal(await markGitHubContentStale({ repo, gitRef }), 3)
      for (const [key, object] of mock.objects) {
        assert.equal(
          object.customMetadata?.staleAt === new Date(0).toISOString(),
          key.includes('/main/'),
          key,
        )
      }
      // An alias can depend on a changed base file even though its own path is unchanged.
      for (const path of files) {
        assert.equal(
          await getCachedGitHubTextFile({
            repo,
            gitRef,
            path,
            origin: async () => 'after push',
          }),
          'after push',
        )
      }
      assert.equal(
        await getCachedGitHubTextFile({
          repo,
          gitRef: 'other',
          path: files[0],
          origin: async () => {
            throw new Error('other refs must remain fresh')
          },
        }),
        'other ref',
      )
    },
  )
  resetGitHubContentCacheForTest()
})
