/**
 * ExportDropdown - Export menu with ZIP and CLI command options
 */

import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import {
  useProjectName,
  useRouterMode,
  useAddOns,
  useProjectStarter,
  useProjectOptions,
  useDryRun,
} from '@tanstack/cta-ui-base/dist/store/project'
import { generateCliCommand } from '../types'

type ExportDropdownProps = {
  large?: boolean
}

export function ExportDropdown({ large }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [copiedCli, setCopiedCli] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // CTA state
  const projectName = useProjectName()
  const routerMode = useRouterMode()
  const { chosenAddOns } = useAddOns()
  const projectStarter = useProjectStarter((s) => s.projectStarter)
  const dryRun = useDryRun()

  const typescript = useProjectOptions((s) => s.typescript)
  const tailwind = useProjectOptions((s) => s.tailwind)
  const files = (dryRun?.files ?? {}) as Record<string, string>
  const hasFiles = Object.keys(files).length > 0

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const cliCommand = generateCliCommand({
    projectName: projectName || 'my-app',
    mode: routerMode,
    typescript,
    tailwind,
    addons: chosenAddOns,
    starter: projectStarter?.id,
  })

  const handleCopyCli = async () => {
    try {
      await navigator.clipboard.writeText(cliCommand)
      setCopiedCli(true)
      setTimeout(() => setCopiedCli(false), 2000)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = cliCommand
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedCli(true)
      setTimeout(() => setCopiedCli(false), 2000)
    }
  }

  const handleDownloadZip = async () => {
    if (!hasFiles) return

    // Dynamically import JSZip
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    // Add all files to ZIP
    for (const [path, content] of Object.entries(files)) {
      // Normalize path (remove leading ./)
      const normalizedPath = path.replace(/^\.\//, '')
      zip.file(normalizedPath, content)
    }

    // Generate and download
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName || 'tanstack-app'}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className={twMerge(
          'flex items-center gap-1 font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors',
          large ? 'px-4 py-2 text-sm' : 'px-2 py-1 text-xs',
        )}
      >
        <span>Export</span>
        <svg
          className={twMerge(
            'transition-transform',
            large ? 'w-4 h-4' : 'w-3 h-3',
            isOpen && 'rotate-180',
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
          {/* Download ZIP */}
          <button
            type="button"
            onClick={handleDownloadZip}
            className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <svg
                className="w-4 h-4 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Download ZIP
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Download project as a ZIP file
              </div>
            </div>
          </button>

          {/* Copy CLI command */}
          <button
            type="button"
            onClick={handleCopyCli}
            className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <svg
                className="w-4 h-4 text-purple-600 dark:text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {copiedCli ? 'Copied!' : 'Copy CLI Command'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Use npx create-tanstack-app
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
