'use client'

import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { useToast } from '~/components/ToastProvider'
import { Copy } from 'lucide-react'
import { Button } from '~/ui'

type CodeBlockProps = React.HTMLProps<HTMLPreElement> & {
  /** Optional title to display above code block */
  'data-code-title'?: string
  /** Whether to show the copy button */
  showCopyButton?: boolean
  /** Whether the code block is embedded (e.g., in a file explorer) */
  isEmbedded?: boolean
}

/**
 * CodeBlock wraps pre-highlighted HTML from server-side Shiki with a copy button.
 * Used by html-react-parser to replace <pre> elements in rendered markdown.
 */
export function CodeBlock({
  children,
  className,
  style,
  'data-code-title': dataCodeTitle,
  showCopyButton = true,
  isEmbedded,
  ...props
}: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false)
  const ref = React.useRef<HTMLPreElement>(null)
  const { notify } = useToast()

  // Extract title from data attribute
  const title =
    dataCodeTitle && dataCodeTitle !== 'undefined' && dataCodeTitle.trim()
      ? dataCodeTitle.trim()
      : undefined

  // Try to extract language from className (e.g., "shiki shiki-themes" or "language-typescript")
  const lang = React.useMemo(() => {
    if (!className) return ''
    // Look for language-* class
    const langMatch = className.match(/language-(\w+)/)
    if (langMatch) return langMatch[1]
    return ''
  }, [className])

  const handleCopy = React.useCallback(() => {
    const copyContent = ref.current?.innerText?.trimEnd() || ''

    navigator.clipboard.writeText(copyContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    notify(
      <div className="flex flex-col">
        <span className="font-medium">Copied code</span>
        <span className="text-gray-500 dark:text-gray-400 text-xs">
          Code block copied to clipboard
        </span>
      </div>,
    )
  }, [notify])

  // Display language in header
  const displayLang = lang?.toLowerCase() === 'bash' ? 'sh' : lang

  return (
    <div
      className={twMerge(
        'codeblock w-full max-w-full relative not-prose border border-gray-500/20 rounded-md [&_pre]:rounded-md',
        isEmbedded && '[&_pre]:rounded-none',
      )}
    >
      {(title || showCopyButton) && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs text-gray-700 dark:text-gray-300">
            {title || displayLang}
          </div>

          <Button
            variant="ghost"
            size="xs"
            className="border-0 rounded-md transition-opacity"
            onClick={handleCopy}
            aria-label="Copy code to clipboard"
          >
            {copied ? (
              <span className="text-xs">Copied!</span>
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}
      <pre
        ref={ref}
        className={twMerge(className, isEmbedded && 'h-full')}
        style={style}
        {...props}
      >
        {children}
      </pre>
    </div>
  )
}

type HighlightedCodeBlockProps = {
  /** Pre-highlighted HTML from server-side Shiki */
  html: string
  /** Optional title to display above code block */
  title?: string
  /** Language for display in header */
  lang?: string
  /** Whether to show the copy button */
  showCopyButton?: boolean
  /** Whether the code block is embedded (e.g., in a file explorer) */
  isEmbedded?: boolean
  className?: string
  style?: React.CSSProperties
}

/**
 * HighlightedCodeBlock renders pre-highlighted HTML from server-side Shiki.
 * Use this for code blocks outside of markdown (e.g., CodeExplorer, landing pages).
 */
export function HighlightedCodeBlock({
  html,
  title,
  lang,
  showCopyButton = true,
  isEmbedded,
  className,
  style,
}: HighlightedCodeBlockProps) {
  const [copied, setCopied] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const { notify } = useToast()

  const handleCopy = React.useCallback(() => {
    const copyContent = ref.current?.innerText?.trimEnd() || ''

    navigator.clipboard.writeText(copyContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    notify(
      <div className="flex flex-col">
        <span className="font-medium">Copied code</span>
        <span className="text-gray-500 dark:text-gray-400 text-xs">
          Code block copied to clipboard
        </span>
      </div>,
    )
  }, [notify])

  // Display language in header
  const displayLang = lang?.toLowerCase() === 'bash' ? 'sh' : (lang ?? '')

  return (
    <div
      className={twMerge(
        'codeblock w-full max-w-full relative not-prose border border-gray-500/20 rounded-md [&_pre]:rounded-md',
        isEmbedded && '[&_pre]:rounded-none',
        className,
      )}
      style={style}
    >
      {(title || showCopyButton) && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs text-gray-700 dark:text-gray-300">
            {title || displayLang}
          </div>

          <Button
            variant="ghost"
            size="xs"
            className="border-0 rounded-md transition-opacity"
            onClick={handleCopy}
            aria-label="Copy code to clipboard"
          >
            {copied ? (
              <span className="text-xs">Copied!</span>
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}
      <div
        ref={ref}
        className={twMerge(isEmbedded && 'h-full [&>pre]:h-full')}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

type PlainCodeBlockProps = {
  /** Code content to display (no highlighting) */
  code: string
  /** Optional title to display above code block */
  title?: string
  /** Language for display in header */
  lang?: string
  /** Whether to show the copy button */
  showCopyButton?: boolean
  className?: string
  style?: React.CSSProperties
}

/**
 * PlainCodeBlock displays code without syntax highlighting.
 * Use this for dynamically generated code (e.g., package manager commands).
 */
export function PlainCodeBlock({
  code,
  title,
  lang,
  showCopyButton = true,
  className,
  style,
}: PlainCodeBlockProps) {
  const [copied, setCopied] = React.useState(false)
  const { notify } = useToast()

  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(code.trimEnd())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    notify(
      <div className="flex flex-col">
        <span className="font-medium">Copied code</span>
        <span className="text-gray-500 dark:text-gray-400 text-xs">
          Code block copied to clipboard
        </span>
      </div>,
    )
  }, [code, notify])

  // Display language in header
  const displayLang = lang?.toLowerCase() === 'bash' ? 'sh' : (lang ?? '')

  return (
    <div
      className={twMerge(
        'codeblock w-full max-w-full relative not-prose border border-gray-500/20 rounded-md',
        className,
      )}
      style={style}
    >
      {(title || showCopyButton) && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-t-md">
          <div className="text-xs text-gray-700 dark:text-gray-300">
            {title || displayLang}
          </div>

          <Button
            variant="ghost"
            size="xs"
            className="border-0 rounded-md transition-opacity"
            onClick={handleCopy}
            aria-label="Copy code to clipboard"
          >
            {copied ? (
              <span className="text-xs">Copied!</span>
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}
      <pre className="p-4 overflow-x-auto bg-gray-50 dark:bg-gray-900/50 rounded-b-md">
        <code className="text-sm font-mono text-gray-800 dark:text-gray-200">
          {code}
        </code>
      </pre>
    </div>
  )
}
