import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ConversationDestination } from '../core/conversation-destination'
import { IconButton } from './IconButton'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import { returnToRetrySource } from './copy-source'

export function RetryReturn({
  destination,
  expectedMessageId,
  visible,
  disabledReason,
  saveDraft,
  onError,
}: {
  destination: ConversationDestination
  expectedMessageId?: string
  visible: boolean
  disabledReason?: string
  saveDraft: () => Promise<boolean>
  onError: (message: string) => void
}) {
  const { request } = useWorkspaceApi()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const active = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const current = useRef({ visible, disabledReason, saveDraft })
  current.current = { visible, disabledReason, saveDraft }
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      active.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (!visible) active.current?.abort()
  }, [visible])
  async function go(button: HTMLButtonElement) {
    if (
      active.current ||
      !current.current.visible ||
      current.current.disabledReason
    )
      return
    const controller = new AbortController()
    active.current = controller
    const cancel = () => controller.abort()
    const moved = (event: Event) => {
      if (!(event.target instanceof Node) || !button.contains(event.target))
        cancel()
    }
    const hidden = () => {
      if (document.visibilityState !== 'visible') cancel()
    }
    document.addEventListener('focusin', moved, { signal: controller.signal })
    document.addEventListener('pointerdown', moved, {
      signal: controller.signal,
    })
    document.addEventListener('visibilitychange', hidden, {
      signal: controller.signal,
    })
    window.addEventListener('blur', cancel, { signal: controller.signal })
    setBusy(true)
    onError('')
    try {
      await returnToRetrySource({
        destination,
        expectedMessageId,
        signal: controller.signal,
        saveDraft: () =>
          current.current.visible && !current.current.disabledReason
            ? current.current.saveDraft()
            : Promise.resolve(false),
        readSource: (signal) =>
          request(`${destination.apiPath}/copy-source`, undefined, 'GET', {
            signal,
          }),
        navigate: (location) => navigate({ ...location, resetScroll: false }),
      })
    } catch (error) {
      if (!controller.signal.aborted && mounted.current)
        onError(
          error instanceof ApiError && [403, 404].includes(error.status)
            ? 'The original request is no longer available. Your retry draft is kept here.'
            : error instanceof Error
              ? error.message
              : 'The original request could not be opened. Your draft is kept here.',
        )
    } finally {
      controller.abort()
      if (active.current === controller) active.current = null
      if (mounted.current) setBusy(false)
    }
  }
  return (
    <IconButton
      label="Return to original request"
      tooltip={
        disabledReason ||
        (busy ? 'Opening original request…' : 'Return to original request')
      }
      disabled={busy || !visible || !!disabledReason}
      onClick={(event) => void go(event.currentTarget)}
    >
      <ArrowLeft size={16} aria-hidden />
    </IconButton>
  )
}
