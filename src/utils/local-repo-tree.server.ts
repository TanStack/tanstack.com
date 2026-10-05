import fs from 'node:fs/promises'
import path from 'node:path'
import type { GitHubFile, GitHubFileNode } from './documents.server'
import { multiSortBy, removeLeadingSlash } from './utils'

export async function readLocalRepoTree(
  resolvedBase: string,
  startingPath: string,
): Promise<Array<GitHubFileNode> | null> {
  const fsStartPath = path.join(resolvedBase, removeLeadingSlash(startingPath))

  const dirsAndFilesToIgnore = [
    'node_modules',
    '.git',
    'dist',
    'test-results',
    '.output',
    '.netlify',
    '.vercel',
    '.DS_Store',
    '.nitro',
    '.tanstack-start/build',
  ]

  async function getContentsForPath(
    filePath: string,
  ): Promise<Array<GitHubFile>> {
    try {
      const list = await fs.readdir(filePath, { withFileTypes: true })
      return list
        .filter((item) => !dirsAndFilesToIgnore.includes(item.name))
        .map((item) => {
          return {
            name: item.name,
            path: path.join(filePath, item.name),
            type: item.isDirectory() ? 'dir' : 'file',
            _links: {
              self: path.join(filePath, item.name),
            },
          }
        })
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return []
      }
      throw error
    }
  }

  const data = await getContentsForPath(fsStartPath)

  if (data.length === 0) {
    return null
  }

  async function buildFileTree(
    nodes: Array<GitHubFile> | undefined,
    depth: number,
    parentPath: string,
  ) {
    const result: Array<GitHubFileNode> = []

    const sortedNodes = multiSortBy(nodes ?? [], [
      (node) => (node.type === 'dir' ? -1 : 1),
      (node) => (node.name.startsWith('.') ? -1 : 1),
      (node) => node.name,
    ])

    for (const node of sortedNodes) {
      const file: GitHubFileNode = {
        ...node,
        depth,
        parentPath,
      }

      if (file.type === 'dir' && depth <= 3) {
        const directoryFiles = await getContentsForPath(file._links.self)
        file.children = await buildFileTree(
          directoryFiles,
          depth + 1,
          `${parentPath}${file.path}/`,
        )
      }

      // This replacement is only being done to more accurately mock the GitHub API response
      file.path = removeLeadingSlash(file.path.replace(resolvedBase, ''))
      file._links.self = removeLeadingSlash(
        file._links.self.replace(resolvedBase, ''),
      )

      result.push(file)
    }

    return result
  }

  const fileTree = await buildFileTree(data, 0, '')
  return fileTree
}
