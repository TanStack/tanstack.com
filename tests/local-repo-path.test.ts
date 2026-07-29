import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { getImportFallbackRepoDirs } from '../src/utils/local-repo-path.server'

assert.deepEqual(
  getImportFallbackRepoDirs(
    pathToFileURL(
      '/workspace/GitHub/tanstack.com/src/utils/documents.server.ts',
    ).href,
    'charts',
  ),
  ['/workspace/GitHub/charts'],
  'a normal checkout resolves a sibling repository',
)

assert.deepEqual(
  getImportFallbackRepoDirs(
    pathToFileURL(
      '/workspace/GitHub/charts/tanstack.com-charts-site/src/utils/documents.server.ts',
    ).href,
    'charts',
  ),
  ['/workspace/GitHub/charts', '/workspace/GitHub/charts/charts'],
  'a nested worktree resolves its enclosing repository before a sibling fallback',
)

console.log('local repo path tests passed')
