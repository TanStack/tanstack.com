import * as React from 'react'
import {
  SandboxBrowser,
  type SandboxBrowserAnnotationTarget,
} from '~/components/examples/SandboxBrowser.client'
import { compileExampleWorkspace } from '~/utils/example-esbuild.client'
import {
  canGoBackInExamplePreview,
  canGoForwardInExamplePreview,
  createExamplePreviewHistory,
  normalizeExamplePreviewUrl,
  updateExamplePreviewHistory,
} from '~/utils/example-preview-history'
import {
  createExampleSandboxDocument,
  isExampleSandboxBrowserMessage,
  isExampleSandboxMessage,
  postExampleSandboxBrowserCommand,
  postExampleSandboxTheme,
  type ExampleSandboxStatus,
} from '~/utils/example-sandbox.client'
import type { ExampleDefinition } from '~/utils/example-workspace'

type PendingSandboxCapture = {
  reject(cause: Error): void
  requestId: string
  resolve(blob: Blob): void
  timeout: number
}

export function ChartsCatalogResult({
  definition,
  height,
}: {
  definition: ExampleDefinition
  height: number
}) {
  const [sourceDocument, setSourceDocument] = React.useState('')
  const [status, setStatus] = React.useState<
    'compiling' | ExampleSandboxStatus
  >('compiling')
  const [previewHistory, setPreviewHistory] = React.useState(() =>
    createExamplePreviewHistory(),
  )
  const [previewNavigationError, setPreviewNavigationError] = React.useState('')
  const [previewAnnotationMode, setPreviewAnnotationModeActive] =
    React.useState(false)
  const [previewAnnotationTarget, setPreviewAnnotationTarget] =
    React.useState<SandboxBrowserAnnotationTarget>()
  const frameRef = React.useRef<HTMLIFrameElement>(null)
  const runTokenRef = React.useRef('')
  const browserChannelRef = React.useRef(crypto.randomUUID())
  const previewHistoryRef = React.useRef(previewHistory)
  const pendingCaptureRef = React.useRef<PendingSandboxCapture | undefined>(
    undefined,
  )
  const compileRequestRef = React.useRef(0)

  React.useEffect(() => {
    previewHistoryRef.current = previewHistory
  }, [previewHistory])

  React.useEffect(() => {
    const controller = new AbortController()
    const request = compileRequestRef.current + 1
    compileRequestRef.current = request
    const runToken = crypto.randomUUID()
    browserChannelRef.current = crypto.randomUUID()
    runTokenRef.current = runToken
    const pending = pendingCaptureRef.current
    if (pending) {
      window.clearTimeout(pending.timeout)
      pendingCaptureRef.current = undefined
      pending.reject(new Error('The preview changed before capture completed.'))
    }
    const initialPreviewHistory = createExamplePreviewHistory()
    previewHistoryRef.current = initialPreviewHistory
    setPreviewHistory(initialPreviewHistory)
    setPreviewNavigationError('')
    setPreviewAnnotationModeActive(false)
    setPreviewAnnotationTarget(undefined)
    setSourceDocument('')
    setStatus('compiling')

    void compileExampleWorkspace(definition.workspace, {
      packageResolution: 'dynamic',
      signal: controller.signal,
    })
      .then((compiled) => {
        if (request !== compileRequestRef.current) return
        setSourceDocument(
          createExampleSandboxDocument({
            compiled,
            browserChannel: browserChannelRef.current,
            document: definition.workspace.files['/index.html'],
            entry: definition.workspace.entry,
            files: definition.workspace.files,
            runToken,
            theme: readTheme(),
          }),
        )
        setStatus('running')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (request !== compileRequestRef.current) return
        console.error(
          `Unable to compile Charts catalog case ${definition.id}`,
          error,
        )
        setStatus('error')
      })

    return () => {
      compileRequestRef.current += 1
      controller.abort()
    }
  }, [definition])

  const syncTheme = React.useCallback(() => {
    postExampleSandboxTheme({
      frame: frameRef.current,
      runToken: runTokenRef.current,
      theme: readTheme(),
    })
  }, [])

  React.useEffect(() => {
    function handleMessage(event: MessageEvent<unknown>) {
      if (event.source !== frameRef.current?.contentWindow) return
      if (event.origin !== 'null') return

      if (
        isExampleSandboxBrowserMessage(event.data, browserChannelRef.current)
      ) {
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

      if (!isExampleSandboxMessage(event.data, runTokenRef.current)) return

      const message = event.data
      if (message.kind === 'theme-request') {
        syncTheme()
        return
      }
      if (message.kind !== 'status') return

      setStatus(message.status)
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [previewAnnotationMode, syncTheme])

  React.useEffect(() => {
    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [syncTheme])

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

  function sendPreviewBrowserCommand(
    command: Parameters<typeof postExampleSandboxBrowserCommand>[0]['command'],
  ) {
    postExampleSandboxBrowserCommand({
      channel: browserChannelRef.current,
      command,
      frame: frameRef.current,
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

  const currentPreviewUrl = previewHistory.entries[previewHistory.index] ?? '/'

  return (
    <div
      className="charts-catalog-chart relative w-full overflow-hidden"
      data-chart-case={definition.id}
      style={{ height: height + 40 }}
    >
      <SandboxBrowser
        annotationAvailable={Boolean(sourceDocument)}
        annotationMode={previewAnnotationMode}
        annotationTarget={previewAnnotationTarget}
        canGoBack={canGoBackInExamplePreview(previewHistory)}
        canGoForward={canGoForwardInExamplePreview(previewHistory)}
        captureScreenshot={sourceDocument ? capturePreview : undefined}
        currentUrl={currentPreviewUrl}
        error={previewNavigationError}
        history={[...new Set(previewHistory.entries)]}
        navigationAvailable={Boolean(sourceDocument)}
        onAnnotationModeChange={setPreviewAnnotationMode}
        onBack={() => sendPreviewBrowserCommand({ kind: 'back' })}
        onClearAnnotationTarget={clearPreviewAnnotationTarget}
        onForward={() => sendPreviewBrowserCommand({ kind: 'forward' })}
        onNavigate={(url) =>
          sendPreviewBrowserCommand({ kind: 'navigate', url })
        }
        onReload={() => sendPreviewBrowserCommand({ kind: 'reload' })}
      >
        {sourceDocument ? (
          <iframe
            ref={frameRef}
            key={runTokenRef.current}
            title={`${definition.title} output`}
            sandbox="allow-scripts"
            srcDoc={sourceDocument}
            onLoad={() => {
              syncTheme()
              sendPreviewBrowserCommand({
                kind: 'annotation',
                enabled: previewAnnotationMode,
              })
            }}
            className="block size-full border-0 bg-background-default"
          />
        ) : null}
        {status !== 'ready' ? (
          <div
            className={`absolute inset-0 ${
              status === 'error'
                ? 'grid place-items-center text-sm text-text-error'
                : 'animate-pulse bg-gray-100 dark:bg-gray-900 motion-reduce:animate-none'
            }`}
          >
            {status === 'error' ? 'Render failed' : null}
          </div>
        ) : null}
      </SandboxBrowser>
    </div>
  )
}

function readTheme() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}
