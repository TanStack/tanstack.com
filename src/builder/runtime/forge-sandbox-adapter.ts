import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { BuilderFileSource } from '~/builder/schema'

type ForgeWorkspaceFile = {
  contents: string
  path: string
  source: BuilderFileSource
}

export const SANDBOX_WORKSPACE_IGNORED_DIRECTORIES: ReadonlySet<string> =
  new Set(['.git', '.tanstack', '.codex', 'dist', 'node_modules'])

export const SANDBOX_WORKSPACE_IGNORED_FILE_PATHS: ReadonlySet<string> = new Set(
  ['pnpm-workspace.yaml', 'src/routeTree.gen.ts'],
)

export type SandboxFileOp = { kind: 'upsert' | 'delete'; path: string }

export function normalizeSandboxFileChunk(chunk: {
  type: string
  name?: string
  value?: unknown
}): SandboxFileOp | null {
  if (chunk.type !== 'CUSTOM') return null
  // file.changed carries a whole-tree git diff — not a per-file op, ignore it
  if (chunk.name !== 'sandbox.file') return null
  const value = chunk.value as { type?: string; path?: string } | undefined
  const filePath = value?.path
  if (!filePath) return null
  const kind = value?.type === 'delete' ? 'delete' : 'upsert'
  return { kind, path: normalizeRelativePath(filePath) }
}

export async function seedSandboxWorkspaceDir(input: {
  dir: string
  workspace: Map<string, ForgeWorkspaceFile>
}): Promise<void> {
  for (const file of input.workspace.values()) {
    const target = path.join(input.dir, file.path)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, file.contents, 'utf8')
  }
}

export async function reconcileSandboxWorkspace(input: {
  dir: string
  workspace: Map<string, ForgeWorkspaceFile>
  protectedPaths?: ReadonlySet<string>
}): Promise<{ changedPaths: Array<string>; deletedPaths: Array<string> }> {
  const onDisk = await listWorkspaceFiles(input.dir)
  const changedPaths: Array<string> = []
  const deletedPaths: Array<string> = []

  for (const [relPath, contents] of onDisk) {
    if (SANDBOX_WORKSPACE_IGNORED_FILE_PATHS.has(relPath)) continue
    const existing = input.workspace.get(relPath)
    if (!existing || existing.contents !== contents) {
      changedPaths.push(relPath)
      // Any file the sandbox agent wrote or modified is agent-authored, even if
      // it previously came from the builder definition. Tagging it `agent` keeps
      // parity with the old harnesses and ensures validateWorkspace (which only
      // runs per-file checks for `source === 'agent'`) actually validates the edit.
      input.workspace.set(relPath, {
        contents,
        path: relPath,
        source: 'agent',
      })
    }
  }

  for (const relPath of Array.from(input.workspace.keys())) {
    if (onDisk.has(relPath)) continue
    if (SANDBOX_WORKSPACE_IGNORED_FILE_PATHS.has(relPath)) continue
    if (input.protectedPaths?.has(relPath)) continue
    deletedPaths.push(relPath)
    input.workspace.delete(relPath)
  }

  return {
    changedPaths: changedPaths.sort(),
    deletedPaths: deletedPaths.sort(),
  }
}

async function listWorkspaceFiles(dir: string): Promise<Map<string, string>> {
  const files = new Map<string, string>()
  async function walk(current: string, prefix: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SANDBOX_WORKSPACE_IGNORED_DIRECTORIES.has(entry.name)) continue
        await walk(path.join(current, entry.name), `${prefix}${entry.name}/`)
        continue
      }
      const relPath = `${prefix}${entry.name}`
      const fileStat = await stat(path.join(current, entry.name))
      if (fileStat.size > 2 * 1024 * 1024) continue // 2MB cap
      files.set(relPath, await readFile(path.join(current, entry.name), 'utf8'))
    }
  }
  await walk(dir, '')
  return files
}

function normalizeRelativePath(filePath: string): string {
  return filePath
    .replace(/^[./]+/, '')
    .split(path.sep)
    .join('/')
}
