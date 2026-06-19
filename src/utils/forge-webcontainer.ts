import type { FileSystemTree } from '@webcontainer/api'

const BASE64_PREFIX = 'base64::'
const DEFAULT_PACKAGE_MANAGER = 'pnpm'
const PREVIEW_SERVER_ARGS = ['--host', '0.0.0.0', '--port', '5173']
const PREVIEW_BRIDGE_MARKER = 'data-forge-preview-bridge'
const PREVIEW_BRIDGE_SCRIPT = `<script data-forge-preview-bridge>
(() => {
  const source = 'forge-webcontainer-preview'
  let lastPath = ''
  let readySent = false
  function sendLocation() {
    const path = window.location.pathname + window.location.search + window.location.hash
    if (path === lastPath) return
    lastPath = path
    window.parent.postMessage({
      href: window.location.href,
      path,
      source,
      type: 'location',
    }, '*')
  }
  function sendReady(reason) {
    if (readySent) return
    readySent = true
    sendLocation()
    window.parent.postMessage({
      reason,
      source,
      type: 'ready',
    }, '*')
  }
  function sendReadyAfterPaint(reason) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => sendReady(reason))
    })
  }
  function hasRenderableBodyContent() {
    if (!document.body) return false
    const ignoredTags = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE'])
    const elements = Array.from(document.body.querySelectorAll('*'))
    for (const element of elements) {
      if (ignoredTags.has(element.tagName)) continue
      const text = element.textContent ? element.textContent.trim() : ''
      if (text) return true
      const rect = element.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) return true
    }
    return false
  }
  function watchRenderableContent() {
    if (hasRenderableBodyContent()) {
      sendReadyAfterPaint('renderable-content')
      return
    }
    if (!document.body) return
    const observer = new MutationObserver(() => {
      if (!hasRenderableBodyContent()) return
      observer.disconnect()
      sendReadyAfterPaint('content-mutation')
    })
    observer.observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true,
    })
  }
  function watchPaintTiming() {
    const existingPaint = performance
      .getEntriesByType('paint')
      .some((entry) => entry.name === 'first-contentful-paint')
    if (existingPaint) {
      sendReadyAfterPaint('first-contentful-paint')
      return
    }
    if (!('PerformanceObserver' in window)) return
    try {
      const observer = new PerformanceObserver((list) => {
        const painted = list
          .getEntries()
          .some((entry) => entry.name === 'first-contentful-paint')
        if (!painted) return
        observer.disconnect()
        sendReadyAfterPaint('first-contentful-paint')
      })
      observer.observe({ type: 'paint', buffered: true })
    } catch {
      // Paint timing is best-effort only.
    }
  }
  function startReadyWatchers() {
    watchPaintTiming()
    watchRenderableContent()
    window.addEventListener('load', () => {
      setTimeout(() => sendReadyAfterPaint('load-fallback'), 1500)
    })
    setTimeout(() => sendReadyAfterPaint('timeout-fallback'), 3000)
  }
  for (const method of ['pushState', 'replaceState']) {
    const original = window.history[method]
    window.history[method] = function (...args) {
      const result = original.apply(this, args)
      queueMicrotask(sendLocation)
      return result
    }
  }
  window.addEventListener('hashchange', sendLocation)
  window.addEventListener('load', sendLocation)
  window.addEventListener('popstate', sendLocation)
  window.addEventListener('message', (event) => {
    const message = event.data
    if (!message || message.source !== 'forge-preview-controls') return
    if (message.type === 'reload') {
      window.location.reload()
    }
    if (message.type === 'stop') {
      window.stop()
    }
  })
  sendLocation()
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startReadyWatchers, {
      once: true,
    })
  } else {
    startReadyWatchers()
  }
})()
</script>`

export type ForgeWebContainerPreviewStatus =
  | 'booting'
  | 'failed'
  | 'idle'
  | 'installing'
  | 'loading'
  | 'mounting'
  | 'ready'
  | 'starting'

export interface ForgeWebContainerCommand {
  args: Array<string>
  command: string
  label: string
}

export interface ForgeWebContainerPreviewCommands {
  dev: ForgeWebContainerCommand
  install: ForgeWebContainerCommand
}

export function assertSafeForgeWebContainerPath(filePath: string) {
  const pathParts = filePath.split('/')

  if (
    !filePath ||
    filePath.startsWith('/') ||
    /^[A-Za-z]:/.test(filePath) ||
    filePath.includes('\\') ||
    pathParts.some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`${filePath} is not a safe preview file path.`)
  }
}

export function createForgeWebContainerFileTree(
  files: Record<string, string>,
): FileSystemTree {
  const tree: FileSystemTree = {}

  for (const filePath of Object.keys(files).sort()) {
    assertSafeForgeWebContainerPath(filePath)

    const pathParts = filePath.split('/')
    const fileName = pathParts[pathParts.length - 1]
    let directory = tree

    for (const directoryName of pathParts.slice(0, -1)) {
      const existingNode = directory[directoryName]

      if (existingNode && 'directory' in existingNode) {
        directory = existingNode.directory
        continue
      }

      const nextNode = { directory: {} }
      directory[directoryName] = nextNode
      directory = nextNode.directory
    }

    directory[fileName] = {
      file: {
        contents: decodeForgeWebContainerFileContent(files[filePath]),
      },
    }
  }

  return tree
}

export function createForgeWebContainerPreviewFiles(
  files: Record<string, string>,
) {
  const indexHtml = files['index.html']

  if (!indexHtml || indexHtml.includes(PREVIEW_BRIDGE_MARKER)) {
    return files
  }

  return {
    ...files,
    'index.html': injectForgePreviewBridge(indexHtml),
  }
}

function injectForgePreviewBridge(indexHtml: string) {
  if (indexHtml.includes('</body>')) {
    return indexHtml.replace('</body>', `${PREVIEW_BRIDGE_SCRIPT}\n</body>`)
  }

  if (indexHtml.includes('</head>')) {
    return indexHtml.replace('</head>', `${PREVIEW_BRIDGE_SCRIPT}\n</head>`)
  }

  return `${indexHtml}\n${PREVIEW_BRIDGE_SCRIPT}\n`
}

export function decodeForgeWebContainerFileContent(content: string) {
  if (!content.startsWith(BASE64_PREFIX)) {
    return content
  }

  const binary = globalThis.atob(content.slice(BASE64_PREFIX.length))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function getForgeWebContainerPreviewCommands(
  packageManager = DEFAULT_PACKAGE_MANAGER,
): ForgeWebContainerPreviewCommands {
  switch (packageManager) {
    case 'bun':
      return {
        dev: {
          args: ['run', 'dev', ...PREVIEW_SERVER_ARGS],
          command: 'bun',
          label: `bun run dev ${PREVIEW_SERVER_ARGS.join(' ')}`,
        },
        install: {
          args: ['install'],
          command: 'bun',
          label: 'bun install',
        },
      }
    case 'npm':
      return {
        dev: {
          args: ['run', 'dev', '--', ...PREVIEW_SERVER_ARGS],
          command: 'npm',
          label: `npm run dev -- ${PREVIEW_SERVER_ARGS.join(' ')}`,
        },
        install: {
          args: ['install'],
          command: 'npm',
          label: 'npm install',
        },
      }
    case 'yarn':
      return {
        dev: {
          args: ['dev', ...PREVIEW_SERVER_ARGS],
          command: 'yarn',
          label: `yarn dev ${PREVIEW_SERVER_ARGS.join(' ')}`,
        },
        install: {
          args: ['install'],
          command: 'yarn',
          label: 'yarn install',
        },
      }
    case 'pnpm':
    default:
      return {
        dev: {
          args: ['run', 'dev', '--', ...PREVIEW_SERVER_ARGS],
          command: 'pnpm',
          label: `pnpm run dev -- ${PREVIEW_SERVER_ARGS.join(' ')}`,
        },
        install: {
          args: ['install'],
          command: 'pnpm',
          label: 'pnpm install',
        },
      }
  }
}

export function getForgeWebContainerWorkspaceName(manifestVersionId: string) {
  const suffix = manifestVersionId
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return `forge-preview-${suffix || 'manifest'}`
}
