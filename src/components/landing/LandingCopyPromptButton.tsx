import * as React from 'react'
import { CheckCircle2, Copy } from 'lucide-react'

type LandingCopyPromptButtonProps = {
  getPrompt?: () => Promise<string> | string
  label?: string
  prompt?: string
}

export function LandingCopyPromptButton({
  getPrompt,
  label = 'Copy Prompt',
  prompt,
}: LandingCopyPromptButtonProps) {
  const [status, setStatus] = React.useState<
    'idle' | 'copying' | 'copied' | 'error'
  >('idle')

  React.useEffect(() => {
    if (status !== 'copied' && status !== 'error') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setStatus('idle')
    }, 1800)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [status])

  return (
    <button
      type="button"
      className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-bold text-zinc-900 transition-colors hover:border-zinc-400 disabled:cursor-wait disabled:opacity-75 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500 sm:w-auto"
      disabled={status === 'copying'}
      onClick={async () => {
        setStatus('copying')

        try {
          const resolvedPrompt = getPrompt ? await getPrompt() : prompt

          if (!resolvedPrompt) {
            throw new Error('Prompt unavailable')
          }

          await copyTextToClipboard(resolvedPrompt)
          setStatus('copied')
        } catch {
          setStatus('error')
        }
      }}
    >
      {status === 'copied' ? (
        <CheckCircle2 size={16} aria-hidden="true" />
      ) : (
        <Copy size={16} aria-hidden="true" />
      )}
      {status === 'copied'
        ? 'Copied'
        : status === 'copying'
          ? 'Copying...'
          : status === 'error'
            ? 'Copy failed'
            : label}
    </button>
  )
}

async function copyTextToClipboard(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(value)
    return
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard unavailable')
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'

  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  let didCopy = false

  try {
    didCopy = document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }

  if (!didCopy) {
    throw new Error('Copy failed')
  }
}
