import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { getImportFallbackRepoDirs } from '../src/utils/local-repo-path.server'

// Build both the inputs and the expectations through `node:path` so the
// assertions hold on Windows, where a POSIX-style absolute path picks up the
// current drive letter and backslash separators.
const root = path.resolve('/workspace/GitHub')

assert.deepEqual(
  getImportFallbackRepoDirs(
    pathToFileURL(
      path.join(root, 'tanstack.com', 'src', 'utils', 'documents.server.ts'),
    ).href,
    'charts',
  ),
  [path.join(root, 'charts')],
  'a normal checkout resolves a sibling repository',
)

assert.deepEqual(
  getImportFallbackRepoDirs(
    pathToFileURL(
      path.join(
        root,
        'charts',
        'tanstack.com-charts-site',
        'src',
        'utils',
        'documents.server.ts',
      ),
    ).href,
    'charts',
  ),
  [path.join(root, 'charts'), path.join(root, 'charts', 'charts')],
  'a nested worktree resolves its enclosing repository before a sibling fallback',
)

console.log('local repo path tests passed')
