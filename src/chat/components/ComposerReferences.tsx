import { LoadingState } from './ui/LoadingState'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { rankPalette } from '../core/command-palette'
import { Popover } from '@base-ui/react/popover'
import { Tooltip } from '@base-ui/react/tooltip'
import { z } from 'zod'
import {
  Check,
  BookOpen,
  ArrowLeft,
  File as FileIcon,
  Info,
  MessageCircle,
  PencilLine,
  Package,
  Plug,
  Plus,
  RotateCw,
  Upload,
  Wrench,
  X,
} from 'lucide-react'
import {
  messageReferenceSchema,
  referenceKey,
  maxMessageReferences,
  maxSelectedPlugins,
  type MessageReference,
  type ReferenceCatalog,
  type ReferenceKind,
} from '../core/message-references'
import { maxSelectedSkills } from '../core/skill-identifiers'
import type { SkillVersion } from '../core/skills'
import { kodyReferenceDetailSchema } from '../core/kody-reference-detail'
import { useWorkspaceApi } from './WorkspaceApi'
import {
  sameConversationResource,
  type ConversationResource,
} from '../core/conversation-destination'
import { IconButton } from './IconButton'
import { SkillPreview } from './SkillPreview'
import { MessageMarkdown } from './MessageMarkdown'
import {
  composerReferenceLimit,
  type ComposerReferencesController,
  type ReferenceTrigger,
} from './useComposerReferences'
import './message-references.css'

const categories: Array<{ kind: ReferenceKind; label: string }> = [
  { kind: 'file', label: 'Saved files' },
  { kind: 'conversation', label: 'Conversations' },
  { kind: 'connection', label: 'Connections' },
  { kind: 'kody', label: 'Kody' },
  { kind: 'tool', label: 'Tools' },
  { kind: 'skill', label: 'Skills' },
  { kind: 'plugin', label: 'Plugins' },
]
function ReferenceIcon({ kind }: { kind: ReferenceKind }) {
  return kind === 'skill' ? (
    <BookOpen size={15} aria-hidden />
  ) : kind === 'plugin' ? (
    <Package size={15} aria-hidden />
  ) : kind === 'file' ? (
    <FileIcon size={15} aria-hidden />
  ) : kind === 'conversation' ? (
    <MessageCircle size={15} aria-hidden />
  ) : kind === 'tool' ? (
    <Wrench size={15} aria-hidden />
  ) : kind === 'kody' ? (
    <Package size={15} aria-hidden />
  ) : (
    <Plug size={15} aria-hidden />
  )
}

function InspectSkill({
  reference,
  userId,
  limitReason,
  busy,
  onBack,
  onSelect,
}: {
  reference: Extract<MessageReference, { kind: 'skill' }>
  userId: string
  limitReason: string
  busy: boolean
  onBack: () => void
  onSelect: (skill: SkillVersion) => void
}) {
  const backButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    backButton.current?.focus()
  }, [])
  const { request, workspaceId } = useWorkspaceApi()
  const query = useQuery({
    queryKey: [
      'skill-version',
      userId,
      workspaceId,
      reference.skillId,
      reference.version,
    ],
    queryFn: async () => {
      const { skillVersionSchema } = await import('../core/skills')
      return skillVersionSchema.parse(
        await request(
          `skills/${encodeURIComponent(reference.skillId)}?version=${reference.version}`,
        ),
      )
    },
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })
  const skill =
    query.isFetchedAfterMount && !query.isFetching && !query.isError
      ? query.data
      : undefined
  const unavailable = skill?.archived
    ? 'This skill is archived.'
    : skill && !skill.enabled
      ? 'Enable this skill in Settings before using it.'
      : limitReason
  return (
    <>
      <div className="skill-reference-actions">
        <IconButton ref={backButton} label="Back to skills" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden />
        </IconButton>
        <button
          type="button"
          className="primary"
          disabled={!skill || !!unavailable || busy}
          onClick={() => {
            if (skill) onSelect(skill)
          }}
        >
          Use skill
        </button>
      </div>
      <div className="skill-reference-preview">
        {query.isError ? (
          <p className="reference-notice" role="alert">
            The skill could not be loaded.{' '}
            <button type="button" onClick={() => void query.refetch()}>
              Retry
            </button>
          </p>
        ) : !skill ? (
          <LoadingState>Loading…</LoadingState>
        ) : (
          <SkillPreview skill={skill} />
        )}
      </div>
      {unavailable && (
        <p className="reference-notice" role="status">
          {unavailable}
        </p>
      )}
    </>
  )
}

function InspectKody({
  reference,
  userId,
  limitReason,
  busy,
  onBack,
  onSelect,
}: {
  reference: Extract<MessageReference, { kind: 'kody' }>
  userId: string
  limitReason: string
  busy: boolean
  onBack: () => void
  onSelect: () => void
}) {
  const backButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    backButton.current?.focus()
  }, [])
  const { request, workspaceId } = useWorkspaceApi()
  const query = useQuery({
    queryKey: [
      'kody-reference-detail',
      userId,
      workspaceId,
      reference.entity,
      reference.operation,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ entity: reference.entity })
      if (reference.operation) params.set('operation', reference.operation)
      return kodyReferenceDetailSchema.parse(
        await request(`references/kody/inspect?${params}`),
      )
    },
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })
  const detail =
    query.isFetchedAfterMount && !query.isFetching && !query.isError
      ? query.data
      : undefined
  return (
    <>
      <div className="skill-reference-actions">
        <IconButton
          ref={backButton}
          label="Back to references"
          onClick={onBack}
        >
          <ArrowLeft size={16} aria-hidden />
        </IconButton>
        <button
          type="button"
          className="primary"
          disabled={!detail || !!limitReason || busy}
          onClick={onSelect}
        >
          Use in message
        </button>
      </div>
      <div className="skill-reference-preview reference-detail">
        {query.isError ? (
          <p className="reference-notice" role="alert">
            {query.error.message}{' '}
            <button type="button" onClick={() => void query.refetch()}>
              Retry
            </button>
          </p>
        ) : !detail ? (
          <p className="reference-notice" role="status">
            Loading…
          </p>
        ) : (
          <>
            <strong>{detail.title}</strong>
            {!(detail.kind === 'package' && detail.intent) && (
              <p>{detail.description}</p>
            )}
            {detail.kind === 'account-object' && detail.fields.length > 0 && (
              <dl>
                {detail.fields.map((field) => (
                  <div key={field.label}>
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {detail.kind === 'capability' && (
              <p className="reference-detail-status">
                {detail.readOnly
                  ? 'Read only'
                  : detail.destructive
                    ? 'Can change or remove data'
                    : 'May change data'}
              </p>
            )}
            {detail.kind === 'package' && detail.intent && (
              <div className="reference-detail-intent">
                <MessageMarkdown httpsLinksOnly>
                  {detail.intent}
                </MessageMarkdown>
              </div>
            )}
            {detail.kind === 'package' && !!detail.exports?.length && (
              <>
                <h3>Exports</h3>
                <ul>
                  {detail.exports.map((entry) => (
                    <li key={entry.subpath}>
                      <code>{entry.subpath}</code>
                      {entry.description && ` ${entry.description}`}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {((detail.kind === 'package' &&
              (detail.importSpecifier || detail.typeDefinition)) ||
              (detail.kind === 'capability' &&
                (detail.inputTypeDefinition ||
                  detail.outputTypeDefinition))) && (
              <details>
                <summary>Technical details</summary>
                {detail.kind === 'package' && detail.importSpecifier && (
                  <p>
                    Import <code>{detail.importSpecifier}</code>
                  </p>
                )}
                {(detail.kind === 'capability'
                  ? detail.inputTypeDefinition
                  : detail.typeDefinition) && (
                  <>
                    <h3>Inputs</h3>
                    <pre>
                      {detail.kind === 'capability'
                        ? detail.inputTypeDefinition
                        : detail.typeDefinition}
                    </pre>
                  </>
                )}
                {detail.kind === 'capability' &&
                  detail.outputTypeDefinition && (
                    <>
                      <h3>Output</h3>
                      <pre>{detail.outputTypeDefinition}</pre>
                    </>
                  )}
              </details>
            )}
          </>
        )}
      </div>
      {limitReason && (
        <p className="reference-notice" role="status">
          {limitReason}
        </p>
      )}
    </>
  )
}

const toolSourcesSchema = z.array(
  z.object({
    serverId: z.string().min(1).max(200),
    label: z.string().min(1).max(200),
    status: z.enum(['missing', 'ready', 'stale']),
    fetchedAt: z.number().int().nonnegative().optional(),
  }),
)
export function parseReferenceCatalog(
  value: unknown,
  kind: ReferenceKind | 'all',
): ReferenceCatalog {
  const parsed = z
    .object({
      items: z.array(messageReferenceSchema),
      more: z.boolean(),
      kodyStatus: z
        .enum([
          'blocked',
          'disconnected',
          'missing',
          'partial',
          'ready',
          'stale',
        ])
        .optional(),
      kodyObjectsStatus: z
        .enum(['blocked', 'disconnected', 'missing', 'ready', 'stale'])
        .optional(),
      toolSources: toolSourcesSchema.optional(),
    })
    .safeParse(value)
  if (!parsed.success) throw new Error('References could not be loaded.')
  if (kind === 'tool' && !parsed.data.toolSources)
    throw new Error('Tool sources could not be loaded.')
  return parsed.data
}
type ToolSource = NonNullable<ReferenceCatalog['toolSources']>[number]
const sourceStatus = (source: ToolSource) =>
  ({
    missing: 'Not loaded',
    ready: 'Cached',
    stale: 'Out of date',
  })[source.status]
export function emptyToolCatalogText(sources: ToolSource[]) {
  if (!sources.length) return 'No connections available.'
  return sources.some((source) => source.status !== 'ready')
    ? 'Refresh a connection to load its tools.'
    : 'No matching tools.'
}

function RefreshTools({
  sources,
  busy,
  attempted,
  activeServerId,
  onRefresh,
}: {
  sources: ToolSource[]
  busy: boolean
  attempted: Set<string>
  activeServerId?: string
  onRefresh: (source: ToolSource) => void
}) {
  const stale = sources.filter(
    (source) =>
      source.status !== 'ready' &&
      attempted.has(source.serverId) &&
      source.serverId !== activeServerId,
  )
  if (!stale.length) return null
  return (
    <div className="reference-tool-sources">
      {stale.map((source) => (
        <button
          key={source.serverId}
          type="button"
          className="reference-option"
          disabled={busy}
          onClick={() => onRefresh(source)}
        >
          <RotateCw size={15} aria-hidden />
          <span>
            Retry {source.label} tools <small>{sourceStatus(source)}</small>
          </span>
        </button>
      ))}
    </div>
  )
}

export function ComposerAddButton({
  handle,
  disabled = false,
}: {
  handle?: ReturnType<typeof Popover.createHandle>
  disabled?: boolean
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <Popover.Trigger
            handle={handle}
            type="button"
            className="icon-button"
            disabled={disabled}
            aria-label="Add files or references"
          />
        }
      >
        <Plus size={18} aria-hidden />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner
          sideOffset={6}
          className="action-tooltip-positioner"
        >
          <Tooltip.Popup className="action-tooltip">
            Add files or references
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function ComposerReferences({
  picker,
  references,
  userId,
  botId,
  destination,
  disabled = false,
  disabledReason,
  uploadedFileIds,
  onUpload,
  onSketch,
  sketchDisabledReason,
  mention,
  composerInput,
  onCloseMention,
  onSelected,
}: {
  picker?: ReturnType<typeof Popover.createHandle>
  references: Pick<
    ComposerReferencesController,
    'items' | 'busy' | 'hasReferences' | 'error' | 'add' | 'remove' | 'clear'
  >
  userId: string
  botId?: string
  destination?: ConversationResource
  disabled?: boolean
  disabledReason?: string
  uploadedFileIds: string[]
  onUpload: () => void
  onSketch: () => void
  sketchDisabledReason?: string
  mention: ReferenceTrigger | null
  composerInput: React.RefObject<HTMLTextAreaElement | null>
  onCloseMention: () => void
  onSelected: (trigger: ReferenceTrigger | null) => void
}) {
  const { request, workspaceId } = useWorkspaceApi()
  const queryClient = useQueryClient()
  const [manualOpen, setManualOpen] = useState(false)
  const kind = mention?.kind === 'skill' ? 'skill' : 'all'
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [inspectingSkill, setInspectingSkill] = useState<Extract<
    MessageReference,
    { kind: 'skill' }
  > | null>(null)
  const [inspectingKody, setInspectingKody] = useState<Extract<
    MessageReference,
    { kind: 'kody' }
  > | null>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const sketchReasonId = useId()
  const uploadAfterClose = useRef(false)
  const focusComposerAfterClose = useRef(false)
  const open = !disabled && (manualOpen || !!mention)
  const [pickerMaxHeight, setPickerMaxHeight] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (!open || !composerInput.current) return
    const textarea = composerInput.current
    const viewport = window.visualViewport
    const update = () => {
      const viewportTop = (viewport?.offsetTop ?? 0) + 8
      const spaceAbove = textarea.getBoundingClientRect().top - viewportTop - 8
      setPickerMaxHeight(Math.max(0, Math.min(520, spaceAbove)))
    }
    update()
    textarea.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    return () => {
      textarea.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
    }
  }, [composerInput, open])
  const refreshScope = JSON.stringify([
    userId,
    workspaceId,
    botId,
    destination?.conversationId,
  ])
  const toolPickerOpen = open && !disabledReason
  const refreshGuard = useRef({
    scope: refreshScope,
    open: !!toolPickerOpen,
    epoch: 0,
  })
  if (
    refreshGuard.current.scope !== refreshScope ||
    refreshGuard.current.open !== !!toolPickerOpen
  )
    refreshGuard.current = {
      scope: refreshScope,
      open: !!toolPickerOpen,
      epoch: refreshGuard.current.epoch + 1,
    }
  const refreshPending = useRef(false)
  const autoToolRefresh = useRef({
    scope: refreshScope,
    open: !!toolPickerOpen,
    attempted: new Set<string>(),
  })
  if (
    autoToolRefresh.current.scope !== refreshScope ||
    autoToolRefresh.current.open !== !!toolPickerOpen
  )
    autoToolRefresh.current = {
      scope: refreshScope,
      open: !!toolPickerOpen,
      attempted: new Set<string>(),
    }
  const mounted = useRef(true)
  const [refreshState, setRefreshState] = useState<{
    scope: string
    epoch: number
    serverId: string
    label: string
    busy: boolean
    error?: string
  } | null>(null)
  const [kodyRefreshing, setKodyRefreshing] = useState(false)
  const [kodyRefreshError, setKodyRefreshError] = useState('')
  const kodySync = useRef({
    scope: refreshScope,
    running: false,
    lastAttempt: 0,
  })
  if (kodySync.current.scope !== refreshScope)
    kodySync.current = {
      scope: refreshScope,
      running: false,
      lastAttempt: 0,
    }
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const queryText = search
  const [serverQuery, setServerQuery] = useState(queryText)
  useEffect(() => {
    const timer = window.setTimeout(() => setServerQuery(queryText), 120)
    return () => window.clearTimeout(timer)
  }, [queryText])
  useEffect(() => {
    if (mention) {
      setSearch(mention.query)
    }
  }, [mention])
  const query = useQuery({
    queryKey: [
      'reference-catalog',
      userId,
      workspaceId,
      kind,
      serverQuery,
      botId,
      destination?.conversationId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ kind, query: serverQuery })
      if (!destination?.conversationId && botId)
        params.set('excludeBotId', botId)
      const path = destination?.conversationId
        ? `conversations/${encodeURIComponent(destination.conversationId)}/references`
        : 'references'
      return parseReferenceCatalog(await request(`${path}?${params}`), kind)
    },
    enabled: open && !disabledReason,
    placeholderData: (previous, previousQuery) => {
      const key = previousQuery?.queryKey
      // Keep results only while refining the same catalog. A category or
      // conversation change must never show unrelated or unauthorized items.
      return key?.[0] === 'reference-catalog' &&
        key[1] === userId &&
        key[2] === workspaceId &&
        key[3] === kind &&
        key[5] === botId &&
        key[6] === destination?.conversationId
        ? previous
        : undefined
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: false,
  })
  const refreshBusy = !!refreshState?.busy
  const refreshError =
    refreshState?.scope === refreshScope &&
    refreshState.epoch === refreshGuard.current.epoch
      ? refreshState.error
      : undefined
  async function refreshTools(source: ToolSource, automatic = false) {
    if (refreshPending.current || !toolPickerOpen) return
    if (automatic && autoToolRefresh.current.attempted.has(source.serverId))
      return
    autoToolRefresh.current.attempted.add(source.serverId)
    refreshPending.current = true
    const captured = {
      scope: refreshScope,
      epoch: refreshGuard.current.epoch,
      serverId: source.serverId,
      label: source.label,
    }
    setRefreshState({ ...captured, busy: true })
    let error: string | undefined
    try {
      await request('references/tools/refresh', { serverId: source.serverId })
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : 'Tools could not be refreshed.'
    } finally {
      try {
        await queryClient.invalidateQueries({
          queryKey: ['reference-catalog', userId, workspaceId],
        })
      } catch {
        error ??= 'Tools could not be refreshed.'
      }
      refreshPending.current = false
      if (mounted.current)
        setRefreshState({
          ...captured,
          busy: false,
          error:
            refreshGuard.current.epoch === captured.epoch ? error : undefined,
        })
    }
  }
  async function refreshKody(force = false) {
    const attempt = kodySync.current
    if (
      attempt.running ||
      (!force && Date.now() - attempt.lastAttempt < 55_000)
    )
      return
    attempt.running = true
    attempt.lastAttempt = Date.now()
    setKodyRefreshing(true)
    setKodyRefreshError('')
    try {
      const path = destination?.conversationId
        ? `conversations/${encodeURIComponent(destination.conversationId)}/references`
        : 'references'
      const updated = parseReferenceCatalog(
        await request(`${path}?kind=kody&query=`),
        'kody',
      )
      if (kodySync.current === attempt)
        await queryClient.invalidateQueries({
          queryKey: ['reference-catalog', userId, workspaceId, 'all'],
        })
      if (['missing', 'stale'].includes(updated.kodyObjectsStatus ?? ''))
        throw new Error('Kody account items could not be loaded.')
    } catch (cause) {
      if (mounted.current && kodySync.current === attempt)
        setKodyRefreshError(
          cause instanceof Error
            ? cause.message
            : 'Kody actions could not be loaded.',
        )
    } finally {
      attempt.running = false
      if (mounted.current && kodySync.current === attempt)
        setKodyRefreshing(false)
    }
  }
  useEffect(() => {
    setKodyRefreshError('')
    setKodyRefreshing(false)
  }, [refreshScope])
  useEffect(() => {
    if (
      toolPickerOpen &&
      (['missing', 'stale', 'partial'].includes(query.data?.kodyStatus ?? '') ||
        ['missing', 'stale'].includes(query.data?.kodyObjectsStatus ?? ''))
    )
      void refreshKody()
  }, [
    toolPickerOpen,
    query.data?.kodyStatus,
    query.data?.kodyObjectsStatus,
    query.dataUpdatedAt,
    refreshScope,
  ])
  useEffect(() => {
    if (!toolPickerOpen || kind !== 'all' || refreshPending.current) return
    const sources = query.data?.toolSources ?? []
    for (const source of sources)
      if (source.status === 'ready')
        autoToolRefresh.current.attempted.delete(source.serverId)
    const next = sources.find(
      (source) =>
        source.status !== 'ready' &&
        !autoToolRefresh.current.attempted.has(source.serverId),
    )
    if (next) void refreshTools(next, true)
  }, [
    toolPickerOpen,
    kind,
    query.data?.toolSources,
    query.dataUpdatedAt,
    refreshBusy,
    refreshScope,
  ])
  useEffect(() => {
    if (
      ['ready', 'blocked', 'disconnected'].includes(
        query.data?.kodyStatus ?? '',
      ) &&
      ['ready', 'blocked', 'disconnected'].includes(
        query.data?.kodyObjectsStatus ?? query.data?.kodyStatus ?? '',
      )
    )
      setKodyRefreshError('')
  }, [query.data?.kodyStatus, query.data?.kodyObjectsStatus])
  const close = () => {
    if (mention) focusComposerAfterClose.current = true
    setManualOpen(false)
    onCloseMention()
    setSearch('')
    setInspectingSkill(null)
    setInspectingKody(null)
  }
  const selected = new Set(references.items.map(referenceKey))
  const catalogItems = query.data?.items ?? []
  const rankedItems = queryText.trim()
    ? rankPalette(
        catalogItems.map((item) => ({
          ...item,
          id: referenceKey(item),
          kind:
            item.kind === 'file'
              ? ('file' as const)
              : item.kind === 'conversation'
                ? ('conversation' as const)
                : ('action' as const),
          aliases:
            item.kind === 'kody' &&
            item.entity.startsWith('package:') &&
            !item.entity.includes('#') &&
            item.label.includes('/')
              ? [item.label.slice(item.label.lastIndexOf('/') + 1)]
              : undefined,
          keywords: [item.detail ?? '', item.kind],
          recentAt: item.kind === 'file' ? item.recentAt : undefined,
          reference: item,
        })),
        queryText,
        { limit: 50, diversify: false },
      ).map((item) => item.reference)
    : catalogItems
        .filter((item) => item.detail !== 'Archived')
        .sort((a, b) => {
          const priority = (item: MessageReference) =>
            ({
              connection: 0,
              conversation: 1,
              file: 2,
              kody: 3,
              tool: 4,
              skill: 5,
              plugin: 6,
            })[item.kind]
          return priority(a) - priority(b) || a.label.localeCompare(b.label)
        })
  const displayedItems = rankedItems.slice(0, queryText.trim() ? 30 : 12)
  useEffect(() => {
    const input = mention ? composerInput.current : searchInput.current
    if (!input || !open) return
    input.setAttribute('aria-controls', listboxId)
    input.setAttribute('aria-haspopup', 'listbox')
    input.setAttribute('aria-expanded', 'true')
    input.setAttribute('aria-autocomplete', 'list')
    return () => {
      input.removeAttribute('aria-controls')
      input.removeAttribute('aria-haspopup')
      input.removeAttribute('aria-expanded')
      input.removeAttribute('aria-autocomplete')
      input.removeAttribute('aria-activedescendant')
    }
  }, [composerInput, listboxId, mention, open])
  useEffect(() => {
    const input = mention ? composerInput.current : searchInput.current
    if (open && displayedItems[activeIndex])
      input?.setAttribute(
        'aria-activedescendant',
        `${listboxId}-choice-${activeIndex}`,
      )
    else input?.removeAttribute('aria-activedescendant')
  }, [activeIndex, composerInput, displayedItems, listboxId, mention, open])
  useEffect(() => setActiveIndex(0), [queryText, kind])
  useEffect(() => {
    if (activeIndex > 0)
      document
        .getElementById(`${listboxId}-choice-${activeIndex}`)
        ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, listboxId])
  const choose = async (item: MessageReference) => {
    const trigger = mention
    if (await references.add(item)) {
      focusComposerAfterClose.current = true
      close()
      onSelected(trigger)
    }
  }
  useEffect(() => {
    if (!open || inspectingSkill || inspectingKody) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        mention
          ? document.activeElement !== composerInput.current
          : document.activeElement !== searchInput.current
      )
        return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close()
        return
      }
      if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return
      if (event.isComposing) return
      event.preventDefault()
      event.stopPropagation()
      if (!displayedItems.length) return
      if (event.key === 'ArrowDown')
        setActiveIndex((index) => (index + 1) % displayedItems.length)
      else if (event.key === 'ArrowUp')
        setActiveIndex(
          (index) =>
            (index + displayedItems.length - 1) % displayedItems.length,
        )
      else {
        const item = displayedItems[activeIndex]
        if (
          item &&
          !query.isPlaceholderData &&
          !selected.has(referenceKey(item)) &&
          !composerReferenceLimit(references.items, item)
        )
          void choose(item)
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [
    open,
    mention,
    inspectingSkill,
    inspectingKody,
    displayedItems,
    activeIndex,
    selected,
    references,
    query.isPlaceholderData,
    composerInput,
  ])
  const fileCount =
    uploadedFileIds.length +
    references.items.filter((item) => item.kind === 'file').length
  const skillCount = references.items.filter(
    (item) => item.kind === 'skill',
  ).length
  const pluginCount = references.items.filter(
    (item) => item.kind === 'plugin',
  ).length
  const skillLimitReason = (
    item: Extract<MessageReference, { kind: 'skill' }>,
  ) => composerReferenceLimit(references.items, item)
  const limitError =
    fileCount > 5
      ? 'Select up to 5 files, including uploads and saved files.'
      : ''
  const unavailable =
    (references.hasReferences ? disabledReason : '') ||
    references.error ||
    limitError
  return (
    <div className="composer-references">
      <Popover.Root
        handle={picker}
        open={open}
        onOpenChange={(next) => {
          if (next) setManualOpen(true)
          else close()
        }}
      >
        {!picker && <ComposerAddButton disabled={disabled} />}
        <Popover.Portal>
          <Popover.Positioner
            anchor={composerInput}
            side="top"
            align="start"
            sideOffset={8}
            className="reference-positioner"
          >
            <Popover.Popup
              className="reference-popup"
              style={
                pickerMaxHeight !== null
                  ? { maxHeight: pickerMaxHeight }
                  : undefined
              }
              initialFocus={mention ? false : searchInput}
              finalFocus={() => {
                if (uploadAfterClose.current) {
                  uploadAfterClose.current = false
                  return false
                }
                if (focusComposerAfterClose.current) {
                  focusComposerAfterClose.current = false
                  return false
                }
                return true
              }}
            >
              <Popover.Title className="reference-sr-only">
                Add files or references
              </Popover.Title>
              {disabledReason ? (
                <p className="reference-notice" role="status">
                  {disabledReason}
                </p>
              ) : inspectingSkill ? (
                <InspectSkill
                  key={referenceKey(inspectingSkill)}
                  reference={inspectingSkill}
                  userId={userId}
                  busy={references.busy}
                  limitReason={skillLimitReason(inspectingSkill)}
                  onBack={() => {
                    setInspectingSkill(null)
                    requestAnimationFrame(() => searchInput.current?.focus())
                  }}
                  onSelect={async (skill) => {
                    const trigger = mention
                    if (
                      await references.add({
                        kind: 'skill',
                        skillId: skill.id,
                        version: skill.version,
                        label: skill.document.name,
                        detail: skill.kodyOrigin
                          ? 'Synced skill'
                          : `${skill.origin?.installationName ?? 'Personal'} · v${skill.version}`,
                      })
                    ) {
                      focusComposerAfterClose.current = true
                      close()
                      onSelected(trigger)
                    }
                  }}
                />
              ) : inspectingKody ? (
                <InspectKody
                  key={referenceKey(inspectingKody)}
                  reference={inspectingKody}
                  userId={userId}
                  busy={references.busy}
                  limitReason={composerReferenceLimit(
                    references.items,
                    inspectingKody,
                  )}
                  onBack={() => {
                    setInspectingKody(null)
                    requestAnimationFrame(() =>
                      (mention
                        ? composerInput.current
                        : searchInput.current
                      )?.focus(),
                    )
                  }}
                  onSelect={() => void choose(inspectingKody)}
                />
              ) : (
                <>
                  {!mention && (
                    <input
                      ref={searchInput}
                      className="reference-search"
                      type="search"
                      aria-label="Search references"
                      placeholder="Search files, conversations, tools, and skills"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  )}
                  {query.isError ? (
                    <p className="reference-notice" role="alert">
                      {query.error.message}{' '}
                      <button
                        type="button"
                        onClick={() => void query.refetch()}
                      >
                        Retry
                      </button>
                    </p>
                  ) : !query.data ? (
                    <LoadingState>Loading…</LoadingState>
                  ) : (
                    <div
                      className="reference-options"
                      aria-busy={query.isFetching}
                    >
                      <div
                        id={listboxId}
                        role="listbox"
                        aria-label="References"
                      >
                        {displayedItems.map((item, index) => {
                          const included =
                            selected.has(referenceKey(item)) ||
                            (item.kind === 'file' &&
                              sameConversationResource(
                                item,
                                destination ?? { botId: botId ?? '' },
                              ) &&
                              uploadedFileIds.includes(item.fileId))
                          const limit =
                            !!composerReferenceLimit(references.items, item) ||
                            (item.kind === 'file' && fileCount >= 5)
                          return (
                            <div
                              key={referenceKey(item)}
                              className="reference-result"
                              onMouseEnter={() => setActiveIndex(index)}
                            >
                              <button
                                id={`${listboxId}-choice-${index}`}
                                type="button"
                                className="reference-option"
                                role="option"
                                aria-selected={index === activeIndex}
                                disabled={included || limit || references.busy}
                                onClick={() => void choose(item)}
                              >
                                <ReferenceIcon kind={item.kind} />
                                <span>
                                  <strong>{item.label}</strong>
                                  {(item.detail || item.kind === 'plugin') && (
                                    <small>
                                      {item.detail ||
                                        (item.kind === 'plugin'
                                          ? `Installed v${item.version}`
                                          : '')}
                                    </small>
                                  )}
                                </span>
                                <em className="reference-kind">
                                  {
                                    categories.find(
                                      (category) => category.kind === item.kind,
                                    )?.label
                                  }
                                </em>
                                {included && (
                                  <Check
                                    size={15}
                                    aria-label="Already selected"
                                  />
                                )}
                              </button>
                              {item.kind === 'skill' && (
                                <IconButton
                                  className="reference-inspect"
                                  label={`Inspect ${item.label}`}
                                  onClick={() => setInspectingSkill(item)}
                                >
                                  <Info size={15} aria-hidden />
                                </IconButton>
                              )}
                              {item.kind === 'kody' && (
                                <IconButton
                                  className="reference-inspect"
                                  label={`Inspect ${item.label}`}
                                  onClick={() => setInspectingKody(item)}
                                >
                                  <Info size={15} aria-hidden />
                                </IconButton>
                              )}
                            </div>
                          )
                        })}
                        {!displayedItems.length && (
                          <p className="reference-notice">
                            {query.isFetching || serverQuery !== queryText
                              ? 'Searching…'
                              : 'No matching references.'}
                          </p>
                        )}
                      </div>
                      {!mention && (
                        <>
                          <button
                            type="button"
                            className="reference-option"
                            disabled={fileCount >= 5 || references.busy}
                            onClick={() => {
                              uploadAfterClose.current = true
                              close()
                              onUpload()
                            }}
                          >
                            <Upload size={15} aria-hidden />
                            Upload files
                          </button>
                          <button
                            type="button"
                            className="reference-option"
                            disabled={!!sketchDisabledReason || references.busy}
                            aria-describedby={
                              sketchDisabledReason ? sketchReasonId : undefined
                            }
                            onClick={() => {
                              uploadAfterClose.current = true
                              close()
                              onSketch()
                            }}
                          >
                            <PencilLine size={15} aria-hidden />
                            Sketch
                          </button>
                          {sketchDisabledReason && (
                            <p className="reference-notice" id={sketchReasonId}>
                              {sketchDisabledReason}
                            </p>
                          )}
                        </>
                      )}
                      {query.data?.more && (
                        <p className="reference-notice">
                          Search to narrow the results.
                        </p>
                      )}
                      {kind === 'all' &&
                        query.data.kodyStatus === 'partial' &&
                        !kodyRefreshing && (
                          <p className="reference-notice" role="status">
                            Some Kody actions could not be loaded.{' '}
                            <button
                              type="button"
                              onClick={() => void refreshKody(true)}
                            >
                              Retry
                            </button>
                          </p>
                        )}
                      {kind === 'all' && !queryText.trim() && (
                        <>
                          {kodyRefreshing &&
                            ['missing', 'stale', 'partial'].includes(
                              query.data.kodyStatus ?? '',
                            ) && (
                              <p className="reference-notice" role="status">
                                Updating Kody actions…
                              </p>
                            )}
                          {kodyRefreshing &&
                            ['missing', 'stale'].includes(
                              query.data.kodyObjectsStatus ?? '',
                            ) && (
                              <p className="reference-notice" role="status">
                                Updating Kody account items…
                              </p>
                            )}
                          <RefreshTools
                            sources={query.data.toolSources ?? []}
                            busy={refreshBusy || query.isFetching}
                            attempted={autoToolRefresh.current.attempted}
                            activeServerId={
                              refreshBusy &&
                              refreshState?.scope === refreshScope
                                ? refreshState.serverId
                                : undefined
                            }
                            onRefresh={(source) => void refreshTools(source)}
                          />
                        </>
                      )}
                      {kind === 'all' && kodyRefreshError && (
                        <p className="reference-notice" role="alert">
                          {kodyRefreshError}{' '}
                          <button
                            type="button"
                            onClick={() => void refreshKody(true)}
                          >
                            Retry
                          </button>
                        </p>
                      )}
                      {refreshBusy && (
                        <p className="reference-notice" role="status">
                          {refreshState?.scope === refreshScope
                            ? `Refreshing ${refreshState.label}…`
                            : 'Refreshing tools…'}
                        </p>
                      )}
                      {refreshError && (
                        <p className="reference-notice" role="alert">
                          {refreshError}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
              {references.items.length >= maxMessageReferences && (
                <p className="reference-notice">
                  Up to 10 references per message.
                </p>
              )}
              {fileCount >= 5 && !disabledReason && (
                <p className="reference-notice">
                  Up to 5 files, including uploads and saved files.
                </p>
              )}
              {skillCount >= maxSelectedSkills &&
                kind === 'skill' &&
                !inspectingSkill &&
                !inspectingKody &&
                !disabledReason && (
                  <p className="reference-notice">
                    Up to 3 skills per message.
                  </p>
                )}
              {pluginCount >= maxSelectedPlugins &&
                kind === 'all' &&
                !disabledReason && (
                  <p className="reference-notice">
                    Up to 8 plugins per message.
                  </p>
                )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      {!!references.items.length && (
        <ul
          className="composer-reference-list"
          aria-label="Selected references"
        >
          {references.items.map((item) => (
            <li key={referenceKey(item)}>
              <ReferenceIcon kind={item.kind} />
              <span
                className="reference-chip-text"
                title={
                  item.detail ? `${item.label} · ${item.detail}` : item.label
                }
              >
                <span className="reference-chip-label">{item.label}</span>
                {(item.kind === 'tool' ||
                  item.kind === 'skill' ||
                  item.kind === 'plugin') && (
                  <small>
                    {item.kind === 'skill'
                      ? (item.detail ?? `Personal · v${item.version}`)
                      : item.kind === 'plugin'
                        ? item.detail || `Installed v${item.version}`
                        : item.detail || item.serverId}
                  </small>
                )}
              </span>
              <IconButton
                label={`Remove reference ${item.label}${item.kind === 'tool' ? ` from ${item.detail || item.serverId}` : ''}`}
                disabled={disabled || references.busy}
                onClick={() => void references.remove(item)}
              >
                <X size={14} aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {unavailable && (
        <p className="reference-error" role="alert">
          {unavailable}
          {references.error && !disabled && (
            <button type="button" onClick={() => void references.clear()}>
              Clear saved references
            </button>
          )}
        </p>
      )}
    </div>
  )
}
