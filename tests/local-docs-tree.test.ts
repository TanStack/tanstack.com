import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readLocalRepoTree } from '../src/utils/local-repo-tree.server'
import { resolveDocsPathRedirect } from '../src/utils/docs-redirects'
import type { GitHubFileNode } from '../src/utils/documents.server'

test('local framework guides remain renderable before they exist upstream', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'local-docs-'))
  try {
    const guide = 'framework/svelte/guides/debouncing'
    for (const doc of [guide, 'guides/debouncing']) {
      const file = path.join(root, 'docs', `${doc}.md`)
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, '# Debouncing')
    }
    const tree = await readLocalRepoTree(root, 'docs')
    assert.ok(tree)
    function paths(nodes: Array<GitHubFileNode>): Array<string> {
      return nodes.flatMap((node) => [
        ...(node.type === 'file'
          ? [node.path.replace(/^docs\//, '').replace(/\.md$/, '')]
          : []),
        ...paths(node.children ?? []),
      ])
    }
    const manifest = { paths: paths(tree), redirects: {} }
    assert.ok(manifest.paths.includes(guide))
    assert.deepEqual(
      resolveDocsPathRedirect({
        defaultDocs: 'overview',
        docsPath: guide,
        frameworks: ['svelte'],
        manifest,
      }),
      { type: 'render', docsPath: guide },
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
