/**
 * Terminal - Collapsible terminal output panel
 */

import * as React from 'react'
import { useWebContainer } from '@tanstack/cta-ui-base'

type TerminalProps = {
  onClose: () => void
}

export function Terminal({ onClose }: TerminalProps) {
  const webContainer = useWebContainer()
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [output, setOutput] = React.useState<string[]>([])

  // Subscribe to terminal output
  React.useEffect(() => {
    if (!webContainer) return

    // Get initial output
    setOutput(webContainer.getState().terminalOutput)

    // Subscribe to updates
    const unsubscribe = webContainer.subscribe((state) => {
      setOutput(state.terminalOutput)
    })

    return unsubscribe
  }, [webContainer])

  // Auto-scroll to bottom
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [output])

  return (
    <div className="h-48 border-t border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Terminal</span>
        <div className="flex items-center gap-1">
          {/* Clear button */}
          <button
            type="button"
            onClick={() => webContainer?.getState().setTerminalOutput([])}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Clear terminal"
          >
            <svg
              className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Close terminal"
          >
            <svg
              className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed"
      >
        {output.length === 0 ? (
          <span className="text-gray-400 dark:text-gray-500">Waiting for output...</span>
        ) : (
          output.map((line, index) => (
            <div key={index} className="whitespace-pre-wrap">
              <span className={getLineColor(line)}>{line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function getLineColor(line: string): string {
  const lineLower = line.toLowerCase()

  if (lineLower.includes('error') || lineLower.includes('failed')) {
    return 'text-red-600 dark:text-red-400'
  }

  if (lineLower.includes('warning') || lineLower.includes('warn')) {
    return 'text-yellow-600 dark:text-yellow-400'
  }

  if (
    lineLower.includes('success') ||
    lineLower.includes('ready') ||
    lineLower.includes('done')
  ) {
    return 'text-green-600 dark:text-green-400'
  }

  if (line.startsWith('>') || line.startsWith('$')) {
    return 'text-blue-600 dark:text-blue-400'
  }

  return 'text-gray-700 dark:text-gray-300'
}
