import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidRepoPath } from '../src/utils/repo-path'
import { resolveDocsPathRedirect } from '../src/utils/docs-redirects'

const docsPath =
  'reference/@tanstack/namespaces/IR/variables/INCLUDES_SCALAR_FIELD'
test('scoped generated reference paths pass both content and route validation', () => {
  assert.equal(isValidRepoPath(`docs/${docsPath}.md`), true)
  assert.deepEqual(
    resolveDocsPathRedirect({
      defaultDocs: 'overview',
      docsPath,
      frameworks: [],
      manifest: { paths: [docsPath], redirects: {} },
    }),
    { type: 'render', docsPath },
  )
})
test('scoped path support preserves traversal and URL delimiter rejection', () => {
  for (const path of [
    '@scope/../secret',
    '@scope/./secret',
    '@scope//secret',
    '@scope/%2e%2e/secret',
    '@scope/file?raw=1',
    '@scope/file#fragment',
    '@scope\\secret',
    '//user@host/file',
    'https://user@host/file',
  ]) {
    assert.equal(isValidRepoPath(path), false, path)
  }
})
