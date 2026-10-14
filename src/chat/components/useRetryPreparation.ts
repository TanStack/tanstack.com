import { useEffect, useRef, useState } from 'react'
import type { ConversationDestination } from '../core/conversation-destination'
import type { RetryAttemptView } from '../core/conversation-retry'
import {
  RetryPreparationStore,
  type RetryPreparationRecord,
} from '../core/retry-preparation'
import { useWorkspaceApi } from './WorkspaceApi'

/** A persisted command identity survives a lost creation response. No message
 * is submitted here, and restored commands wait for the user to resume them. */
export function useRetryPreparation(
  destination: ConversationDestination,
  onReady: (
    target: NonNullable<RetryAttemptView['target']>,
    signal: AbortSignal,
  ) => Promise<boolean>,
  visible = true,
) {
  const { request } = useWorkspaceApi()
  const [record, setRecord] = useState<RetryPreparationRecord | null>(null)
  const [attempt, setAttempt] = useState<RetryAttemptView>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const mounted = useRef(false)
  const generation = useRef(0)
  const working = useRef(false)
  const service = useRef<RetryPreparationStore | null>(null)
  const open = useRef(onReady)
  open.current = onReady
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const controller = useRef<AbortController | null>(null)
  const selectedKey = useRef<string | null>(null)

  function store() {
    if (!navigator.locks)
      throw new Error('Use an up-to-date browser to prepare a retry safely.')
    return (service.current ??= new RetryPreparationStore({
      storage: localStorage,
      scope: {
        userId: destination.userId,
        workspaceId: destination.workspaceId,
        botId: destination.botId,
        conversationId: destination.conversationId,
      },
      lock: (key, operation) => navigator.locks.request(key, operation),
    }))
  }
  function stop() {
    controller.current?.abort()
    generation.current++
    clearTimeout(timer.current)
    working.current = false
    if (mounted.current) setBusy(false)
  }
  useEffect(() => {
    mounted.current = true
    function restore() {
      try {
        const saved = store().read()
        const changed = selectedKey.current !== (saved?.idempotencyKey ?? null)
        if (changed || saved?.handled) {
          stop()
          setAttempt(undefined)
          setError('')
        }
        selectedKey.current = saved?.idempotencyKey ?? null
        setRecord(saved && !saved.handled ? saved : null)
      } catch (cause) {
        stop()
        setError(
          cause instanceof Error
            ? cause.message
            : 'Retry recovery is unavailable.',
        )
      }
    }
    restore()
    const changed = (event: StorageEvent) => {
      if (event.key === service.current?.key || event.key === null) restore()
    }
    window.addEventListener('storage', changed)
    return () => {
      window.removeEventListener('storage', changed)
      mounted.current = false
      stop()
    }
  }, [destination.sessionKey])
  useEffect(() => {
    if (!visible) stop()
  }, [visible])

  async function advance(
    saved: RetryPreparationRecord,
    token: number,
    signal: AbortSignal,
    resume = false,
  ) {
    if (!mounted.current || token !== generation.current || signal.aborted)
      return
    try {
      const view = saved.attemptId
        ? await request<RetryAttemptView>(
            `retries/${saved.attemptId}${resume ? '/prepare' : ''}`,
            resume ? {} : undefined,
          )
        : await request<RetryAttemptView>(`${destination.apiPath}/retries`, {
            messageId: saved.messageId,
            idempotencyKey: saved.idempotencyKey,
          })
      const known = await store().rememberAttempt(
        saved.idempotencyKey,
        view.attemptId,
      )
      if (!mounted.current || token !== generation.current) return
      setRecord(known)
      setAttempt(view)
      if (view.status === 'ready' && view.target) {
        const navigated = await open.current(view.target, signal)
        // Successful navigation may unmount this source. Keep its receipt even
        // then, but a pause or stale completion must never finish a newer task.
        if (navigated) await store().markHandled(known.idempotencyKey)
        if (mounted.current && token === generation.current) {
          if (navigated) setRecord(null)
          stop()
        }
      } else if (view.status === 'failed' || view.error) {
        setError(view.error?.message ?? 'This retry could not be prepared.')
        stop()
      } else {
        // The copy alarm advances the branch. Once it is visible, finish the
        // file handoff with the same explicit command, never another attempt.
        timer.current = setTimeout(
          () => void advance(known, token, signal, !!view.target),
          1500,
        )
      }
    } catch (cause) {
      if (mounted.current && token === generation.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Preparation could not be confirmed.',
        )
        stop()
      }
    }
  }
  async function begin(messageId: string, restart = false) {
    if (working.current || !mounted.current || !visible) return
    controller.current?.abort()
    const command = new AbortController()
    controller.current = command
    working.current = true
    const token = ++generation.current
    setBusy(true)
    setError('')
    setAttempt(undefined)
    try {
      let saved =
        restart && record
          ? await store().restart(record.idempotencyKey, messageId)
          : await store().start(messageId)
      if (!mounted.current || token !== generation.current) return
      selectedKey.current = saved.idempotencyKey
      setRecord(saved)
      // A handled draft opens again until it has actually been sent. A later
      // deliberate click on the original request then starts a new attempt.
      if (!restart && saved.handled && saved.attemptId) {
        const previous = await request<RetryAttemptView>(
          `retries/${saved.attemptId}`,
        )
        if (!mounted.current || token !== generation.current) return
        if (previous.submittedMessageId)
          saved = await store().restart(saved.idempotencyKey, messageId)
      }
      if (!mounted.current || token !== generation.current) return
      selectedKey.current = saved.idempotencyKey
      setRecord(saved)
      await advance(saved, token, command.signal, !!saved.attemptId)
    } catch (cause) {
      if (mounted.current && token === generation.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Retry preparation is unavailable.',
        )
        stop()
      }
    }
  }
  return { record, attempt, error, busy, begin, stop }
}
