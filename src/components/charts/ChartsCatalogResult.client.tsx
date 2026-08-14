import * as React from 'react'
import { compileExampleWorkspace } from '~/utils/example-esbuild.client'
import {
  createExampleSandboxDocument,
  isExampleSandboxMessage,
  postExampleSandboxTheme,
  type ExampleSandboxStatus,
} from '~/utils/example-sandbox.client'
import type { ExampleDefinition } from '~/utils/example-workspace'

export function ChartsCatalogResult({
  definition,
  height,
  onStatus,
}: {
  definition: ExampleDefinition
  height: number
  onStatus?: (status: 'ready' | 'error') => void
}) {
  const [sourceDocument, setSourceDocument] = React.useState('')
  const [status, setStatus] = React.useState<
    'compiling' | ExampleSandboxStatus
  >('compiling')
  const frameRef = React.useRef<HTMLIFrameElement>(null)
  const runTokenRef = React.useRef('')
  const compileRequestRef = React.useRef(0)
  const onStatusRef = React.useRef(onStatus)

  React.useEffect(() => {
    onStatusRef.current = onStatus
  }, [onStatus])

  React.useEffect(() => {
    const request = compileRequestRef.current + 1
    compileRequestRef.current = request
    const runToken = crypto.randomUUID()
    runTokenRef.current = runToken
    setSourceDocument('')
    setStatus('compiling')

    void compileExampleWorkspace(definition.workspace)
      .then((compiled) => {
        if (request !== compileRequestRef.current) return
        setSourceDocument(
          createExampleSandboxDocument({
            compiled,
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
        if (request !== compileRequestRef.current) return
        console.error(
          `Unable to compile Charts catalog case ${definition.id}`,
          error,
        )
        setStatus('error')
        onStatusRef.current?.('error')
      })
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
      if (!isExampleSandboxMessage(event.data, runTokenRef.current)) return

      const message = event.data
      if (message.kind === 'theme-request') {
        syncTheme()
        return
      }
      if (message.kind !== 'status') return

      setStatus(message.status)
      if (message.status === 'ready' || message.status === 'error') {
        onStatusRef.current?.(message.status)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [syncTheme])

  React.useEffect(() => {
    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [syncTheme])

  return (
    <div
      className="charts-catalog-chart relative w-full overflow-hidden"
      data-chart-case={definition.id}
      style={{ height }}
    >
      {sourceDocument ? (
        <iframe
          ref={frameRef}
          title={`${definition.title} output`}
          sandbox="allow-scripts"
          srcDoc={sourceDocument}
          onLoad={syncTheme}
          className="block size-full border-0 bg-background-default"
        />
      ) : null}
      {status !== 'ready' ? (
        <div
          className={`absolute inset-0 ${
            status === 'error'
              ? 'grid place-items-center text-sm text-red-700 dark:text-red-300'
              : 'animate-pulse bg-gray-100 dark:bg-gray-900'
          }`}
        >
          {status === 'error' ? 'Render failed' : null}
        </div>
      ) : null}
    </div>
  )
}

function readTheme() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}
