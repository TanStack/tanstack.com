/**
 * WebContainer Store
 *
 * Manages WebContainer lifecycle for live preview in the builder.
 * Boots a single WebContainer instance, mounts project files,
 * installs dependencies, and runs the dev server.
 */

import { WebContainer } from '@webcontainer/api'
import { create } from 'zustand'
import type { FileSystemTree, WebContainerProcess } from '@webcontainer/api'

export type SetupStep =
  | 'idle'
  | 'booting'
  | 'mounting'
  | 'installing'
  | 'starting'
  | 'ready'
  | 'error'

export const SETUP_STEP_LABELS: Record<SetupStep, string> = {
  idle: 'Waiting...',
  booting: 'Booting WebContainer...',
  mounting: 'Mounting files...',
  installing: 'Installing dependencies...',
  starting: 'Starting dev server...',
  ready: 'Ready',
  error: 'Error',
}

interface WebContainerState {
  container: WebContainer | null
  setupStep: SetupStep
  previewUrl: string | null
  error: string | null
  terminalOutput: Array<string>
  devProcess: WebContainerProcess | null
  installProcess: WebContainerProcess | null
  isUpdating: boolean
  lastFiles: Record<string, string> | null
  updateId: number // Increments on each update to detect stale operations
}

interface WebContainerActions {
  boot: () => Promise<void>
  updateFiles: (files: Record<string, string>) => Promise<void>
  teardown: () => void
  clearTerminal: () => void
}

type WebContainerStore = WebContainerState & WebContainerActions

// Singleton container (WebContainer can only boot once per page)
// Use globalThis to survive HMR and module re-execution
interface WebContainerGlobal {
  __webcontainer_instance__?: WebContainer
  __webcontainer_promise__?: Promise<WebContainer>
}

const wcGlobal = globalThis as unknown as WebContainerGlobal

function getBootedContainer(): WebContainer | null {
  return wcGlobal.__webcontainer_instance__ ?? null
}

function setBootedContainer(container: WebContainer | null) {
  wcGlobal.__webcontainer_instance__ = container ?? undefined
}

function getContainerPromise(): Promise<WebContainer> | null {
  return wcGlobal.__webcontainer_promise__ ?? null
}

function setContainerPromise(promise: Promise<WebContainer> | null) {
  wcGlobal.__webcontainer_promise__ = promise ?? undefined
}

function cleanTerminalLine(data: string): string {
  let cleaned = data
  // Remove ANSI escape sequences
  cleaned = cleaned.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
  cleaned = cleaned.replace(/\u001b\][0-9;]*;[^\u0007]*\u0007/g, '')
  cleaned = cleaned.replace(/\u001b[=>]/g, '')
  // Remove control characters
  cleaned = cleaned.replace(/\r/g, '')
  cleaned = cleaned.replace(
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g,
    '',
  )
  // Remove spinner characters
  cleaned = cleaned.replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏▀▁▂▃▄▅▆▇█▉▊▋▌▍▎▏░▒▓]/g, '')
  return cleaned.trim()
}

/**
 * WebContainer File Patching System
 *
 * Declarative patches for files that need modification to run in WebContainers.
 * Each patch is isolated and fails gracefully without breaking other patches.
 */

interface FilePatch {
  name: string
  match: RegExp
  replace: string | ((match: string, ...groups: Array<string>) => string)
}

const VITE_CONFIG_PATCHES: Array<FilePatch> = [
  // Remove cloudflare plugin import
  {
    name: 'remove-cloudflare-import',
    match:
      /import\s*\{\s*cloudflare\s*\}\s*from\s*['"]@cloudflare\/vite-plugin['"]\s*;?\n?/g,
    replace: '',
  },
  // Remove cloudflare plugin call (handles nested objects)
  {
    name: 'remove-cloudflare-plugin',
    match: /cloudflare\s*\([^)]*\{[^}]*\}[^)]*\)\s*,?\s*/g,
    replace: '',
  },
  // Remove netlify plugin import
  {
    name: 'remove-netlify-import',
    match:
      /import\s*\{\s*netlify\s*\}\s*from\s*['"]@netlify\/vite-plugin['"]\s*;?\n?/g,
    replace: '',
  },
  // Remove netlify plugin call
  {
    name: 'remove-netlify-plugin',
    match: /netlify\s*\([^)]*\)\s*,?\s*/g,
    replace: '',
  },
  // Remove nitro plugin import (various forms)
  {
    name: 'remove-nitro-import',
    match:
      /import\s*(?:\{\s*nitro\s*\}|nitro)\s*from\s*['"](?:@nitro\/vite-plugin|nitropack\/vite)['"]\s*;?\n?/g,
    replace: '',
  },
  // Remove nitro plugin call
  {
    name: 'remove-nitro-plugin',
    match: /nitro\s*\([^)]*\)\s*,?\s*/g,
    replace: '',
  },
  // Clean up double commas
  { name: 'cleanup-double-commas', match: /,\s*,/g, replace: ',' },
  // Clean up trailing comma before ]
  { name: 'cleanup-trailing-comma', match: /,\s*\]/g, replace: ']' },
  // Clean up leading comma after [
  { name: 'cleanup-leading-comma', match: /\[\s*,/g, replace: '[' },
]

function applyPatches(content: string, patches: Array<FilePatch>): string {
  let result = content
  for (const patch of patches) {
    try {
      result = result.replace(patch.match, patch.replace as string)
    } catch (e) {
      console.warn(`Patch "${patch.name}" failed:`, e)
    }
  }
  return result
}

/**
 * Patch package.json for WebContainer compatibility.
 * Uses JSON parsing for safety.
 */
function patchPackageJson(content: string): string {
  try {
    const pkg = JSON.parse(content)

    // Force vite dev for all projects (deployment wrappers don't work in WebContainers)
    if (pkg.scripts?.dev) {
      pkg.scripts.dev = 'vite dev'
    }

    // Remove dependencies that don't work in WebContainers
    const incompatibleDeps = [
      'wrangler',
      '@cloudflare/vite-plugin',
      '@netlify/vite-plugin',
      'nitropack',
      '@nitro/vite-plugin',
    ]
    for (const dep of incompatibleDeps) {
      delete pkg.dependencies?.[dep]
      delete pkg.devDependencies?.[dep]
    }

    return JSON.stringify(pkg, null, 2)
  } catch {
    return content
  }
}

/**
 * Patch vite.config.ts for WebContainer compatibility.
 */
function patchViteConfig(content: string): string {
  return applyPatches(content, VITE_CONFIG_PATCHES)
}

/**
 * AsyncLocalStorage polyfill code
 * Handles async callbacks properly by waiting for promises before restoring store
 */
/**
 * Navigation tracking script for cross-origin iframe communication.
 * This gets injected into __root.tsx head() for SSR apps.
 */
const NAV_TRACKING_SCRIPT_CONTENT = `(function() {
  var send = function(type, data) {
    window.parent.postMessage({ type: 'wc-nav', payload: { type: type, ...data } }, '*');
  };
  var getPath = function() {
    return location.pathname + location.search + location.hash || '/';
  };
  send('load', { path: getPath() });
  window.addEventListener('popstate', function() {
    send('popstate', { path: getPath() });
  });
  var origPush = history.pushState;
  var origReplace = history.replaceState;
  history.pushState = function() {
    origPush.apply(this, arguments);
    send('pushstate', { path: getPath() });
  };
  history.replaceState = function() {
    origReplace.apply(this, arguments);
    send('replacestate', { path: getPath() });
  };
  window.addEventListener('hashchange', function() {
    send('hashchange', { path: getPath() });
  });
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'wc-nav-cmd') {
      var cmd = e.data.cmd;
      if (cmd === 'back') history.back();
      else if (cmd === 'forward') history.forward();
      else if (cmd === 'reload') location.reload();
      else if (cmd === 'navigate' && e.data.path) {
        location.href = e.data.path;
      }
    }
  });
})();`

/**
 * Patch __root.tsx to inject navigation tracking script into head().
 * Works with TanStack Start SSR apps.
 */
function patchRootTsx(content: string): string {
  // Use single quotes and escape to avoid nested template literal issues
  const escapedScript = NAV_TRACKING_SCRIPT_CONTENT.replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
  const scriptEntry = '{ children: `' + escapedScript + '` }'

  // First, check if there's already a scripts array in head()
  const hasScripts = /head:\s*\([^)]*\)\s*=>\s*\(\{[\s\S]*?scripts:\s*\[/.test(
    content,
  )

  if (hasScripts) {
    // Add our script to the beginning of the existing scripts array
    return content.replace(
      /(scripts:\s*\[)/,
      '$1\n        ' + scriptEntry + ',',
    )
  }

  // No scripts array, need to add one to the head() return object
  const hasHead = /head:\s*\([^)]*\)\s*=>\s*\(\{/.test(content)

  if (hasHead) {
    // Add scripts array after the opening brace of head() return
    return content.replace(
      /(head:\s*\([^)]*\)\s*=>\s*\(\{)/,
      '$1\n    scripts: [' + scriptEntry + '],',
    )
  }

  // No head() function at all - need to add one
  // Look for createRootRoute or createRootRouteWithContext call
  if (content.includes('createRootRoute')) {
    return content.replace(
      /(createRootRoute(?:WithContext<[^>]+>)?\s*\(\)\s*\(\s*\{)/,
      '$1\n  head: () => ({ scripts: [' + scriptEntry + '] }),',
    )
  }

  return content
}

const ALS_POLYFILL = `// AsyncLocalStorage polyfill for WebContainers
class AsyncLocalStorage {
  constructor() {
    this._store = undefined;
  }
  run(store, callback, ...args) {
    const prevStore = this._store;
    this._store = store;
    try {
      const result = callback(...args);
      // If result is a promise, wait for it before restoring
      if (result && typeof result.then === 'function') {
        return result.then(
          (value) => {
            this._store = prevStore;
            return value;
          },
          (error) => {
            this._store = prevStore;
            throw error;
          }
        );
      }
      this._store = prevStore;
      return result;
    } catch (error) {
      this._store = prevStore;
      throw error;
    }
  }
  exit(callback, ...args) {
    const prevStore = this._store;
    this._store = undefined;
    try {
      const result = callback(...args);
      if (result && typeof result.then === 'function') {
        return result.then(
          (value) => {
            this._store = prevStore;
            return value;
          },
          (error) => {
            this._store = prevStore;
            throw error;
          }
        );
      }
      this._store = prevStore;
      return result;
    } catch (error) {
      this._store = prevStore;
      throw error;
    }
  }
  getStore() {
    return this._store;
  }
  enterWith(store) {
    this._store = store;
  }
  disable() {
    this._store = undefined;
  }
}
export { AsyncLocalStorage };
`

/**
 * Recursively read directory to find files
 */
async function findFilesRecursive(
  container: WebContainer,
  dir: string,
  matches: Array<string>,
  targetFiles: Array<string>,
  maxDepth = 10,
): Promise<void> {
  if (maxDepth <= 0) return

  try {
    const entries = await container.fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = `${dir}/${entry.name}`
      if (entry.isDirectory()) {
        await findFilesRecursive(
          container,
          fullPath,
          matches,
          targetFiles,
          maxDepth - 1,
        )
      } else if (targetFiles.includes(entry.name)) {
        matches.push(fullPath)
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
}

/**
 * Patch AsyncLocalStorage in node_modules after install.
 * WebContainers don't fully support Node's AsyncLocalStorage, so we replace
 * the import with a polyfill that handles async callbacks properly.
 */
async function patchNodeModulesALS(
  container: WebContainer,
  addOutput: (line: string) => void,
): Promise<void> {
  // Files in @tanstack/start packages that import from node:async_hooks
  const targetFiles = ['async-local-storage.js', 'request-response.js']
  const matches: Array<string> = []

  await findFilesRecursive(
    container,
    'node_modules/.pnpm',
    matches,
    targetFiles,
  )

  let patchedCount = 0
  for (const filePath of matches) {
    try {
      const content = await container.fs.readFile(filePath, 'utf-8')
      const patched = content.replace(
        /import\s*\{\s*AsyncLocalStorage\s*\}\s*from\s*['"]node:async_hooks['"];?/,
        ALS_POLYFILL,
      )

      if (patched !== content) {
        await container.fs.writeFile(filePath, patched)
        patchedCount++
      }
    } catch {
      // File might not need patching or doesn't exist
    }
  }

  if (patchedCount > 0) {
    addOutput(`Patched ${patchedCount} files for WebContainer compatibility`)
  }
}

function filesToTree(files: Record<string, string>): {
  tree: FileSystemTree
  binaryFiles: Record<string, Uint8Array>
} {
  const tree: FileSystemTree = {}
  const binaryFiles: Record<string, Uint8Array> = {}

  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/')

    let current: FileSystemTree = tree
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!current[part]) {
        current[part] = { directory: {} }
      }
      const node = current[part]
      if ('directory' in node) {
        current = node.directory
      }
    }

    const fileName = parts[parts.length - 1]
    let adjustedContent = content

    // Patch package.json for WebContainer compatibility
    if (fileName === 'package.json' && path === 'package.json') {
      adjustedContent = patchPackageJson(adjustedContent)
    }

    // Patch vite.config.ts for WebContainer compatibility
    if (fileName === 'vite.config.ts' && path === 'vite.config.ts') {
      adjustedContent = patchViteConfig(adjustedContent)
    }

    // Inject navigation tracking into __root.tsx for SSR apps
    if (fileName === '__root.tsx') {
      adjustedContent = patchRootTsx(adjustedContent)
    }

    if (adjustedContent.startsWith('base64::')) {
      // Binary file - decode and store separately
      const base64 = adjustedContent.slice(8).replace(/\s/g, '')
      try {
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i) & 0xff
        }
        binaryFiles[path] = bytes
      } catch {
        console.error(`Failed to decode binary file: ${path}`)
      }
    } else {
      current[fileName] = { file: { contents: adjustedContent } }
    }
  }

  return { tree, binaryFiles }
}

export const useWebContainerStore = create<WebContainerStore>((set, get) => ({
  // State
  container: null,
  setupStep: 'idle',
  previewUrl: null,
  error: null,
  terminalOutput: [],
  devProcess: null,
  installProcess: null,
  isUpdating: false,
  lastFiles: null,
  updateId: 0,

  // Actions
  boot: async () => {
    const { container } = get()
    if (container) return // Already booted in this store instance

    // If we already have a booted container from a previous store instance (HMR), reuse it
    const existingContainer = getBootedContainer()
    if (existingContainer) {
      set({ container: existingContainer, setupStep: 'idle' })
      return
    }

    // If there's already a pending boot, wait for it
    const existingPromise = getContainerPromise()
    if (existingPromise) {
      try {
        const existing = await existingPromise
        setBootedContainer(existing)
        set({ container: existing, setupStep: 'idle' })
        return
      } catch {
        // Previous boot failed, clear and retry
        setContainerPromise(null)
      }
    }

    set({ setupStep: 'booting', error: null })

    try {
      const bootPromise = WebContainer.boot()
      setContainerPromise(bootPromise)
      const booted = await bootPromise
      setBootedContainer(booted)

      // Listen for server ready (register once on boot)
      booted.on('server-ready', (_port: number, url: string) => {
        set({ previewUrl: url, setupStep: 'ready' })
      })

      set({ container: booted, setupStep: 'idle' })
    } catch (error) {
      console.error('WebContainer boot failed:', error)
      setContainerPromise(null) // Clear so retry is possible
      set({
        error: `Failed to boot WebContainer: ${(error as Error).message}`,
        setupStep: 'error',
      })
    }
  },

  updateFiles: async (files: Record<string, string>) => {
    const { container, devProcess, installProcess, lastFiles } = get()

    if (!container) {
      console.error('WebContainer not booted')
      return
    }

    // Check if files actually changed
    if (lastFiles && JSON.stringify(lastFiles) === JSON.stringify(files)) {
      console.log('Files unchanged, skipping update')
      return
    }

    // Kill any existing processes before starting new update
    if (devProcess) {
      devProcess.kill()
    }
    if (installProcess) {
      installProcess.kill()
    }

    // Increment updateId to invalidate any in-flight operations
    const currentUpdateId = get().updateId + 1

    // Clear terminal and reset state for fresh start
    set({
      isUpdating: true,
      error: null,
      terminalOutput: [],
      previewUrl: null,
      devProcess: null,
      installProcess: null,
      updateId: currentUpdateId,
    })

    // Helper to check if this update is still current
    const isStale = () => get().updateId !== currentUpdateId

    const addOutput = (line: string) => {
      if (isStale()) return
      const cleaned = cleanTerminalLine(line)
      if (cleaned) {
        set((s) => ({ terminalOutput: [...s.terminalOutput, cleaned] }))
      }
    }

    try {
      // Clean up old files - must wait for completion to avoid race with new mount
      addOutput('Cleaning workspace...')
      try {
        const entries = await container.fs.readdir('/')
        for (const entry of entries) {
          if (isStale()) return
          const rmProcess = await container.spawn('rm', ['-rf', entry])
          await rmProcess.exit // Wait for deletion to complete
        }
      } catch {
        // Ignore cleanup errors
      }

      if (isStale()) return

      // Mount files
      set({ setupStep: 'mounting' })
      addOutput('Mounting files...')

      const { tree, binaryFiles } = filesToTree(files)
      await container.mount(tree)

      // Write binary files separately
      for (const [path, bytes] of Object.entries(binaryFiles)) {
        await container.fs.writeFile(path, bytes)
      }

      set({ lastFiles: files })
      addOutput(`Mounted ${Object.keys(files).length} files`)

      if (isStale()) return

      // Install dependencies
      set({ setupStep: 'installing' })
      addOutput('Installing dependencies...')

      const newInstallProcess = await container.spawn('pnpm', ['install'])
      set({ installProcess: newInstallProcess })

      newInstallProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            if (isStale()) return
            const cleaned = cleanTerminalLine(data)
            if (cleaned && cleaned.length > 3) {
              // Only show important lines
              if (
                cleaned.includes('added') ||
                cleaned.includes('packages') ||
                cleaned.includes('error') ||
                cleaned.includes('ERR')
              ) {
                addOutput(cleaned)
              }
            }
          },
        }),
      )

      const installCode = await newInstallProcess.exit
      if (isStale()) return
      if (installCode !== 0) {
        throw new Error(`pnpm install failed with code ${installCode}`)
      }
      addOutput('Dependencies installed')
      set({ installProcess: null })

      if (isStale()) return

      // Patch AsyncLocalStorage in node_modules for WebContainer compatibility
      await patchNodeModulesALS(container, addOutput)

      if (isStale()) return

      // Start dev server
      set({ setupStep: 'starting' })
      addOutput('Starting dev server...')

      const newDevProcess = await container.spawn('pnpm', ['dev'])
      set({ devProcess: newDevProcess })

      newDevProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            if (isStale()) return
            const cleaned = cleanTerminalLine(data)
            if (cleaned && cleaned.length > 3) {
              addOutput(cleaned)
            }
          },
        }),
      )

      // Handle unexpected exit (ignore if we're updating or intentionally killed)
      newDevProcess.exit.then((code) => {
        if (isStale()) return
        const { setupStep, isUpdating, devProcess: currentProcess } = get()
        // Only show error if:
        // - Exit code is non-zero
        // - We're not in the middle of an update (which kills the server intentionally)
        // - The current devProcess is still this one (not replaced)
        // - We're not already in error state
        // - Code 143 (SIGTERM) is expected when we kill intentionally
        if (
          code !== 0 &&
          code !== 143 &&
          !isUpdating &&
          currentProcess === newDevProcess &&
          setupStep !== 'error'
        ) {
          addOutput(`Dev server exited with code ${code}`)
          set({
            error: `Dev server exited with code ${code}`,
            setupStep: 'error',
          })
        }
      })
    } catch (error) {
      if (isStale()) return
      console.error('WebContainer update failed:', error)
      set({
        error: (error as Error).message,
        setupStep: 'error',
      })
      addOutput(`Error: ${(error as Error).message}`)
    } finally {
      if (!isStale()) {
        set({ isUpdating: false })
      }
    }
  },

  teardown: () => {
    const { devProcess, installProcess } = get()
    if (devProcess) {
      devProcess.kill()
    }
    if (installProcess) {
      installProcess.kill()
    }
    set({
      devProcess: null,
      installProcess: null,
      previewUrl: null,
      setupStep: 'idle',
      terminalOutput: [],
      lastFiles: null,
    })
  },

  clearTerminal: () => {
    set({ terminalOutput: [] })
  },
}))

// Selector hooks
export const useSetupStep = () => useWebContainerStore((s) => s.setupStep)
export const usePreviewUrl = () => useWebContainerStore((s) => s.previewUrl)
export const useWebContainerError = () => useWebContainerStore((s) => s.error)
export const useTerminalOutput = () =>
  useWebContainerStore((s) => s.terminalOutput)
export const useIsUpdating = () => useWebContainerStore((s) => s.isUpdating)
