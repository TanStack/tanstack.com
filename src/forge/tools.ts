import { ConvexHttpClient } from 'convex/browser'
import { memfs } from 'memfs'
import { tool } from 'ai'
import { z } from 'zod/v4'

import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

import { generateFileTree } from '~/forge/file-tree-generator'

function enforceFSPath(path: string) {
  if (path.startsWith('./')) {
    return path.replace('./', '/')
  }
  if (path.startsWith('/')) {
    return path
  }
  return '/' + path
}

function enforceStoredPath(path: string) {
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
      return files.vol.readdirSync(enforceFSPath(path), 'utf8').map((file) => ({
        name: file,
        type: files.vol.statSync(enforceFSPath(path)).isDirectory()
          ? 'directory'
          : 'file',
      }))
    },
  })

  const readFile = tool({
    description: 'Read the contents of a file',
    inputSchema: z.object({
      path: z.string().describe('The path to the file to read'),
    }),
    execute: ({ path }: { path: string }) => {
      const content = files.vol.readFileSync(enforceFSPath(path), 'utf8')
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
      files.vol.writeFileSync(enforceFSPath(path), content)
      await convex.mutation(api.forge.updateFile, {
        projectId: projectId as Id<'forge_projects'>,
        path: enforceStoredPath(path),
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
        path: enforceStoredPath(path),
      })
      files.vol.unlinkSync(enforceFSPath(path))
      return {
        type: 'success',
        message: `File ${path} deleted successfully`,
      }
    },
  })

  const addDependency = tool({
    description: 'Add one or more dependencies to package.json',
    inputSchema: z.object({
      modules: z
        .array(z.string())
        .describe('Array of module names to add as dependencies'),
      devDependency: z
        .boolean()
        .describe(
          'Whether to add as devDependencies (true) or dependencies (false)'
        ),
    }),
    execute: async ({
      modules,
      devDependency,
    }: {
      modules: string[]
      devDependency: boolean
    }) => {
      try {
        // Read current package.json
        const packageJsonPath = '/package.json'
        let packageJsonContent: string
        let packageJson: any

        try {
          packageJsonContent = files.vol.readFileSync(packageJsonPath, 'utf8')
          packageJson = JSON.parse(packageJsonContent)
        } catch (error) {
          return {
            type: 'error',
            message: 'Could not read package.json file',
            error: String(error),
          }
        }

        // Fetch latest versions from NPM for each module
        const dependencyVersions: Record<string, string> = {}
        const errors: string[] = []

        for (const module of modules) {
          try {
            const response = await fetch(
              `https://registry.npmjs.org/${module}/latest`
            )
            if (response.ok) {
              const data = await response.json()
              dependencyVersions[module] = `^${data.version}`
            } else {
              errors.push(
                `Failed to fetch version for ${module}: ${response.status}`
              )
            }
          } catch (error) {
            errors.push(
              `Error fetching version for ${module}: ${String(error)}`
            )
          }
        }

        if (errors.length > 0) {
          return {
            type: 'error',
            message: 'Some modules could not be fetched from NPM',
            errors,
          }
        }

        // Add dependencies to package.json
        const dependencyType = devDependency
          ? 'devDependencies'
          : 'dependencies'

        if (!packageJson[dependencyType]) {
          packageJson[dependencyType] = {}
        }

        for (const [module, version] of Object.entries(dependencyVersions)) {
          packageJson[dependencyType][module] = version
        }

        // Write updated package.json
        const updatedContent = JSON.stringify(packageJson, null, 2)
        files.vol.writeFileSync(packageJsonPath, updatedContent)

        await convex.mutation(api.forge.updateFile, {
          projectId: projectId as Id<'forge_projects'>,
          path: './package.json',
          content: updatedContent,
        })

        return {
          type: 'success',
          message: `Successfully added ${modules.length} ${
            devDependency ? 'dev ' : ''
          }dependencies`,
          addedDependencies: dependencyVersions,
          dependencyType,
        }
      } catch (error) {
        return {
          type: 'error',
          message: 'Failed to add dependencies',
          error: String(error),
        }
      }
    },
  })

  return {
    listDirectory,
    readFile,
    writeFile,
    deleteFile,
    addDependency,
    fileTreeText,
  }
}
