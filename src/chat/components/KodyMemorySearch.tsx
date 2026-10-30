import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  kodyMemoryChangeSchema,
  kodyMemoryCreateReviewSchema,
  kodyMemoryCreateSchema,
  kodyMemoryDetailSchema,
  kodyMemoryReviewSchema,
  kodyMemorySearchSchema,
  type KodyMemoryMatch,
} from '../core/kody-memory'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import { Button } from './ui/Button'

function KodyMemoryItem({
  item,
  userId,
  accountScope,
  readOnly,
}: {
  item: KodyMemoryMatch
  userId: string
  accountScope: string
  readOnly?: boolean
}) {
  const { request, workspaceId } = useWorkspaceApi()
  const queries = useQueryClient()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'update' | 'delete' | null>(null)
  const [draft, setDraft] = useState({ subject: '', summary: '', details: '' })
  const [review, setReview] = useState<ReturnType<
    typeof kodyMemoryReviewSchema.parse
  > | null>(null)
  const [operationId, setOperationId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const path = `kody/memories/${encodeURIComponent(item.id)}`
  const detail = useQuery({
    queryKey: [
      'kody-memory-detail',
      workspaceId,
      userId,
      accountScope,
      item.id,
      item.updatedAt,
    ],
    queryFn: async () => kodyMemoryDetailSchema.parse(await request(path)),
    enabled: open,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    retry: false,
  })
  function closeChange() {
    setMode(null)
    setReview(null)
    setError('')
  }
  function startChange(type: 'update' | 'delete') {
    if (!detail.data || readOnly || !item.canMutate || busy) return
    setDraft({
      subject: detail.data.subject,
      summary: detail.data.summary,
      details: detail.data.details,
    })
    setMode(type)
    setReview(null)
    setError('')
  }
  async function reviewChange() {
    if (!mode || !detail.data || busy) return
    setBusy(true)
    setError('')
    try {
      const input = kodyMemoryChangeSchema.parse({
        type: mode,
        expectedUpdatedAt: detail.data.updatedAt,
        ...(mode === 'update' ? draft : {}),
      })
      const checked = kodyMemoryReviewSchema.parse(
        await request(`${path}/review`, input, 'POST'),
      )
      if (checked.type !== mode)
        throw new Error('Kody returned a different memory change.')
      setReview(checked)
      setOperationId(crypto.randomUUID())
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Kody memory could not be reviewed.',
      )
    } finally {
      setBusy(false)
    }
  }
  async function applyChange() {
    if (!review || !mode || busy || readOnly) return
    setBusy(true)
    setError('')
    try {
      const changed = kodyMemoryDetailSchema.parse(
        await request(
          `${path}/apply`,
          { token: review.token, operationId },
          'POST',
        ),
      )
      if (
        changed.id !== item.id ||
        changed.status !== (mode === 'delete' ? 'deleted' : 'active')
      )
        throw new Error('Kody did not confirm the requested memory change.')
      closeChange()
      await Promise.all([
        queries.invalidateQueries({
          queryKey: ['kody-memory-search', workspaceId, userId, accountScope],
        }),
        queries.invalidateQueries({
          queryKey: [
            'kody-memory-detail',
            workspaceId,
            userId,
            accountScope,
            item.id,
          ],
        }),
      ])
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Check the current memory in Kody before trying again.',
      )
      if (cause instanceof ApiError && cause.status === 409) {
        setReview(null)
        void detail.refetch()
      }
    } finally {
      setBusy(false)
    }
  }
  return (
    <details
      className="kody-memory-item"
      onToggle={(event) => {
        setOpen(event.currentTarget.open)
        if (!event.currentTarget.open) closeChange()
      }}
    >
      <summary>
        <strong>{item.subject}</strong>
        <span>{item.summary}</span>
      </summary>
      {open && (
        <div className="kody-memory-detail">
          {detail.isFetching && <p role="status">Loading memory…</p>}
          {detail.isError && <p role="alert">{detail.error.message}</p>}
          {detail.data && !detail.isError && (
            <>
              {detail.data.status !== 'active' && (
                <p role="status">
                  {detail.data.status === 'deleted' ? 'Deleted' : 'Archived'} in
                  Kody
                </p>
              )}
              {detail.data.details && <p>{detail.data.details}</p>}
              {detail.data.category && <small>{detail.data.category}</small>}
              <small>
                Updated {new Date(detail.data.updatedAt).toLocaleString()}
              </small>
              {detail.data.status === 'active' &&
                item.canMutate &&
                !readOnly &&
                !mode && (
                  <div className="kody-memory-actions">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => startChange('update')}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startChange('delete')}
                    >
                      Forget
                    </Button>
                  </div>
                )}
              {mode && !review && (
                <div className="kody-memory-change">
                  {mode === 'update' ? (
                    <>
                      <label>
                        Subject
                        <input
                          value={draft.subject}
                          onChange={(event) =>
                            setDraft({ ...draft, subject: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Summary
                        <textarea
                          value={draft.summary}
                          onChange={(event) =>
                            setDraft({ ...draft, summary: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Details
                        <textarea
                          value={draft.details}
                          onChange={(event) =>
                            setDraft({ ...draft, details: event.target.value })
                          }
                        />
                      </label>
                    </>
                  ) : (
                    <p>
                      Forget this memory in Kody? It will no longer be used for
                      answers.
                    </p>
                  )}
                  <div className="kody-memory-actions">
                    <Button
                      size="sm"
                      onClick={() => void reviewChange()}
                      disabled={busy}
                    >
                      {busy ? 'Reviewing…' : 'Review change'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={closeChange}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {review && (
                <div className="kody-memory-change">
                  {mode === 'update' ? (
                    <div className="kody-memory-review-copy">
                      <strong>{draft.subject}</strong>
                      <p>{draft.summary}</p>
                      {draft.details && <p>{draft.details}</p>}
                    </div>
                  ) : (
                    <p>Forget this memory in Kody?</p>
                  )}
                  {review.related.length > 0 && (
                    <>
                      <strong>Related Kody memories</strong>
                      <ul>
                        {review.related.map((related) => (
                          <li key={related.id}>
                            <strong>{related.subject}</strong> {related.summary}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div className="kody-memory-actions">
                    <Button
                      size="sm"
                      onClick={() => void applyChange()}
                      disabled={busy}
                    >
                      {busy
                        ? 'Saving…'
                        : mode === 'delete'
                          ? 'Forget memory'
                          : 'Save correction'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={closeChange}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {error && <p role="alert">{error}</p>}
            </>
          )}
        </div>
      )}
    </details>
  )
}

export function KodyMemorySearch({
  userId,
  accountScope,
  visible,
  readOnly,
}: {
  userId: string
  accountScope: string
  visible: boolean
  readOnly?: boolean
}) {
  const { request, workspaceId } = useWorkspaceApi()
  const queries = useQueryClient()
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [memoryDraft, setMemoryDraft] = useState({
    subject: '',
    summary: '',
    details: '',
  })
  const [createReview, setCreateReview] = useState<ReturnType<
    typeof kodyMemoryCreateReviewSchema.parse
  > | null>(null)
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createdName, setCreatedName] = useState('')
  const search = useQuery({
    queryKey: ['kody-memory-search', workspaceId, userId, accountScope, query],
    queryFn: async () =>
      kodyMemorySearchSchema.parse(
        await request(`kody/memories?${new URLSearchParams({ query })}`),
      ),
    enabled: visible && !!query,
    staleTime: 0,
    refetchInterval: visible ? 60_000 : false,
    refetchIntervalInBackground: false,
    retry: false,
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    const input = draft.trim()
    if (!input || input.length > 200) {
      setError('Enter a search within 200 characters.')
      return
    }
    setError('')
    if (input === query) void search.refetch()
    else setQuery(input)
  }
  function closeCreate() {
    setCreating(false)
    setCreateReview(null)
    setCreateError('')
  }
  async function reviewCreate() {
    if (createBusy || readOnly) return
    setCreateBusy(true)
    setCreateError('')
    try {
      const candidate = kodyMemoryCreateSchema.parse(memoryDraft)
      const checked = kodyMemoryCreateReviewSchema.parse(
        await request('kody/memories/create/review', candidate, 'POST'),
      )
      setMemoryDraft(candidate)
      setCreateReview(checked)
    } catch (cause) {
      setCreateError(
        cause instanceof Error
          ? cause.message
          : 'Kody memory could not be reviewed.',
      )
    } finally {
      setCreateBusy(false)
    }
  }
  async function applyCreate() {
    if (!createReview || createReview.duplicateId || createBusy || readOnly)
      return
    setCreateBusy(true)
    setCreateError('')
    try {
      const memory = kodyMemoryDetailSchema.parse(
        await request(
          'kody/memories/create/apply',
          { token: createReview.token },
          'POST',
        ),
      )
      if (memory.status !== 'active')
        throw new Error('Kody did not confirm the saved memory.')
      setCreatedName(memory.subject)
      closeCreate()
      setMemoryDraft({ subject: '', summary: '', details: '' })
      await queries.invalidateQueries({
        queryKey: ['kody-memory-search', workspaceId, userId, accountScope],
      })
    } catch (cause) {
      setCreateError(
        cause instanceof Error
          ? cause.message
          : 'Search Kody memory before trying again.',
      )
      if (cause instanceof ApiError && cause.status === 409)
        setCreateReview(null)
    } finally {
      setCreateBusy(false)
    }
  }
  return (
    <section className="kody-memory-panel" aria-label="Kody memory">
      <form className="kody-memory-search" onSubmit={submit}>
        <input
          aria-label="Search Kody memory"
          placeholder="Search Kody memory"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" size="sm">
          Search
        </Button>
      </form>
      {!readOnly && !creating && (
        <Button
          className="kody-memory-create-trigger"
          size="sm"
          variant="secondary"
          onClick={() => {
            setCreatedName('')
            setCreating(true)
          }}
        >
          Add memory
        </Button>
      )}
      {createdName && <p role="status">Saved {createdName} in Kody.</p>}
      {creating && !readOnly && (
        <div className="kody-memory-change">
          {!createReview ? (
            <>
              <label>
                Subject
                <input
                  value={memoryDraft.subject}
                  onChange={(event) =>
                    setMemoryDraft({
                      ...memoryDraft,
                      subject: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Summary
                <textarea
                  value={memoryDraft.summary}
                  onChange={(event) =>
                    setMemoryDraft({
                      ...memoryDraft,
                      summary: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Details
                <textarea
                  value={memoryDraft.details}
                  onChange={(event) =>
                    setMemoryDraft({
                      ...memoryDraft,
                      details: event.target.value,
                    })
                  }
                />
              </label>
            </>
          ) : (
            <>
              <div className="kody-memory-review-copy">
                <strong>{memoryDraft.subject}</strong>
                <p>{memoryDraft.summary}</p>
                {memoryDraft.details && <p>{memoryDraft.details}</p>}
              </div>
              {createReview.related.length > 0 && (
                <>
                  <strong>Related Kody memories</strong>
                  <ul>
                    {createReview.related.map((related) => (
                      <li key={related.id}>
                        <strong>{related.subject}</strong> {related.summary}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {createReview.duplicateId && (
                <p role="status">This memory is already saved in Kody.</p>
              )}
            </>
          )}
          <div className="kody-memory-actions">
            <Button
              size="sm"
              onClick={() =>
                void (createReview ? applyCreate() : reviewCreate())
              }
              disabled={createBusy || !!createReview?.duplicateId}
            >
              {createBusy
                ? createReview
                  ? 'Saving…'
                  : 'Reviewing…'
                : createReview
                  ? 'Save memory'
                  : 'Review memory'}
            </Button>
            {createReview && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCreateReview(null)
                  setCreateError('')
                }}
                disabled={createBusy}
              >
                Edit
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={closeCreate}
              disabled={createBusy}
            >
              Cancel
            </Button>
          </div>
          {createError && <p role="alert">{createError}</p>}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {query && search.isFetching && <p role="status">Searching Kody…</p>}
      {search.isError && <p role="alert">{search.error.message}</p>}
      {search.data && !search.isError && (
        <>
          {search.data.items.map((item) => (
            <KodyMemoryItem
              key={item.id}
              item={item}
              userId={userId}
              accountScope={accountScope}
              readOnly={readOnly}
            />
          ))}
          {search.data.items.length === 0 && <p>No matching Kody memories.</p>}
        </>
      )}
    </section>
  )
}
