import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readLocalDocsTree } from '../src/utils/local-docs-tree.server'

test('local tree reads nested docs, omits generated directories and symlinks, and stays inside the repo', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'docs-tree-'))
  try {
    const repo = path.join(root, 'repo')
    await mkdir(path.join(repo, 'docs', 'guide'), { recursive: true })
    await mkdir(path.join(repo, 'docs', 'node_modules'))
    await writeFile(path.join(repo, 'docs', 'guide', 'one.md'), '# One')
    await writeFile(path.join(root, 'outside.md'), 'outside')
    await symlink(
      path.join(root, 'outside.md'),
      path.join(repo, 'docs', 'linked.md'),
    )
    const tree = await readLocalDocsTree(repo, 'docs')
    assert.deepEqual(
      tree.map((entry) => entry.path),
      ['docs/guide'],
    )
    assert.equal(tree[0].children?.[0].path, 'docs/guide/one.md')
    assert.equal(tree[0].children?.[0].depth, 1)
    const rootTree = await readLocalDocsTree(repo, '')
    assert.deepEqual(
      rootTree.map((entry) => entry.path),
      ['docs'],
    )
    await mkdir(path.join(repo, '..docs'))
    await writeFile(path.join(repo, '..docs', 'valid.md'), '# Valid')
    assert.equal(
      (await readLocalDocsTree(repo, '..docs'))[0].path,
      '..docs/valid.md',
    )
    await assert.rejects(
      readLocalDocsTree(repo, '..'),
      /outside the repository/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('local trees include documentation below the former depth limit', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'docs-depth-'))
  try {
    const directory = 'docs/framework/react/course/project/checkpoints/final'
    await mkdir(path.join(root, directory), { recursive: true })
    await writeFile(path.join(root, directory, 'index.md'), '# Final')
    let nodes = await readLocalDocsTree(root, 'docs')
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
    assert.equal(nodes[0]?.path, `${directory}/index.md`)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
