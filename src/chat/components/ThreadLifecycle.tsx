import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, RotateCcw } from 'lucide-react'
import type { ThreadSummary } from '../core/conversation-threads'
import { IconButton } from './IconButton'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'

import {
  ThreadLifecycleStore,
  threadLifecycleKey,
  type ThreadLifecycleCommand as Command,
} from './thread-lifecycle-store'

export function ThreadLifecycle({
  thread,
  userId,
  disabled = false,
}: {
  thread: ThreadSummary
  userId: string
  disabled?: boolean
}) {
  const { request, workspaceId } = useWorkspaceApi()
  const queries = useQueryClient()
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState<Command>()
  const [error, setError] = useState('')
  const recoveryKey = threadLifecycleKey(
    workspaceId,
    userId,
    thread.conversationId,
  )
  const [ready, setReady] = useState(false)
  useEffect(() => {
    try {
      setRetry(
        new ThreadLifecycleStore(localStorage, recoveryKey).read() ?? undefined,
      )
      setReady(true)
    } catch {
      setError('The saved thread change could not be read on this device.')
      setReady(false)
    }
  }, [recoveryKey])
  async function change() {
    if (lock.current || disabled || !ready) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      if (!navigator.locks)
        throw Error('This browser cannot safely coordinate thread changes.')
      await navigator.locks.request(recoveryKey, async () => {
        const store = new ThreadLifecycleStore(localStorage, recoveryKey)
        const command = store.read() ?? {
          type: 'archive' as const,
          archived: thread.archivedAt === null,
          expectedVersion: thread.version,
        }
        store.save(command)
        setRetry(command)
        try {
          await request(
            `conversations/${encodeURIComponent(thread.conversationId)}/thread`,
            command,
          )
          store.clear(command)
          setRetry(undefined)
          await Promise.all([
            queries.invalidateQueries({ queryKey: ['conversation-thread'] }),
            queries.invalidateQueries({ queryKey: ['conversation-threads'] }),
          ])
        } catch (cause) {
          if (
            cause instanceof ApiError &&
            [400, 401, 403, 404, 409].includes(cause.status)
          ) {
            store.clear(command)
            setRetry(undefined)
            setError(cause.message)
            void queries.invalidateQueries({
              queryKey: ['conversation-thread'],
            })
          } else {
            setError(
              'The change could not be confirmed. Retry to check the same request.',
            )
          }
        }
      })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The thread change could not be saved on this device.',
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <div className="thread-lifecycle">
      {thread.archivedAt !== null && <span>Archived</span>}
      <IconButton
        label={
          retry
            ? 'Retry thread change'
            : thread.archivedAt === null
              ? 'Archive thread'
              : 'Restore thread'
        }
        disabled={disabled || busy || !ready}
        onClick={() => void change()}
      >
        {retry ? (
          <RotateCcw size={14} aria-hidden />
        ) : thread.archivedAt === null ? (
          <Archive size={14} aria-hidden />
        ) : (
          <ArchiveRestore size={14} aria-hidden />
        )}
      </IconButton>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
