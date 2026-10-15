import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fetchApiContents } from '../src/utils/documents.server'
import { env } from '../src/utils/env'

test('missing local docs fall back remotely, but empty local docs recover locally', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'local-docs-recovery-'))
  const originalNodeEnv = process.env.NODE_ENV
  const originalRemote = process.env.TANSTACK_DOCS_USE_REMOTE
  const originalRoot = env.TANSTACK_LOCAL_REPOS_DIR
  const originalFetch = globalThis.fetch
  process.env.NODE_ENV = 'development'
  delete process.env.TANSTACK_DOCS_USE_REMOTE
  env.TANSTACK_LOCAL_REPOS_DIR = root
  const repo = path.basename(root)
  let remoteCalls = 0
  globalThis.fetch = async (input) => {
    remoteCalls++
    const url = new URL(input instanceof Request ? input.url : input)
    return Response.json(
      url.pathname.includes('/contents/') ? [] : { tree: [], truncated: false },
    )
  }
  const load = () => fetchApiContents(`tanstack/${repo}`, 'main', 'docs')
  try {
    await load()
    assert.ok(remoteCalls > 0)
    const callsAfterFallback = remoteCalls
    const docs = path.join(root, repo, 'docs')
    await mkdir(docs, { recursive: true })
    assert.deepEqual(await load(), [])
    assert.equal(remoteCalls, callsAfterFallback)
    await writeFile(
      path.join(docs, 'restored.md'),
      '---\ntitle: Restored\n---\nRestored\n',
    )
    assert.ok((await load())?.some((file) => file.name === 'restored.md'))
    assert.equal(remoteCalls, callsAfterFallback)
  } finally {
    globalThis.fetch = originalFetch
    env.TANSTACK_LOCAL_REPOS_DIR = originalRoot
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    if (originalRemote === undefined)
      delete process.env.TANSTACK_DOCS_USE_REMOTE
    else process.env.TANSTACK_DOCS_USE_REMOTE = originalRemote
    await rm(root, { recursive: true, force: true })
  }
})
