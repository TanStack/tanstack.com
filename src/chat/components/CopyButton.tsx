import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { IconButton } from './IconButton'
import './message-interactions.css'

export function CopyButton({
  text,
  label,
  icon,
}: {
  text: string | (() => string)
  label: string
  icon?: ReactNode
}) {
  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'error'>(
    'idle',
  )
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  async function copy() {
    if (state === 'copying') return
    clearTimeout(timer.current)
    setState('copying')
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(
        typeof text === 'function' ? text() : text,
      )
      setState('copied')
      timer.current = setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
    }
  }
  return (
    <span className="message-copy" data-copy-control>
      <IconButton
        className="message-action"
        label={state === 'copied' ? `${label}, copied` : label}
        tooltip={state === 'copied' ? 'Copied' : label}
        disabled={state === 'copying'}
        onClick={() => void copy()}
      >
        {state === 'copied' ? (
          <Check size={14} aria-hidden />
        ) : (
          (icon ?? <Copy size={14} aria-hidden />)
        )}
      </IconButton>
      <span
        className={state === 'error' ? 'message-copy-error' : 'message-sr-only'}
        role="status"
      >
        {state === 'error'
          ? 'Could not copy. Try again or select the text.'
          : state === 'copied'
            ? `${label}: copied.`
            : ''}
      </span>
    </span>
  )
}
