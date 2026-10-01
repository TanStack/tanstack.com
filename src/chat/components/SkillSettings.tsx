import { LoadingState } from './ui/LoadingState'
import { Button } from './ui/Button'
import { SelectField } from './SelectField'
import { useEffect, useId, useRef, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Menu } from '@base-ui/react/menu'
import { Tooltip } from '@base-ui/react/tooltip'
import { ArrowLeft, Download, MoreHorizontal, Upload } from 'lucide-react'
import { z } from 'zod'
import {
  maxSkillImportBytes,
  parseSkillMarkdown,
  serializeSkillMarkdown,
  skillDocumentSchema,
  skillCommandSchema,
  skillSummarySchema,
  skillVersionSchema,
  type SkillCommand,
  type SkillDocument,
  type SkillSummary,
  type SkillVersion,
} from '../core/skills'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import { IconButton } from './IconButton'
import { SkillPreview } from './SkillPreview'
import './skills.css'
import './message-references.css'

export function skillErrorMessage(cause: unknown) {
  return cause instanceof z.ZodError
    ? (cause.issues[0]?.message ?? 'Check the skill fields.')
    : cause instanceof Error
      ? cause.message
      : 'The skill could not be saved.'
}
export function definiteSkillRejection(cause: unknown): cause is ApiError {
  return (
    cause instanceof ApiError &&
    cause.status >= 400 &&
    cause.status < 500 &&
    cause.status !== 408 &&
    cause.status !== 429
  )
}
const listSchema = z.object({
  items: z.array(skillSummarySchema),
  nextCursor: z.string().optional(),
})
type Editor = {
  id: string
  source?: SkillVersion
  expectedRevision?: number
  document: SkillDocument
  imported?: boolean
}

type SkillStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export const skillCommandStorageKey = (userId: string, workspaceId?: string) =>
  JSON.stringify(['gum', 'skill-command', 1, userId, workspaceId])
export class SkillCommandStore {
  constructor(
    private storage: SkillStorage,
    readonly key: string,
  ) {}
  read(): SkillCommand | null {
    const raw = this.storage.getItem(this.key)
    if (raw === null) return null
    if (raw.length > 40_000)
      throw Error('The saved skill request could not be recovered.')
    return skillCommandSchema.parse(JSON.parse(raw))
  }
  create(command: SkillCommand) {
    const pending = this.read()
    if (pending) return pending
    const parsed = skillCommandSchema.parse(command)
    const text = JSON.stringify(parsed)
    if (text.length > 40_000)
      throw Error('The skill request is too large to save on this device.')
    this.storage.setItem(this.key, text)
    if (this.storage.getItem(this.key) !== text)
      throw Error('The skill request could not be saved on this device.')
    return parsed
  }
  clear(commandId: string) {
    if (this.read()?.commandId !== commandId) return
    this.storage.removeItem(this.key)
    if (this.storage.getItem(this.key) !== null)
      throw Error(
        'The confirmed skill request could not be cleared on this device.',
      )
  }
}

export function SkillSettings({ userId }: { userId: string }) {
  const { workspaceId } = useWorkspaceApi()
  return (
    <PrivateSkillSettings
      key={JSON.stringify([userId, workspaceId])}
      userId={userId}
    />
  )
}

function PrivateSkillSettings({ userId }: { userId: string }) {
  const { workspaceId, request } = useWorkspaceApi()
  const queries = useQueryClient()
  const [search, setSearch] = useState('')
  const [archived, setArchived] = useState(false)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [externalPreview, setExternalPreview] = useState<SkillVersion | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<SkillCommand | null>(null)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [preview, setPreview] = useState(false)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const nameInput = useRef<HTMLInputElement>(null)
  const editingFields = !!editor && !preview
  useEffect(() => {
    if (editingFields) nameInput.current?.focus()
  }, [editingFields])
  const picker = useRef<HTMLInputElement>(null)
  const portalContainer = useRef<HTMLDivElement>(null)
  const exportUrl = useRef<string | null>(null)
  const nameHelpId = useId()
  const heading = useRef<HTMLButtonElement>(null)
  const searchField = useRef<HTMLInputElement>(null)
  const menuTriggers = useRef(new Map<string, HTMLElement>())
  const locked = useRef(false)
  const mounted = useRef(false)
  const recoveryKey = skillCommandStorageKey(userId, workspaceId)
  const recover = () => {
    try {
      const saved = new SkillCommandStore(localStorage, recoveryKey).read()
      setPending(saved)
      setRecoveryReady(true)
      if (saved) {
        setError('A saved skill request is awaiting confirmation.')
        if (saved.type === 'create' || saved.type === 'update')
          setEditor(
            (current) =>
              current ?? {
                id: saved.id,
                document: saved.document,
                ...(saved.type === 'update'
                  ? { expectedRevision: saved.expectedRevision }
                  : {}),
              },
          )
      } else setError('')
    } catch {
      setRecoveryReady(false)
      setError('The saved skill request could not be recovered on this device.')
    }
  }
  useEffect(() => {
    mounted.current = true
    recover()
    const changed = (event: StorageEvent) => {
      if (event.key === recoveryKey || event.key === null) {
        recover()
        void invalidate()
      }
    }
    window.addEventListener('storage', changed)
    return () => {
      mounted.current = false
      window.removeEventListener('storage', changed)
      if (exportUrl.current) URL.revokeObjectURL(exportUrl.current)
    }
  }, [])
  const list = useInfiniteQuery({
    queryKey: ['private-skills', userId, workspaceId, archived, search],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        query: search,
        archived: String(archived),
      })
      if (pageParam) params.set('cursor', pageParam)
      return listSchema.parse(await request(`skills?${params}`))
    },
    getNextPageParam: (page) => page.nextCursor,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })
  const externalList = useInfiniteQuery({
    queryKey: ['external-skills', userId, workspaceId, search],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ catalog: 'external', query: search })
      if (pageParam) params.set('cursor', pageParam)
      return listSchema.parse(await request(`skills?${params}`))
    },
    getNextPageParam: (page) => page.nextCursor,
    enabled: !archived,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: false,
  })
  const invalidate = () =>
    Promise.all([
      queries.invalidateQueries({
        queryKey: ['private-skills', userId, workspaceId],
      }),
      queries.invalidateQueries({
        queryKey: ['skill-version', userId, workspaceId],
      }),
      queries.invalidateQueries({
        queryKey: ['reference-catalog', userId, workspaceId, 'skill'],
      }),
      queries.invalidateQueries({
        queryKey: ['external-skills', userId, workspaceId],
      }),
    ])
  async function command(value: SkillCommand) {
    if (locked.current || !recoveryReady) return
    locked.current = true
    setBusy(true)
    setError('')
    setConflict(false)
    try {
      if (!navigator.locks)
        throw Error('Use an up-to-date browser to save skill changes safely.')
      await navigator.locks.request(recoveryKey, async () => {
        if (!mounted.current) return
        const store = new SkillCommandStore(localStorage, recoveryKey)
        const frozen = store.create(value)
        if (mounted.current) setPending(frozen)
        if (frozen.commandId !== value.commandId)
          throw Error(
            'Another skill change is awaiting confirmation. Retry that saved request first.',
          )
        try {
          skillVersionSchema.parse(await request('skills', frozen))
        } catch (cause) {
          if (definiteSkillRejection(cause)) store.clear(frozen.commandId)
          throw cause
        }
        store.clear(frozen.commandId)
      })
      await invalidate()
      if (mounted.current) {
        setPending(null)
        setEditor((current) => {
          if (current?.id !== value.id) return current
          if (
            (value.type === 'create' || value.type === 'update') &&
            JSON.stringify(current.document) !== JSON.stringify(value.document)
          )
            return current
          return null
        })
        setPreview(false)
        requestAnimationFrame(() => searchField.current?.focus())
      }
    } catch (cause) {
      if (mounted.current) {
        setError(skillErrorMessage(cause))
        // A definite rejection can be corrected. An uncertain result retries
        // the original command ID and payload instead of creating another skill.
        if (definiteSkillRejection(cause)) {
          setPending(null)
          setConflict(cause.status === 409)
        }
      }
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function loadSkill(
    skill: Pick<SkillSummary, 'id' | 'version'>,
    latest = false,
  ) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      const loaded = skillVersionSchema.parse(
        await request(
          `skills/${encodeURIComponent(skill.id)}${latest ? '' : `?version=${skill.version}`}`,
        ),
      )
      if (mounted.current) {
        setEditor({ id: loaded.id, source: loaded, document: loaded.document })
        setPreview(loaded.archived)
        setConflict(false)
      }
    } catch (cause) {
      if (mounted.current) setError(skillErrorMessage(cause))
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function loadExternalSkill(skill: SkillSummary) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      const loaded = skillVersionSchema.parse(
        await request(
          `skills/${encodeURIComponent(skill.id)}?version=${skill.version}`,
        ),
      )
      if (mounted.current) setExternalPreview(loaded)
    } catch (cause) {
      if (mounted.current) setError(skillErrorMessage(cause))
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function exportSkill(skill: SkillSummary) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      const saved = skillVersionSchema.parse(
        await request(
          `skills/${encodeURIComponent(skill.id)}?version=${skill.version}`,
        ),
      )
      if (!mounted.current) return
      if (exportUrl.current) URL.revokeObjectURL(exportUrl.current)
      const url = URL.createObjectURL(
        new Blob([serializeSkillMarkdown(saved.document)], {
          type: 'text/markdown;charset=utf-8',
        }),
      )
      exportUrl.current = url
      const link = document.createElement('a')
      link.href = url
      link.download = 'SKILL.md'
      portalContainer.current?.append(link)
      link.click()
      link.remove()
    } catch (cause) {
      if (mounted.current) setError(skillErrorMessage(cause))
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function importSkill(file: File) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    try {
      if (file.size > maxSkillImportBytes)
        throw Error('Choose a SKILL.md file up to 32 KiB.')
      const document = parseSkillMarkdown(
        new TextDecoder('utf-8', { fatal: true }).decode(
          await file.arrayBuffer(),
        ),
      )
      if (mounted.current) {
        setEditor({ id: crypto.randomUUID(), document, imported: true })
        setPreview(false)
      }
    } catch (cause) {
      if (mounted.current) setError(skillErrorMessage(cause))
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  function save() {
    if (!editor || busy || pending) return
    const parsed = skillDocumentSchema.safeParse(editor.document)
    if (!parsed.success) {
      setError(skillErrorMessage(parsed.error))
      return
    }
    const expectedRevision = editor.source?.revision ?? editor.expectedRevision
    void command(
      expectedRevision !== undefined
        ? {
            type: 'update',
            id: editor.id,
            commandId: crypto.randomUUID(),
            expectedRevision,
            document: parsed.data,
          }
        : {
            type: 'create',
            id: editor.id,
            commandId: crypto.randomUUID(),
            document: parsed.data,
          },
    )
  }
  const rowCommand = (
    skill: SkillSummary,
    type: 'archive' | 'restore' | 'enabled',
  ) => {
    const common = {
      id: skill.id,
      commandId: crypto.randomUUID(),
      expectedRevision: skill.revision,
    }
    void command(
      type === 'enabled'
        ? { ...common, type, enabled: !skill.enabled }
        : { ...common, type },
    )
  }
  const disabled = busy || !!pending || !recoveryReady
  const shown = list.data?.pages.flatMap((page) => page.items) ?? []
  const external = externalList.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <div className="skill-settings" ref={portalContainer}>
      {externalPreview ? (
        <div className="skill-editor">
          <div className="skill-editor-heading">
            <IconButton
              label="Back to skills"
              onClick={() => {
                setExternalPreview(null)
                setError('')
                requestAnimationFrame(() => searchField.current?.focus())
              }}
            >
              <ArrowLeft size={16} aria-hidden />
            </IconButton>
            <strong>{externalPreview.name}</strong>
          </div>
          <SkillPreview skill={externalPreview} />
        </div>
      ) : editor ? (
        <div className="skill-editor">
          <div className="skill-editor-heading">
            <IconButton
              ref={heading}
              label="Back to skills"
              disabled={disabled}
              onClick={() => {
                setEditor(null)
                setPreview(false)
                setError('')
                setConflict(false)
                requestAnimationFrame(() => searchField.current?.focus())
              }}
            >
              <ArrowLeft size={16} aria-hidden />
            </IconButton>
            <strong>
              {editor.source
                ? editor.source.name
                : editor.expectedRevision
                  ? 'Edit skill'
                  : 'New skill'}
            </strong>
            {editor.source && (
              <IconButton
                label="Export SKILL.md"
                disabled={disabled}
                onClick={() => void exportSkill(editor.source!)}
              >
                <Download size={16} aria-hidden />
              </IconButton>
            )}
          </div>
          {editor.imported && (
            <p className="skill-scope">
              Only this SKILL.md is imported. Referenced scripts and files are
              not included.
            </p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            {preview ? (
              <SkillPreview
                unsaved={!editor.source?.archived}
                skill={{
                  version: editor.source?.version ?? 1,
                  document: editor.document,
                }}
              />
            ) : (
              <div className="skill-editor-fields">
                <label>
                  Name
                  <input
                    ref={nameInput}
                    required
                    aria-label="Name"
                    aria-describedby={nameHelpId}
                    value={editor.document.name}
                    disabled={disabled}
                    onChange={(event) =>
                      setEditor({
                        ...editor,
                        document: {
                          ...editor.document,
                          name: event.target.value,
                        },
                      })
                    }
                  />
                  <span className="skill-editor-help" id={nameHelpId}>
                    Lowercase words with hyphens, such as weekly-update.
                  </span>
                </label>
                <label>
                  Description
                  <textarea
                    required
                    rows={2}
                    maxLength={1024}
                    value={editor.document.description}
                    disabled={disabled}
                    onChange={(event) =>
                      setEditor({
                        ...editor,
                        document: {
                          ...editor.document,
                          description: event.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Instructions
                  <textarea
                    required
                    rows={12}
                    maxLength={12000}
                    value={editor.document.instructions}
                    disabled={disabled}
                    onChange={(event) =>
                      setEditor({
                        ...editor,
                        document: {
                          ...editor.document,
                          instructions: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              </div>
            )}
            <div className="skill-editor-actions">
              {!editor.source?.archived && (
                <>
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={disabled}
                    onClick={() => setPreview(!preview)}
                  >
                    {preview ? 'Edit' : 'Preview'}
                  </Button>
                  <Button type="submit" variant="primary" disabled={disabled}>
                    Save
                  </Button>
                </>
              )}
              {editor.source?.archived && (
                <Button
                  variant="secondary"
                  type="button"
                  disabled={disabled}
                  onClick={() => rowCommand(editor.source!, 'restore')}
                >
                  Restore disabled
                </Button>
              )}
            </div>
          </form>
        </div>
      ) : (
        <>
          <div className="skill-settings-toolbar">
            <input
              ref={searchField}
              type="search"
              aria-label="Search skills"
              placeholder="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              disabled={disabled}
            />
            <SelectField
              aria-label="Skill filter"
              value={String(archived)}
              onValueChange={(value) => setArchived(value === 'true')}
              disabled={disabled}
              items={[
                {
                  value: 'false',
                  label: 'Current',
                },
                {
                  value: 'true',
                  label: 'Archived',
                },
              ]}
            />
            <Button
              variant="secondary"
              type="button"
              disabled={disabled}
              onClick={() => {
                setEditor({
                  id: crypto.randomUUID(),
                  document: { name: '', description: '', instructions: '' },
                })
                setError('')
                setPreview(false)
              }}
            >
              New
            </Button>
            <IconButton
              label="Import SKILL.md"
              disabled={disabled}
              onClick={() => picker.current?.click()}
            >
              <Upload size={16} aria-hidden />
            </IconButton>
            <input
              ref={picker}
              hidden
              type="file"
              accept=".md,text/markdown,text/plain"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void importSkill(file)
              }}
            />
          </div>
          {list.isError ? (
            <p className="skill-error" role="alert">
              {skillErrorMessage(list.error)}{' '}
              <Button
                variant="secondary"
                type="button"
                onClick={() => void list.refetch()}
              >
                Retry
              </Button>
            </p>
          ) : !list.isFetchedAfterMount ? (
            <LoadingState>Loading…</LoadingState>
          ) : (
            <>
              {!!shown.length && <h3>Personal</h3>}
              <ul className="skill-list">
                {shown.map((skill) => (
                  <li key={skill.id}>
                    <div className="skill-list-main">
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={disabled}
                        onClick={() => void loadSkill(skill)}
                      >
                        {skill.name}
                      </Button>
                      <p>{skill.description}</p>
                      <small>
                        v{skill.version}
                        {skill.archived
                          ? ' · Archived'
                          : !skill.enabled
                            ? ' · Disabled'
                            : ''}
                      </small>
                    </div>
                    <div className="skill-list-actions">
                      {!skill.archived && (
                        <label className="skill-enabled-control">
                          <input
                            type="checkbox"
                            role="switch"
                            aria-label={`Enable ${skill.name}`}
                            checked={skill.enabled}
                            disabled={disabled}
                            onChange={() => rowCommand(skill, 'enabled')}
                          />
                        </label>
                      )}
                      <Menu.Root>
                        <Tooltip.Root>
                          <Tooltip.Trigger
                            render={
                              <Menu.Trigger
                                ref={(element: HTMLButtonElement | null) => {
                                  if (element)
                                    menuTriggers.current.set(skill.id, element)
                                  else menuTriggers.current.delete(skill.id)
                                }}
                                className="icon-button"
                                aria-label={`Manage ${skill.name}`}
                                disabled={disabled}
                              />
                            }
                          >
                            <MoreHorizontal size={17} aria-hidden />
                          </Tooltip.Trigger>
                          <Tooltip.Portal container={portalContainer}>
                            <Tooltip.Positioner
                              className="action-tooltip-positioner"
                              sideOffset={6}
                            >
                              <Tooltip.Popup className="action-tooltip">
                                Manage {skill.name}
                              </Tooltip.Popup>
                            </Tooltip.Positioner>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                        <Menu.Portal container={portalContainer}>
                          <Menu.Positioner
                            className="reference-refresh-positioner"
                            sideOffset={5}
                            align="end"
                          >
                            <Menu.Popup
                              className="reference-refresh-menu"
                              aria-label={`${skill.name} actions`}
                              finalFocus={() =>
                                menuTriggers.current.get(skill.id)?.isConnected
                                  ? true
                                  : (heading.current ?? searchField.current)
                              }
                            >
                              <Menu.Item
                                className="reference-refresh-option"
                                onClick={() => void loadSkill(skill)}
                              >
                                {skill.archived ? 'View' : 'Edit'}
                              </Menu.Item>
                              <Menu.Item
                                className="reference-refresh-option"
                                onClick={() => void exportSkill(skill)}
                              >
                                Export SKILL.md
                              </Menu.Item>
                              <Menu.Item
                                className="reference-refresh-option"
                                onClick={() =>
                                  rowCommand(
                                    skill,
                                    skill.archived ? 'restore' : 'archive',
                                  )
                                }
                              >
                                {skill.archived
                                  ? 'Restore disabled'
                                  : 'Archive'}
                              </Menu.Item>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.Root>
                    </div>
                  </li>
                ))}
              </ul>
              {!archived && externalList.isError && (
                <p className="skill-error" role="alert">
                  {skillErrorMessage(externalList.error)}{' '}
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => void externalList.refetch()}
                  >
                    Retry
                  </Button>
                </p>
              )}
              {!archived && external.length > 0 && (
                <>
                  <h3>Connected</h3>
                  <ul className="skill-list">
                    {external.map((skill) => (
                      <li key={skill.id}>
                        <div className="skill-list-main">
                          <Button
                            variant="secondary"
                            type="button"
                            disabled={disabled}
                            onClick={() => void loadExternalSkill(skill)}
                          >
                            {skill.name}
                          </Button>
                          <p>{skill.description}</p>
                          <small>
                            {skill.kodyOrigin
                              ? 'Kody'
                              : (skill.origin?.installationName ?? 'Plugin')}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {externalList.hasNextPage && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="skill-load-more"
                      disabled={externalList.isFetchingNextPage || disabled}
                      onClick={() => void externalList.fetchNextPage()}
                    >
                      {externalList.isFetchingNextPage
                        ? 'Loading…'
                        : 'Load more'}
                    </Button>
                  )}
                </>
              )}
              {!shown.length &&
                (archived ||
                  (externalList.isFetchedAfterMount &&
                    !externalList.isError &&
                    !external.length)) && (
                  <p className="skill-scope">
                    {search
                      ? 'No matching skills.'
                      : archived
                        ? 'No archived skills.'
                        : 'No saved skills.'}
                  </p>
                )}
              {list.hasNextPage && (
                <Button
                  type="button"
                  variant="secondary"
                  className="skill-load-more"
                  disabled={list.isFetchingNextPage || disabled}
                  onClick={() => void list.fetchNextPage()}
                >
                  {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </Button>
              )}
            </>
          )}
        </>
      )}
      {error && (
        <p className="skill-error" role="alert">
          {error}
          {!recoveryReady && (
            <Button variant="secondary" type="button" onClick={recover}>
              Retry recovery
            </Button>
          )}
          {pending && (
            <Button
              variant="secondary"
              type="button"
              disabled={busy}
              onClick={() => void command(pending)}
            >
              Retry saved request
            </Button>
          )}
          {conflict && editor && (editor.source || editor.expectedRevision) && (
            <Button
              variant="secondary"
              type="button"
              disabled={busy}
              onClick={() =>
                void loadSkill(
                  { id: editor.id, version: editor.source?.version ?? 1 },
                  true,
                )
              }
            >
              Discard edits and reload
            </Button>
          )}
        </p>
      )}
    </div>
  )
}
