import { CheckCircleIcon } from '@phosphor-icons/react/CheckCircle'
import { CopyIcon } from '@phosphor-icons/react/Copy'
import { useCopyButton } from '~/components/CopyMarkdownButton'
import { copyTextToClipboard } from '~/utils/browser-effects'

export function LandingPromptBox({
  heading,
  prompt,
}: {
  heading: string
  prompt: string
}) {
  const [copied, onCopy] = useCopyButton(() => copyTextToClipboard(prompt))

  return (
    <div className="mt-6 w-full max-w-136 rounded-lg border border-border-default bg-background-surface px-4 py-3">
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/65">
          {heading}
        </p>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex shrink-0 items-center gap-1.5 font-ds-mono text-ds-mono-caps-xs uppercase text-text-secondary transition-colors hover:text-text-primary"
        >
          {copied ? (
            <CheckCircleIcon size={16} aria-hidden="true" />
          ) : (
            <CopyIcon size={16} aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy prompt'}
        </button>
      </div>
      <p className="mt-2 text-ds-body-sm text-text-primary sm:text-ds-body-md">
        {prompt}
      </p>
    </div>
  )
}
