import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  AlertCircle,
  RefreshCw,
  Terminal,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import type {
  PreviewMessage,
  Unsubscribe,
  WebContainer,
  WebContainerProcess,
} from '@webcontainer/api'
import {
  createForgeWebContainerFileTree,
  createForgeWebContainerPreviewFiles,
  getForgeWebContainerPreviewCommands,
  getForgeWebContainerWorkspaceName,
  type ForgeWebContainerPreviewStatus,
} from '~/utils/forge-webcontainer'

type ForgeWebContainerPreviewProps = {
  files: Record<string, string>
  manifestVersionId?: string
  packageManager?: string
}

type ForgePreviewLogTone = 'error' | 'info' | 'muted'

type ForgePreviewLog = {
  id: number
  message: string
  tone: ForgePreviewLogTone
}

type ConsoleResizeState = {
  handle: HTMLDivElement
  maxHeight: number
  pointerId: number
  startHeight: number
  startY: number
}

type PreviewConsolePanelProps = {
  height: number | string
  logs: Array<ForgePreviewLog>
  maxHeight?: number
  onResizeStart?: (event: ReactPointerEvent<HTMLDivElement>) => void
  outputRef: RefObject<HTMLDivElement | null>
  resizable?: boolean
}

type PreviewBridgeMessage = {
  href?: unknown
  path?: unknown
  source?: unknown
  type?: unknown
}

const CONSOLE_DEFAULT_HEIGHT = 180
const CONSOLE_MIN_HEIGHT = 96
const PREVIEW_MIN_HEIGHT = 120
const PREVIEW_ALIAS_HOST = 'localhost'

const PREVIEW_LOADING_STEPS = [
  { label: 'Starting preview', status: 'booting' },
  { label: 'Preparing files', status: 'mounting' },
  { label: 'Installing dependencies', status: 'installing' },
  { label: 'Starting app', status: 'starting' },
  { label: 'Opening page', status: 'loading' },
] satisfies Array<{
  label: string
  status: ForgeWebContainerPreviewStatus
}>

let webContainerPromise: Promise<WebContainer> | undefined

async function getWebContainer() {
  if (!webContainerPromise) {
    const webContainerModule = await import('@webcontainer/api')
    webContainerPromise = webContainerModule.WebContainer.boot({
      coep: 'require-corp',
      forwardPreviewErrors: 'exceptions-only',
      workdirName: 'forge-preview',
    })
  }

  return webContainerPromise
}

export function ForgeWebContainerPreview({
  files,
  manifestVersionId,
  packageManager,
}: ForgeWebContainerPreviewProps) {
  const [status, setStatus] = useState<ForgeWebContainerPreviewStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<Array<ForgePreviewLog>>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [frameSrc, setFrameSrc] = useState<string | null>(null)
  const [addressValue, setAddressValue] = useState('')
  const [locationHistory, setLocationHistory] = useState<Array<string>>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [frameLoadKey, setFrameLoadKey] = useState(0)
  const [frameLoading, setFrameLoading] = useState(false)
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [loadingConsoleVisible, setLoadingConsoleVisible] = useState(false)
  const [consoleHeight, setConsoleHeight] = useState(CONSOLE_DEFAULT_HEIGHT)
  const [consoleResizing, setConsoleResizing] = useState(false)
  const [previewPaneHeight, setPreviewPaneHeight] = useState(0)
  const [previewActive, setPreviewActive] = useState(true)
  const [restartKey, setRestartKey] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const previewPaneRef = useRef<HTMLDivElement>(null)
  const consoleOutputRef = useRef<HTMLDivElement>(null)
  const consoleResizeStateRef = useRef<ConsoleResizeState | null>(null)
  const currentUrlRef = useRef<string | null>(null)
  const historyIndexRef = useRef(-1)
  const locationHistoryRef = useRef<Array<string>>([])
  const nextLogIdRef = useRef(0)
  const filesRef = useRef(files)
  const previewPaintTimeoutRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined)
  const previewLoadTimeoutRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined)
  const fileCount = Object.keys(files).length
  const commands = useMemo(
    () => getForgeWebContainerPreviewCommands(packageManager),
    [packageManager],
  )
  const canStart = Boolean(manifestVersionId) && fileCount > 0
  const setupBusy =
    status === 'booting' ||
    status === 'installing' ||
    status === 'mounting' ||
    status === 'starting'
  const sandboxLoading = setupBusy || status === 'loading'
  const previewBusy = sandboxLoading || frameLoading
  const consoleVisible = consoleOpen
  const consoleButtonActive = consoleOpen || loadingConsoleVisible
  const canGoBack = historyIndex > 0
  const canGoForward =
    historyIndex >= 0 && historyIndex < locationHistory.length - 1
  const consoleMaxHeight = Math.max(
    CONSOLE_MIN_HEIGHT,
    previewPaneHeight - PREVIEW_MIN_HEIGHT,
  )
  const consoleTargetHeight = consoleOpen
    ? clampNumber(consoleHeight, CONSOLE_MIN_HEIGHT, consoleMaxHeight)
    : 0

  useEffect(() => {
    filesRef.current = files
  }, [files, manifestVersionId])

  useEffect(() => {
    const element = previewPaneRef.current

    if (!element) {
      return
    }

    const paneElement = element

    function updateHeight() {
      setPreviewPaneHeight(paneElement.getBoundingClientRect().height)
    }

    updateHeight()

    const resizeObserver = new ResizeObserver(updateHeight)
    resizeObserver.observe(paneElement)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    historyIndexRef.current = historyIndex
  }, [historyIndex])

  useEffect(() => {
    locationHistoryRef.current = locationHistory
  }, [locationHistory])

  useEffect(() => {
    if (!consoleVisible) {
      return
    }

    const outputElement = consoleOutputRef.current
    if (outputElement) {
      outputElement.scrollTop = outputElement.scrollHeight
    }
  }, [consoleVisible, logs.length, sandboxLoading])

  useEffect(() => {
    if (!consoleResizing) {
      return
    }

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    function handlePointerMove(event: PointerEvent) {
      const resizeState = consoleResizeStateRef.current
      if (!resizeState) {
        return
      }

      const nextHeight =
        resizeState.startHeight + resizeState.startY - event.clientY
      setConsoleHeight(
        clampNumber(
          nextHeight,
          CONSOLE_MIN_HEIGHT,
          Math.max(CONSOLE_MIN_HEIGHT, resizeState.maxHeight),
        ),
      )
    }

    function handlePointerEnd() {
      const resizeState = consoleResizeStateRef.current
      if (resizeState?.handle.hasPointerCapture(resizeState.pointerId)) {
        resizeState.handle.releasePointerCapture(resizeState.pointerId)
      }
      consoleResizeStateRef.current = null
      setConsoleResizing(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)

    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [consoleResizing])

  useEffect(() => {
    setPreviewActive(true)
    setConsoleOpen(false)
    setLoadingConsoleVisible(false)
  }, [manifestVersionId])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const message = event.data as PreviewBridgeMessage

      if (!message || message.source !== 'forge-webcontainer-preview') {
        return
      }

      if (message.type === 'ready') {
        markPreviewReady()
        return
      }

      if (message.type !== 'location' || !previewUrl) {
        return
      }

      const nextUrl = resolvePreviewBridgeUrl({
        message,
        previewUrl,
      })

      if (!nextUrl) {
        return
      }

      currentUrlRef.current = nextUrl
      setAddressValue(formatPreviewAddress(nextUrl, previewUrl))
      pushPreviewHistory(nextUrl)
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [previewUrl])

  useEffect(() => {
    if (!canStart || !manifestVersionId || !previewActive) {
      setStatus('idle')
      setError(null)
      setFrameLoading(false)
      if (!previewActive) {
        return
      }
      resetPreviewNavigation(null)
      return
    }

    let active = true
    let installProcess: WebContainerProcess | undefined
    let previewProcess: WebContainerProcess | undefined
    let previewReady = false
    let previewLoadTimeout: ReturnType<typeof setTimeout> | undefined
    const outputLines: Array<string> = []
    const unsubscribers: Array<Unsubscribe> = []
    const activeManifestVersionId = manifestVersionId
    const activeFiles = filesRef.current
    const activeFileCount = Object.keys(activeFiles).length

    function appendLog(message: string, tone: ForgePreviewLogTone = 'info') {
      if (!active) {
        return
      }

      const cleanLines = stripAnsiEscape(message)
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter(Boolean)

      if (cleanLines.length === 0) {
        return
      }

      setLogs((currentLogs) => {
        const nextLogs = [...currentLogs]

        for (const cleanLine of cleanLines) {
          outputLines.push(cleanLine)
          if (outputLines.length > 80) {
            outputLines.shift()
          }

          nextLogs.push({
            id: nextLogIdRef.current,
            message: cleanLine,
            tone,
          })
          nextLogIdRef.current += 1
        }

        return nextLogs.slice(-120)
      })
    }

    function pipeProcessOutput(process: WebContainerProcess) {
      void process.output
        .pipeTo(
          new WritableStream<string>({
            write(chunk) {
              appendLog(chunk, 'muted')
            },
          }),
        )
        .catch((pipeError: unknown) => {
          if (active) {
            appendLog(
              pipeError instanceof Error
                ? pipeError.message
                : 'Preview output stream closed.',
              'error',
            )
          }
        })
    }

    async function startPreview() {
      setStatus('booting')
      setError(null)
      setLogs([])
      setConsoleOpen(false)
      setLoadingConsoleVisible(false)
      resetPreviewNavigation(null)

      try {
        if (!globalThis.crossOriginIsolated) {
          throw new Error(
            'Forge browser preview needs cross-origin isolation headers.',
          )
        }

        appendLog('Booting browser preview runtime.')
        const webContainer = await getWebContainer()
        if (!active) {
          return
        }

        const workspaceName = getForgeWebContainerWorkspaceName(
          activeManifestVersionId,
        )
        const fileTree = createForgeWebContainerFileTree(
          createForgeWebContainerPreviewFiles(activeFiles),
        )

        setStatus('mounting')
        appendLog(`Hydrating ${activeFileCount.toLocaleString()} files.`)
        await webContainer.fs.rm(workspaceName, {
          force: true,
          recursive: true,
        })
        await webContainer.fs.mkdir(workspaceName, { recursive: true })
        await webContainer.mount(fileTree, { mountPoint: workspaceName })

        unsubscribers.push(
          webContainer.on('server-ready', (port, url) => {
            previewReady = true
            setStatus('loading')
            setPreviewUrl(url)
            resetPreviewNavigation(url)
            appendLog(`Preview server ready on port ${port}.`)

            if (previewLoadTimeout) {
              clearTimeout(previewLoadTimeout)
            }

            previewLoadTimeout = setTimeout(() => {
              if (!active) {
                return
              }

              const message =
                'Preview server started, but the browser frame did not load.'
              setStatus((currentStatus) =>
                currentStatus === 'loading' ? 'failed' : currentStatus,
              )
              setError((currentError) => currentError ?? message)
              appendLog(message, 'error')
            }, 20_000)
            previewLoadTimeoutRef.current = previewLoadTimeout
          }),
        )
        unsubscribers.push(
          webContainer.on('port', (port, type) => {
            appendLog(`Port ${port} ${type}.`, 'muted')
          }),
        )
        unsubscribers.push(
          webContainer.on('error', (event) => {
            appendLog(event.message, 'error')
          }),
        )
        unsubscribers.push(
          webContainer.on('preview-message', (event) => {
            appendLog(formatPreviewMessage(event), 'error')
          }),
        )

        setStatus('installing')
        appendLog(`Running ${commands.install.label}.`)
        installProcess = await webContainer.spawn(
          commands.install.command,
          commands.install.args,
          { cwd: workspaceName },
        )
        pipeProcessOutput(installProcess)

        const installExitCode = await installProcess.exit
        if (!active) {
          return
        }
        if (installExitCode !== 0) {
          throw new Error(
            formatProcessExitError({
              commandLabel: commands.install.label,
              exitCode: installExitCode,
              outputLines,
              reason: 'install failed',
            }),
          )
        }

        setStatus('starting')
        appendLog(`Running ${commands.dev.label}.`)
        previewProcess = await webContainer.spawn(
          commands.dev.command,
          commands.dev.args,
          { cwd: workspaceName },
        )
        pipeProcessOutput(previewProcess)

        const previewExitCode = await previewProcess.exit
        if (!active) {
          return
        }

        if (!previewReady) {
          throw new Error(
            formatProcessExitError({
              commandLabel: commands.dev.label,
              exitCode: previewExitCode,
              outputLines,
              reason: 'preview was not ready',
            }),
          )
        }

        throw new Error(
          formatProcessExitError({
            commandLabel: commands.dev.label,
            exitCode: previewExitCode,
            outputLines,
            reason: 'preview dev server exited',
          }),
        )
      } catch (startError) {
        if (!active) {
          return
        }

        const message =
          startError instanceof Error
            ? startError.message
            : 'Browser preview failed.'
        setStatus('failed')
        setLoadingConsoleVisible(false)
        setError(message)
        appendLog(message, 'error')
      }
    }

    void startPreview()

    return () => {
      active = false
      for (const unsubscribe of unsubscribers) {
        unsubscribe()
      }
      installProcess?.kill()
      previewProcess?.kill()
      if (previewLoadTimeout) {
        clearTimeout(previewLoadTimeout)
      }
      if (previewLoadTimeoutRef.current === previewLoadTimeout) {
        previewLoadTimeoutRef.current = undefined
      }
      if (previewPaintTimeoutRef.current) {
        clearTimeout(previewPaintTimeoutRef.current)
        previewPaintTimeoutRef.current = undefined
      }
    }
  }, [
    canStart,
    commands.dev.args,
    commands.dev.command,
    commands.dev.label,
    commands.install.args,
    commands.install.command,
    commands.install.label,
    manifestVersionId,
    previewActive,
    restartKey,
  ])

  function resetPreviewNavigation(url: string | null) {
    if (previewPaintTimeoutRef.current) {
      clearTimeout(previewPaintTimeoutRef.current)
      previewPaintTimeoutRef.current = undefined
    }
    currentUrlRef.current = url
    setPreviewUrl(url)
    setFrameSrc(url)
    setAddressValue(url ? formatPreviewAddress(url, url) : '')
    setLocationHistory(url ? [url] : [])
    setHistoryIndex(url ? 0 : -1)
    setFrameLoading(Boolean(url))
  }

  function markPreviewReady() {
    if (previewLoadTimeoutRef.current) {
      clearTimeout(previewLoadTimeoutRef.current)
      previewLoadTimeoutRef.current = undefined
    }
    if (previewPaintTimeoutRef.current) {
      clearTimeout(previewPaintTimeoutRef.current)
      previewPaintTimeoutRef.current = undefined
    }

    setStatus((currentStatus) =>
      currentStatus === 'loading' ? 'ready' : currentStatus,
    )
    setLoadingConsoleVisible(false)
    setFrameLoading(false)
  }

  function pushPreviewHistory(nextUrl: string) {
    setLocationHistory((currentHistory) => {
      const currentIndex = historyIndexRef.current

      if (currentHistory[currentIndex] === nextUrl) {
        return currentHistory
      }

      const baseHistory =
        currentIndex >= 0
          ? currentHistory.slice(0, currentIndex + 1)
          : currentHistory
      const nextHistory = [...baseHistory, nextUrl]
      setHistoryIndex(nextHistory.length - 1)
      return nextHistory
    })
  }

  function navigatePreview(nextUrl: string, historyMode: 'push' | 'replace') {
    if (!previewUrl) {
      return
    }

    currentUrlRef.current = nextUrl
    setFrameSrc(nextUrl)
    setAddressValue(formatPreviewAddress(nextUrl, previewUrl))
    setFrameLoading(true)

    if (historyMode === 'replace') {
      setLocationHistory((currentHistory) => {
        const currentIndex = historyIndexRef.current

        if (currentIndex < 0) {
          setHistoryIndex(0)
          return [nextUrl]
        }

        const nextHistory = [...currentHistory]
        nextHistory[currentIndex] = nextUrl
        return nextHistory
      })
      return
    }

    pushPreviewHistory(nextUrl)
  }

  function handleAddressSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!previewUrl) {
      return
    }

    const nextUrl = resolvePreviewAddress({
      address: addressValue,
      previewUrl,
    })

    if (!nextUrl) {
      return
    }

    navigatePreview(nextUrl, 'push')
  }

  function goBack() {
    if (!canGoBack) {
      return
    }

    const nextIndex = historyIndexRef.current - 1
    const nextUrl = locationHistoryRef.current[nextIndex]

    if (!nextUrl || !previewUrl) {
      return
    }

    currentUrlRef.current = nextUrl
    setHistoryIndex(nextIndex)
    setAddressValue(formatPreviewAddress(nextUrl, previewUrl))
    setFrameSrc(nextUrl)
    setFrameLoading(true)
  }

  function goForward() {
    if (!canGoForward) {
      return
    }

    const nextIndex = historyIndexRef.current + 1
    const nextUrl = locationHistoryRef.current[nextIndex]

    if (!nextUrl || !previewUrl) {
      return
    }

    currentUrlRef.current = nextUrl
    setHistoryIndex(nextIndex)
    setAddressValue(formatPreviewAddress(nextUrl, previewUrl))
    setFrameSrc(nextUrl)
    setFrameLoading(true)
  }

  function handleRefreshOrStop() {
    if (setupBusy) {
      setPreviewActive(false)
      setFrameLoading(false)
      setStatus('idle')
      setConsoleOpen(false)
      setLoadingConsoleVisible(false)
      return
    }

    if (previewBusy) {
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: 'forge-preview-controls',
          type: 'stop',
        },
        '*',
      )
      setFrameLoading(false)
      setStatus((currentStatus) =>
        currentStatus === 'loading' ? 'ready' : currentStatus,
      )
      setLoadingConsoleVisible(false)
      return
    }

    if (!previewUrl) {
      setPreviewActive(true)
      setRestartKey((value) => value + 1)
      return
    }

    iframeRef.current?.contentWindow?.postMessage(
      {
        source: 'forge-preview-controls',
        type: 'reload',
      },
      '*',
    )
    setFrameLoading(true)
    setFrameSrc(currentUrlRef.current ?? previewUrl)
    setFrameLoadKey((value) => value + 1)
  }

  function revealLoadingConsole() {
    setLoadingConsoleVisible(true)
    setConsoleOpen(true)
  }

  function handleConsoleToggle() {
    if (sandboxLoading) {
      const nextValue = !loadingConsoleVisible
      setLoadingConsoleVisible(nextValue)
      setConsoleOpen(nextValue)
      return
    }

    setConsoleOpen((value) => !value)
  }

  function startConsoleResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    const paneHeight =
      previewPaneRef.current?.getBoundingClientRect().height ??
      CONSOLE_DEFAULT_HEIGHT + PREVIEW_MIN_HEIGHT

    consoleResizeStateRef.current = {
      handle: event.currentTarget,
      maxHeight: paneHeight - PREVIEW_MIN_HEIGHT,
      pointerId: event.pointerId,
      startHeight: consoleHeight,
      startY: event.clientY,
    }
    setConsoleResizing(true)
  }

  return (
    <div className="grid h-full min-h-0 min-w-0 max-w-full grid-rows-[36px_minmax(0,1fr)] overflow-hidden bg-white dark:bg-[#101010]">
      <div className="border-b border-neutral-200 bg-[#fbfbfa] dark:border-white/10 dark:bg-[#171717]">
        <div className="flex h-9 items-center gap-1 px-1">
          <button
            className={browserButtonClassName(canGoBack)}
            disabled={!canGoBack}
            onClick={goBack}
            title="Back"
            type="button"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button
            className={browserButtonClassName(canGoForward)}
            disabled={!canGoForward}
            onClick={goForward}
            title="Forward"
            type="button"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            className={browserButtonClassName(canStart)}
            disabled={!canStart}
            onClick={handleRefreshOrStop}
            title={
              previewBusy ? 'Stop loading' : previewUrl ? 'Reload' : 'Start'
            }
            type="button"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${previewBusy ? 'animate-spin' : ''}`}
            />
          </button>
          <form
            className="relative min-w-0 flex-1"
            onSubmit={handleAddressSubmit}
          >
            <input
              className="h-7 w-full rounded-md border border-neutral-200 bg-white px-2 pr-8 text-xs text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white dark:border-white/10 dark:bg-black/25 dark:text-neutral-100 dark:placeholder:text-neutral-600 dark:focus:border-white/20"
              disabled={!previewUrl}
              onChange={(event) => setAddressValue(event.currentTarget.value)}
              placeholder={canStart ? 'localhost/' : 'No preview'}
              value={addressValue}
            />
            <button
              className="absolute right-1 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
              disabled={!previewUrl}
              title="Navigate"
              type="submit"
            >
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </form>
          <button
            aria-pressed={consoleButtonActive}
            className={consoleButtonClassName(consoleButtonActive)}
            onClick={handleConsoleToggle}
            title={consoleButtonActive ? 'Hide console' : 'Show console'}
            type="button"
          >
            <Terminal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        className="flex min-h-0 min-w-0 max-w-full flex-col bg-white dark:bg-black"
        ref={previewPaneRef}
      >
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          {frameSrc ? (
            <iframe
              allow="cross-origin-isolated"
              className={`h-full w-full bg-white ${
                consoleResizing ? 'pointer-events-none' : ''
              }`}
              key={frameLoadKey}
              onError={() => {
                const message = 'Preview frame failed to load.'
                setStatus('failed')
                setError(message)
                setLoadingConsoleVisible(false)
                setFrameLoading(false)
              }}
              onLoad={() => {
                if (previewPaintTimeoutRef.current) {
                  clearTimeout(previewPaintTimeoutRef.current)
                }
                previewPaintTimeoutRef.current = setTimeout(() => {
                  markPreviewReady()
                }, 2500)
              }}
              ref={iframeRef}
              src={frameSrc}
              title="Forge browser preview"
            />
          ) : error ? (
            <PreviewFailure error={error} logs={logs} />
          ) : (
            <div className="h-full min-h-[240px]" />
          )}
          {sandboxLoading ? (
            <PreviewLoadingPanel
              compact={loadingConsoleVisible}
              onShowConsole={revealLoadingConsole}
              status={status}
            />
          ) : null}
        </div>
        <div
          aria-hidden={!consoleVisible}
          className="min-w-0 max-w-full shrink-0 overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none"
          style={{ height: consoleTargetHeight }}
        >
          <PreviewConsolePanel
            height="100%"
            logs={logs}
            maxHeight={consoleMaxHeight}
            onResizeStart={startConsoleResize}
            outputRef={consoleOutputRef}
            resizable={consoleOpen}
          />
        </div>
      </div>
    </div>
  )
}

function PreviewLoadingPanel({
  compact,
  onShowConsole,
  status,
}: {
  compact: boolean
  onShowConsole: () => void
  status: ForgeWebContainerPreviewStatus
}) {
  const loadingCopy = getPreviewLoadingCopy(status)
  const activeStepIndex = getPreviewLoadingStepIndex(status)

  return (
    <div
      className={`absolute inset-x-0 top-0 z-10 overflow-hidden bg-[#fbfbfa]/95 text-center backdrop-blur-sm transition-[height,border-color] duration-300 ease-out motion-reduce:transition-none dark:bg-[#101010]/95 ${
        compact
          ? 'h-32 border-b border-neutral-200 dark:border-white/10'
          : 'h-full border-b border-transparent'
      }`}
    >
      <div className="flex h-full w-full items-center justify-center px-6">
        <div
          className={`flex max-w-sm flex-col items-center transition-transform duration-300 ease-out motion-reduce:transition-none ${
            compact ? 'scale-95' : 'scale-100'
          }`}
        >
          <div
            className={`flex items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition-[height,width] duration-300 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 ${
              compact ? 'h-8 w-8' : 'h-10 w-10'
            }`}
          >
            <RefreshCw
              className={`animate-spin transition-[height,width] duration-300 ${
                compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
              }`}
            />
          </div>
          <div
            className={`font-medium text-neutral-950 transition-[margin] duration-300 dark:text-neutral-100 ${
              compact ? 'mt-2 text-xs' : 'mt-4 text-sm'
            }`}
          >
            {loadingCopy.title}
          </div>
          <div
            className={`text-xs leading-5 text-neutral-500 transition-[margin] duration-300 dark:text-neutral-400 ${
              compact ? 'mt-0.5' : 'mt-1'
            }`}
          >
            {loadingCopy.description}
          </div>
          <div
            className={`flex items-center gap-1.5 transition-[margin] duration-300 ${
              compact ? 'mt-2' : 'mt-4'
            }`}
          >
            {PREVIEW_LOADING_STEPS.map((step, index) => (
              <div
                aria-hidden="true"
                className={`h-1.5 rounded-full transition-[background-color,width] ${
                  compact ? 'w-6' : 'w-8'
                } ${
                  index <= activeStepIndex
                    ? 'bg-neutral-900 dark:bg-neutral-100'
                    : 'bg-neutral-200 dark:bg-white/15'
                }`}
                key={step.status}
                title={step.label}
              />
            ))}
          </div>
          {compact ? null : (
            <button
              className="mt-5 inline-flex h-8 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:text-neutral-950 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:border-white/20 dark:hover:text-white"
              onClick={onShowConsole}
              type="button"
            >
              <Terminal className="h-3.5 w-3.5" />
              Show console
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PreviewConsolePanel({
  height,
  logs,
  maxHeight,
  onResizeStart,
  outputRef,
  resizable,
}: PreviewConsolePanelProps) {
  return (
    <div
      className="flex w-full min-w-0 max-w-full flex-col border-t border-neutral-200 bg-[#fbfbfa] dark:border-white/10 dark:bg-[#101010]"
      style={{ height }}
    >
      {resizable ? (
        <div
          aria-label="Resize console"
          aria-orientation="horizontal"
          aria-valuemax={maxHeight}
          aria-valuemin={CONSOLE_MIN_HEIGHT}
          aria-valuenow={typeof height === 'number' ? height : undefined}
          className="group flex h-3 shrink-0 cursor-row-resize touch-none items-center justify-center"
          onPointerDown={onResizeStart}
          role="separator"
          tabIndex={0}
        >
          <div className="h-1 w-12 rounded-full bg-neutral-300 transition group-hover:bg-neutral-500 dark:bg-white/20 dark:group-hover:bg-white/40" />
        </div>
      ) : null}
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-neutral-200 px-2 text-[11px] font-medium text-neutral-700 dark:border-white/10 dark:text-neutral-300">
        <Terminal className="h-3 w-3" />
        <span>Console</span>
      </div>
      <div
        className="min-h-0 min-w-0 flex-1 overflow-auto px-3 py-2 font-mono text-[11px] leading-5"
        ref={outputRef}
      >
        {logs.map((log) => (
          <div
            className={`${logClassName(log.tone)} whitespace-pre-wrap break-words`}
            key={log.id}
          >
            {log.message}
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewFailure({
  error,
  logs,
}: {
  error: string
  logs: Array<ForgePreviewLog>
}) {
  return (
    <div className="flex h-full min-h-[240px] flex-col overflow-auto bg-white p-4 dark:bg-[#101010]">
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 whitespace-pre-wrap leading-6">{error}</div>
      </div>
      {logs.length > 0 ? (
        <div className="mt-4 space-y-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 font-mono text-[11px] leading-5 dark:border-white/10 dark:bg-black/20">
          {logs.slice(-24).map((log) => (
            <div className={logClassName(log.tone)} key={log.id}>
              {log.message}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function browserButtonClassName(enabled: boolean) {
  return `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-neutral-600 transition dark:text-neutral-300 ${
    enabled
      ? 'border-transparent hover:bg-neutral-100 hover:text-neutral-950 dark:hover:bg-white/5 dark:hover:text-white'
      : 'cursor-not-allowed border-transparent text-neutral-300 dark:text-neutral-700'
  }`
}

function consoleButtonClassName(open: boolean) {
  return `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition ${
    open
      ? 'border-transparent bg-neutral-100 text-neutral-900 dark:bg-white/5 dark:text-neutral-200'
      : 'border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white'
  }`
}

function getPreviewLoadingCopy(status: ForgeWebContainerPreviewStatus) {
  switch (status) {
    case 'booting':
      return {
        description: 'Starting the browser runtime.',
        title: 'Starting preview',
      }
    case 'mounting':
      return {
        description: 'Preparing the generated app files.',
        title: 'Preparing files',
      }
    case 'installing':
      return {
        description: 'Installing packages for the preview.',
        title: 'Installing dependencies',
      }
    case 'starting':
      return {
        description: 'Starting the development server.',
        title: 'Starting app',
      }
    case 'loading':
      return {
        description: 'Opening the generated page.',
        title: 'Opening preview',
      }
    case 'failed':
      return {
        description: 'The preview could not start.',
        title: 'Preview failed',
      }
    case 'idle':
    case 'ready':
      return {
        description: 'The preview is waiting to start.',
        title: 'Preview',
      }
  }
}

function getPreviewLoadingStepIndex(status: ForgeWebContainerPreviewStatus) {
  const stepIndex = PREVIEW_LOADING_STEPS.findIndex(
    (step) => step.status === status,
  )

  return stepIndex === -1 ? 0 : stepIndex
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function resolvePreviewBridgeUrl({
  message,
  previewUrl,
}: {
  message: PreviewBridgeMessage
  previewUrl: string
}) {
  if (typeof message.path === 'string') {
    return new URL(message.path, previewUrl).href
  }

  if (typeof message.href === 'string') {
    try {
      const previewOrigin = new URL(previewUrl).origin
      const href = new URL(message.href)

      if (href.origin !== previewOrigin) {
        return null
      }

      return href.href
    } catch {
      return null
    }
  }

  return null
}

function resolvePreviewAddress({
  address,
  previewUrl,
}: {
  address: string
  previewUrl: string
}) {
  const trimmed = address.trim()

  if (!trimmed) {
    return previewUrl
  }

  try {
    const previewOrigin = new URL(previewUrl).origin

    if (trimmed.startsWith('/')) {
      return new URL(trimmed, previewUrl).href
    }

    const aliasPath = readPreviewAliasPath(trimmed)
    if (aliasPath) {
      return new URL(aliasPath, previewUrl).href
    }

    if (/^https?:\/\//i.test(trimmed)) {
      const inputUrl = new URL(trimmed)

      if (inputUrl.hostname === PREVIEW_ALIAS_HOST) {
        return new URL(
          `${inputUrl.pathname}${inputUrl.search}${inputUrl.hash}`,
          previewUrl,
        ).href
      }

      if (inputUrl.origin === previewOrigin) {
        return inputUrl.href
      }

      return new URL(
        `${inputUrl.pathname}${inputUrl.search}${inputUrl.hash}`,
        previewUrl,
      ).href
    }

    return new URL(`/${trimmed.replace(/^\/+/, '')}`, previewUrl).href
  } catch {
    return null
  }
}

function readPreviewAliasPath(value: string) {
  if (value === PREVIEW_ALIAS_HOST) {
    return '/'
  }

  if (
    value.startsWith(`${PREVIEW_ALIAS_HOST}/`) ||
    value.startsWith(`${PREVIEW_ALIAS_HOST}?`) ||
    value.startsWith(`${PREVIEW_ALIAS_HOST}#`)
  ) {
    const path = value.slice(PREVIEW_ALIAS_HOST.length)
    return path.startsWith('/') ? path : `/${path}`
  }

  if (!value.startsWith(`${PREVIEW_ALIAS_HOST}:`)) {
    return null
  }

  const afterHost = value.slice(PREVIEW_ALIAS_HOST.length + 1)
  const pathStartIndex = afterHost.search(/[/?#]/)
  const port =
    pathStartIndex === -1 ? afterHost : afterHost.slice(0, pathStartIndex)

  if (!/^\d+$/.test(port)) {
    return null
  }

  if (pathStartIndex === -1) {
    return '/'
  }

  const path = afterHost.slice(pathStartIndex)
  return path.startsWith('/') ? path : `/${path}`
}

function formatPreviewAddress(url: string, previewUrl: string) {
  try {
    const previewOrigin = new URL(previewUrl).origin
    const value = new URL(url)

    if (value.origin !== previewOrigin) {
      return url
    }

    return `${PREVIEW_ALIAS_HOST}${value.pathname}${value.search}${value.hash}`
  } catch {
    return url
  }
}

function logClassName(tone: ForgePreviewLogTone) {
  switch (tone) {
    case 'error':
      return 'text-red-600 dark:text-red-300'
    case 'info':
      return 'text-neutral-700 dark:text-neutral-300'
    case 'muted':
      return 'text-neutral-500'
  }
}

function formatPreviewMessage(message: PreviewMessage) {
  if ('args' in message) {
    const output = message.args.map(formatPreviewMessageValue).join(' ')

    return output || 'Preview console error.'
  }

  return message.stack
    ? `${message.message}\n${message.stack}`
    : message.message
}

function formatPreviewMessageValue(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  if (value instanceof Error) {
    return value.stack ?? value.message
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function stripAnsiEscape(value: string) {
  const escapeCharacter = String.fromCharCode(27)
  let stripped = ''

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]

    if (character !== escapeCharacter) {
      stripped += character
      continue
    }

    if (value[index + 1] !== '[') {
      continue
    }

    index += 2
    while (index < value.length && !isAnsiEscapeTerminator(value[index])) {
      index += 1
    }
  }

  return stripped
}

function isAnsiEscapeTerminator(character: string | undefined) {
  return Boolean(
    character &&
    ((character >= '@' && character <= '~') ||
      (character >= 'A' && character <= 'Z') ||
      (character >= 'a' && character <= 'z')),
  )
}

function formatProcessExitError({
  commandLabel,
  exitCode,
  outputLines,
  reason,
}: {
  commandLabel: string
  exitCode: number
  outputLines: Array<string>
  reason: string
}) {
  const outputTail = outputLines.slice(-8).join('\n').trim()
  const message = `${commandLabel} exited with code ${exitCode}; ${reason}.`

  return outputTail ? `${message}\n${outputTail}` : message
}
