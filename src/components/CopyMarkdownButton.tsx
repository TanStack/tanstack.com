'use client'
import { useState, useTransition } from 'react'
import { FaCheck, FaCopy } from 'react-icons/fa'

import { type MouseEventHandler, useEffect, useRef } from 'react'

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
  const [checked, onClick] = useCopyButton(async () => {
    startTransition(() => {
      const url = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`
      const cached = cache.get(url)

      if (cached) {
        navigator.clipboard.writeText(cached)
      } else {
        fetch(url)
          .then((response) => response.text())
          .then((content) => {
            cache.set(url, content)
            return navigator.clipboard.writeText(content)
          })
          .catch(() => {
            // fallback: try to copy current page content if available
            const pageContent =
              document.querySelector('.styled-markdown-content')?.textContent ||
              ''
            return navigator.clipboard.writeText(pageContent)
          })
      }
    })
  })

  return (
    <button
      disabled={isLoading}
      className="py-1 px-2 text-sm bg-white/70 text-black dark:bg-gray-500/40 dark:text-white shadow-lg shadow-black/20 flex items-center justify-center backdrop-blur-sm z-20 rounded-lg overflow-hidden"
      onClick={onClick}
      title="Copy markdown source"
    >
      <div className="flex gap-2 items-center">
        {checked ? (
          <FaCheck className="w-3 h-3" />
        ) : (
          <FaCopy className="w-3 h-3" />
        )}
        Copy Markdown
      </div>
    </button>
  )
}
