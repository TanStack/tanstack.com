import * as React from 'react'
import { CheckCircle, Copy } from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import { copyTextToClipboard } from '~/utils/browser-effects'

type LandingCopyPromptButtonProps = {
  className?: string
  getPrompt?: () => Promise<string> | string
  label?: string
  prompt?: string
}

export function LandingCopyPromptButton({
  className,
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
      aria-live="polite"
      className={twMerge(
        'inline-flex w-full max-w-full items-center justify-center gap-2 rounded-lg border border-border-default bg-background-surface px-4 py-2.5 text-ds-label-md text-text-primary transition-colors hover:border-border-strong disabled:cursor-wait disabled:opacity-75 sm:w-auto',
        className,
      )}
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
        <CheckCircle size={16} aria-hidden="true" />
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
