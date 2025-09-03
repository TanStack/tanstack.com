import { ConvexHttpClient } from 'convex/browser'
import { memfs } from 'memfs'
import { tool } from 'ai'
import { z } from 'zod/v4'

import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

import { generateFileTree } from '~/forge/file-tree-generator'

function checkPath(path: string) {
  if (path.startsWith('./')) {
    return path
  }
  if (path.startsWith('/')) {
    return '.' + path
  }
  return './' + path
}

export const getTools = async (convex: ConvexHttpClient, projectId: string) => {
  const projectFiles = await convex.query(api.forge.getProjectFiles, {
    projectId: projectId as Id<'forge_projects'>,
  })

  const projectFilesObj = projectFiles.reduce(
    (acc: Record<string, string>, file: { path: string; content: string }) => {
      acc[file.path.replace('./', '')] = file.content
      return acc
    },
    {}
  )

  const fileTreeText = generateFileTree(projectFilesObj)

  const files = memfs(projectFilesObj)

  const listDirectory = tool({
    description: 'Read the contents of a directory',
    inputSchema: z.object({
      path: z
        .string()
        .describe('The path to the directory to read (/ for the root)'),
    }),
    execute: ({ path }: { path: string }) => {
      return files.vol.readdirSync(path, 'utf8').map((file) => ({
        name: file,
        type: files.vol.statSync(path).isDirectory() ? 'directory' : 'file',
      }))
    },
  })

  const readFile = tool({
    description: 'Read the contents of a file',
    inputSchema: z.object({
      path: z.string().describe('The path to the file to read'),
    }),
    execute: ({ path }: { path: string }) => {
      const content = files.vol.readFileSync(path, 'utf8')
      return content
    },
  })

  const writeFile = tool({
    description: 'Write to a file',
    inputSchema: z.object({
      path: z.string().describe('The path to the file to write to'),
      content: z.string().describe('The content to write to the file'),
    }),
    execute: async ({ path, content }: { path: string; content: string }) => {
      files.vol.writeFileSync(path, content)
      await convex.mutation(api.forge.updateFile, {
        projectId: projectId as Id<'forge_projects'>,
        path: checkPath(path),
        content,
      })
      return {
        type: 'success',
        message: `File ${path} written successfully`,
      }
    },
  })

  const deleteFile = tool({
    description: 'Delete a file',
    inputSchema: z.object({
      path: z.string().describe('The path to the file to delete'),
    }),
    execute: async ({ path }: { path: string }) => {
      await convex.mutation(api.forge.deleteFile, {
        projectId: projectId as Id<'forge_projects'>,
        path: checkPath(path),
      })
      files.vol.unlinkSync(path)
      return {
        type: 'success',
        message: `File ${path} deleted successfully`,
      }
    },
  })

  return {
    listDirectory,
    readFile,
    writeFile,
    deleteFile,
    fileTreeText,
  }
}
