import type { FileSystemTree } from '@webcontainer/api'

const BASE64_PREFIX = 'base64::'
const DEFAULT_PACKAGE_MANAGER = 'pnpm'
const PREVIEW_SERVER_ARGS = ['--host', '0.0.0.0', '--port', '5173']
const PREVIEW_BRIDGE_MARKER = 'data-forge-preview-bridge'
const PREVIEW_BRIDGE_MODULE_PATH = 'src/forge-preview-bridge.ts'
const PREVIEW_BRIDGE_SOURCE = `
(() => {
  const source = 'forge-webcontainer-preview'
  const annotationUiAttribute = 'data-forge-annotation-ui'
  const annotationUiSelector = '[' + annotationUiAttribute + ']'
  let annotationEnabled = false
  let annotationOverlay = null
  let annotationPanel = null
  let annotationStyle = null
  let annotationTarget = null
  let lastPath = ''
  let readySent = false
  function postMessage(message) {
    window.parent.postMessage({
      ...message,
      source,
    }, '*')
  }
  function sendLocation() {
    const path = window.location.pathname + window.location.search + window.location.hash
    if (path === lastPath) return
    lastPath = path
    postMessage({
      href: window.location.href,
      path,
      type: 'location',
    })
  }
  function sendReady(reason) {
    if (readySent) return
    readySent = true
    sendLocation()
    postMessage({
      reason,
      type: 'ready',
    })
  }
  function sendReadyAfterPaint(reason) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => sendReady(reason))
    })
  }
  function sendAnnotationMode() {
    postMessage({
      enabled: annotationEnabled,
      type: 'annotation.mode',
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
  function escapeCssIdent(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value)
    }
    return value.replace(/[^a-zA-Z0-9_-]/g, '\\\\$&')
  }
  function escapeCssString(value) {
    return value.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"')
  }
  function normalizeText(value, maxLength) {
    const text = String(value || '').replace(/\\s+/g, ' ').trim()
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength - 3).trimEnd() + '...'
  }
  function getPreferredAttribute(element) {
    const preferredNames = [
      'data-testid',
      'data-test',
      'data-cy',
      'aria-label',
      'name',
      'title',
      'alt',
    ]
    for (const name of preferredNames) {
      const value = element.getAttribute(name)
      if (value) {
        return '[' + name + '="' + escapeCssString(value) + '"]'
      }
    }
    return ''
  }
  function getElementNthOfType(element) {
    let index = 1
    let previous = element.previousElementSibling
    while (previous) {
      if (previous.tagName === element.tagName) {
        index += 1
      }
      previous = previous.previousElementSibling
    }
    return index
  }
  function selectorIsUnique(selector) {
    try {
      return document.querySelectorAll(selector).length === 1
    } catch {
      return false
    }
  }
  function getSelectorSegment(element) {
    const tag = element.tagName.toLowerCase()
    const id = element.getAttribute('id')
    if (id) {
      return tag + '#' + escapeCssIdent(id)
    }

    const preferredAttribute = getPreferredAttribute(element)
    if (preferredAttribute) {
      return tag + preferredAttribute
    }

    const classes = Array.from(element.classList)
      .filter((className) => /^[a-zA-Z0-9_-]+$/.test(className))
      .slice(0, 3)
    const classSelector = classes.length > 0
      ? '.' + classes.map(escapeCssIdent).join('.')
      : ''
    const baseSelector = tag + classSelector

    if (selectorIsUnique(baseSelector)) {
      return baseSelector
    }

    return baseSelector + ':nth-of-type(' + getElementNthOfType(element) + ')'
  }
  function getElementSelector(element) {
    const segments = []
    let current = element
    while (
      current &&
      current.nodeType === Node.ELEMENT_NODE &&
      current !== document.documentElement
    ) {
      segments.unshift(getSelectorSegment(current))
      const candidate = segments.join(' > ')
      if (selectorIsUnique(candidate)) {
        return candidate
      }
      current = current.parentElement
    }

    return segments.join(' > ')
  }
  function readElementAttributes(element) {
    const attributes = {}
    const visibleAttributeNames = new Set([
      'alt',
      'aria-label',
      'class',
      'href',
      'id',
      'name',
      'role',
      'src',
      'title',
      'type',
    ])

    for (const attribute of Array.from(element.attributes)) {
      if (
        visibleAttributeNames.has(attribute.name) ||
        attribute.name.startsWith('data-')
      ) {
        attributes[attribute.name] = normalizeText(attribute.value, 240)
      }
    }

    return attributes
  }
  function captureElementAnnotation(element) {
    const rect = element.getBoundingClientRect()
    return {
      attributes: readElementAttributes(element),
      href: window.location.href,
      outerHtml: normalizeText(element.outerHTML || '', 1600),
      path: window.location.pathname + window.location.search + window.location.hash,
      rect: {
        height: Math.round(rect.height),
        width: Math.round(rect.width),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
      },
      selector: getElementSelector(element),
      tagName: element.tagName.toLowerCase(),
      text: normalizeText(element.innerText || element.textContent || '', 600),
    }
  }
  function ensureAnnotationUi() {
    if (!document.body) return false

    if (!annotationStyle) {
      annotationStyle = document.createElement('style')
      annotationStyle.setAttribute(annotationUiAttribute, 'true')
      annotationStyle.textContent = [
        'html.forge-annotation-enabled, html.forge-annotation-enabled * { cursor: crosshair !important; }',
        '.forge-annotation-hover { position: fixed; z-index: 2147483646; display: none; pointer-events: none; border: 2px solid #38bdf8; border-radius: 6px; background: rgba(14, 165, 233, 0.12); box-shadow: 0 0 0 9999px rgba(2, 6, 23, 0.08), 0 0 0 1px rgba(2, 132, 199, 0.45); }',
        '.forge-annotation-panel { position: fixed; z-index: 2147483647; width: min(360px, calc(100vw - 24px)); border: 1px solid rgba(148, 163, 184, 0.32); border-radius: 12px; background: #111827; color: #f8fafc; box-shadow: 0 20px 48px rgba(15, 23, 42, 0.35); font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; pointer-events: auto; }',
        '.forge-annotation-panel * { box-sizing: border-box; cursor: auto !important; }',
        '.forge-annotation-panel-header { padding: 12px 12px 8px; border-bottom: 1px solid rgba(148, 163, 184, 0.18); }',
        '.forge-annotation-panel-title { margin: 0 0 4px; font-weight: 650; }',
        '.forge-annotation-panel-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #94a3b8; font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }',
        '.forge-annotation-panel-body { padding: 12px; }',
        '.forge-annotation-panel-textarea { display: block; width: 100%; min-height: 88px; resize: vertical; border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 8px; background: rgba(15, 23, 42, 0.92); color: #f8fafc; outline: none; padding: 9px 10px; font: inherit; }',
        '.forge-annotation-panel-textarea:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.16); }',
        '.forge-annotation-panel-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }',
        '.forge-annotation-panel-button { height: 30px; border: 0; border-radius: 7px; padding: 0 10px; font: 600 12px/1 ui-sans-serif, system-ui, sans-serif; }',
        '.forge-annotation-panel-button-secondary { background: rgba(148, 163, 184, 0.16); color: #cbd5e1; }',
        '.forge-annotation-panel-button-primary { background: #38bdf8; color: #082f49; }',
      ].join('\\n')
      document.head.appendChild(annotationStyle)
    }

    if (!annotationOverlay) {
      annotationOverlay = document.createElement('div')
      annotationOverlay.className = 'forge-annotation-hover'
      annotationOverlay.setAttribute(annotationUiAttribute, 'true')
      document.body.appendChild(annotationOverlay)
    }

    return true
  }
  function isAnnotationUiElement(element) {
    return Boolean(element.closest(annotationUiSelector))
  }
  function hideAnnotationOverlay() {
    if (annotationOverlay) {
      annotationOverlay.style.display = 'none'
    }
  }
  function updateAnnotationOverlay(element) {
    if (!ensureAnnotationUi() || !annotationOverlay) return
    if (!element || isAnnotationUiElement(element)) {
      hideAnnotationOverlay()
      return
    }

    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      hideAnnotationOverlay()
      return
    }

    annotationTarget = element
    annotationOverlay.style.display = 'block'
    annotationOverlay.style.left = rect.left + 'px'
    annotationOverlay.style.top = rect.top + 'px'
    annotationOverlay.style.width = rect.width + 'px'
    annotationOverlay.style.height = rect.height + 'px'
  }
  function closeAnnotationPanel() {
    if (annotationPanel) {
      annotationPanel.remove()
      annotationPanel = null
    }
  }
  function placeAnnotationPanel(panel, rect) {
    const margin = 12
    const panelWidth = Math.min(360, window.innerWidth - margin * 2)
    const panelHeight = 208
    const maxLeft = Math.max(margin, window.innerWidth - panelWidth - margin)
    let left = Math.min(Math.max(margin, rect.x), maxLeft)
    let top = rect.y + rect.height + 10

    if (top + panelHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.y - panelHeight - 10)
    }

    panel.style.left = left + 'px'
    panel.style.top = top + 'px'
  }
  function showAnnotationPanel(annotation) {
    if (!ensureAnnotationUi()) return
    closeAnnotationPanel()

    const panel = document.createElement('form')
    panel.className = 'forge-annotation-panel'
    panel.setAttribute(annotationUiAttribute, 'true')
    panel.addEventListener('submit', (event) => {
      event.preventDefault()
      const textarea = panel.querySelector('textarea')
      if (!textarea) return
      const comment = textarea.value.trim()
      if (!comment) {
        textarea.focus()
        return
      }

      postMessage({
        annotation: {
          ...annotation,
          comment,
        },
        type: 'annotation.submit',
      })
      closeAnnotationPanel()
      setAnnotationEnabled(false)
    })

    const header = document.createElement('div')
    header.className = 'forge-annotation-panel-header'

    const title = document.createElement('div')
    title.className = 'forge-annotation-panel-title'
    title.textContent = 'Annotate element'

    const meta = document.createElement('div')
    meta.className = 'forge-annotation-panel-meta'
    meta.textContent = annotation.selector || annotation.tagName

    header.append(title, meta)

    const body = document.createElement('div')
    body.className = 'forge-annotation-panel-body'

    const textarea = document.createElement('textarea')
    textarea.className = 'forge-annotation-panel-textarea'
    textarea.placeholder = 'Describe what should change here...'
    textarea.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        panel.requestSubmit()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        closeAnnotationPanel()
      }
    })

    const actions = document.createElement('div')
    actions.className = 'forge-annotation-panel-actions'

    const cancelButton = document.createElement('button')
    cancelButton.className = 'forge-annotation-panel-button forge-annotation-panel-button-secondary'
    cancelButton.type = 'button'
    cancelButton.textContent = 'Cancel'
    cancelButton.addEventListener('click', () => {
      closeAnnotationPanel()
    })

    const submitButton = document.createElement('button')
    submitButton.className = 'forge-annotation-panel-button forge-annotation-panel-button-primary'
    submitButton.type = 'submit'
    submitButton.textContent = 'Send'

    actions.append(cancelButton, submitButton)
    body.append(textarea, actions)
    panel.append(header, body)
    document.body.appendChild(panel)
    annotationPanel = panel
    placeAnnotationPanel(panel, annotation.rect)
    textarea.focus()
  }
  function handleAnnotationPointerMove(event) {
    if (!annotationEnabled || !(event.target instanceof Element)) return
    updateAnnotationOverlay(event.target)
  }
  function handleAnnotationClick(event) {
    if (!annotationEnabled || !(event.target instanceof Element)) return
    if (isAnnotationUiElement(event.target)) return
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    updateAnnotationOverlay(event.target)
    showAnnotationPanel(captureElementAnnotation(event.target))
  }
  function handleAnnotationKeydown(event) {
    if (!annotationEnabled || event.key !== 'Escape') return
    event.preventDefault()
    closeAnnotationPanel()
    setAnnotationEnabled(false)
  }
  function handleAnnotationViewportChange() {
    if (!annotationEnabled || !annotationTarget) return
    updateAnnotationOverlay(annotationTarget)
    if (annotationPanel && annotationTarget) {
      placeAnnotationPanel(
        annotationPanel,
        captureElementAnnotation(annotationTarget).rect,
      )
    }
  }
  function setAnnotationEnabled(enabled) {
    const nextEnabled = Boolean(enabled)
    if (annotationEnabled === nextEnabled) {
      sendAnnotationMode()
      return
    }

    annotationEnabled = nextEnabled
    if (annotationEnabled) {
      if (!ensureAnnotationUi()) {
        annotationEnabled = false
        sendAnnotationMode()
        return
      }
      document.documentElement.classList.add('forge-annotation-enabled')
      document.addEventListener('pointermove', handleAnnotationPointerMove, true)
      document.addEventListener('click', handleAnnotationClick, true)
      document.addEventListener('keydown', handleAnnotationKeydown, true)
      window.addEventListener('scroll', handleAnnotationViewportChange, true)
      window.addEventListener('resize', handleAnnotationViewportChange)
    } else {
      document.documentElement.classList.remove('forge-annotation-enabled')
      document.removeEventListener('pointermove', handleAnnotationPointerMove, true)
      document.removeEventListener('click', handleAnnotationClick, true)
      document.removeEventListener('keydown', handleAnnotationKeydown, true)
      window.removeEventListener('scroll', handleAnnotationViewportChange, true)
      window.removeEventListener('resize', handleAnnotationViewportChange)
      annotationTarget = null
      closeAnnotationPanel()
      hideAnnotationOverlay()
    }
    sendAnnotationMode()
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
    if (message.type === 'annotation.set') {
      setAnnotationEnabled(message.enabled === true)
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
})()`
const PREVIEW_BRIDGE_SCRIPT = `<script data-forge-preview-bridge>
${PREVIEW_BRIDGE_SOURCE}
</script>`
const PREVIEW_BRIDGE_MODULE = `if (typeof window !== 'undefined') {
${PREVIEW_BRIDGE_SOURCE}
}
`

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

  if (indexHtml) {
    if (indexHtml.includes(PREVIEW_BRIDGE_MARKER)) {
      return files
    }

    return {
      ...files,
      'index.html': injectForgePreviewBridge(indexHtml),
    }
  }

  return injectForgePreviewBridgeModule(files)
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

function injectForgePreviewBridgeModule(files: Record<string, string>) {
  const rootRoutePath = 'src/routes/__root.tsx'
  const rootRoute = files[rootRoutePath]

  if (rootRoute) {
    return {
      ...files,
      [PREVIEW_BRIDGE_MODULE_PATH]: PREVIEW_BRIDGE_MODULE,
      [rootRoutePath]: injectForgePreviewBridgeImport({
        content: rootRoute,
        importPath: '../forge-preview-bridge',
      }),
    }
  }

  const routerPath = 'src/router.tsx'
  const router = files[routerPath]

  if (!router) {
    return files
  }

  return {
    ...files,
    [PREVIEW_BRIDGE_MODULE_PATH]: PREVIEW_BRIDGE_MODULE,
    [routerPath]: injectForgePreviewBridgeImport({
      content: router,
      importPath: './forge-preview-bridge',
    }),
  }
}

function injectForgePreviewBridgeImport({
  content,
  importPath,
}: {
  content: string
  importPath: string
}) {
  if (content.includes('forge-preview-bridge')) {
    return content
  }

  return `import '${importPath}'\n${content}`
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
