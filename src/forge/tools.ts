import { ConvexHttpClient } from 'convex/browser'
import { memfs } from 'memfs'
import { tool } from 'ai'
import { z } from 'zod/v4'
import { dirname } from 'path'

import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

import { generateFileTree } from '~/forge/file-tree-generator'
import {
  createSerializedOptionsFromPersisted,
  getFrameworkById,
  getAllAddOns,
  createDefaultEnvironment,
} from '@tanstack/cta-engine'
import { addToAppWrapper } from '~/forge/engine-handling/add-to-app-wrapper'
import { createAppWrapper } from '~/forge/engine-handling/create-app-wrapper'
import { setServerEnvironment } from '~/forge/engine-handling/server-environment'
import type { DryRunOutput } from '~/forge/types'

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
      return String(content)
    },
  })

  const writeFile = tool({
    description: 'Write to a file (creates parent directories if they don\'t exist)',
    inputSchema: z.object({
      path: z.string().describe('The path to the file to write to'),
      content: z.string().describe('The content to write to the file'),
    }),
    execute: async ({ path, content }: { path: string; content: string }) => {
      const fsPath = enforceFSPath(path)
      const dirPath = dirname(fsPath)
      
      // Create parent directories if they don't exist
      if (!files.vol.existsSync(dirPath)) {
        files.vol.mkdirSync(dirPath, { recursive: true })
      }
      
      files.vol.writeFileSync(fsPath, content)
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
          packageJsonContent = String(
            files.vol.readFileSync(packageJsonPath, 'utf8')
          )
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

  const listAddOns = tool({
    description: 'List available TanStack add-ons for the current application',
    inputSchema: z.object({
      includeInstalled: z
        .boolean()
        .optional()
        .describe(
          'Whether to include already installed add-ons (default: false)'
        ),
    }),
    execute: async ({ includeInstalled = false }) => {
      try {
        // Set up the server environment for the in-memory project
        setServerEnvironment({ projectPath: '/', mode: 'add' })

        // Check if this is a TanStack project by looking for config
        const configFiles = Object.keys(projectFilesObj).filter(
          (path) => path.endsWith('.cta.json') || path === '.cta.json'
        )

        if (configFiles.length === 0) {
          return {
            type: 'error',
            message:
              'No TanStack configuration found. This may not be a TanStack project.',
          }
        }

        // Read and parse the config
        const configContent = projectFilesObj[configFiles[0].replace('./', '')]
        const persistedOptions = JSON.parse(configContent)

        // Convert to serialized options
        const serializedOptions =
          createSerializedOptionsFromPersisted(persistedOptions)

        // Get framework
        const framework = await getFrameworkById(serializedOptions.framework)
        if (!framework) {
          return {
            type: 'error',
            message: `Framework '${serializedOptions.framework}' not found`,
          }
        }

        // Get all available add-ons for this framework/mode
        const allAddOns = getAllAddOns(framework, serializedOptions.mode)

        // Filter based on what's already installed if requested
        const installedIds = serializedOptions.chosenAddOns || []
        const filteredAddOns = includeInstalled
          ? allAddOns
          : allAddOns.filter((addon) => !installedIds.includes(addon.id))

        return {
          type: 'success',
          framework: serializedOptions.framework,
          mode: serializedOptions.mode,
          installedAddOns: installedIds,
          availableAddOns: filteredAddOns.map((addon) => ({
            id: addon.id,
            name: addon.name,
            description: addon.description,
            type: addon.type,
            dependsOn: addon.dependsOn || [],
          })),
        }
      } catch (error) {
        return {
          type: 'error',
          message: 'Failed to list add-ons',
          error: String(error),
        }
      }
    },
  })

  const addAddOn = tool({
    description:
      'Add TanStack add-ons to the current application with conflict detection',
    inputSchema: z.object({
      addOnIds: z.array(z.string()).describe('Array of add-on IDs to install'),
      mode: z
        .enum(['preview', 'apply'])
        .optional()
        .describe(
          'Preview shows what would change, apply makes the changes (default: preview)'
        ),
    }),
    execute: async ({ addOnIds, mode = 'preview' }) => {
      try {
        // Set up the server environment
        setServerEnvironment({ projectPath: '/', mode: 'add' })

        // Store current state
        const currentState = { ...projectFilesObj }

        // Find config file
        const configFiles = Object.keys(projectFilesObj).filter(
          (path) => path.endsWith('.cta.json') || path === '.cta.json'
        )

        if (configFiles.length === 0) {
          return {
            type: 'error',
            message: 'No TanStack configuration found',
          }
        }

        // For apply mode, we need to set up the environment
        // and actually run the add-on installation
        if (mode === 'apply') {
          // Create a tracking environment that syncs with our memfs
          const environmentFactory = () => {
            const env = createDefaultEnvironment()
            const originalWriteFile = env.writeFile
            const originalDeleteFile = env.deleteFile

            env.writeFile = async (path: string, content: string) => {
              // Normalize path for our storage
              const normalizedPath = path
                .replace(/^\//, '')
                .replace(/^\.\//, '')

              // Ensure parent directories exist
              const fsPath = enforceFSPath(path)
              const dirPath = dirname(fsPath)
              if (!files.vol.existsSync(dirPath)) {
                files.vol.mkdirSync(dirPath, { recursive: true })
              }

              // Update memfs
              files.vol.writeFileSync(fsPath, content)

              // Update Convex storage
              await convex.mutation(api.forge.updateFile, {
                projectId: projectId as Id<'forge_projects'>,
                path: enforceStoredPath(normalizedPath),
                content,
              })

              // Update our local projectFilesObj
              projectFilesObj[normalizedPath] = content

              // Call original
              return originalWriteFile(path, content)
            }

            env.deleteFile = async (path: string) => {
              const normalizedPath = path
                .replace(/^\//, '')
                .replace(/^\.\//, '')

              // Update memfs
              if (files.vol.existsSync(enforceFSPath(path))) {
                files.vol.unlinkSync(enforceFSPath(path))
              }

              // Update Convex storage
              await convex.mutation(api.forge.deleteFile, {
                projectId: projectId as Id<'forge_projects'>,
                path: enforceStoredPath(normalizedPath),
              })

              // Update our local projectFilesObj
              delete projectFilesObj[normalizedPath]

              // Call original
              return originalDeleteFile(path)
            }

            return env
          }

          // Run the actual add-on installation
          const result = await addToAppWrapper(addOnIds, {
            dryRun: false,
            environmentFactory,
          })

          return {
            type: 'success',
            status: 'applied',
            message: `Successfully added ${addOnIds.length} add-on(s)`,
            result,
          }
        }

        // Preview mode - run dry-run to detect changes and conflicts
        const withAddOnsOutput = (await addToAppWrapper(addOnIds, {
          dryRun: true,
        })) as DryRunOutput

        // Get the current config to generate baseline
        const configContent = projectFilesObj[configFiles[0].replace('./', '')]
        const persistedOptions = JSON.parse(configContent)
        const baselineOptions = createSerializedOptionsFromPersisted({
          ...persistedOptions,
          chosenAddOns: persistedOptions.chosenAddOns || [],
        })

        // Generate baseline (what the app looks like with current config)
        const baselineOutput = (await createAppWrapper(baselineOptions, {
          dryRun: true,
        })) as DryRunOutput

        // Analyze differences
        const analysis = {
          conflicts: [] as Array<{
            path: string
            baseline: string
            current: string
            withAddOn: string
            fileType: string
          }>,
          safeChanges: [] as Array<{ path: string; content: string }>,
          newFiles: [] as Array<{ path: string; content: string }>,
          unchanged: [] as string[],
        }

        // Check each file that would be affected
        for (const [path, withAddOnContent] of Object.entries(
          withAddOnsOutput.files
        )) {
          const normalizedPath = path.replace(/^\.?\//, '')
          const currentContent = currentState[normalizedPath]
          const baselineContent = baselineOutput.files[path]

          if (!currentContent && withAddOnContent) {
            // New file from add-on
            analysis.newFiles.push({
              path: normalizedPath,
              content: withAddOnContent,
            })
          } else if (
            currentContent === baselineContent &&
            currentContent !== withAddOnContent
          ) {
            // User hasn't modified from baseline, safe to update
            analysis.safeChanges.push({
              path: normalizedPath,
              content: withAddOnContent,
            })
          } else if (
            currentContent &&
            currentContent !== baselineContent &&
            currentContent !== withAddOnContent &&
            baselineContent !== withAddOnContent
          ) {
            // Three-way conflict: user modified, add-on wants different changes
            const fileType = path.endsWith('router.tsx')
              ? 'router'
              : path.endsWith('Root.tsx')
              ? 'root-component'
              : path.includes('/components/')
              ? 'component'
              : 'other'

            analysis.conflicts.push({
              path: normalizedPath,
              baseline: baselineContent || '// File did not exist in baseline',
              current: currentContent,
              withAddOn: withAddOnContent,
              fileType,
            })
          } else if (currentContent === withAddOnContent) {
            // Already has the add-on changes
            analysis.unchanged.push(normalizedPath)
          }
        }

        return {
          type: 'success',
          status: 'preview',
          analysis,
          summary: {
            totalChanges: Object.keys(withAddOnsOutput.files).length,
            conflicts: analysis.conflicts.length,
            safeToApply: analysis.safeChanges.length + analysis.newFiles.length,
            unchanged: analysis.unchanged.length,
          },
          recommendation:
            analysis.conflicts.length === 0
              ? 'No conflicts detected. Safe to apply changes.'
              : `Found ${analysis.conflicts.length} conflict(s) that need manual resolution.`,
        }
      } catch (error) {
        return {
          type: 'error',
          message: 'Failed to add add-ons',
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
    listAddOns,
    addAddOn,
    fileTreeText,
  }
}
