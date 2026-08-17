import * as React from 'react'
import {
  ArrowRightIcon,
  CheckIcon,
  CodeIcon,
  CopyIcon,
  PlayIcon,
  PlusIcon,
  QuestionIcon,
  TerminalWindowIcon,
} from '@phosphor-icons/react'
import { createHighlighter } from '@tanstack/highlight/core'
import { tsx } from '@tanstack/highlight/languages/tsx'
import * as esbuild from 'esbuild-wasm'
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url'
import { Collapsible, CollapsibleContent } from '~/components/Collapsible'
import { ButtonGroup } from '~/components/ButtonGroup'
import { NotebookGuideDialog } from '~/components/charts/NotebookGuideDialog'
import { Button } from '~/components/ds/ui'
import {
  SandboxBrowser,
  type SandboxBrowserAnnotationTarget,
} from '~/components/examples/SandboxBrowser.client'
import { useLoginModal } from '~/contexts/LoginModalContext'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { copyTextToClipboard } from '~/utils/browser-effects'
import {
  canGoBackInExamplePreview,
  canGoForwardInExamplePreview,
  createExamplePreviewHistory,
  normalizeExamplePreviewUrl,
  updateExamplePreviewHistory,
} from '~/utils/example-preview-history'
import {
  createExampleSandboxBrowserScript,
  isExampleSandboxBrowserMessage,
  postExampleSandboxBrowserCommand,
} from '~/utils/example-sandbox.client'
import {
  createSharedChartUrl,
  decodeSharedChartSource,
  encodeSharedChartSource,
} from '~/utils/charts-notebook'
import {
  notebookImports,
  notebookStarterSource,
} from '~/utils/notebook-environment'
import { notebookExamples } from '~/utils/notebook-examples'

const draftStorageKey = 'tanstack-charts-notebook-source:v1'
const defaultNotebookTitle = 'Notebook'
const sourceHighlighter = createHighlighter({ languages: [tsx] })
const editorTextStyle = {
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: '13px',
  fontWeight: 400,
  fontVariantLigatures: 'none',
  letterSpacing: 'normal',
  lineHeight: '24px',
  tabSize: 2,
} satisfies React.CSSProperties
const notebookImportMap = JSON.stringify({ imports: notebookImports })
let esbuildInitialization: Promise<void> | undefined

async function compileNotebookSource(source: string) {
  esbuildInitialization ??= esbuild.initialize({ wasmURL: esbuildWasmUrl })
  await esbuildInitialization

  const result = await esbuild.transform(source, {
    format: 'esm',
    jsx: 'automatic',
    jsxImportSource: 'react',
    legalComments: 'none',
    loader: 'tsx',
    sourcefile: 'notebook.tsx',
    sourcemap: 'inline',
    target: 'es2022',
  })

  return result.code
}

const defaultSource = `import { scaleBand, scaleLinear } from 'd3-scale'
import { barY, defineChart, mountChart } from '@tanstack/charts'
import { alphabet } from '@tanstack/charts-data/alphabet'

const letters = alphabet.slice(0, 10)
console.log('Loaded', letters.length, 'letter-frequency rows')

const definition = defineChart({
  marks: [
    barY(letters, {
      id: 'letter-frequency',
      x: 'letter',
      y: 'frequency',
      key: 'letter',
      fill: '#10b981',
      inset: 2,
    }),
  ],
  x: {
    scale: scaleBand()
      .domain(letters.map((datum) => datum.letter))
      .padding(0.2),
  },
  y: {
    scale: scaleLinear().domain([0, 0.14]).nice(),
    axis: { label: 'Frequency' },
    grid: true,
  },
  margin: { top: 24, right: 24, bottom: 48, left: 56 },
  theme: { background: 'transparent' },
  animate: true,
})

const host = document.createElement('div')
host.style.width = '100%'
host.style.height = '100%'

mountChart(host, {
  definition,
  height: 360,
  initialWidth: 720,
  ariaLabel: 'English letter frequency',
})

export default host`

type SandboxTheme = 'light' | 'dark'

function createSandboxDocument(
  source: string,
  browserChannel: string,
  runToken: string,
  theme: SandboxTheme,
) {
  const serializedSource = JSON.stringify(source).replaceAll('<', '\\u003c')
  const serializedRunToken = JSON.stringify(runToken)
  const serializedTheme = JSON.stringify(theme)
  const browserBridge = createExampleSandboxBrowserScript({
    channel: browserChannel,
    mode: 'client',
  }).replaceAll('</script', '<\\/script')

  return `<!doctype html>
<html class="${theme}" style="color-scheme: ${theme}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <script type="importmap">${notebookImportMap}</script>
    <script>${browserBridge}</script>
    <style>
      * { box-sizing: border-box; }
      html, body, #output { width: 100%; margin: 0; }
      :root {
        color-scheme: light;
        --notebook-background: #fff;
        --notebook-foreground: #171717;
        --notebook-error: #b91c1c;
      }
      :root.dark {
        color-scheme: dark;
        --notebook-background: #030712;
        --notebook-foreground: #f9fafb;
        --notebook-error: #f87171;
      }
      body {
        overflow-x: auto;
        overflow-y: hidden;
        background: var(--notebook-background);
        color: var(--notebook-foreground);
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      #output { padding: 24px; }
      #output > pre {
        margin: 0;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      #output > pre[data-error] { color: var(--notebook-error); }
    </style>
  </head>
  <body>
    <main id="output" aria-label="Notebook output"></main>
    <script type="module">
      const output = document.querySelector('#output')
      const source = ${serializedSource}
      const runToken = ${serializedRunToken}
      const initialTheme = ${serializedTheme}

      function applyTheme(theme) {
        const dark = theme === 'dark'
        document.documentElement.classList.toggle('dark', dark)
        document.documentElement.classList.toggle('light', !dark)
        document.documentElement.style.colorScheme = theme
      }

      applyTheme(initialTheme)

      window.addEventListener('message', (event) => {
        const value = event.data
        if (
          typeof value !== 'object' ||
          value === null ||
          value.type !== 'tanstack-charts-notebook:theme' ||
          value.runToken !== runToken ||
          (value.theme !== 'light' && value.theme !== 'dark')
        ) {
          return
        }

        applyTheme(value.theme)
      })

      parent.postMessage(
        {
          type: 'tanstack-charts-notebook:theme-request',
          runToken,
        },
        '*',
      )

      function post(status, message) {
        parent.postMessage(
          {
            type: 'tanstack-charts-notebook:status',
            runToken,
            status,
            message,
          },
          '*',
        )
      }

      let postedHeight = 0
      let heightFrame

      function postHeight() {
        heightFrame = undefined
        const height = Math.ceil(
          Math.max(output.scrollHeight, output.getBoundingClientRect().height),
        )

        if (height === postedHeight) return
        postedHeight = height
        parent.postMessage(
          {
            type: 'tanstack-charts-notebook:height',
            runToken,
            height,
          },
          '*',
        )
      }

      function scheduleHeight() {
        if (heightFrame !== undefined) return
        heightFrame = requestAnimationFrame(postHeight)
      }

      const heightObserver = new ResizeObserver(scheduleHeight)
      heightObserver.observe(document.documentElement)
      heightObserver.observe(document.body)
      heightObserver.observe(output)
      scheduleHeight()

      if (document.fonts) {
        document.fonts.ready.then(scheduleHeight)
      }

      function formatError(error) {
        if (error instanceof Error) return error.stack || error.message
        return String(error)
      }

      function formatConsoleValue(value) {
        if (typeof value === 'string') return value
        if (value instanceof Error) return value.stack || value.message

        try {
          return (
            JSON.stringify(
              value,
              (_key, nestedValue) =>
                typeof nestedValue === 'bigint'
                  ? String(nestedValue) + 'n'
                  : nestedValue,
              2,
            ) ?? String(value)
          )
        } catch {
          return String(value)
        }
      }

      for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
        const writeToBrowserConsole = console[level].bind(console)
        console[level] = (...values) => {
          writeToBrowserConsole(...values)
          parent.postMessage(
            {
              type: 'tanstack-charts-notebook:console',
              runToken,
              level,
              values: values.map(formatConsoleValue),
            },
            '*',
          )
        }
      }

      function appendValue(value) {
        if (value === undefined || value === null) return
        if (value instanceof Node) {
          output.append(value)
          return
        }

        const pre = document.createElement('pre')
        pre.textContent =
          typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
        output.append(pre)
      }

      function findInvalidSvgGeometry() {
        const attributes = [
          'x',
          'y',
          'x1',
          'x2',
          'y1',
          'y2',
          'cx',
          'cy',
          'r',
          'rx',
          'ry',
          'width',
          'height',
        ]

        for (const element of output.querySelectorAll('svg *')) {
          for (const attribute of attributes) {
            const value = element.getAttribute(attribute)
            if (
              value !== null &&
              (value.includes('NaN') || value.includes('Infinity'))
            ) {
              return (
                '<' +
                element.tagName.toLowerCase() +
                '> ' +
                attribute +
                '="' +
                value +
                '"'
              )
            }
          }
        }

        return undefined
      }

      output.replaceChildren()
      post('loading')

      const moduleUrl = URL.createObjectURL(
        new Blob([source], { type: 'text/javascript' }),
      )

      try {
        const notebookModule = await import(moduleUrl)
        const value =
          typeof notebookModule.default === 'function'
            ? await notebookModule.default(output)
            : notebookModule.default

        appendValue(value)
        await new Promise((resolve) => requestAnimationFrame(resolve))
        await new Promise((resolve) => requestAnimationFrame(resolve))

        const invalidGeometry = findInvalidSvgGeometry()
        if (invalidGeometry) {
          throw new Error(
            'Invalid SVG geometry: ' +
              invalidGeometry +
              '. Check scale domains and numeric data.',
          )
        }

        post('ready')
        scheduleHeight()
      } catch (error) {
        const message = formatError(error)
        const pre = document.createElement('pre')
        pre.dataset.error = ''
        pre.textContent = message
        output.append(pre)
        post('error', message)
        scheduleHeight()
      } finally {
        URL.revokeObjectURL(moduleUrl)
      }
    </script>
  </body>
</html>`
}

type SandboxStatus = 'idle' | 'loading' | 'ready' | 'error'
type SandboxConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'
type SandboxConsoleEntry = {
  id: number
  level: SandboxConsoleLevel
  values: Array<string>
}
type PendingSandboxCapture = {
  reject(cause: Error): void
  requestId: string
  resolve(blob: Blob): void
  timeout: number
}

function isSandboxHeightMessage(
  value: unknown,
): value is { runToken: string; height: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'tanstack-charts-notebook:height' &&
    'runToken' in value &&
    typeof value.runToken === 'string' &&
    'height' in value &&
    typeof value.height === 'number' &&
    Number.isFinite(value.height) &&
    value.height > 0
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function readNotebookTitle() {
  return (
    new URLSearchParams(window.location.search).get('title')?.trim() ||
    defaultNotebookTitle
  )
}

function readNotebookDescription() {
  return (
    new URLSearchParams(window.location.search).get('description')?.trim() ?? ''
  )
}

function readResolvedTheme(): SandboxTheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function readShowSource() {
  return new URLSearchParams(window.location.search).get('view') === 'code'
}

function readStoredSource() {
  return window.localStorage.getItem(draftStorageKey) ?? defaultSource
}

function isSandboxStatus(value: unknown): value is SandboxStatus {
  return value === 'loading' || value === 'ready' || value === 'error'
}

function isSandboxConsoleLevel(value: unknown): value is SandboxConsoleLevel {
  return (
    value === 'log' ||
    value === 'info' ||
    value === 'warn' ||
    value === 'error' ||
    value === 'debug'
  )
}

function isSandboxConsoleMessage(value: unknown): value is {
  runToken: string
  level: SandboxConsoleLevel
  values: Array<string>
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'tanstack-charts-notebook:console' &&
    'runToken' in value &&
    typeof value.runToken === 'string' &&
    'level' in value &&
    isSandboxConsoleLevel(value.level) &&
    'values' in value &&
    Array.isArray(value.values) &&
    value.values.every((item) => typeof item === 'string')
  )
}

function isSandboxMessage(
  value: unknown,
): value is { runToken: string; status: SandboxStatus; message?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'tanstack-charts-notebook:status' &&
    'runToken' in value &&
    typeof value.runToken === 'string' &&
    'status' in value &&
    isSandboxStatus(value.status) &&
    (!('message' in value) ||
      value.message === undefined ||
      typeof value.message === 'string')
  )
}

function isSandboxThemeRequest(value: unknown): value is { runToken: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'tanstack-charts-notebook:theme-request' &&
    'runToken' in value &&
    typeof value.runToken === 'string'
  )
}

export function ChartsNotebookPage() {
  const { openLoginModal } = useLoginModal()
  const userQuery = useCurrentUserQuery()
  const user = userQuery.data
  const [showNotebook, setShowNotebook] = React.useState(() =>
    window.location.hash.startsWith('#code='),
  )
  const [notebookTitle, setNotebookTitle] = React.useState(readNotebookTitle)
  const [notebookDescription, setNotebookDescription] = React.useState(
    readNotebookDescription,
  )
  const [showSource, setShowSource] = React.useState(readShowSource)
  const [source, setSource] = React.useState(readStoredSource)
  const [compiledSource, setCompiledSource] = React.useState<string>()
  const [frameContentHeight, setFrameContentHeight] = React.useState<number>()
  const [runningTheme, setRunningTheme] = React.useState(readResolvedTheme)
  const [sourceReady, setSourceReady] = React.useState(false)
  const [runRevision, setRunRevision] = React.useState(0)
  const [status, setStatus] = React.useState<SandboxStatus>('idle')
  const [error, setError] = React.useState<string>()
  const [copied, setCopied] = React.useState(false)
  const [showConsole, setShowConsole] = React.useState(false)
  const [desktopLayout, setDesktopLayout] = React.useState(
    () => window.matchMedia('(min-width: 1024px)').matches,
  )
  const [sourcePanelWidth, setSourcePanelWidth] = React.useState<number>()
  const [sourcePanelHeight, setSourcePanelHeight] = React.useState<number>()
  const [renderedSourcePanelHeight, setRenderedSourcePanelHeight] =
    React.useState<number>()
  const [consoleHeight, setConsoleHeight] = React.useState(160)
  const [consoleEntries, setConsoleEntries] = React.useState<
    Array<SandboxConsoleEntry>
  >([])
  const [sandboxChannel] = React.useState(() => crypto.randomUUID())
  const [previewHistory, setPreviewHistory] = React.useState(() =>
    createExamplePreviewHistory(),
  )
  const [previewNavigationError, setPreviewNavigationError] = React.useState('')
  const [previewAnnotationMode, setPreviewAnnotationModeActive] =
    React.useState(false)
  const [previewAnnotationTarget, setPreviewAnnotationTarget] =
    React.useState<SandboxBrowserAnnotationTarget>()
  const previewHistoryRef = React.useRef(previewHistory)
  const pendingCaptureRef = React.useRef<PendingSandboxCapture | undefined>(
    undefined,
  )
  const highlightedSourceRef = React.useRef<HTMLDivElement>(null)
  const workspaceRef = React.useRef<HTMLDivElement>(null)
  const sourcePanelRef = React.useRef<HTMLDivElement>(null)
  const outputSectionRef = React.useRef<HTMLElement>(null)
  const outputFrameAreaRef = React.useRef<HTMLDivElement>(null)
  const outputFrameRef = React.useRef<HTMLIFrameElement>(null)
  const consolePanelRef = React.useRef<HTMLDivElement>(null)
  const outputLayoutSnapshotRef = React.useRef<
    | {
        rect: DOMRect
      }
    | undefined
  >(undefined)
  const skipSourceToggleAnimationRef = React.useRef(false)
  const copiedTimeoutRef = React.useRef<number | undefined>(undefined)
  const nextConsoleEntryIdRef = React.useRef(0)
  const compileRequestRef = React.useRef(0)
  const runToken = `${sandboxChannel}:${runRevision}`
  const activeRunTokenRef = React.useRef(runToken)
  const fluidOutput = !showSource && !showConsole
  const sandboxDocument = React.useMemo(
    () =>
      compiledSource === undefined
        ? undefined
        : createSandboxDocument(
            compiledSource,
            sandboxChannel,
            runToken,
            runningTheme,
          ),
    [compiledSource, runningTheme, runToken, sandboxChannel],
  )
  const highlightedTokens = React.useMemo(() => {
    if (!showSource) return []
    return sourceHighlighter.tokenize(source, { lang: 'tsx' }).tokens
  }, [showSource, source])

  activeRunTokenRef.current = runToken

  const syncSandboxTheme = React.useCallback(() => {
    outputFrameRef.current?.contentWindow?.postMessage(
      {
        type: 'tanstack-charts-notebook:theme',
        runToken: activeRunTokenRef.current,
        theme: readResolvedTheme(),
      },
      '*',
    )
  }, [])

  React.useEffect(() => {
    window.localStorage.setItem(draftStorageKey, source)
  }, [source])

  React.useEffect(() => {
    previewHistoryRef.current = previewHistory
  }, [previewHistory])

  React.useEffect(() => {
    if (!user || !showNotebook || !sourceReady) return

    let active = true
    const timeout = window.setTimeout(() => {
      void encodeSharedChartSource(source)
        .then((encodedSource) => {
          if (!active) return
          window.history.replaceState(
            null,
            '',
            createSharedChartUrl(encodedSource),
          )
        })
        .catch((cause: unknown) => {
          if (!active) return
          setError(cause instanceof Error ? cause.message : String(cause))
        })
    }, 400)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [showNotebook, source, sourceReady, user])

  React.useEffect(() => {
    document.title = `${notebookTitle.trim() || defaultNotebookTitle} | TanStack`
  }, [notebookTitle])

  React.useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const updateLayout = () => setDesktopLayout(media.matches)

    media.addEventListener('change', updateLayout)
    return () => media.removeEventListener('change', updateLayout)
  }, [])

  React.useEffect(() => {
    const panel = sourcePanelRef.current
    if (!panel) return

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return
      setRenderedSourcePanelHeight(entry.contentRect.height)
    })

    resizeObserver.observe(panel)
    return () => resizeObserver.disconnect()
  }, [])

  React.useEffect(() => {
    const frameArea = outputFrameAreaRef.current
    if (fluidOutput || !frameArea) return

    const resizeObserver = new ResizeObserver(() => {
      setFrameContentHeight(undefined)
    })

    resizeObserver.observe(frameArea)
    return () => resizeObserver.disconnect()
  }, [fluidOutput])

  React.useLayoutEffect(() => {
    const snapshot = outputLayoutSnapshotRef.current
    outputLayoutSnapshotRef.current = undefined
    if (!snapshot) return

    const element = desktopLayout
      ? outputSectionRef.current
      : outputFrameAreaRef.current
    if (!element) return

    const previousTransition = element.style.transition
    const previousTransform = element.style.transform
    const previousTransformOrigin = element.style.transformOrigin
    const previousWillChange = element.style.willChange

    element.style.transition = 'none'
    element.style.transform = 'none'
    const nextRect = element.getBoundingClientRect()
    const scaleX = snapshot.rect.width / nextRect.width
    const scaleY = snapshot.rect.height / nextRect.height

    element.style.transformOrigin = 'top left'
    element.style.willChange = 'transform'
    element.style.transform = `translate(${snapshot.rect.left - nextRect.left}px, ${snapshot.rect.top - nextRect.top}px) scale(${scaleX}, ${scaleY})`
    element.getBoundingClientRect()
    element.style.transition = 'transform 180ms cubic-bezier(0.32, 0.72, 0, 1)'
    element.style.transform = 'none'

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      element.style.transition = previousTransition
      element.style.transform = previousTransform
      element.style.transformOrigin = previousTransformOrigin
      element.style.willChange = previousWillChange
    }
    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.target === element && event.propertyName === 'transform') {
        finish()
      }
    }

    element.addEventListener('transitionend', handleTransitionEnd)
    return () => {
      element.removeEventListener('transitionend', handleTransitionEnd)
      finish()
    }
  }, [desktopLayout, showSource])

  React.useEffect(() => {
    let active = true

    void decodeSharedChartSource(window.location.hash)
      .then((sharedSource) => {
        if (!active) return
        if (sharedSource === undefined) {
          setSourceReady(true)
          return
        }
        setSource(sharedSource)
        setShowNotebook(true)
        setSourceReady(true)
      })
      .catch((cause: unknown) => {
        if (!active) return
        setStatus('error')
        setError(cause instanceof Error ? cause.message : String(cause))
      })

    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    function receiveSandboxMessage(event: MessageEvent) {
      if (event.source !== outputFrameRef.current?.contentWindow) return
      if (event.origin !== 'null') return

      if (isExampleSandboxBrowserMessage(event.data, sandboxChannel)) {
        const message = event.data
        if (
          message.kind === 'capture-result' ||
          message.kind === 'capture-error'
        ) {
          const pending = pendingCaptureRef.current
          if (!pending || pending.requestId !== message.requestId) return
          window.clearTimeout(pending.timeout)
          pendingCaptureRef.current = undefined
          if (message.kind === 'capture-error') {
            pending.reject(new Error(message.message))
          } else {
            pending.resolve(
              new Blob([message.bytes], { type: message.mimeType }),
            )
          }
          return
        }

        if (message.kind === 'browser-state') {
          const trustedUrl = normalizeExamplePreviewUrl({
            mode: 'client',
            url: message.url,
          })
          if (!trustedUrl) return
          const currentHistory = previewHistoryRef.current
          const currentUrl = currentHistory.entries[currentHistory.index] ?? '/'

          setPreviewHistory((current) => {
            const next = updateExamplePreviewHistory(current, {
              kind: message.navigationKind,
              url: trustedUrl,
            })
            previewHistoryRef.current = next
            return next
          })
          setPreviewNavigationError('')
          if (message.navigationKind === 'load' || currentUrl !== trustedUrl) {
            setPreviewAnnotationTarget(undefined)
          }
          return
        }

        if (message.kind === 'navigation-error') {
          setPreviewNavigationError(
            'This client preview only supports in-page links.',
          )
          return
        }

        if (!previewAnnotationMode) return
        const currentHistory = previewHistoryRef.current
        setPreviewAnnotationTarget({
          rect: message.rect,
          selector: message.selector,
          tagName: message.tag,
          text: message.text,
          url: currentHistory.entries[currentHistory.index] ?? '/',
        })
        return
      }

      if (
        isSandboxHeightMessage(event.data) &&
        event.data.runToken === activeRunTokenRef.current
      ) {
        setFrameContentHeight(Math.ceil(event.data.height))
        return
      }

      if (
        isSandboxThemeRequest(event.data) &&
        event.data.runToken === activeRunTokenRef.current
      ) {
        syncSandboxTheme()
        return
      }

      if (
        isSandboxConsoleMessage(event.data) &&
        event.data.runToken === activeRunTokenRef.current
      ) {
        const entry = {
          id: nextConsoleEntryIdRef.current,
          level: event.data.level,
          values: event.data.values,
        }
        nextConsoleEntryIdRef.current += 1
        setConsoleEntries((entries) => [...entries, entry])
        return
      }

      if (
        !isSandboxMessage(event.data) ||
        event.data.runToken !== activeRunTokenRef.current
      ) {
        return
      }

      setStatus(event.data.status)
      setError(event.data.message)
    }

    window.addEventListener('message', receiveSandboxMessage)
    return () => window.removeEventListener('message', receiveSandboxMessage)
  }, [previewAnnotationMode, sandboxChannel, syncSandboxTheme])

  React.useEffect(() => {
    syncSandboxTheme()
  }, [runToken, syncSandboxTheme])

  React.useEffect(() => {
    const pending = pendingCaptureRef.current
    if (pending) {
      window.clearTimeout(pending.timeout)
      pendingCaptureRef.current = undefined
      pending.reject(new Error('The preview changed before capture completed.'))
    }
    const initial = createExamplePreviewHistory()
    previewHistoryRef.current = initial
    setPreviewHistory(initial)
    setPreviewNavigationError('')
    setPreviewAnnotationTarget(undefined)
  }, [runToken])

  React.useEffect(
    () => () => {
      const pending = pendingCaptureRef.current
      if (!pending) return
      window.clearTimeout(pending.timeout)
      pendingCaptureRef.current = undefined
      pending.reject(new Error('The preview closed before capture completed.'))
    },
    [],
  )

  React.useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(syncSandboxTheme)

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [syncSandboxTheme])

  React.useEffect(
    () => () => {
      if (copiedTimeoutRef.current !== undefined) {
        window.clearTimeout(copiedTimeoutRef.current)
      }
    },
    [],
  )

  function runSource(nextSource: string) {
    setPreviewAnnotationModeActive(false)
    setPreviewAnnotationTarget(undefined)
    sendPreviewBrowserCommand({ kind: 'annotation', enabled: false })

    const compileRequest = compileRequestRef.current + 1
    compileRequestRef.current = compileRequest
    setStatus('loading')
    setError(undefined)
    setConsoleEntries([])
    setFrameContentHeight(undefined)
    nextConsoleEntryIdRef.current = 0
    setCompiledSource(undefined)
    setRunningTheme(readResolvedTheme())
    setRunRevision((revision) => revision + 1)

    void compileNotebookSource(nextSource)
      .then((nextCompiledSource) => {
        if (compileRequest !== compileRequestRef.current) return
        setCompiledSource(nextCompiledSource)
      })
      .catch((cause: unknown) => {
        if (compileRequest !== compileRequestRef.current) return
        setStatus('error')
        setError(cause instanceof Error ? cause.message : String(cause))
      })
  }

  function run() {
    runSource(source)
  }

  function sendPreviewBrowserCommand(
    command: Parameters<typeof postExampleSandboxBrowserCommand>[0]['command'],
  ) {
    postExampleSandboxBrowserCommand({
      channel: sandboxChannel,
      command,
      frame: outputFrameRef.current,
    })
  }

  function setPreviewAnnotationMode(active: boolean) {
    setPreviewAnnotationModeActive(active)
    setPreviewAnnotationTarget(undefined)
    sendPreviewBrowserCommand({ kind: 'annotation', enabled: active })
  }

  function clearPreviewAnnotationTarget() {
    setPreviewAnnotationTarget(undefined)
    sendPreviewBrowserCommand({ kind: 'annotation', enabled: true })
  }

  function capturePreview() {
    const current = pendingCaptureRef.current
    if (current) {
      window.clearTimeout(current.timeout)
      pendingCaptureRef.current = undefined
      current.reject(new Error('A newer screenshot replaced this capture.'))
    }
    const requestId = crypto.randomUUID()

    return new Promise<Blob>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        if (pendingCaptureRef.current?.requestId !== requestId) return
        pendingCaptureRef.current = undefined
        reject(new Error('The preview did not return a screenshot.'))
      }, 15_000)
      pendingCaptureRef.current = { reject, requestId, resolve, timeout }
      sendPreviewBrowserCommand({ kind: 'capture', requestId })
    })
  }

  function loadExample(id: string) {
    const example = notebookExamples.find((item) => item.id === id)
    if (!example) return

    setSource(example.source)
    updateNotebookTitle(example.title)
    updateNotebookDescription(example.description)
    setShowNotebook(true)
    runSource(example.source)
  }

  function createNotebook() {
    setSource(notebookStarterSource)
    updateNotebookTitle(defaultNotebookTitle)
    updateNotebookDescription('')
    setSourceReady(true)
    setShowNotebook(true)
    setSourceOpen(true)
    runSource(notebookStarterSource)
  }

  function setSourceOpen(open: boolean) {
    const output = desktopLayout
      ? outputSectionRef.current
      : outputFrameAreaRef.current

    if (
      !skipSourceToggleAnimationRef.current &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      output
    ) {
      outputLayoutSnapshotRef.current = {
        rect: output.getBoundingClientRect(),
      }
    }
    skipSourceToggleAnimationRef.current = false

    const url = new URL(window.location.href)

    if (open) {
      url.searchParams.set('view', 'code')
    } else {
      url.searchParams.delete('view')
    }

    window.history.replaceState(null, '', url)
    setShowSource(open)
  }

  function updateNotebookTitle(title: string) {
    setNotebookTitle(title)
    if (!user) return

    const url = new URL(window.location.href)
    const trimmedTitle = title.trim()

    if (trimmedTitle && trimmedTitle !== defaultNotebookTitle) {
      url.searchParams.set('title', trimmedTitle)
    } else {
      url.searchParams.delete('title')
    }

    window.history.replaceState(null, '', url)
  }

  function updateNotebookDescription(description: string) {
    setNotebookDescription(description)
    if (!user) return

    const url = new URL(window.location.href)
    const trimmedDescription = description.trim()

    if (trimmedDescription) {
      url.searchParams.set('description', trimmedDescription)
    } else {
      url.searchParams.delete('description')
    }

    window.history.replaceState(null, '', url)
  }

  function startSourceResize(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return

    const panel = sourcePanelRef.current
    const workspace = workspaceRef.current
    if (!panel || !workspace) return

    event.preventDefault()

    const axis = desktopLayout ? 'x' : 'y'
    const panelRect = panel.getBoundingClientRect()
    const workspaceRect = workspace.getBoundingClientRect()
    const containerSize =
      axis === 'x' ? workspaceRect.width : workspaceRect.bottom - panelRect.top
    const preferredMinSize = axis === 'x' ? 280 : 180
    const minSize = Math.min(preferredMinSize, containerSize / 2)
    const maxSize = Math.max(minSize, containerSize - minSize)
    const startSize = axis === 'x' ? panelRect.width : panelRect.height
    const startPointer = axis === 'x' ? event.clientX : event.clientY
    const ownerDocument = event.currentTarget.ownerDocument
    const previousCursor = ownerDocument.body.style.cursor
    const previousUserSelect = ownerDocument.body.style.userSelect
    const outputFrame = workspace.querySelector('iframe')
    const previousFramePointerEvents = outputFrame?.style.pointerEvents
    let size = startSize

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const pointer = axis === 'x' ? moveEvent.clientX : moveEvent.clientY
      size = clamp(startSize + pointer - startPointer, minSize, maxSize)

      if (axis === 'x') {
        panel.style.width = `${size}px`
        const outputSection = outputSectionRef.current
        if (outputSection) outputSection.style.marginLeft = `${size}px`
      } else {
        panel.style.height = `${size}px`
        const outputFrameArea = outputFrameAreaRef.current
        if (outputFrameArea) outputFrameArea.style.top = `${size}px`
      }
    }

    const handleMouseUp = () => {
      if (axis === 'x') setSourcePanelWidth(size)
      else setSourcePanelHeight(size)

      ownerDocument.body.style.cursor = previousCursor
      ownerDocument.body.style.userSelect = previousUserSelect
      if (outputFrame) {
        outputFrame.style.pointerEvents = previousFramePointerEvents ?? ''
      }
      ownerDocument.removeEventListener('mousemove', handleMouseMove)
      ownerDocument.removeEventListener('mouseup', handleMouseUp)
    }

    ownerDocument.body.style.cursor = axis === 'x' ? 'ew-resize' : 'ns-resize'
    ownerDocument.body.style.userSelect = 'none'
    if (outputFrame) outputFrame.style.pointerEvents = 'none'
    ownerDocument.addEventListener('mousemove', handleMouseMove)
    ownerDocument.addEventListener('mouseup', handleMouseUp)
  }

  function resizeSourceWithKeyboard(
    event: React.KeyboardEvent<HTMLDivElement>,
  ) {
    const decreaseKey = desktopLayout ? 'ArrowLeft' : 'ArrowUp'
    const increaseKey = desktopLayout ? 'ArrowRight' : 'ArrowDown'
    if (event.key !== decreaseKey && event.key !== increaseKey) return

    const panel = sourcePanelRef.current
    const workspace = workspaceRef.current
    if (!panel || !workspace) return

    event.preventDefault()
    const axis = desktopLayout ? 'x' : 'y'
    const panelRect = panel.getBoundingClientRect()
    const workspaceRect = workspace.getBoundingClientRect()
    const containerSize =
      axis === 'x' ? workspaceRect.width : workspaceRect.bottom - panelRect.top
    const preferredMinSize = axis === 'x' ? 280 : 180
    const minSize = Math.min(preferredMinSize, containerSize / 2)
    const maxSize = Math.max(minSize, containerSize - minSize)
    const currentSize = axis === 'x' ? panelRect.width : panelRect.height
    const direction = event.key === increaseKey ? 1 : -1
    const size = clamp(
      currentSize + direction * (event.shiftKey ? 64 : 24),
      minSize,
      maxSize,
    )

    if (axis === 'x') setSourcePanelWidth(size)
    else setSourcePanelHeight(size)
  }

  function resetSourceSize() {
    if (desktopLayout) setSourcePanelWidth(undefined)
    else setSourcePanelHeight(undefined)
  }

  function startConsoleResize(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return

    const panel = consolePanelRef.current
    const output = outputSectionRef.current
    if (!panel || !output) return

    event.preventDefault()

    const outputHeight = output.getBoundingClientRect().height
    const minSize = Math.min(96, outputHeight / 2)
    const maxSize = Math.max(minSize, outputHeight - minSize)
    const startSize = panel.getBoundingClientRect().height
    const startPointer = event.clientY
    const ownerDocument = event.currentTarget.ownerDocument
    const previousCursor = ownerDocument.body.style.cursor
    const previousUserSelect = ownerDocument.body.style.userSelect
    const outputFrame = output.querySelector('iframe')
    const previousFramePointerEvents = outputFrame?.style.pointerEvents
    let size = startSize

    const handleMouseMove = (moveEvent: MouseEvent) => {
      size = clamp(
        startSize - (moveEvent.clientY - startPointer),
        minSize,
        maxSize,
      )
      panel.style.height = `${size}px`
    }

    const handleMouseUp = () => {
      setConsoleHeight(size)
      ownerDocument.body.style.cursor = previousCursor
      ownerDocument.body.style.userSelect = previousUserSelect
      if (outputFrame) {
        outputFrame.style.pointerEvents = previousFramePointerEvents ?? ''
      }
      ownerDocument.removeEventListener('mousemove', handleMouseMove)
      ownerDocument.removeEventListener('mouseup', handleMouseUp)
    }

    ownerDocument.body.style.cursor = 'ns-resize'
    ownerDocument.body.style.userSelect = 'none'
    if (outputFrame) outputFrame.style.pointerEvents = 'none'
    ownerDocument.addEventListener('mousemove', handleMouseMove)
    ownerDocument.addEventListener('mouseup', handleMouseUp)
  }

  function resizeConsoleWithKeyboard(
    event: React.KeyboardEvent<HTMLDivElement>,
  ) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return

    const output = outputSectionRef.current
    if (!output) return

    event.preventDefault()
    const outputHeight = output.getBoundingClientRect().height
    const minSize = Math.min(96, outputHeight / 2)
    const maxSize = Math.max(minSize, outputHeight - minSize)
    const direction = event.key === 'ArrowUp' ? 1 : -1
    setConsoleHeight((height) =>
      clamp(height + direction * (event.shiftKey ? 64 : 24), minSize, maxSize),
    )
  }

  async function share() {
    try {
      const encodedSource = await encodeSharedChartSource(source)
      const url = createSharedChartUrl(encodedSource)
      const trimmedTitle = notebookTitle.trim()
      const trimmedDescription = notebookDescription.trim()

      if (trimmedTitle && trimmedTitle !== defaultNotebookTitle) {
        url.searchParams.set('title', trimmedTitle)
      } else {
        url.searchParams.delete('title')
      }
      if (trimmedDescription) {
        url.searchParams.set('description', trimmedDescription)
      } else {
        url.searchParams.delete('description')
      }

      window.history.replaceState(null, '', url)
      await copyTextToClipboard(url.href)
      setCopied(true)

      if (copiedTimeoutRef.current !== undefined) {
        window.clearTimeout(copiedTimeoutRef.current)
      }
      copiedTimeoutRef.current = window.setTimeout(() => {
        setCopied(false)
        copiedTimeoutRef.current = undefined
      }, 2000)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  function shareAfterAuthentication() {
    if (user) {
      void share()
      return
    }

    openLoginModal({ onSuccess: () => void share() })
  }

  const currentPreviewUrl = previewHistory.entries[previewHistory.index] ?? '/'

  if (!showNotebook) {
    return (
      <main className="min-h-[calc(100dvh-var(--navbar-height))] bg-white px-5 py-14 text-gray-950 sm:px-8 sm:py-20 dark:bg-black dark:text-white">
        <section className="mx-auto w-full max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Notebook
            </h1>
            <div className="flex items-center gap-2">
              <NotebookGuideDialog>
                <Button type="button" variant="ghost" size="sm">
                  <QuestionIcon className="size-4" aria-hidden="true" />
                  Guide
                </Button>
              </NotebookGuideDialog>
              <Button type="button" size="sm" onClick={createNotebook}>
                <PlusIcon className="size-4" aria-hidden="true" />
                New notebook
              </Button>
            </div>
          </div>
          <div className="mt-10 border-y border-gray-500/20">
            {notebookExamples.map((example) => (
              <button
                key={example.id}
                type="button"
                onClick={() => loadExample(example.id)}
                className="group flex w-full items-center gap-6 border-b border-gray-500/20 px-1 py-6 text-left transition-colors last:border-b-0 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500 sm:px-4 dark:hover:bg-gray-950"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold sm:text-lg">
                    {example.title}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-gray-600 dark:text-gray-400">
                    {example.description}
                  </span>
                </span>
                <ArrowRightIcon
                  className="size-5 shrink-0 text-gray-400 transition-transform group-hover:translate-x-1 dark:text-gray-600"
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </section>
      </main>
    )
  }

  return (
    <Collapsible
      open={showSource}
      onOpenChange={setSourceOpen}
      className="contents"
    >
      {({ open }) => (
        <main
          className={`flex min-h-[calc(100dvh-var(--navbar-height))] w-full flex-col bg-gray-50 text-gray-950 dark:bg-gray-950 dark:text-white ${
            fluidOutput
              ? ''
              : 'h-[calc(100dvh-var(--navbar-height))] min-h-[640px] overflow-hidden'
          }`}
        >
          <header
            className={`sticky z-30 flex min-h-14 items-center gap-3 border-b border-border-default bg-background-default px-3 text-text-primary sm:px-4 ${
              fluidOutput ? 'top-[var(--navbar-height)]' : 'top-0'
            }`}
          >
            <div className="min-w-0 flex-1">
              <input
                aria-label="Notebook title"
                value={notebookTitle}
                maxLength={120}
                onChange={(event) => updateNotebookTitle(event.target.value)}
                onBlur={() => {
                  if (!notebookTitle.trim()) {
                    updateNotebookTitle(defaultNotebookTitle)
                  }
                }}
                className="block w-full truncate rounded-sm bg-transparent text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              />
              <input
                aria-label="Notebook description"
                value={notebookDescription}
                maxLength={240}
                placeholder="Add a description"
                onChange={(event) =>
                  updateNotebookDescription(event.target.value)
                }
                onBlur={() =>
                  updateNotebookDescription(notebookDescription.trim())
                }
                className="block w-full truncate rounded-sm bg-transparent text-xs text-text-muted outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-border-focus"
              />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`hidden text-xs sm:inline ${
                  status === 'error' ? 'text-text-error' : 'text-text-muted'
                }`}
                role="status"
              >
                {status === 'idle'
                  ? 'Ready to run'
                  : status === 'loading'
                    ? 'Running'
                    : status === 'ready'
                      ? 'Ready'
                      : 'Error'}
              </span>
              <ButtonGroup>
                <NotebookGuideDialog>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    rounded="none"
                    aria-label="Open notebook guide"
                  >
                    <QuestionIcon className="size-3.5" aria-hidden="true" />
                    <span className="hidden md:inline">Guide</span>
                  </Button>
                </NotebookGuideDialog>
                <Button
                  type="button"
                  aria-controls="notebook-source"
                  aria-expanded={open}
                  aria-label={open ? 'Hide source code' : 'Show source code'}
                  aria-pressed={open}
                  variant="ghost"
                  size="xs"
                  rounded="none"
                  onPointerDown={() => {
                    skipSourceToggleAnimationRef.current = false
                  }}
                  onKeyDown={() => {
                    skipSourceToggleAnimationRef.current = true
                  }}
                  onClick={() => setSourceOpen(!open)}
                >
                  <CodeIcon className="size-3.5" aria-hidden="true" />
                  <span className="hidden md:inline">Code</span>
                </Button>
                <Button
                  type="button"
                  aria-controls="notebook-console"
                  aria-expanded={showConsole}
                  aria-label={showConsole ? 'Hide console' : 'Show console'}
                  aria-pressed={showConsole}
                  variant="ghost"
                  size="xs"
                  rounded="none"
                  onClick={() => setShowConsole((open) => !open)}
                >
                  <TerminalWindowIcon className="size-3.5" aria-hidden="true" />
                  <span className="hidden md:inline">Console</span>
                </Button>
              </ButtonGroup>
              <ButtonGroup>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  rounded="none"
                  disabled={userQuery.isPending}
                  onClick={shareAfterAuthentication}
                  aria-label={
                    copied
                      ? 'Share URL copied'
                      : user
                        ? 'Copy share URL'
                        : 'Sign in to share'
                  }
                >
                  {copied ? (
                    <CheckIcon className="size-3.5" aria-hidden="true" />
                  ) : (
                    <CopyIcon className="size-3.5" aria-hidden="true" />
                  )}
                  <span className="hidden md:inline">
                    {copied ? 'Copied' : 'Share'}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="xs"
                  rounded="none"
                  onClick={run}
                >
                  <PlayIcon
                    className="size-3.5"
                    weight="fill"
                    aria-hidden="true"
                  />
                  <span className="hidden md:inline">Run</span>
                </Button>
              </ButtonGroup>
            </div>
          </header>

          <div
            ref={workspaceRef}
            className={`relative flex-1 ${
              fluidOutput ? '' : 'min-h-0 overflow-hidden'
            }`}
          >
            <CollapsibleContent
              ref={sourcePanelRef}
              id="notebook-source"
              style={
                desktopLayout
                  ? sourcePanelWidth === undefined
                    ? undefined
                    : { width: sourcePanelWidth }
                  : sourcePanelHeight === undefined
                    ? undefined
                    : { height: sourcePanelHeight }
              }
              className={`absolute inset-x-0 top-0 z-10 h-1/2 grid-rows-[1fr] transition-[translate,opacity] duration-[180ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none lg:inset-y-0 lg:left-0 lg:right-auto lg:h-full lg:w-1/2 ${
                open
                  ? 'translate-y-0 opacity-100 lg:translate-x-0'
                  : 'pointer-events-none -translate-y-full opacity-0 lg:translate-y-0 lg:-translate-x-full'
              }`}
            >
              <section className="relative flex h-full min-h-0 flex-col border-b border-gray-500/20 bg-gray-950 shadow-xl lg:border-r lg:border-b-0">
                <div className="flex h-9 shrink-0 items-center justify-between border-b border-gray-500/20 bg-white px-3 text-xs dark:bg-black">
                  <span className="font-medium">TypeScript + JSX module</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    ⌘ Enter to run
                  </span>
                </div>
                <div className="dark relative min-h-0 flex-1 bg-gray-950">
                  <div
                    ref={highlightedSourceRef}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre p-4"
                    style={{ ...editorTextStyle, color: 'var(--th-token)' }}
                  >
                    {highlightedTokens.map((token, index) =>
                      token.className ? (
                        <span
                          key={index}
                          className={`th-token th-${token.className}`}
                        >
                          {token.value}
                        </span>
                      ) : (
                        <React.Fragment key={index}>
                          {token.value}
                        </React.Fragment>
                      ),
                    )}
                  </div>
                  <textarea
                    aria-label="TypeScript and JSX module source"
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' &&
                        (event.metaKey || event.ctrlKey)
                      ) {
                        event.preventDefault()
                        run()
                      }
                    }}
                    onScroll={(event) => {
                      const highlightedSource = highlightedSourceRef.current
                      if (!highlightedSource) return
                      highlightedSource.scrollLeft =
                        event.currentTarget.scrollLeft
                      highlightedSource.scrollTop =
                        event.currentTarget.scrollTop
                    }}
                    spellCheck={false}
                    wrap="off"
                    className="absolute inset-0 size-full resize-none overflow-auto bg-transparent p-4 text-transparent caret-white outline-none selection:bg-emerald-500/30"
                    style={editorTextStyle}
                  />
                </div>
                <div
                  role="separator"
                  aria-label="Resize code panel"
                  aria-orientation={desktopLayout ? 'vertical' : 'horizontal'}
                  tabIndex={0}
                  onMouseDown={startSourceResize}
                  onDoubleClick={resetSourceSize}
                  onKeyDown={resizeSourceWithKeyboard}
                  className="group absolute inset-x-0 bottom-0 z-20 flex h-3 touch-none cursor-ns-resize select-none items-center justify-center hover:bg-blue-500/15 focus-visible:bg-blue-500/15 focus-visible:outline-2 focus-visible:outline-blue-500 lg:inset-y-0 lg:right-0 lg:left-auto lg:h-full lg:w-3 lg:cursor-ew-resize"
                >
                  <div className="h-px w-10 bg-gray-500 group-hover:bg-blue-400 group-focus-visible:bg-blue-400 lg:h-10 lg:w-px" />
                </div>
              </section>
            </CollapsibleContent>

            <Collapsible
              open={showConsole}
              onOpenChange={setShowConsole}
              className="contents"
            >
              {({ open: consoleOpen }) => (
                <section
                  ref={outputSectionRef}
                  style={
                    desktopLayout && showSource
                      ? { marginLeft: sourcePanelWidth ?? '50%' }
                      : undefined
                  }
                  className={
                    fluidOutput
                      ? 'relative min-h-[calc(100dvh-var(--navbar-height)-3.5rem)] bg-white'
                      : 'relative flex h-full min-h-0 flex-col bg-white'
                  }
                >
                  <div
                    style={
                      fluidOutput && frameContentHeight !== undefined
                        ? { height: frameContentHeight + 40 }
                        : undefined
                    }
                    className={
                      fluidOutput
                        ? 'relative min-h-[calc(100dvh-var(--navbar-height)-3.5rem)]'
                        : 'relative min-h-0 flex-1'
                    }
                  >
                    <div
                      ref={outputFrameAreaRef}
                      style={
                        !desktopLayout && showSource
                          ? { top: renderedSourcePanelHeight ?? '50%' }
                          : { top: 0 }
                      }
                      className={`absolute inset-x-0 bottom-0 ${
                        fluidOutput ? '' : 'overflow-auto'
                      }`}
                    >
                      <SandboxBrowser
                        annotationAvailable={Boolean(sandboxDocument)}
                        annotationMode={previewAnnotationMode}
                        annotationTarget={previewAnnotationTarget}
                        canGoBack={canGoBackInExamplePreview(previewHistory)}
                        canGoForward={canGoForwardInExamplePreview(
                          previewHistory,
                        )}
                        captureScreenshot={
                          sandboxDocument ? capturePreview : undefined
                        }
                        currentUrl={currentPreviewUrl}
                        error={previewNavigationError}
                        history={[...new Set(previewHistory.entries)]}
                        navigationAvailable={Boolean(sandboxDocument)}
                        onAnnotationModeChange={setPreviewAnnotationMode}
                        onBack={() =>
                          sendPreviewBrowserCommand({ kind: 'back' })
                        }
                        onClearAnnotationTarget={clearPreviewAnnotationTarget}
                        onForward={() =>
                          sendPreviewBrowserCommand({ kind: 'forward' })
                        }
                        onNavigate={(url) =>
                          sendPreviewBrowserCommand({ kind: 'navigate', url })
                        }
                        onReload={() =>
                          sendPreviewBrowserCommand({ kind: 'reload' })
                        }
                      >
                        {sourceReady && sandboxDocument ? (
                          <iframe
                            ref={outputFrameRef}
                            key={runRevision}
                            srcDoc={sandboxDocument}
                            sandbox="allow-scripts"
                            title={`${notebookTitle.trim() || defaultNotebookTitle} output`}
                            onLoad={() => {
                              syncSandboxTheme()
                              sendPreviewBrowserCommand({
                                kind: 'annotation',
                                enabled: previewAnnotationMode,
                              })
                            }}
                            className="block size-full border-0 bg-white dark:bg-gray-950"
                          />
                        ) : null}
                      </SandboxBrowser>
                    </div>
                  </div>
                  {status === 'error' && error ? (
                    <div className="max-h-24 shrink-0 overflow-auto border-t border-red-200 bg-red-50 px-3 py-2 font-mono text-xs text-red-700">
                      {error}
                    </div>
                  ) : null}
                  <CollapsibleContent
                    ref={consolePanelRef}
                    id="notebook-console"
                    style={{ height: consoleHeight }}
                    className={`absolute inset-x-0 bottom-0 z-[5] grid-rows-[1fr] transition-[translate,opacity] duration-[180ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
                      consoleOpen
                        ? 'translate-y-0 opacity-100'
                        : 'pointer-events-none translate-y-full opacity-0'
                    }`}
                  >
                    <div className="relative h-full border-t border-gray-700 bg-gray-950">
                      <div
                        role="separator"
                        aria-label="Resize console height"
                        aria-orientation="horizontal"
                        aria-valuenow={consoleHeight}
                        tabIndex={0}
                        onMouseDown={startConsoleResize}
                        onDoubleClick={() => setConsoleHeight(160)}
                        onKeyDown={resizeConsoleWithKeyboard}
                        className="group absolute inset-x-0 top-0 z-20 flex h-3 touch-none cursor-ns-resize select-none items-center justify-center hover:bg-blue-500/15 focus-visible:bg-blue-500/15 focus-visible:outline-2 focus-visible:outline-blue-500"
                      >
                        <div className="h-px w-10 bg-gray-500 group-hover:bg-blue-400 group-focus-visible:bg-blue-400" />
                      </div>
                      <div
                        role="log"
                        aria-label="Console output"
                        className="h-full overflow-auto px-3 py-2 font-mono text-xs leading-5 text-gray-200"
                      >
                        {consoleEntries.length ? (
                          consoleEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className={`whitespace-pre-wrap break-words ${
                                entry.level === 'error'
                                  ? 'text-red-400'
                                  : entry.level === 'warn'
                                    ? 'text-amber-300'
                                    : entry.level === 'info'
                                      ? 'text-blue-300'
                                      : entry.level === 'debug'
                                        ? 'text-gray-500'
                                        : ''
                              }`}
                            >
                              {entry.level === 'log' ? '' : `${entry.level} `}
                              {entry.values.join(' ')}
                            </div>
                          ))
                        ) : (
                          <span className="text-gray-500">
                            No console output
                          </span>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </section>
              )}
            </Collapsible>
          </div>
        </main>
      )}
    </Collapsible>
  )
}
