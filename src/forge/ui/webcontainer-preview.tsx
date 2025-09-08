import { useState, useEffect, useCallback, useRef } from 'react'
import type { FileSystemTree } from '@webcontainer/api'

import { useWebContainer } from '~/forge/hooks/use-web-container'

interface WebContainerPreviewProps {
  projectFiles: Array<{ path: string; content: string }>
}

type SetupStep = 'mounting' | 'installing' | 'starting' | 'ready' | 'error'

const ALS_RESOLVER = `resolve: {
  alias: {
    'node:async_hooks': '\0virtual:async_hooks',
    async_hooks: '\0virtual:async_hooks',
  },
},`

const ALS_SHIM = `export class AsyncLocalStorage {
  constructor() {
    // queue: array of { store, fn, resolve, reject }
    this._queue = [];
    this._running = false;        // true while processing queue
    this._currentStore = undefined; // store visible to getStore() while a run executes
  }

  /**
   * run(store, callback, ...args) -> Promise
   * Queues the callback to run with store as the current store. If the callback
   * returns a Promise, the queue waits for it to settle before starting the next run.
   */
  run(store, callback, ...args) {
    return new Promise((resolve, reject) => {
      this._queue.push({
        store,
        fn: () => callback(...args),
        resolve,
        reject,
      });
      // start processing (if not already)
      this._processQueue().catch((err) => {
        // _processQueue shouldn't throw; but guard anyway.
        console.error('SerialAsyncLocalStorage internal error:', err);
      });
    });
  }

  /**
   * getStore() -> current store or undefined
   * Returns the store of the currently executing run (or undefined if none).
   */
  getStore() {
    return this._currentStore;
  }

  /**
   * enterWith(store)
   * Set the current store for the currently running task synchronously.
   * Throws if there is no active run (this polyfill requires you to be inside a run).
   */
  enterWith(store) {
    if (!this._running) {
      throw new Error('enterWith() may be used only while a run is active.');
    }
    this._currentStore = store;
  }

  // internal: process queue serially
  async _processQueue() {
    if (this._running) return;
    this._running = true;

    while (this._queue.length) {
      const { store, fn, resolve, reject } = this._queue.shift();
      const prevStore = this._currentStore;
      this._currentStore = store;

      try {
        const result = fn();
        // await if callback returned a promise
        const awaited = result instanceof Promise ? await result : result;
        resolve(awaited);
      } catch (err) {
        reject(err);
      } finally {
        // restore previous store (if any)
        this._currentStore = prevStore;
      }
      // loop continues to next queued task
    }

    this._running = false;
  }
}
export default AsyncLocalStorage
`

const ALS_SHIM_LOADER = `
function alsShim(): PluginOption {
  return {
    enforce: 'pre',
    name: 'virtual-async-hooks',
    config() {
      return {
        resolve: {
          alias: {
            // catch both forms
            'node:async_hooks': '\0virtual:async_hooks',
            async_hooks: '\0virtual:async_hooks',
          },
        },
      };
    },
    resolveId(id) {
      if (id === '\0virtual:async_hooks') return id;
    },
    load(id) {
      if (id !== '\0virtual:async_hooks') return null;

      console.log('loaded!', id);

      return \`${ALS_SHIM}\`;
    },
  };
}
`

export function WebContainerPreview({
  projectFiles,
}: WebContainerPreviewProps) {
  const webContainer = useWebContainer()
  const [setupStep, setSetupStep] = useState<SetupStep>('mounting')
  const [statusMessage, setStatusMessage] = useState<string>('Initializing...')
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [devProcess, setDevProcess] = useState<any>(null)

  // Helper to add terminal output
  const addTerminalOutput = useCallback((message: string) => {
    setTerminalOutput((prev) =>
      [...prev, `${new Date().toLocaleTimeString()}: ${message}`].slice(-100)
    ) // Keep last 100 lines
  }, [])

  // Function to start the dev server
  const startDevServer = useCallback(async () => {
    if (!webContainer) return

    try {
      // Kill existing dev process if running
      if (devProcess) {
        console.log('Killing existing dev process...')
        devProcess.kill()
        setDevProcess(null)
      }

      setSetupStep('starting')
      setStatusMessage('Starting development server...')
      addTerminalOutput('🚀 Starting dev server...')

      // Start the dev server
      const newDevProcess = await webContainer.spawn('pnpm', ['dev'])
      setDevProcess(newDevProcess)

      newDevProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            const cleaned = processTerminalLine(data)
            if (cleaned) {
              addTerminalOutput(cleaned)
            }
          },
        })
      )

      // Wait for server to be ready
      webContainer.on('server-ready', (port, url) => {
        console.log('Server ready on port', port, 'at', url)
        setPreviewUrl(url)
        setSetupStep('ready')
        setStatusMessage('Development server running')
        addTerminalOutput(`✅ Server ready at ${url}`)
      })
    } catch (error) {
      console.error('Dev server start error:', error)
      addTerminalOutput(`❌ Dev server error: ${(error as Error).message}`)
      setError((error as Error).message)
    }
  }, [webContainer, devProcess, addTerminalOutput])

  const isMounting = useRef(false)
  useEffect(() => {
    if (!webContainer || !projectFiles.length) return

    const setupWebContainer = async () => {
      if (isMounting.current) return
      isMounting.current = true

      try {
        setSetupStep('mounting')
        setStatusMessage('Setting up project files...')
        setError('')

        // Build FileSystemTree from project files
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

          let adjustedContent = content
          if (fileName === 'vite.config.ts') {
            adjustedContent += ALS_SHIM_LOADER
            adjustedContent = adjustedContent.replace(
              'plugins: [',
              `${ALS_RESOLVER}plugins: [alsShim(),`
            )
            console.log('vite.config.ts', adjustedContent)
          }

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

        // Mount the files to the webcontainer
        await webContainer.mount(fileSystemTree)
        console.log('Files mounted successfully')
        console.log('WebContainer URL:', (webContainer as any).url)
        addTerminalOutput('📁 Files mounted successfully')

        setSetupStep('installing')
        setStatusMessage('Installing dependencies...')
        addTerminalOutput('📦 Installing dependencies...')

        // Install dependencies
        const installProcess = await webContainer.spawn('pnpm', ['install'])

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
          throw new Error(
            `npm install failed with exit code ${installExitCode}`
          )
        }

        console.log('Dependencies installed')
        addTerminalOutput('✅ Dependencies installed successfully')

        // Start the dev server
        await startDevServer()
      } catch (error) {
        console.error('WebContainer setup error:', error)
        setSetupStep('error')
        setError((error as Error).message)
        setStatusMessage('Setup failed')
      }
    }

    setupWebContainer()
  }, [webContainer, projectFiles, addTerminalOutput, startDevServer])

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

  const getStepIcon = (step: SetupStep) => {
    switch (step) {
      case 'mounting':
        return '📁'
      case 'installing':
        return '📦'
      case 'starting':
        return '🚀'
      case 'ready':
        return '✅'
      case 'error':
        return '❌'
    }
  }

  const getStepColor = (step: SetupStep) => {
    switch (step) {
      case 'error':
        return 'text-red-500'
      case 'ready':
        return 'text-green-500'
      default:
        return 'text-blue-500'
    }
  }

  if (!webContainer) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-lg font-medium text-gray-700 dark:text-gray-300">
            Initializing WebContainer...
          </div>
        </div>
      </div>
    )
  }

  if (setupStep === 'error') {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-lg font-medium text-red-600 mb-2">
            Setup Failed
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {error}
          </div>
        </div>
      </div>
    )
  }

  if (setupStep !== 'ready' || !previewUrl) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
        {/* Progress Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-2xl">{getStepIcon(setupStep)}</div>
            <div className={`font-medium ${getStepColor(setupStep)}`}>
              {statusMessage}
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex gap-4 text-sm">
            <div
              className={`flex items-center gap-1 ${
                setupStep === 'mounting'
                  ? 'text-blue-500'
                  : setupStep === 'installing' ||
                    setupStep === 'starting' ||
                    setupStep === 'ready'
                  ? 'text-green-500'
                  : 'text-gray-400'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-current"></div>
              Mount Files
            </div>
            <div
              className={`flex items-center gap-1 ${
                setupStep === 'installing'
                  ? 'text-blue-500'
                  : setupStep === 'starting' || setupStep === 'ready'
                  ? 'text-green-500'
                  : 'text-gray-400'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-current"></div>
              Install Dependencies
            </div>
            <div
              className={`flex items-center gap-1 ${
                setupStep === 'starting'
                  ? 'text-blue-500'
                  : setupStep === 'ready'
                  ? 'text-green-500'
                  : 'text-gray-400'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-current"></div>
              Start Server
            </div>
          </div>
        </div>

        {/* Terminal Output */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="bg-black text-green-400 font-mono text-xs p-4 rounded-lg h-full overflow-y-auto">
            {terminalOutput.length > 0 ? (
              terminalOutput.map((line, index) => (
                <div key={index} className="mb-1">
                  {line}
                </div>
              ))
            ) : (
              <div className="text-gray-500">Waiting for output...</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Show the running application with persistent terminal
  return (
    <div className="flex flex-col h-full">
      {/* Header with URL and controls */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="text-lg">✅</div>
          <div className="flex-1">
            <div className="text-sm font-medium text-green-600 dark:text-green-400">
              {setupStep === 'ready'
                ? 'Development Server Running'
                : statusMessage}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {previewUrl || 'No URL available'}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={startDevServer}
              disabled={!webContainer}
              className="px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              🔄 Restart Dev Server
            </button>
            {previewUrl && (
              <button
                onClick={() => window.open(previewUrl, '_blank')}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Open in New Tab
              </button>
            )}
          </div>
        </div>
      </div>

      {/* iframe with the running app - 85% height */}
      <div className="flex-1 relative" style={{ height: '85%' }}>
        {previewUrl ? (
          <iframe
            src={previewUrl}
            className="w-full h-full border-0"
            title="Application Preview"
            onLoad={() => console.log('Iframe loaded successfully')}
            onError={(e) => console.error('Iframe load error:', e)}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800">
            <div className="text-center">
              <div className="text-2xl mb-2">🔄</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {setupStep === 'ready'
                  ? 'Preview not available'
                  : statusMessage}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Terminal output - 15% height */}
      <div
        className="border-t border-gray-200 dark:border-gray-700 bg-black text-green-400"
        style={{ height: '15%' }}
      >
        <div className="p-2 border-b border-gray-700 bg-gray-900 flex items-center justify-between">
          <div className="text-xs font-medium text-gray-300">
            Terminal Output
          </div>
          <button
            onClick={() => setTerminalOutput([])}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            Clear
          </button>
        </div>
        <div className="font-mono text-xs p-2 h-full overflow-y-auto">
          {terminalOutput.length > 0 ? (
            terminalOutput.map((line, index) => (
              <div key={index} className="mb-1 leading-tight">
                {line}
              </div>
            ))
          ) : (
            <div className="text-gray-500">No output yet...</div>
          )}
        </div>
      </div>
    </div>
  )
}
