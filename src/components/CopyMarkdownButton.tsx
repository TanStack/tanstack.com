'use client'
import { useState, useTransition } from 'react'
import { FaCheck, FaCopy } from 'react-icons/fa'

import { type MouseEventHandler, useEffect, useRef } from 'react'
import { useToast } from '~/components/ToastProvider'

export function useCopyButton(
  onCopy: () => void | Promise<void>
): [checked: boolean, onClick: MouseEventHandler] {
  const [checked, setChecked] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const onClick: MouseEventHandler = async () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    const res = Promise.resolve(onCopy())

    void res.then(() => {
      setChecked(true)
      timeoutRef.current = window.setTimeout(() => {
        setChecked(false)
      }, 1500)
    })
  }

  // avoid updates after being unmounted
  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  return [checked, onClick]
}

const cache = new Map<string, string>()

interface CopyMarkdownButtonProps {
  repo: string
  branch: string
  filePath: string
}

export function CopyMarkdownButton({
  repo,
  branch,
  filePath,
}: CopyMarkdownButtonProps) {
  const [isLoading, startTransition] = useTransition()
  const { notify } = useToast()
  const [checked, onClick] = useCopyButton(async () => {
    startTransition(() => {
      const url = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`
      const cached = cache.get(url)

      if (cached) {
        navigator.clipboard.writeText(cached).then(() => {
          notify(
            <div>
              <div className="font-medium">Copied markdown</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">
                Source content copied from cache
              </div>
            </div>
          )
        })
      } else {
        fetch(url)
          .then((response) => {
            if (!response.ok) {
              throw new Error('Fetch failed')
            }
            return response.text()
          })
          .then((content) => {
            cache.set(url, content)
            return navigator.clipboard.writeText(content).then(() => {
              notify(
                <div>
                  <div className="font-medium">Copied markdown</div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs">
                    Source content copied from GitHub
                  </div>
                </div>
              )
            })
          })
          .catch(() => {
            // fallback: try to copy current page content if available
            const pageContent =
              document.querySelector('.styled-markdown-content')?.textContent ||
              ''
            navigator.clipboard.writeText(pageContent).then(() => {
              notify(
                <div>
                  <div className="font-medium">Copied markdown</div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs">
                    Fallback: copied rendered page content
                  </div>
                </div>
              )
            })
          })
      }
    })
  })

  return (
    <button
      disabled={isLoading}
      className="py-1 px-2 text-sm bg-white/70 text-black dark:bg-gray-500/40 dark:text-white shadow-md flex items-center justify-center backdrop-blur-sm rounded-lg overflow-hidden"
      onClick={onClick}
      title="Copy markdown source"
    >
      <div className="flex gap-2 items-center">
        {checked ? (
          <>
            <FaCheck className="w-3 h-3" /> Copied to Clipboard
          </>
        ) : (
          <>
            <FaCopy className="w-3 h-3" /> Copy Markdown
          </>
        )}
      </div>
    </button>
  )
}
