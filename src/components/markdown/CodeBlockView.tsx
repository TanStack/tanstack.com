'use client'

import * as React from 'react'
import { Copy } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { useToast } from '~/components/ToastProvider'
import { Button } from '~/ui'

export function CodeBlockView({
  className,
  copyText,
  htmlMarkup,
  isEmbedded,
  lang,
  showTypeCopyButton = true,
  style,
  title,
}: {
  className?: string
  copyText: string
  htmlMarkup: string
  isEmbedded?: boolean
  lang?: string
  showTypeCopyButton?: boolean
  style?: React.CSSProperties
  title?: string
}) {
  const [copied, setCopied] = React.useState(false)
  const { notify } = useToast()

  return (
    <div
      className={twMerge(
        'codeblock w-full max-w-full relative not-prose border border-gray-500/20 rounded-md [&_pre]:rounded-md',
        className,
      )}
      style={style}
    >
      {(title || showTypeCopyButton) && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs text-gray-700 dark:text-gray-300">
            {title || (lang?.toLowerCase() === 'bash' ? 'sh' : (lang ?? ''))}
          </div>

          <Button
            variant="ghost"
            size="xs"
            className={twMerge('border-0 rounded-md transition-opacity')}
            onClick={() => {
              navigator.clipboard.writeText(copyText)
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
            }}
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
        className={twMerge(
          isEmbedded ? 'h-full [&>pre]:h-full [&>pre]:rounded-none' : '',
        )}
        dangerouslySetInnerHTML={{ __html: htmlMarkup }}
      />
    </div>
  )
}
