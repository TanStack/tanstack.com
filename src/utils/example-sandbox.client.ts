import type { CompiledExampleWorkspace } from './example-esbuild.client'

export type ExampleSandboxTheme = 'light' | 'dark'
export type ExampleSandboxStatus = 'error' | 'ready' | 'running'
export type ExampleConsoleLevel = 'debug' | 'error' | 'info' | 'log' | 'warn'
export type ExampleSandboxNavigationKind =
  | 'hash'
  | 'load'
  | 'pop'
  | 'push'
  | 'replace'

export type ExampleSandboxBrowserCommand =
  | { kind: 'annotation'; enabled: boolean }
  | { kind: 'back' }
  | { kind: 'capture'; requestId: string }
  | { kind: 'forward' }
  | { kind: 'navigate'; url: string }
  | { kind: 'reload' }

export type ExampleSandboxBrowserCommandMessage =
  ExampleSandboxBrowserCommand & {
    channel: string
    type: 'tanstack-example-sandbox:browser-command'
  }

export type ExampleSandboxBrowserMode = 'client' | 'webcontainer'

type ExampleSandboxBrowserMessageBase = {
  channel: string
  type: 'tanstack-example-sandbox:browser'
}

export type ExampleSandboxBrowserStateMessage =
  ExampleSandboxBrowserMessageBase & {
    kind: 'browser-state'
    navigationKind: ExampleSandboxNavigationKind
    title: string
    url: string
  }

export type ExampleSandboxAnnotationTargetMessage =
  ExampleSandboxBrowserMessageBase & {
    kind: 'annotation-target'
    rect: {
      height: number
      width: number
      x: number
      y: number
    }
    selector: string
    tag: string
    text: string
  }

export type ExampleSandboxNavigationErrorMessage =
  ExampleSandboxBrowserMessageBase & {
    kind: 'navigation-error'
    message: string
    url: string
  }

export type ExampleSandboxCaptureMessage = ExampleSandboxBrowserMessageBase & {
  bytes: ArrayBuffer
  kind: 'capture-result'
  mimeType: 'image/png'
  requestId: string
}

export type ExampleSandboxCaptureErrorMessage =
  ExampleSandboxBrowserMessageBase & {
    kind: 'capture-error'
    message: string
    requestId: string
  }

export type ExampleSandboxBrowserMessage =
  | ExampleSandboxAnnotationTargetMessage
  | ExampleSandboxCaptureErrorMessage
  | ExampleSandboxCaptureMessage
  | ExampleSandboxBrowserStateMessage
  | ExampleSandboxNavigationErrorMessage

export type ExampleSandboxMessage =
  | {
      kind: 'console'
      level: ExampleConsoleLevel
      runToken: string
      type: 'tanstack-example-sandbox'
      values: Array<string>
    }
  | {
      kind: 'status'
      message?: string
      runToken: string
      status: ExampleSandboxStatus
      type: 'tanstack-example-sandbox'
    }
  | {
      kind: 'theme-request'
      runToken: string
      type: 'tanstack-example-sandbox'
    }

export function createExampleSandboxDocument({
  binaryFiles,
  compiled,
  document,
  entry,
  files,
  runToken,
  browserChannel = runToken,
  theme,
}: {
  binaryFiles?: Record<string, string>
  browserChannel?: string
  compiled: CompiledExampleWorkspace
  document: string | undefined
  entry: string
  files: Record<string, string>
  runToken: string
  theme: ExampleSandboxTheme
}) {
  const importMap = escapeScriptText(
    JSON.stringify({ imports: compiled.imports }),
  )
  const bridge = escapeScriptText(createRuntimeBridgeScript(runToken, theme))
  const browserBridge = escapeScriptText(
    createExampleSandboxBrowserScript({
      channel: browserChannel,
      mode: 'client',
    }),
  )
  const javascript = escapeScriptText(
    `${compiled.javascript}\nsend({ kind: 'status', status: 'ready' })`,
  )
  const head = [
    '<meta name="color-scheme" content="light dark">',
    `<script type="importmap">${importMap}</script>`,
    `<style>:root{--notebook-background:#fff;--notebook-foreground:#111;--notebook-error:#b91c1c;--ts-chart-1:#3aa3c4;--ts-chart-2:#d3481b;--ts-chart-3:#39af46;--ts-chart-4:#b64cc7;--ts-chart-5:#ffa216;--ts-chart-6:#3e3529;background:var(--notebook-background);color:var(--notebook-foreground)}:root.dark{--notebook-background:#111;--notebook-foreground:#d4d4d4;--notebook-error:#e06e49;--ts-chart-1:#9cd5e2;--ts-chart-2:#edaa8d;--ts-chart-3:#a2e1a9;--ts-chart-4:#ca8ec5;--ts-chart-5:#fae884;--ts-chart-6:#aea691}</style>`,
    compiled.css ? `<style>${escapeStyleText(compiled.css)}</style>` : '',
    `<script>${bridge}</script><script>${browserBridge}</script>`,
  ].join('')
  const body = `<script type="module">${javascript}</script>`
  const source = document
    ? prepareAuthoredDocument(document, entry, files, binaryFiles)
    : '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>'

  return injectBeforeClosingTag(
    injectBeforeClosingTag(source, 'head', head),
    'body',
    body,
  )
}

function prepareAuthoredDocument(
  source: string,
  entry: string,
  files: Record<string, string>,
  binaryFiles: Record<string, string> = {},
) {
  const parsed = new DOMParser().parseFromString(source, 'text/html')

  for (const script of parsed.querySelectorAll('script[type="module"][src]')) {
    const src = script.getAttribute('src')
    if (!src) continue

    const url = new URL(src, 'https://tanstack.example/')
    if (url.origin === 'https://tanstack.example' && url.pathname === entry) {
      script.remove()
    }
  }

  for (const element of parsed.querySelectorAll('[href], [src]')) {
    for (const attribute of ['href', 'src']) {
      const value = element.getAttribute(attribute)
      if (!value) continue

      const url = new URL(value, 'https://tanstack.example/')
      if (url.origin !== 'https://tanstack.example') continue

      const filePath = `/public${url.pathname}`
      const file = files[filePath] ?? files[url.pathname]
      const binaryFile = binaryFiles[filePath] ?? binaryFiles[url.pathname]
      const binaryMimeType = getBinaryAssetMimeType(url.pathname)
      if (binaryFile !== undefined && binaryMimeType) {
        element.setAttribute(
          attribute,
          `data:${binaryMimeType};base64,${binaryFile}`,
        )
        continue
      }

      const mimeType = getTextAssetMimeType(url.pathname)
      if (file === undefined || !mimeType) continue

      element.setAttribute(
        attribute,
        `data:${mimeType};charset=utf-8,${encodeURIComponent(file)}`,
      )
    }
  }

  const doctype = parsed.doctype ? '<!doctype html>' : ''
  return `${doctype}${parsed.documentElement.outerHTML}`
}

function getBinaryAssetMimeType(path: string) {
  if (/\.avif$/i.test(path)) return 'image/avif'
  if (/\.gif$/i.test(path)) return 'image/gif'
  if (/\.ico$/i.test(path)) return 'image/x-icon'
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg'
  if (/\.png$/i.test(path)) return 'image/png'
  if (/\.webp$/i.test(path)) return 'image/webp'
  if (/\.woff2$/i.test(path)) return 'font/woff2'
  if (/\.woff$/i.test(path)) return 'font/woff'
  return undefined
}

function getTextAssetMimeType(path: string) {
  if (path.endsWith('.css')) return 'text/css'
  if (path.endsWith('.html')) return 'text/html'
  if (path.endsWith('.js')) return 'text/javascript'
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.svg')) return 'image/svg+xml'
  if (path.endsWith('.txt')) return 'text/plain'
  return undefined
}

export function postExampleSandboxTheme({
  frame,
  runToken,
  theme,
}: {
  frame: HTMLIFrameElement | null
  runToken: string
  theme: ExampleSandboxTheme
}) {
  frame?.contentWindow?.postMessage(
    {
      type: 'tanstack-example-sandbox:theme',
      runToken,
      theme,
    },
    '*',
  )
}

export function postExampleSandboxBrowserCommand({
  channel,
  command,
  frame,
  targetOrigin = '*',
}: {
  channel: string
  command: ExampleSandboxBrowserCommand
  frame: HTMLIFrameElement | null
  targetOrigin?: string
}) {
  frame?.contentWindow?.postMessage(
    {
      channel,
      ...command,
      type: 'tanstack-example-sandbox:browser-command',
    },
    targetOrigin,
  )
}

export function isExampleSandboxBrowserCommandMessage(
  value: unknown,
  channel: string,
): value is ExampleSandboxBrowserCommandMessage {
  if (
    !isRecord(value) ||
    value.type !== 'tanstack-example-sandbox:browser-command' ||
    value.channel !== channel ||
    typeof value.kind !== 'string'
  ) {
    return false
  }

  if (
    value.kind === 'back' ||
    value.kind === 'forward' ||
    value.kind === 'reload'
  ) {
    return true
  }

  if (value.kind === 'annotation') return typeof value.enabled === 'boolean'

  if (value.kind === 'capture') {
    return isCappedString(value.requestId, 128)
  }

  return (
    value.kind === 'navigate' &&
    typeof value.url === 'string' &&
    value.url.length <= 2_048
  )
}

export function isExampleSandboxBrowserMessage(
  value: unknown,
  channel: string,
): value is ExampleSandboxBrowserMessage {
  if (
    !isRecord(value) ||
    value.type !== 'tanstack-example-sandbox:browser' ||
    value.channel !== channel ||
    typeof value.kind !== 'string'
  ) {
    return false
  }

  if (value.kind === 'browser-state') {
    return (
      isNavigationKind(value.navigationKind) &&
      isCappedString(value.title, 512) &&
      isCappedString(value.url, 2_048)
    )
  }

  if (value.kind === 'navigation-error') {
    return (
      isCappedString(value.message, 256) && isCappedString(value.url, 2_048)
    )
  }

  if (value.kind === 'capture-result') {
    return (
      value.mimeType === 'image/png' &&
      isCappedString(value.requestId, 128) &&
      value.bytes instanceof ArrayBuffer &&
      value.bytes.byteLength <= 8_000_000
    )
  }

  if (value.kind === 'capture-error') {
    return (
      isCappedString(value.requestId, 128) && isCappedString(value.message, 256)
    )
  }

  return (
    value.kind === 'annotation-target' &&
    isCappedString(value.selector, 512) &&
    isCappedString(value.tag, 64) &&
    isCappedString(value.text, 500) &&
    isAnnotationRect(value.rect)
  )
}

export function isExampleSandboxMessage(
  value: unknown,
  runToken: string,
): value is ExampleSandboxMessage {
  if (
    !isRecord(value) ||
    value.type !== 'tanstack-example-sandbox' ||
    value.runToken !== runToken ||
    typeof value.kind !== 'string'
  ) {
    return false
  }

  if (value.kind === 'console') {
    return (
      isConsoleLevel(value.level) &&
      Array.isArray(value.values) &&
      value.values.every((item) => typeof item === 'string')
    )
  }

  if (value.kind === 'theme-request') return true

  return (
    value.kind === 'status' &&
    (value.status === 'error' ||
      value.status === 'ready' ||
      value.status === 'running') &&
    (value.message === undefined || typeof value.message === 'string')
  )
}

export function createExampleSandboxBrowserScript({
  channel,
  mode,
}: {
  channel: string
  mode: ExampleSandboxBrowserMode
}) {
  return `(function () {
const channel = ${JSON.stringify(channel)}
const mode = ${JSON.stringify(mode)}
let annotationEnabled = false
let annotationTarget = null
let annotationOverlay = null
let annotationStyle = null
let lastReportedUrl = null

function send(value, transferables) {
  parent.postMessage({
    type: 'tanstack-example-sandbox:browser',
    channel,
    ...value,
  }, '*', transferables || [])
}

function currentUrl() {
  if (mode === 'client') return location.hash || '/'
  return location.href
}

function reportBrowserState(navigationKind, documentChanged) {
  const url = currentUrl().slice(0, 2048)
  const didNavigate = documentChanged || navigationKind === 'load'
    || (lastReportedUrl !== null && lastReportedUrl !== url)
  if (annotationTarget && didNavigate) {
    annotationTarget = null
    setAnnotationMarkerVisible(false)
    positionAnnotationOverlay()
  }
  lastReportedUrl = url
  send({
    kind: 'browser-state',
    navigationKind,
    title: document.title.slice(0, 512),
    url,
  })
}

function rejectNavigation(url) {
  send({
    kind: 'navigation-error',
    message: mode === 'client'
      ? 'This client preview only supports in-page links.'
      : 'Preview navigation must stay on the current origin.',
    url: String(url).slice(0, 2048),
  })
}

function getClientHash(value) {
  const url = value.trim()
  if (url === '' || url === '/' || url === 'about:srcdoc') return ''
  if (url.startsWith('#')) return url
  if (url.startsWith('/#')) return url.slice(1)
  return null
}

function navigateClient(url) {
  const hash = getClientHash(url)
  if (hash === null) {
    rejectNavigation(url)
    return
  }

  try {
    if (location.hash === hash) {
      reportBrowserState('hash')
      return
    }
    location.hash = hash
  } catch {
    rejectNavigation(url)
  }
}

function navigateWebContainer(value) {
  let url
  try {
    url = new URL(value, location.href)
  } catch {
    rejectNavigation(value)
    return
  }

  if (url.origin !== location.origin) {
    rejectNavigation(value)
    return
  }
  location.assign(url.href)
}

function navigate(url) {
  if (mode === 'client') {
    navigateClient(url)
    return
  }
  navigateWebContainer(url)
}

function capRectNumber(value, minimum) {
  const rounded = Math.round(value * 100) / 100
  return Math.min(100000, Math.max(minimum, rounded))
}

function getSelector(element) {
  if (element.id) return ('#' + CSS.escape(element.id)).slice(0, 512)

  const parts = []
  let current = element
  while (current && current !== document.documentElement && parts.length < 4) {
    let part = current.tagName.toLowerCase()
    const classes = Array.from(current.classList).slice(0, 2)
    if (classes.length > 0) {
      part += classes.map((className) => '.' + CSS.escape(className)).join('')
    }

    const parentElement = current.parentElement
    if (parentElement) {
      const siblings = Array.from(parentElement.children).filter(
        (sibling) => sibling.tagName === current.tagName,
      )
      if (siblings.length > 1) {
        part += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')'
      }
    }

    parts.unshift(part)
    current = parentElement
  }
  return parts.join(' > ').slice(0, 512)
}

function ensureAnnotationOverlay() {
  if (annotationOverlay) return annotationOverlay

  annotationOverlay = document.createElement('div')
  annotationOverlay.setAttribute('aria-hidden', 'true')
  annotationOverlay.setAttribute('data-tanstack-annotation-overlay', '')
  Object.assign(annotationOverlay.style, {
    border: '2px solid #2563eb',
    borderRadius: '3px',
    boxSizing: 'border-box',
    display: 'none',
    pointerEvents: 'none',
    position: 'fixed',
    zIndex: '2147483647',
  })
  const marker = document.createElement('span')
  marker.dataset.tanstackAnnotationMarker = ''
  marker.textContent = '1'
  Object.assign(marker.style, {
    alignItems: 'center',
    background: '#2563eb',
    border: '2px solid white',
    borderRadius: '999px',
    color: 'white',
    display: 'none',
    font: '600 11px/1 ui-sans-serif, system-ui, sans-serif',
    height: '22px',
    justifyContent: 'center',
    position: 'absolute',
    right: '-11px',
    top: '-11px',
    width: '22px',
  })
  annotationOverlay.append(marker)
  document.documentElement.append(annotationOverlay)
  return annotationOverlay
}

function setAnnotationMarkerVisible(visible) {
  const marker = ensureAnnotationOverlay().querySelector(
    '[data-tanstack-annotation-marker]',
  )
  if (marker instanceof HTMLElement) marker.style.display = visible ? 'flex' : 'none'
}

function positionAnnotationOverlay() {
  const overlay = ensureAnnotationOverlay()
  if (!annotationEnabled || !annotationTarget?.isConnected) {
    overlay.style.display = 'none'
    return
  }

  const rect = annotationTarget.getBoundingClientRect()
  Object.assign(overlay.style, {
    display: 'block',
    height: Math.max(0, rect.height) + 'px',
    left: rect.left + 'px',
    top: rect.top + 'px',
    width: Math.max(0, rect.width) + 'px',
  })
}

function setAnnotationEnabled(enabled) {
  annotationEnabled = enabled
  annotationTarget = null

  if (enabled && !annotationStyle) {
    annotationStyle = document.createElement('style')
    annotationStyle.textContent = 'html[data-tanstack-annotating] *{cursor:crosshair!important}'
    document.documentElement.append(annotationStyle)
  }
  document.documentElement.toggleAttribute('data-tanstack-annotating', enabled)
  setAnnotationMarkerVisible(false)
  positionAnnotationOverlay()
}

function sendAnnotationTarget(element) {
  const rect = element.getBoundingClientRect()
  send({
    kind: 'annotation-target',
    rect: {
      height: capRectNumber(rect.height, 0),
      width: capRectNumber(rect.width, 0),
      x: capRectNumber(rect.x, -100000),
      y: capRectNumber(rect.y, -100000),
    },
    selector: getSelector(element),
    tag: element.tagName.toLowerCase().slice(0, 64),
    text: (element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 500),
  })
}

function collectPageStyles() {
  let source = ''
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (source.length >= 500000) return source.slice(0, 500000)
        source += rule.cssText + '\\n'
      }
    } catch {
      // Cross-origin stylesheets cannot be read. Their link remains in the clone.
    }
  }
  return source.slice(0, 500000)
}

function clonePageForCapture() {
  const clone = document.documentElement.cloneNode(true)
  if (!(clone instanceof Element)) throw new Error('Unable to clone preview.')

  clone.querySelectorAll('script').forEach((script) => script.remove())
  const originalCanvases = document.querySelectorAll('canvas')
  const clonedCanvases = clone.querySelectorAll('canvas')
  clonedCanvases.forEach((canvas, index) => {
    const original = originalCanvases[index]
    if (!original) return
    try {
      const image = document.createElement('img')
      image.src = original.toDataURL('image/png')
      image.width = original.clientWidth
      image.height = original.clientHeight
      image.setAttribute('style', original.getAttribute('style') || '')
      canvas.replaceWith(image)
    } catch {
      // A tainted canvas cannot be copied; leave its empty fallback in place.
    }
  })

  const style = document.createElement('style')
  style.textContent = collectPageStyles()
  clone.querySelector('head')?.append(style)
  return clone
}

async function captureViewport(requestId) {
  try {
    const width = Math.min(4096, Math.max(1, window.innerWidth))
    const height = Math.min(4096, Math.max(1, window.innerHeight))
    const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
    if (width * height * pixelRatio * pixelRatio > 16000000) {
      throw new Error('The preview is too large to capture.')
    }

    const clone = clonePageForCapture()
    const serialized = new XMLSerializer().serializeToString(clone)
    const translated = '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' +
      Math.max(document.documentElement.scrollWidth, width) + 'px;transform:translate(' +
      (-window.scrollX) + 'px,' + (-window.scrollY) + 'px);transform-origin:top left">' +
      serialized + '</div>'
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width +
      '" height="' + height + '"><foreignObject width="100%" height="100%">' +
      translated + '</foreignObject></svg>'
    const svgUrl = URL.createObjectURL(
      new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
    )
    const image = new Image()
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = () => reject(new Error('Unable to render preview image.'))
      image.src = svgUrl
    })
    URL.revokeObjectURL(svgUrl)

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Screenshot rendering is unavailable.')
    context.scale(pixelRatio, pixelRatio)
    context.drawImage(image, 0, 0, width, height)

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (value) => value
          ? resolve(value)
          : reject(new Error('Unable to encode screenshot.')),
        'image/png',
      )
    })
    const bytes = await blob.arrayBuffer()
    if (bytes.byteLength > 8000000) {
      throw new Error('The screenshot is too large to copy.')
    }
    send({
      bytes,
      kind: 'capture-result',
      mimeType: 'image/png',
      requestId,
    }, [bytes])
  } catch (cause) {
    send({
      kind: 'capture-error',
      message: cause instanceof Error
        ? cause.message.slice(0, 256)
        : 'Unable to capture this preview.',
      requestId,
    })
  }
}

document.addEventListener('pointerover', (event) => {
  if (!annotationEnabled || !(event.target instanceof Element)) return
  annotationTarget = event.target
  setAnnotationMarkerVisible(false)
  positionAnnotationOverlay()
}, true)

document.addEventListener('click', (event) => {
  if (!annotationEnabled || !(event.target instanceof Element)) return
  event.preventDefault()
  event.stopImmediatePropagation()
  annotationTarget = event.target
  setAnnotationMarkerVisible(true)
  positionAnnotationOverlay()
  sendAnnotationTarget(event.target)
}, true)

document.addEventListener('click', (event) => {
  const anchor = event.target instanceof Element
    ? event.target.closest('a[href]')
    : null
  const href = anchor?.getAttribute('href')
  if (href === null || href === undefined || event.defaultPrevented) return

  if (mode === 'webcontainer') {
    let url
    try {
      url = new URL(href, document.baseURI)
    } catch {
      event.preventDefault()
      event.stopImmediatePropagation()
      rejectNavigation(href)
      return
    }
    if (url.origin === location.origin) return
    event.preventDefault()
    event.stopImmediatePropagation()
    rejectNavigation(url.href)
    return
  }

  const hash = getClientHash(href)
  if (hash === null) {
    event.preventDefault()
    event.stopImmediatePropagation()
    rejectNavigation(href)
    return
  }
  event.preventDefault()
  const target = document.getElementById(hash.slice(1))
  target?.scrollIntoView()
  navigate(href)
})

document.addEventListener('submit', (event) => {
  if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) return
  if (event.target.method.toLowerCase() === 'dialog') return

  const url = new URL(event.target.action || location.href, location.href)
  if (mode === 'webcontainer' && url.origin === location.origin) return

  event.preventDefault()
  event.stopImmediatePropagation()
  rejectNavigation(url.href)
})

const originalPushState = history.pushState.bind(history)
history.pushState = (...arguments_) => {
  const result = originalPushState(...arguments_)
  reportBrowserState('push')
  return result
}

const originalReplaceState = history.replaceState.bind(history)
history.replaceState = (...arguments_) => {
  const result = originalReplaceState(...arguments_)
  reportBrowserState('replace')
  return result
}

window.addEventListener('pageshow', (event) => {
  const navigation = performance.getEntriesByType('navigation')[0]
  reportBrowserState(
    event.persisted || navigation?.type === 'back_forward' ? 'pop' : 'load',
    true,
  )
})
window.addEventListener('popstate', () => reportBrowserState('pop'))
window.addEventListener('hashchange', () => reportBrowserState('hash'))
window.addEventListener('resize', positionAnnotationOverlay)
document.addEventListener('scroll', positionAnnotationOverlay, true)

window.addEventListener('message', (event) => {
  const value = event.data
  if (
    event.source !== parent ||
    typeof value !== 'object' ||
    value === null ||
    value.type !== 'tanstack-example-sandbox:browser-command' ||
    value.channel !== channel ||
    typeof value.kind !== 'string'
  ) return

  if (value.kind === 'back') {
    history.back()
    return
  }
  if (value.kind === 'forward') {
    history.forward()
    return
  }
  if (value.kind === 'reload') {
    location.reload()
    return
  }
  if (
    value.kind === 'capture' &&
    typeof value.requestId === 'string' &&
    value.requestId.length <= 128
  ) {
    void captureViewport(value.requestId)
    return
  }
  if (
    value.kind === 'navigate' &&
    typeof value.url === 'string' &&
    value.url.length <= 2048
  ) {
    navigate(value.url)
    return
  }
  if (value.kind === 'annotation' && typeof value.enabled === 'boolean') {
    setAnnotationEnabled(value.enabled)
  }
})

})()`
}

function createRuntimeBridgeScript(
  runToken: string,
  theme: ExampleSandboxTheme,
) {
  return `const runToken = ${JSON.stringify(runToken)}

function send(value) {
  parent.postMessage({ type: 'tanstack-example-sandbox', runToken, ...value }, '*')
}

function applyTheme(theme) {
  const dark = theme === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.classList.toggle('light', !dark)
  document.documentElement.style.colorScheme = theme
}

function format(value) {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.stack || value.message
  try {
    return JSON.stringify(value, (_key, nested) =>
      typeof nested === 'bigint' ? String(nested) + 'n' : nested, 2) ?? String(value)
  } catch {
    return String(value)
  }
}

applyTheme(${JSON.stringify(theme)})

window.addEventListener('message', (event) => {
  const value = event.data
  if (
    event.source !== parent ||
    typeof value !== 'object' ||
    value === null ||
    value.type !== 'tanstack-example-sandbox:theme' ||
    value.runToken !== runToken ||
    (value.theme !== 'light' && value.theme !== 'dark')
  ) return
  applyTheme(value.theme)
})

for (const level of ['debug', 'error', 'info', 'log', 'warn']) {
  const original = console[level].bind(console)
  console[level] = (...values) => {
    original(...values)
    send({ kind: 'console', level, values: values.map(format) })
  }
}

window.addEventListener('error', (event) => {
  send({ kind: 'status', status: 'error', message: format(event.error || event.message) })
})

window.addEventListener('unhandledrejection', (event) => {
  send({ kind: 'status', status: 'error', message: format(event.reason) })
})

send({ kind: 'theme-request' })
send({ kind: 'status', status: 'running' })`
}

function injectBeforeClosingTag(
  source: string,
  tag: 'body' | 'head',
  value: string,
) {
  const closingTag = `</${tag}>`
  const index = source.toLowerCase().lastIndexOf(closingTag)
  if (index === -1) return `${source}${value}`
  return `${source.slice(0, index)}${value}${source.slice(index)}`
}

function escapeScriptText(value: string) {
  return value.replaceAll('</script', '<\\/script')
}

function escapeStyleText(value: string) {
  return value.replaceAll('</style', '<\\/style')
}

function isConsoleLevel(value: unknown): value is ExampleConsoleLevel {
  return (
    value === 'debug' ||
    value === 'error' ||
    value === 'info' ||
    value === 'log' ||
    value === 'warn'
  )
}

function isNavigationKind(
  value: unknown,
): value is ExampleSandboxNavigationKind {
  return (
    value === 'hash' ||
    value === 'load' ||
    value === 'pop' ||
    value === 'push' ||
    value === 'replace'
  )
}

function isCappedString(value: unknown, maximumLength: number) {
  return typeof value === 'string' && value.length <= maximumLength
}

function isAnnotationRect(
  value: unknown,
): value is ExampleSandboxAnnotationTargetMessage['rect'] {
  if (!isRecord(value)) return false

  return (
    isCappedNumber(value.x, -100_000) &&
    isCappedNumber(value.y, -100_000) &&
    isCappedNumber(value.width, 0) &&
    isCappedNumber(value.height, 0)
  )
}

function isCappedNumber(value: unknown, minimum: number) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= 100_000
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
