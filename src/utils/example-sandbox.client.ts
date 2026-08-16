import type { CompiledExampleWorkspace } from './example-esbuild.client'

export type ExampleSandboxTheme = 'light' | 'dark'
export type ExampleSandboxStatus = 'error' | 'ready' | 'running'
export type ExampleConsoleLevel = 'debug' | 'error' | 'info' | 'log' | 'warn'

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
  theme,
}: {
  binaryFiles?: Record<string, string>
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
  const bridge = escapeScriptText(createBridgeScript(runToken, theme))
  const javascript = escapeScriptText(
    `${compiled.javascript}\nsend({ kind: 'status', status: 'ready' })`,
  )
  const head = [
    '<meta name="color-scheme" content="light dark">',
    `<script type="importmap">${importMap}</script>`,
    `<style>:root{--notebook-background:#fff;--notebook-foreground:#111;--notebook-error:#b91c1c;--ts-chart-1:#3aa3c4;--ts-chart-2:#d3481b;--ts-chart-3:#39af46;--ts-chart-4:#b64cc7;--ts-chart-5:#ffa216;--ts-chart-6:#3e3529;background:var(--notebook-background);color:var(--notebook-foreground)}:root.dark{--notebook-background:#111;--notebook-foreground:#d4d4d4;--notebook-error:#e06e49;--ts-chart-1:#9cd5e2;--ts-chart-2:#edaa8d;--ts-chart-3:#a2e1a9;--ts-chart-4:#ca8ec5;--ts-chart-5:#fae884;--ts-chart-6:#aea691}</style>`,
    compiled.css ? `<style>${escapeStyleText(compiled.css)}</style>` : '',
    `<script>${bridge}</script>`,
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

function createBridgeScript(runToken: string, theme: ExampleSandboxTheme) {
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

document.addEventListener('click', (event) => {
  const anchor = event.target instanceof Element
    ? event.target.closest('a[href]')
    : null
  const href = anchor?.getAttribute('href')
  if (!href?.startsWith('#')) return

  event.preventDefault()
  const target = document.getElementById(href.slice(1))
  target?.scrollIntoView()
})

window.addEventListener('message', (event) => {
  const value = event.data
  if (
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
