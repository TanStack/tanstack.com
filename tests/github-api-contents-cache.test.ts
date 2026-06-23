import assert from 'node:assert/strict'
import { runWithHostRuntimeEnv } from '../src/server/runtime/host.server'
import { fetchApiContents } from '../src/utils/documents.server'
import { createMockR2Bucket } from './github-cache-test-utils'
import type { GitHubFileNode } from '../src/utils/documents.server'

const repo = 'tanstack/router'
const gitRef = 'main'
const startingPath = 'examples/react/kitchen-sink'

const mockR2 = createMockR2Bucket()
mockR2.objects.set(
  'github:dir/tanstack/router/main/__github_recursive_tree__',
  {
    customMetadata: {},
    uploaded: new Date(),
    value: JSON.stringify({
      value: {
        sha: 'root-sha',
        tree: [
          {
            path: startingPath,
            sha: 'example-sha',
            type: 'tree',
            url: 'https://api.github.com/tree/example-sha',
          },
          {
            path: `${startingPath}/package.json`,
            sha: 'package-sha',
            size: 100,
            type: 'blob',
            url: 'https://api.github.com/blob/package-sha',
          },
          {
            path: `${startingPath}/src`,
            sha: 'src-sha',
            type: 'tree',
            url: 'https://api.github.com/tree/src-sha',
          },
          {
            path: `${startingPath}/src/main.tsx`,
            sha: 'main-sha',
            size: 200,
            type: 'blob',
            url: 'https://api.github.com/blob/main-sha',
          },
        ],
        truncated: false,
        url: 'https://api.github.com/tree/root-sha',
      },
    }),
  },
)

const contents: Array<GitHubFileNode> | null = await runWithHostRuntimeEnv(
  { GITHUB_CONTENT_CACHE: mockR2.bucket },
  () => fetchApiContents(repo, gitRef, startingPath),
)

assert.ok(contents)
assert.deepEqual(
  contents.map((node) => node.name),
  ['src', 'package.json'],
)

const src = contents.find((node) => node.name === 'src')
assert.ok(src?.children)
assert.deepEqual(
  src.children.map((node) => node.name),
  ['main.tsx'],
)

const persistedDirectory = mockR2.objects.get(
  'github:dir/tanstack/router/main/examples/react/kitchen-sink',
)
assert.ok(persistedDirectory)
assert.equal(persistedDirectory.customMetadata?.repo, repo)
assert.equal(persistedDirectory.customMetadata?.gitRef, gitRef)
assert.equal(persistedDirectory.customMetadata?.isPresent, 'true')

console.log('github-api-contents-cache tests passed')
