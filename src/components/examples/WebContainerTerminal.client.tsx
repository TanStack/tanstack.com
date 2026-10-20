import * as React from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal, type ITheme } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import type {
  WebContainerExampleSession,
  WebContainerTerminal,
} from '~/utils/example-webcontainer.client'

export function WebContainerTerminalPanel({
  active,
  session,
  theme,
}: {
  active: boolean
  session: WebContainerExampleSession
  theme: 'dark' | 'light'
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const activeRef = React.useRef(active)
  const fitRef = React.useRef<() => void>(() => {})
  const terminalRef = React.useRef<Terminal>(null)
  const [generation, setGeneration] = React.useState(0)
  const [state, setState] = React.useState<
    | { status: 'connecting' | 'connected' }
    | { message: string; status: 'error' }
    | { exitCode: number; status: 'exited' }
  >({ status: 'connecting' })
  activeRef.current = active

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let connection: WebContainerTerminal | undefined
    let dataDisposable: { dispose(): void } | undefined
    let resizeFrame: number | undefined
    let terminalEnded = false
    const fitAddon = new FitAddon()
    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily: getComputedStyle(container).fontFamily,
      fontSize: window.matchMedia('(min-width: 1024px)').matches ? 12 : 13,
      lineHeight: 1.25,
      scrollback: 5_000,
      theme: readTerminalTheme(container),
    })

    terminalRef.current = terminal
    terminal.loadAddon(fitAddon)
    terminal.open(container)
    setState({ status: 'connecting' })

    function fit() {
      if (!container || !container.clientWidth || !container.clientHeight) {
        return
      }

      fitAddon.fit()
      connection?.resize({ cols: terminal.cols, rows: terminal.rows })
    }

    fitRef.current = fit
    fit()
    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(fit)
    })
    resizeObserver.observe(container)

    void session
      .openTerminal({
        cols: terminal.cols,
        onError(cause) {
          if (!disposed) {
            terminalEnded = true
            setState({ message: formatError(cause), status: 'error' })
          }
        },
        onExit(exitCode) {
          if (!disposed) {
            terminalEnded = true
            setState({ exitCode, status: 'exited' })
          }
        },
        onOutput(value) {
          if (!disposed) terminal.write(value)
        },
        rows: terminal.rows,
      })
      .then((nextConnection) => {
        if (disposed) {
          nextConnection.dispose()
          return
        }

        connection = nextConnection
        if (terminalEnded) return

        setState({ status: 'connected' })
        dataDisposable = terminal.onData((value) => {
          void nextConnection.write(value).catch((cause) => {
            if (!disposed) {
              setState({ message: formatError(cause), status: 'error' })
            }
          })
        })
        fit()
        if (activeRef.current && !container.closest('[inert]')) terminal.focus()
      })
      .catch((cause) => {
        if (!disposed) {
          setState({ message: formatError(cause), status: 'error' })
        }
      })

    return () => {
      disposed = true
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame)
      resizeObserver.disconnect()
      dataDisposable?.dispose()
      connection?.dispose()
      terminal.dispose()
      terminalRef.current = null
      fitRef.current = () => {}
    }
  }, [generation, session])

  React.useEffect(() => {
    const container = containerRef.current
    const terminal = terminalRef.current
    if (!container || !terminal) return

    terminal.options.theme = readTerminalTheme(container)
  }, [theme])

  React.useEffect(() => {
    if (!active) return
    const frame = requestAnimationFrame(() => fitRef.current())
    return () => cancelAnimationFrame(frame)
  }, [active])

  const canRestart = state.status === 'error' || state.status === 'exited'

  return (
    <div className="relative size-full min-h-0 bg-background-default">
      <div
        ref={containerRef}
        className="size-full min-h-0 px-2 py-1 font-ds-mono [&_.xterm]:h-full [&_.xterm-viewport]:!bg-background-default"
      />
      {canRestart ? (
        <div className="absolute right-2 bottom-2 flex items-center gap-2 rounded-md border border-border-default bg-background-surface px-2 py-1 text-[11px] text-text-muted shadow-sm">
          <span className="max-w-64 truncate">
            {state.status === 'exited'
              ? `Shell exited (${state.exitCode})`
              : state.message}
          </span>
          <button
            type="button"
            className="font-medium text-text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            onClick={() => setGeneration((current) => current + 1)}
          >
            Restart
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function WebContainerProcessTerminalPanel({
  active,
  generation,
  offset,
  output,
  theme,
}: {
  active: boolean
  generation: number
  offset: number
  output: string
  theme: 'dark' | 'light'
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const fitRef = React.useRef<() => void>(() => {})
  const terminalRef = React.useRef<Terminal>(null)
  const outputRef = React.useRef({ generation, offset, value: output })
  const renderedOutputRef = React.useRef({ end: 0, generation: -1 })
  outputRef.current = { generation, offset, value: output }

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let resizeFrame: number | undefined
    const fitAddon = new FitAddon()
    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: false,
      cursorInactiveStyle: 'none',
      cursorStyle: 'bar',
      disableStdin: true,
      fontFamily: getComputedStyle(container).fontFamily,
      fontSize: window.matchMedia('(min-width: 1024px)').matches ? 12 : 13,
      lineHeight: 1.25,
      screenReaderMode: true,
      scrollback: 5_000,
      theme: readTerminalTheme(container),
    })

    terminalRef.current = terminal
    terminal.loadAddon(fitAddon)
    terminal.open(container)
    if (terminal.textarea) {
      terminal.textarea.ariaLabel = 'Process output'
      terminal.textarea.readOnly = true
      terminal.textarea.tabIndex = -1
    }
    renderProcessOutput(terminal, outputRef.current, renderedOutputRef)

    function fit() {
      if (!container || !container.clientWidth || !container.clientHeight)
        return
      fitAddon.fit()
    }

    fitRef.current = fit
    fit()
    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(fit)
    })
    resizeObserver.observe(container)

    return () => {
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame)
      resizeObserver.disconnect()
      terminal.dispose()
      terminalRef.current = null
      renderedOutputRef.current = { end: 0, generation: -1 }
      fitRef.current = () => {}
    }
  }, [])

  React.useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) return
    renderProcessOutput(
      terminal,
      { generation, offset, value: output },
      renderedOutputRef,
    )
  }, [generation, offset, output])

  React.useEffect(() => {
    const container = containerRef.current
    const terminal = terminalRef.current
    if (!container || !terminal) return

    terminal.options.theme = readTerminalTheme(container)
  }, [theme])

  React.useEffect(() => {
    if (!active) return
    const frame = requestAnimationFrame(() => fitRef.current())
    return () => cancelAnimationFrame(frame)
  }, [active])

  return (
    <div className="relative size-full min-h-0 bg-background-default">
      <div
        ref={containerRef}
        role="region"
        aria-label="Process output"
        className="size-full min-h-0 px-2 py-1 font-ds-mono [&_.xterm]:h-full [&_.xterm-viewport]:!bg-background-default"
      />
    </div>
  )
}

function renderProcessOutput(
  terminal: Terminal,
  output: { generation: number; offset: number; value: string },
  renderedOutputRef: React.MutableRefObject<{
    end: number
    generation: number
  }>,
) {
  const renderedOutput = renderedOutputRef.current
  const outputEnd = output.offset + output.value.length

  if (
    renderedOutput.generation === output.generation &&
    renderedOutput.end >= output.offset &&
    renderedOutput.end <= outputEnd
  ) {
    terminal.write(output.value.slice(renderedOutput.end - output.offset))
  } else {
    terminal.write(`\x1bc${output.value}`)
  }

  renderedOutputRef.current = {
    end: outputEnd,
    generation: output.generation,
  }
}

function readTerminalTheme(container: HTMLElement): ITheme {
  const probe = document.createElement('span')
  probe.hidden = true
  container.append(probe)

  function color(variable: string) {
    probe.style.color = `var(${variable})`
    return getComputedStyle(probe).color
  }

  const terminalTheme = {
    background: color('--color-background-default'),
    black: color('--color-ds-neutral-500'),
    blue: color('--color-status-info'),
    brightBlack: color('--color-text-muted'),
    brightBlue: color('--color-ds-blue-200'),
    brightCyan: color('--color-ds-blue-200'),
    brightGreen: color('--color-ds-green-200'),
    brightMagenta: color('--color-ds-purple-200'),
    brightRed: color('--color-ds-terracotta-200'),
    brightWhite: color('--color-text-primary'),
    brightYellow: color('--color-ds-amber-200'),
    cursor: color('--color-text-primary'),
    cursorAccent: color('--color-background-default'),
    cyan: color('--color-ds-blue-400'),
    foreground: color('--color-text-primary'),
    green: color('--color-status-success'),
    magenta: color('--color-ds-purple-400'),
    red: color('--color-status-error'),
    selectionBackground: color('--color-status-info-bg'),
    white: color('--color-text-secondary'),
    yellow: color('--color-status-warning'),
  }

  probe.remove()
  return terminalTheme
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
