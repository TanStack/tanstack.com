import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const originalCwd = process.cwd()
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-session-scope-'),
)

process.chdir(runtimeRoot)

try {
  const {
    getLocalForgeCurrentWorkspaceDir,
    resetLocalForgeRuntime,
    withLocalForgeRuntimeSession,
  } = await import('../src/builder/runtime/local-store.server')

  const sessionAWorkspace = await withLocalForgeRuntimeSession(
    'local-chat-a',
    async () => {
      await resetLocalForgeRuntime()
      const workspaceDir = getLocalForgeCurrentWorkspaceDir()

      await mkdir(path.join(workspaceDir, 'src'), { recursive: true })
      await writeFile(
        path.join(workspaceDir, 'src/a.ts'),
        'export const session = "a"\n',
        'utf8',
      )

      return workspaceDir
    },
  )

  const sessionBWorkspace = await withLocalForgeRuntimeSession(
    'local-chat-b',
    async () => {
      await resetLocalForgeRuntime()
      const workspaceDir = getLocalForgeCurrentWorkspaceDir()

      await mkdir(path.join(workspaceDir, 'src'), { recursive: true })
      await writeFile(
        path.join(workspaceDir, 'src/b.ts'),
        'export const session = "b"\n',
        'utf8',
      )

      return workspaceDir
    },
  )

  assert.notEqual(sessionAWorkspace, sessionBWorkspace)
  assert.equal(
    await readFile(path.join(sessionAWorkspace, 'src/a.ts'), 'utf8'),
    'export const session = "a"\n',
  )
  assert.equal(
    await readFile(path.join(sessionBWorkspace, 'src/b.ts'), 'utf8'),
    'export const session = "b"\n',
  )
  await assert.rejects(
    readFile(path.join(sessionBWorkspace, 'src/a.ts'), 'utf8'),
    isMissingFileError,
  )
} finally {
  process.chdir(originalCwd)
  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge session workspace scope verifier passed')

function isMissingFileError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  )
}
