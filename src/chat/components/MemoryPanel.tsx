import { LoadingState } from './ui/LoadingState'
import { Button } from './ui/Button'
import { useEffect, useRef, useState } from 'react'
import { editedMemoryExpiry, formatMemoryExpiry } from '../core/memory-expiry'
import { MemoryCommandStore, memoryCommandKey } from './memory-command-store'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { z } from 'zod'
import { MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  memoryCommandSchema,
  memoryRecordSchema,
  type MemoryCommand,
  type MemoryRecord,
} from '../core/memory'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import { IconButton } from './IconButton'
import { KodyMemorySearch } from './KodyMemorySearch'
import './memory.css'

const pageSchema = z.object({
  items: z.array(memoryRecordSchema),
  nextAfterId: z.string().optional(),
})
export function MemoryPanel(props: {
  conversationId: string
  userId: string
  readOnly?: boolean
  runVersion?: string
  onSourceMessage?: (id: string) => void
  kodyAvailable?: boolean
  kodyAccountScope?: string
}) {
  const api = useWorkspaceApi()
  const [source, setSource] = useState<'conversation' | 'kody'>('conversation')
  const [visitedKody, setVisitedKody] = useState(false)
  const showKody = !!props.kodyAvailable && source === 'kody'
  return (
    <div className="memory-source-panel">
      {props.kodyAvailable && (
        <div className="memory-source-switch" aria-label="Memory source">
          <Button
            size="sm"
            variant={showKody ? 'ghost' : 'secondary'}
            aria-pressed={!showKody}
            onClick={() => setSource('conversation')}
          >
            This conversation
          </Button>
          <Button
            size="sm"
            variant={showKody ? 'secondary' : 'ghost'}
            aria-pressed={showKody}
            onClick={() => {
              setVisitedKody(true)
              setSource('kody')
            }}
          >
            Kody
          </Button>
        </div>
      )}
      <div hidden={showKody}>
        <MemoryContents
          key={JSON.stringify([
            api.workspaceId,
            props.userId,
            props.conversationId,
          ])}
          {...props}
        />
      </div>
      {props.kodyAvailable && visitedKody && (
        <div hidden={!showKody}>
          <KodyMemorySearch
            userId={props.userId}
            accountScope={props.kodyAccountScope ?? props.userId}
            visible={showKody}
            readOnly={props.readOnly}
          />
        </div>
      )}
    </div>
  )
}
function MemoryContents({
  conversationId,
  userId,
  readOnly,
  runVersion,
  onSourceMessage,
}: {
  conversationId: string
  userId: string
  readOnly?: boolean
  runVersion?: string
  onSourceMessage?: (id: string) => void
}) {
  const api = useWorkspaceApi(),
    client = useQueryClient()
  const searchRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const forgetRef = useRef<HTMLButtonElement>(null)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  function closeEditor() {
    setError('')
    setEditor(null)
    setForget(null)
    searchRef.current?.focus()
  }
  const [query, setQuery] = useState(''),
    [editor, setEditor] = useState<{
      id: string
      revision?: number
      title: string
      body: string
      expiry: string
      expiresAt: number | null
    } | null>(null)
  const [forget, setForget] = useState<MemoryRecord | null>(null)
  const [pending, setPending] = useState<MemoryCommand | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const recoveryKey = memoryCommandKey(api.workspaceId, userId, conversationId)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const recover = () => {
      try {
        setPending(new MemoryCommandStore(localStorage, recoveryKey).read())
        setReady(true)
      } catch {
        setReady(false)
        setError(
          'The saved memory request could not be recovered on this device.',
        )
      }
    }
    recover()
    const changed = (event: StorageEvent) => {
      if (event.key === recoveryKey || event.key === null) recover()
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [recoveryKey])
  useEffect(() => {
    if (editor) titleRef.current?.focus()
  }, [editor?.id])
  useEffect(() => {
    if (forget) forgetRef.current?.focus()
  }, [forget?.id])
  const path = `conversations/${encodeURIComponent(conversationId)}/memories`
  const key = ['memories', api.workspaceId, userId, conversationId]
  const preferences = useQuery({
    queryKey: [...key, 'preferences'],
    queryFn: async () =>
      z
        .object({
          enabled: z.boolean(),
          revision: z.number().int().nonnegative(),
        })
        .parse(await api.request(path + '/preferences')),
  })
  const [changingRecall, setChangingRecall] = useState(false)
  async function setRecall(enabled: boolean) {
    if (!preferences.data || changingRecall || readOnly) return
    setChangingRecall(true)
    setError('')
    try {
      await api.request(path + '/preferences', {
        enabled,
        expectedRevision: preferences.data.revision,
      })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Recall could not be changed.',
      )
    } finally {
      await preferences.refetch()
      setChangingRecall(false)
    }
  }
  useEffect(() => {
    void client.invalidateQueries({
      queryKey: ['memories', api.workspaceId, userId, conversationId],
    })
  }, [client, api.workspaceId, userId, conversationId, runVersion])
  const list = useInfiniteQuery({
    queryKey: [...key, query],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) =>
      pageSchema.parse(
        await api.request(
          `${path}?${new URLSearchParams({ query, ...(pageParam ? { afterId: pageParam } : {}) })}`,
          undefined,
          'GET',
          { signal },
        ),
      ),
    getNextPageParam: (page) => page.nextAfterId,
  })
  async function send(command: MemoryCommand) {
    if (busy || readOnly || !ready) return
    setBusy(true)
    setError('')
    try {
      if (!navigator.locks)
        throw Error(
          'This browser cannot safely coordinate memory edits. Use a browser with Web Locks support.',
        )
      await navigator.locks.request(recoveryKey, async () => {
        const store = new MemoryCommandStore(localStorage, recoveryKey)
        const existing = store.read()
        if (existing && JSON.stringify(existing) !== JSON.stringify(command)) {
          setPending(existing)
          throw Error(
            'Resolve the saved memory request before making another change.',
          )
        }
        const saved = store.save(command)
        setPending(saved)
        try {
          await api.request(path, saved)
        } catch (cause) {
          if (
            cause instanceof ApiError &&
            cause.status >= 400 &&
            cause.status < 500 &&
            cause.status !== 408 &&
            cause.status !== 429
          ) {
            store.clear(saved.commandId)
            setPending(null)
            if (cause.status === 409)
              await client.invalidateQueries({ queryKey: key })
          }
          throw cause
        }
        store.clear(saved.commandId)
        setPending(null)
        closeEditor()
        await client.invalidateQueries({ queryKey: key })
      })
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 409
          ? 'Memory changed or is unavailable. Cancel and reopen it to review the latest version. Your draft has not been saved.'
          : cause instanceof Error
            ? cause.message
            : 'Memory could not be saved.',
      )
    } finally {
      setBusy(false)
    }
  }
  function save() {
    if (!editor) return
    try {
      const { id, revision, title, body, expiry } = editor
      const expiresAt = editedMemoryExpiry(expiry, timeZone, editor.expiresAt)
      void send(
        memoryCommandSchema.parse({
          id,
          commandId: crypto.randomUUID(),
          ...(revision
            ? { type: 'update', expectedRevision: revision }
            : { type: 'create' }),
          document: { title, body, expiresAt },
        }),
      )
    } catch (cause) {
      setError(
        cause instanceof z.ZodError
          ? 'Add a title and saved text within the size limits.'
          : cause instanceof Error
            ? cause.message
            : 'Check the memory fields.',
      )
    }
  }
  return (
    <section className="memory-panel" aria-label="Memory">
      <div className="memory-toolbar">
        <input
          ref={searchRef}
          aria-label="Search memory"
          placeholder="Search memory"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <IconButton
          label="Save a memory"
          disabled={!ready || readOnly || busy || !!pending}
          onClick={() => {
            setForget(null)
            setEditor({
              id: crypto.randomUUID(),
              title: '',
              body: '',
              expiry: '',
              expiresAt: null,
            })
            setError('')
          }}
        >
          <Plus size={16} />
        </IconButton>
      </div>
      <label className="memory-recall">
        <input
          type="checkbox"
          checked={preferences.data?.enabled ?? false}
          disabled={
            !preferences.data ||
            preferences.isFetching ||
            changingRecall ||
            readOnly
          }
          onChange={(event) => void setRecall(event.target.checked)}
        />
        Use saved memory
      </label>
      <p className="memory-note">
        Private to this conversation. Turning this off stops new reads, but
        cannot remove text already sent in a task.
      </p>
      {preferences.isError && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => void preferences.refetch()}
        >
          Retry recall settings
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
      {pending && !busy && (
        <Button
          variant="secondary"
          type="button"
          onClick={() => void send(pending)}
        >
          Retry saved request
        </Button>
      )}
      {editor && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
          className="memory-editor"
        >
          <label>
            Title
            <input
              ref={titleRef}
              maxLength={120}
              value={editor.title}
              disabled={busy || !!pending}
              onChange={(e) => setEditor({ ...editor, title: e.target.value })}
            />
          </label>
          <label>
            Saved text
            <textarea
              maxLength={8000}
              rows={5}
              value={editor.body}
              disabled={busy || !!pending}
              onChange={(e) => setEditor({ ...editor, body: e.target.value })}
            />
          </label>
          <label>
            Expires ({timeZone})
            <input
              type="datetime-local"
              value={editor.expiry}
              disabled={busy || !!pending}
              onChange={(event) =>
                setEditor({ ...editor, expiry: event.target.value })
              }
            />
          </label>
          <div>
            <Button
              type="submit"
              variant="secondary"
              disabled={busy || !!pending || readOnly}
            >
              Save
            </Button>
            <Button
              variant="secondary"
              type="button"
              disabled={busy || !!pending}
              onClick={closeEditor}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {forget && (
        <div className="memory-editor" role="group" aria-label="Forget memory">
          <p>
            Forget “{forget.title}”? Earlier messages containing it will remain.
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !!pending || readOnly}
            onClick={() =>
              void send({
                type: 'delete',
                id: forget.id,
                expectedRevision: forget.revision,
                commandId: crypto.randomUUID(),
              })
            }
          >
            Forget
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !!pending}
            ref={forgetRef}
            onClick={closeEditor}
          >
            Cancel
          </Button>
        </div>
      )}
      {list.isPending ? (
        <LoadingState>Loading memory…</LoadingState>
      ) : list.isError ? (
        <div role="alert">
          <p>{list.error.message}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void list.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          {list.data.pages
            .flatMap((page) => page.items)
            .map((item) => (
              <article key={item.id} className="memory-item">
                <div className="memory-toolbar">
                  <strong>{item.title}</strong>
                  {item.sourceMessageId && onSourceMessage && (
                    <IconButton
                      label={`View original source for ${item.title}`}
                      onClick={() => onSourceMessage(item.sourceMessageId!)}
                    >
                      <MessageSquare size={15} />
                    </IconButton>
                  )}
                  <IconButton
                    label={`Edit ${item.title}`}
                    disabled={!ready || readOnly || busy || !!pending}
                    onClick={() => {
                      setForget(null)
                      setEditor({
                        ...item,
                        expiry: formatMemoryExpiry(item.expiresAt, timeZone),
                      })
                      setError('')
                    }}
                  >
                    <Pencil size={15} />
                  </IconButton>
                  <IconButton
                    label={`Forget ${item.title}`}
                    disabled={!ready || readOnly || busy || !!pending}
                    onClick={() => {
                      setEditor(null)
                      setForget(item)
                    }}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </div>
                <p>{item.body}</p>
                <small>
                  Updated {new Date(item.updatedAt).toLocaleString()}
                  {item.expiresAt
                    ? ` · Expires ${new Date(item.expiresAt).toLocaleString()}`
                    : ''}
                </small>
              </article>
            ))}
          {!list.data.pages.some((page) => page.items.length) && (
            <p>No saved memories.</p>
          )}
          {list.hasNextPage && (
            <Button
              type="button"
              variant="secondary"
              disabled={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              Load more
            </Button>
          )}
        </>
      )}
    </section>
  )
}
