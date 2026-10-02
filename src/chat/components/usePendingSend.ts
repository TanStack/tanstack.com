import { useEffect, useMemo, useRef, useState } from 'react'
import {
  assertSendDestination,
  PendingSendCoordinator,
  PendingSendStore,
  SendStorageError,
  sendReceiptKey,
  type NewSend,
  type SendEnvelope,
  type SendPayload,
  type SendScope,
  type SendResolution,
} from '../core/send-receipt'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import type { ConversationDestination } from '../core/conversation-destination'

export function usePendingSend(
  scope: SendScope,
  onAccepted: (
    payload: SendPayload,
    envelope: SendEnvelope,
  ) => boolean | Promise<boolean>,
  destination?: ConversationDestination,
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled !== false
  const api = useWorkspaceApi()
  const key = sendReceiptKey(scope)
  const owner = useMemo(() => ({ ...scope }), [key])
  const [state, setState] = useState({
    pending: null as SendEnvelope | null,
    ready: false,
    busy: true,
    error: '',
  })
  const [submitted, setSubmitted] = useState<SendEnvelope | null>(null)
  const mounted = useRef(false)
  const working = useRef(false)
  const accepted = useRef(onAccepted)
  accepted.current = onAccepted
  const service = useRef<{
    key: string
    store: PendingSendStore
    coordinator: PendingSendCoordinator
  } | null>(null)

  function getService() {
    if (destination) assertSendDestination(owner, destination)
    if (service.current) {
      if (service.current.key !== key) throw new SendStorageError()
      return service.current
    }
    if (!navigator.locks)
      throw new Error('Use an up-to-date browser to send messages safely.')
    let store: PendingSendStore
    try {
      store = new PendingSendStore(localStorage, owner)
    } catch {
      throw new SendStorageError()
    }
    const coordinator = new PendingSendCoordinator({
      store,
      lock: (operation) => navigator.locks.request(key, operation),
      post: (payload) => {
        // Publish the durable local envelope before waiting for the network.
        const envelope = store.read()
        if (mounted.current) {
          setSubmitted(envelope)
          setState((previous) => ({ ...previous, pending: envelope }))
        }
        return api.request(
          `${destination?.apiPath ?? (owner.conversationId ? `conversations/${encodeURIComponent(owner.conversationId)}` : `bots/${encodeURIComponent(owner.botId)}`)}/send`,
          payload,
        )
      },
      receipt: (messageId) =>
        api.request(
          `${destination?.apiPath ?? (owner.conversationId ? `conversations/${encodeURIComponent(owner.conversationId)}` : `bots/${encodeURIComponent(owner.botId)}`)}/send-receipt?message=${encodeURIComponent(messageId)}`,
        ),
      definitiveRejection: (error) =>
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408,
    })
    return (service.current = { key, store, coordinator })
  }
  async function perform(
    operation: (coordinator: PendingSendCoordinator) => Promise<SendResolution>,
  ) {
    if (!enabled) return
    if (working.current) return
    working.current = true
    const acknowledge = accepted.current
    if (mounted.current)
      setState((previous) => ({ ...previous, busy: true, error: '' }))
    try {
      const { coordinator, store } = getService()
      const pending = store.read()
      if (mounted.current) setState((previous) => ({ ...previous, pending }))
      const result = await operation(coordinator)
      if (result.kind === 'rejected') setSubmitted(null)
      let nextPending = result.kind === 'pending' ? result.envelope : null
      if (result.kind === 'accepted') {
        if (!(await acknowledge(result.envelope.payload, result.envelope)))
          throw new SendStorageError()
        nextPending = await coordinator.finishAccepted(result.envelope)
      }
      if (mounted.current)
        setState({
          pending: nextPending,
          ready: true,
          busy: false,
          error: 'error' in result ? (result.error ?? '') : '',
        })
    } catch (error) {
      let pending: SendEnvelope | null = null
      try {
        pending = service.current?.store.read() ?? null
      } catch {
        /* Storage remains unavailable. */
      }
      if (mounted.current)
        setState({
          pending,
          ready: false,
          busy: false,
          error:
            error instanceof Error
              ? error.message
              : 'The send could not be confirmed. Check again.',
        })
    } finally {
      working.current = false
    }
  }
  useEffect(() => {
    if (!enabled) return
    mounted.current = true
    void perform((coordinator) => coordinator.check())
    const changed = (event: StorageEvent) => {
      if (event.key === key || event.key === null)
        void perform((coordinator) => coordinator.check())
    }
    window.addEventListener('storage', changed)
    return () => {
      mounted.current = false
      window.removeEventListener('storage', changed)
    }
  }, [key, enabled])
  return {
    ...state,
    submitted,
    forgetSubmitted: () => setSubmitted(null),
    submit: (input: NewSend) =>
      perform((coordinator) => coordinator.submit(input)),
    retry: () => perform((coordinator) => coordinator.retry()),
    check: () => perform((coordinator) => coordinator.check()),
  }
}
