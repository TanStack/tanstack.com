import assert from 'node:assert/strict'
import { isValidRepoPath } from '../src/utils/repo-path'

assert.equal(
  isValidRepoPath(
    'examples/react/start-clerk-basic/src/routes/_authed/posts.$postId.tsx',
  ),
  true,
  'TanStack route params are valid repo path segments',
)

assert.equal(
  isValidRepoPath('examples/react/start-clerk-basic/src/routes/__root.tsx'),
  true,
  'underscores remain valid repo path segments',
)

assert.equal(
  isValidRepoPath('../src/routes/__root.tsx'),
  false,
  'traversal is rejected',
)

assert.equal(
  isValidRepoPath('src/routes//__root.tsx'),
  false,
  'empty path segments are rejected',
)

assert.equal(
  isValidRepoPath('src/routes/app?file.tsx'),
  false,
  'query delimiters are rejected',
)

console.log('repo-path tests passed')
