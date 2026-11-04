import { ThreadLifecycle } from './ThreadLifecycle'
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, X } from 'lucide-react'
import type { ThreadSummary } from '../core/conversation-threads'
import { IconButton } from './IconButton'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import {
  ThreadRenameStore,
  threadRenameKey,
  type ThreadRenameCommand,
} from './thread-lifecycle-store'

type ThreadTitleProps = {
  thread: ThreadSummary
  userId: string
  disabled?: boolean
}

export function ThreadTitle(props: ThreadTitleProps) {
  const { workspaceId } = useWorkspaceApi()
  return (
    <ThreadTitleEditor
      key={JSON.stringify([
        workspaceId,
        props.userId,
        props.thread.conversationId,
      ])}
      {...props}
    />
  )
}

function ThreadTitleEditor({
  thread,
  userId,
  disabled = false,
}: ThreadTitleProps) {
  const { request, workspaceId } = useWorkspaceApi()
  const queries = useQueryClient()
  const [draft, setDraft] = useState<{ title: string; version: number }>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const editorInput = useRef<HTMLInputElement>(null)
  const isEditing = !!draft
  useEffect(() => {
    if (isEditing) editorInput.current?.focus()
  }, [isEditing])
  const trigger = useRef<HTMLButtonElement>(null)
  const lock = useRef(false)
  const [pending, setPending] = useState<ThreadRenameCommand>()
  const [ready, setReady] = useState(false)
  const recoveryKey = threadRenameKey(
    workspaceId,
    userId,
    thread.conversationId,
  )
  useEffect(() => {
    try {
      const command = new ThreadRenameStore(localStorage, recoveryKey).read()
      if (command) {
        setPending(command)
        setDraft({ title: command.title, version: command.expectedVersion })
      }
      setReady(true)
    } catch {
      setError('The saved rename could not be read on this device.')
    }
  }, [recoveryKey])
  const finish = () => {
    setDraft(undefined)
    setError('')
    requestAnimationFrame(() => trigger.current?.focus())
  }
  async function save() {
    if (!draft || lock.current || disabled || !ready) return
    lock.current = true
    setSaving(true)
    setError('')
    try {
      if (!navigator.locks)
        throw Error('This browser cannot safely coordinate thread changes.')
      await navigator.locks.request(recoveryKey, async () => {
        const store = new ThreadRenameStore(localStorage, recoveryKey)
        const command = store.save(
          store.read() ?? {
            type: 'rename',
            title: draft.title,
            expectedVersion: draft.version,
          },
        )
        setPending(command)
        setDraft({ title: command.title, version: command.expectedVersion })
        try {
          await request(
            `conversations/${encodeURIComponent(thread.conversationId)}/thread`,
            command,
          )
          store.clear(command)
          setPending(undefined)
          finish()
        } catch (cause) {
          if (
            cause instanceof ApiError &&
            [400, 401, 403, 404, 409].includes(cause.status)
          ) {
            store.clear(command)
            setPending(undefined)
            setError(
              cause.status === 409
                ? 'This thread changed. Cancel and reopen to review its current name.'
                : cause.message,
            )
          } else {
            setError(
              'The rename could not be confirmed. Retry to check the same request.',
            )
          }
        }
        await Promise.all([
          queries.invalidateQueries({ queryKey: ['conversation-thread'] }),
          queries.invalidateQueries({ queryKey: ['conversation-threads'] }),
        ])
      })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The rename could not be saved on this device.',
      )
    } finally {
      lock.current = false
      setSaving(false)
    }
  }
  return (
    <div className="thread-title-editor">
      {draft ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <input
            ref={editorInput}
            aria-label="Thread name"
            maxLength={80}
            value={draft.title}
            disabled={saving || disabled || !!pending}
            onChange={(event) =>
              setDraft({ ...draft, title: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !saving && !pending) {
                event.preventDefault()
                event.stopPropagation()
                finish()
              }
            }}
          />
          <IconButton
            type="submit"
            label={pending ? 'Retry thread rename' : 'Save thread name'}
            disabled={saving || disabled || !ready || !draft.title.trim()}
          >
            <Check size={14} aria-hidden />
          </IconButton>
          <IconButton
            type="button"
            label="Cancel thread rename"
            disabled={saving || !!pending}
            onClick={finish}
          >
            <X size={14} aria-hidden />
          </IconButton>
        </form>
      ) : (
        <>
          <strong>{thread.title}</strong>
          <IconButton
            ref={trigger}
            label="Rename thread"
            disabled={disabled || !ready}
            onClick={() => {
              setDraft({ title: thread.title, version: thread.version })
              setError('')
            }}
          >
            <Pencil size={14} aria-hidden />
          </IconButton>
        </>
      )}
      {!draft && (
        <ThreadLifecycle
          key={thread.conversationId}
          thread={thread}
          userId={userId}
          disabled={disabled}
        />
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
