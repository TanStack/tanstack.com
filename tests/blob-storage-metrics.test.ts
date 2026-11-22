import assert from 'node:assert/strict'
import test from 'node:test'
import {
  measureBlobStorageOperations,
  recordBlobStorageOperation,
} from '../src/server/runtime/blob-storage-metrics.server'

test('R2 measurements retain nested causes and failed attempts without logging object data', async (t) => {
  const logs: Array<string> = []
  t.mock.method(console, 'log', (message: string) => logs.push(message))
  await assert.rejects(
    measureBlobStorageOperations('markGitHubContentStale', async () => {
      recordBlobStorageOperation('githubContentCache', 'list')
      await measureBlobStorageOperations('putGitHubContent', async () => {
        recordBlobStorageOperation('githubContentCache', 'put')
        throw new Error('storage failed')
      })
    }),
    /storage failed/,
  )
  assert.equal(logs.length, 1)
  assert.deepEqual(JSON.parse(logs[0]), {
    event: 'r2_operations',
    source: 'markGitHubContentStale',
    sampleRate: 1,
    operations: {
      'githubContentCache:markGitHubContentStale': {
        get: 0,
        put: 0,
        list: 1,
        delete: 0,
      },
      'githubContentCache:putGitHubContent': {
        get: 0,
        put: 1,
        list: 0,
        delete: 0,
      },
    },
  })
})
