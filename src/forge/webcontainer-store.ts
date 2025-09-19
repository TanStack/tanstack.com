import {
  FileSystemTree,
  WebContainer,
  WebContainerProcess,
} from '@webcontainer/api'
import { createStore } from 'zustand'
import originalShimALS from './als-shim'

export type SetupStep =
  | 'mounting'
  | 'installing'
  | 'starting'
  | 'ready'
  | 'error'

type WebContainerStore = {
  webContainer: Promise<WebContainer> | null
  ready: boolean
  setupStep: SetupStep
  statusMessage: string
  terminalOutput: string[]
  previewUrl: string | null
  error: string | null
  devProcess: WebContainerProcess | null
  projectFiles: Array<{ path: string; content: string }>

  teardown: () => void
  updateProjectFiles: (
    projectFiles: Array<{ path: string; content: string }>
  ) => Promise<void>

  startDevServer: () => Promise<void>
  addTerminalOutput: (output: string) => void
  installDependencies: () => Promise<void>
}

const processTerminalLine = (data: string): string => {
  // Simple clean up of terminal output - remove common ANSI codes
  let cleaned = data

  // Remove common ANSI escape sequences
  cleaned = cleaned.replace(/\u001b\[[\d;]*m/g, '') // Color codes
  cleaned = cleaned.replace(/\u001b\[[\d;]*[A-Za-z]/g, '') // Cursor/display codes
  cleaned = cleaned.replace(/\u001b\][\d;]*;[^\u0007]*\u0007/g, '') // Title codes

  // Remove non-printable characters except newlines and tabs
  cleaned = cleaned.replace(
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g,
    ''
  )

  return cleaned.trim()
}

let webContainer: Promise<WebContainer> | null = null

export default function createWebContainerStore(shouldShimALS: boolean) {
  const shimALS = shouldShimALS
    ? originalShimALS
    : (fileName: string, content: string) => content

  if (!webContainer) {
    webContainer = WebContainer.boot()
  }

  const store = createStore<WebContainerStore>((set, get) => ({
    webContainer,
    ready: false,
    setupStep: 'mounting',
    statusMessage: '',
    terminalOutput: [],
    previewUrl: null,
    error: null,
    devProcess: null,
    projectFiles: [],

    teardown: () => {
      set({ webContainer: null, ready: false })
    },
    addTerminalOutput: (output: string) => {
      set(({ terminalOutput }) => ({
        terminalOutput: [...terminalOutput, output],
      }))
    },
    startDevServer: async () => {
      const { devProcess, webContainer, terminalOutput, addTerminalOutput } =
        get()
      if (!webContainer) {
        throw new Error('WebContainer not found')
      }

      try {
        const container = await webContainer
        if (!container) {
          throw new Error('WebContainer not found')
        }
        if (devProcess) {
          console.log('Killing existing dev process...')
          devProcess.kill()
          set({ devProcess: null })
        }

        set({
          setupStep: 'starting',
          statusMessage: 'Starting development server...',
        })
        addTerminalOutput('🚀 Starting dev server...')

        // Start the dev server
        const newDevProcess = await container.spawn('pnpm', ['dev'])
        set({ devProcess: newDevProcess })

        newDevProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              const cleaned = processTerminalLine(data)
              if (cleaned) {
                set(({ terminalOutput }) => ({
                  terminalOutput: [...terminalOutput, cleaned],
                }))
              }
            },
          })
        )

        // Wait for server to be ready
        container.on('server-ready', (port, url) => {
          console.log('Server ready on port', port, 'at', url)
          set({
            previewUrl: url,
            setupStep: 'ready',
            statusMessage: 'Development server running',
            terminalOutput: [...terminalOutput, `✅ Server ready at ${url}`],
          })
        })
      } catch (error) {
        console.error('Dev server start error:', error)
        addTerminalOutput(`❌ Dev server error: ${(error as Error).message}`)
        set({ error: (error as Error).message })
      }
    },
    updateProjectFiles: async (
      projectFiles: Array<{ path: string; content: string }>
    ) => {
      const {
        projectFiles: originalProjectFiles,
        addTerminalOutput,
        installDependencies,
        webContainer,
      } = get()

      if (!webContainer) {
        throw new Error('WebContainer not found')
      }

      const container = await webContainer
      if (!container) {
        throw new Error('WebContainer not found')
      }

      let packageJSONChanged = false
      if (originalProjectFiles.length === 0) {
        const fileSystemTree: FileSystemTree = {}
        for (const { path, content } of projectFiles) {
          const cleanPath = path.replace(/^\.?\//, '')
          const pathParts = cleanPath.split('/')

          let current: any = fileSystemTree
          for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i]
            if (!current[part]) {
              current[part] = { directory: {} }
            }
            current = current[part].directory
          }

          const fileName = pathParts[pathParts.length - 1]

          const adjustedContent = shimALS(fileName, content)

          if (adjustedContent.startsWith('base64::')) {
            current[fileName] = {
              file: {
                contents: adjustedContent.replace('base64::', ''),
                encoding: 'base64',
              },
            }
          } else {
            current[fileName] = {
              file: {
                contents: String(adjustedContent),
              },
            }
          }
        }

        await container.mount(fileSystemTree)
        addTerminalOutput('📁 Files mounted successfully')
        packageJSONChanged = true
      } else {
        const originalMap = new Map<string, string>()
        for (const { path, content } of originalProjectFiles) {
          originalMap.set(path, content)
        }
        const newMap = new Map<string, string>()
        for (const { path, content } of projectFiles) {
          newMap.set(path, content)
        }

        const changedOrNewFiles: Array<{ path: string; content: string }> = []
        for (const { path, content } of projectFiles) {
          if (!originalMap.has(path)) {
            changedOrNewFiles.push({ path, content })
          } else if (originalMap.get(path) !== content) {
            changedOrNewFiles.push({ path, content })
          }
        }

        const deletedFiles: string[] = []
        for (const { path } of originalProjectFiles) {
          if (!newMap.has(path)) {
            deletedFiles.push(path)
          }
        }

        if (changedOrNewFiles.length > 0 || deletedFiles.length > 0) {
          for (const { path, content } of changedOrNewFiles) {
            await container.fs.writeFile(path, content)
          }

          for (const path of deletedFiles) {
            await container.fs.rm(path)
          }

          addTerminalOutput('📁 Files updated successfully')

          if (changedOrNewFiles.some(({ path }) => path === './package.json')) {
            packageJSONChanged = true
          }
        }
      }

      set({ projectFiles })

      if (packageJSONChanged) {
        addTerminalOutput(
          '📦 Package.json changed, reinstalling dependencies...'
        )
        await installDependencies()
      }
    },
    installDependencies: async () => {
      const { webContainer, addTerminalOutput, startDevServer } = get()
      if (!webContainer) {
        throw new Error('WebContainer not found')
      }

      const container = await webContainer
      if (!container) {
        throw new Error('WebContainer not found')
      }

      const installProcess = await container.spawn('pnpm', ['install'])
      installProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            const cleaned = processTerminalLine(data)
            if (cleaned) {
              addTerminalOutput(cleaned)
            }
          },
        })
      )

      const installExitCode = await installProcess.exit
      if (installExitCode !== 0) {
        throw new Error(`pnpm install failed with exit code ${installExitCode}`)
      }

      addTerminalOutput('✅ Dependencies installed successfully')

      set({ setupStep: 'ready' })

      await startDevServer()
    },
  }))

  return store
}
