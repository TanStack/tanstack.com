import fs from 'node:fs/promises'
import path from 'node:path'
import type { GitHubFileNode } from './documents.server'

const ignored = new Set([
  'node_modules',
  '.git',
  'dist',
  'test-results',
  '.output',
  '.netlify',
  '.vercel',
  '.DS_Store',
  '.nitro',
])

export async function readLocalDocsTree(
  repoDir: string,
  directory: string,
  depth = 0,
): Promise<Array<GitHubFileNode>> {
  const root = await fs.realpath(repoDir)
  const resolved = await fs.realpath(path.resolve(repoDir, directory))
  const relative = path.relative(root, resolved)
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error('Directory is outside the repository')
  const entries = (await fs.readdir(resolved, { withFileTypes: true }))
    .filter((entry) => !ignored.has(entry.name) && !entry.isSymbolicLink())
    .sort(
      (a, b) =>
        Number(b.isDirectory()) - Number(a.isDirectory()) ||
        Number(b.name.startsWith('.')) - Number(a.name.startsWith('.')) ||
        a.name.localeCompare(b.name),
    )
  return Promise.all(
    entries.map(async (entry) => {
      const filePath = path.posix.join(directory, entry.name)
      return {
        name: entry.name,
        path: filePath,
        type: entry.isDirectory() ? 'dir' : 'file',
        depth,
        parentPath: directory,
        _links: { self: filePath },
        ...(entry.isDirectory() && depth <= 3
          ? { children: await readLocalDocsTree(repoDir, filePath, depth + 1) }
          : {}),
      }
    }),
  )
}
