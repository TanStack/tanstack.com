import { useWorkspaceSearch } from './useWorkspaceSearch'
import { PackageIdentity, packageName } from './PackageIdentity'
import { LoadingState } from './ui/LoadingState'
import { IconButton } from './IconButton'
import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ArrowRight, ArrowUpRight, ChevronRight, Search, X } from 'lucide-react'
import { z } from 'zod'
import { kodyAccountSchema } from '../core/kody-account'
import { skillSummarySchema } from '../core/skills'
import { defaultWorkspaceSearch } from '../core/navigation'
import { isHomeSection, type HomeSection } from '../core/home-navigation'
import type { WorkspaceBot } from '../core/bot-workspace'
import { activityLabels, type BotActivity } from '../core/bot-views'
import { useWorkspaceApi } from './WorkspaceApi'
import { Button } from './ui/Button'
import { kodyResourceKindSchema } from '../core/kody-resources'
import { deferredPanel } from './deferredPanel'
import { KodyRunDetails } from './KodyRunDetails'
import { homeResources, homeEmptyMessages } from './home-resources'
import './home-dashboard.css'

type Entry = {
  iconUrl?: string
  id: string
  name: string
  description?: string
  status?: string
  time?: string
  source?: string
  href?: string
  severity?: string
}
type Inventory = {
  items: Entry[]
  state: 'ready' | 'loading' | 'unavailable'
  partial?: boolean
}
const KodyMail = deferredPanel(async () => {
  const module = await import('./KodyMail')
  return { default: module.KodyMail }
}, 'mail')
const KodyMemorySearch = deferredPanel(async () => {
  const module = await import('./KodyMemorySearch')
  return { default: module.KodyMemorySearch }
}, 'memories')
const KodySavedPackages = deferredPanel(async () => {
  const module = await import('./KodySavedPackages')
  return { default: module.KodySavedPackages }
}, 'packages')
const KodyRunHistory = deferredPanel(async () => {
  const module = await import('./KodyRunHistory')
  return { default: module.KodyRunHistory }
}, 'activity')
const KodyUsage = deferredPanel(async () => {
  const module = await import('./KodyUsage')
  return { default: module.KodyUsage }
}, 'usage')
const KodyCommunity = deferredPanel(async () => {
  const module = await import('./KodyCommunity')
  return { default: module.KodyCommunity }
}, 'plugins')
const KodyResources = deferredPanel(async () => {
  const module = await import('./KodyResources')
  return { default: module.KodyResources }
}, 'resources')
const KodyAccountSettings = deferredPanel(async () => {
  const module = await import('./KodyAccountSettings')
  return { default: module.KodyAccountSettings }
}, 'account')
const KodyJobControl = deferredPanel(async () => {
  const module = await import('./KodyJobControl')
  return { default: module.KodyJobControl }
}, 'job settings')
const SkillDetail = deferredPanel(async () => {
  const module = await import('./HomeAssetDetail')
  return { default: module.SkillDetail }
}, 'skill details')
const AccountAssetDetail = deferredPanel(async () => {
  const module = await import('./HomeAssetDetail')
  return { default: module.AccountAssetDetail }
}, 'account details')
function time(value: string | number) {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : String(value)
}

export function HomeDashboard({
  toolbar,
  userId,
  bots,
  activity,
  fixture,
  connected,
  allowed,
  onConversation,
  onNew,
  onSettings,
}: {
  toolbar?: ReactNode
  userId: string
  bots: WorkspaceBot[]
  activity: Record<string, BotActivity>
  fixture: boolean
  connected: boolean
  allowed: boolean
  onConversation: (id: string) => void
  onNew: () => void
  onSettings: (tab: 'general' | 'skills' | 'connection') => void
}) {
  const { request, workspaceId } = useWorkspaceApi()
  const params = useParams({ strict: false })
  const search = useWorkspaceSearch()
  const navigate = useNavigate()
  const section = isHomeSection(params.homeSection)
    ? params.homeSection
    : undefined
  const query = search.homeQuery ?? ''
  const asset = search.asset
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    content.current?.scrollTo(0, 0)
  }, [section, asset])
  const account = useQuery({
    queryKey: ['kody-account', userId, workspaceId],
    queryFn: async () => kodyAccountSchema.parse(await request('kody/account')),
    enabled: connected && allowed,
    refetchInterval: 60000,
    retry: false,
  })
  const skills = useInfiniteQuery({
    queryKey: ['home-skills', userId, workspaceId],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      z
        .object({
          items: z.array(skillSummarySchema),
          nextCursor: z.string().optional(),
        })
        .parse(
          await request(
            `skills?archived=false${pageParam ? '&cursor=' + encodeURIComponent(pageParam) : ''}`,
          ),
        ),
    getNextPageParam: (page) => page.nextCursor,
    refetchInterval: 60000,
    retry: false,
  })
  const externalSkills = useInfiniteQuery({
    queryKey: ['home-external-skills', userId, workspaceId],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      z
        .object({
          items: z.array(skillSummarySchema),
          nextCursor: z.string().optional(),
        })
        .parse(
          await request(
            `skills?catalog=external${pageParam ? '&cursor=' + encodeURIComponent(pageParam) : ''}`,
          ),
        ),
    getNextPageParam: (page) => page.nextCursor,
    refetchInterval: 60000,
    retry: false,
  })
  const allSkills = [
    ...(skills.data?.pages.flatMap((page) => page.items) ?? []),
    ...(externalSkills.data?.pages.flatMap((page) => page.items) ?? []),
  ]
  const data = connected && allowed ? account.data : undefined
  const ready = connected && allowed
  const source = (
    value: { status: string; items: unknown[] } | undefined,
  ): Inventory['state'] =>
    value?.status === 'ready'
      ? 'ready'
      : account.isLoading && ready
        ? 'loading'
        : 'unavailable'
  const chats = bots
    .filter((b) => b.archived_at === null && b.deleted_at === null)
    .sort(
      (a, b) =>
        (activity[b.id]?.activity_at ?? b.updated_at) -
        (activity[a.id]?.activity_at ?? a.updated_at),
    )
  const chatEntries = chats.map((b) => ({
    id: b.id,
    name: b.name,
    description: activity[b.id]?.preview,
    status: activityLabels[activity[b.id]?.status ?? 'idle'],
    time: time(activity[b.id]?.activity_at ?? b.updated_at),
  }))
  const localAttention = chatEntries.filter((b) =>
    ['approval', 'setup', 'error'].includes(activity[b.id]?.status),
  )
  const inventories: Partial<Record<HomeSection, Inventory>> = {
    conversations: { items: chatEntries, state: 'ready' },
    attention: {
      items: [
        ...localAttention,
        ...(data?.waiting.items ?? []).map((w) => ({
          id: `waiting:${encodeURIComponent(w.kind + ':' + w.title)}`,
          name: w.title,
          description: w.why,
          href: w.href,
          severity: w.severity,
        })),
      ],
      state: localAttention.length || !ready ? 'ready' : source(data?.waiting),
      partial: data?.waiting.status !== 'ready',
    },
    packages: {
      items: (data?.packages.items ?? []).map((p) => ({
        iconUrl: p.iconUrl,
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.visibility,
      })),
      state: source(data?.packages),
      partial: data?.packages.limited,
    },
    skills: {
      items: allSkills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        status: s.enabled ? 'Enabled' : 'Disabled',
        source: s.kodyOrigin?.packageId,
      })),
      state:
        skills.isPending || externalSkills.isPending
          ? 'loading'
          : skills.isError && externalSkills.isError
            ? 'unavailable'
            : 'ready',
      partial:
        skills.hasNextPage ||
        externalSkills.hasNextPage ||
        skills.isError ||
        externalSkills.isError,
    },
    routines: {
      items: (data?.jobs.items ?? []).map((j) => ({
        id: j.id,
        name: j.name,
        description: j.schedule,
        status:
          j.enabled && !j.killSwitchEnabled && !j.expired
            ? 'Enabled'
            : 'Inactive',
        time: j.nextRunAt ? `Next ${time(j.nextRunAt)}` : undefined,
        source: j.sourceId,
      })),
      state: source(data?.jobs),
      partial: data?.jobs.limited,
    },
    workflows: {
      items: (data?.workflows.items ?? []).map((w) => ({
        id: w.id,
        name: w.name,
        status: w.status,
        source: w.sourceId,
        time: w.updatedAt ? time(w.updatedAt) : undefined,
      })),
      state: source(data?.workflows),
      partial: data?.workflows.limited,
    },
    activity: {
      items: (data?.runs.items ?? []).map((r) => ({
        id: r.id,
        name: r.name ?? r.surface,
        status: r.status,
        time: time(r.startedAt),
        source: r.packageId,
      })),
      state: source(data?.runs),
      partial: data?.runs.more,
    },
    integrations: {
      items: (data?.integrations.items ?? []).map((i) => ({
        id: i.name,
        name: i.name,
        status: i.authFailure?.title ?? i.usageMode,
        description: i.authFailure?.why,
      })),
      state: source(data?.integrations),
    },
    servers: {
      items: (data?.servers.items ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        status: s.connected ? 'Connected' : s.state,
        description: s.error ?? `${s.toolCount} tools`,
      })),
      state: source(data?.servers),
    },
  }
  const accountInventoryAvailable = ready && (!account.isError || !!data)
  const canBrowseInventory = (target: HomeSection) =>
    target === 'conversations' ||
    target === 'skills' ||
    (target === 'attention'
      ? localAttention.length > 0 || accountInventoryAvailable
      : accountInventoryAvailable)
  const selected =
    section && asset
      ? inventories[section]?.items.find((i) => i.id === asset)
      : undefined
  function destination(target?: HomeSection, id?: string) {
    const nextSearch = {
      ...defaultWorkspaceSearch,
      asset: id,
      homeQuery: undefined,
    }
    return target
      ? {
          to: '/chat/w/$workspaceId/home/$homeSection' as const,
          params: { workspaceId: workspaceId!, homeSection: target },
          search: nextSearch,
        }
      : {
          to: '/chat/w/$workspaceId' as const,
          params: { workspaceId: workspaceId! },
          search: nextSearch,
        }
  }
  const resourceLink = (
    target: HomeSection,
    children: ReactNode,
    id?: string,
    className?: string,
  ) =>
    target === 'conversations' ? (
      <span className={className}>{children}</span>
    ) : (
      <Link {...destination(target, id)} className={className}>
        {children}
      </Link>
    )
  function entry(target: HomeSection, item: Entry) {
    const Icon = homeResources[target].icon
    const body = (
      <>
        {target === 'packages' ? (
          <PackageIdentity name={item.name} iconUrl={item.iconUrl} />
        ) : (
          <span className="home-entry-icon">
            <Icon size={17} aria-hidden />
          </span>
        )}
        <span className="home-entry-copy">
          <strong>
            {target === 'packages' ? packageName(item.name).title : item.name}
          </strong>
          {target === 'packages' && (
            <small className="home-muted">{packageName(item.name).owner}</small>
          )}
          {item.description && (
            <span className="home-entry-description">{item.description}</span>
          )}
          {(item.status || item.time) && (
            <span className="home-entry-meta">
              {item.status && <span>{item.status}</span>}
              {item.time && <span>{item.time}</span>}
            </span>
          )}
        </span>
        <ChevronRight size={15} className="home-entry-arrow" aria-hidden />
      </>
    )
    return (
      <li key={item.id}>
        {target === 'conversations' ||
        (target === 'attention' && !item.id.startsWith('waiting:')) ? (
          <button
            className="home-entry"
            onClick={() => onConversation(item.id)}
          >
            {body}
          </button>
        ) : (
          resourceLink(target, body, item.id, 'home-entry')
        )}
      </li>
    )
  }
  function inventory(target: HomeSection, preview = false) {
    const inv = inventories[target]!
    if (!canBrowseInventory(target)) return null
    const matches = inv.items.filter((i) =>
      `${i.name} ${i.description ?? ''}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    return (
      <>
        {inv.state === 'loading' && (
          <LoadingState inset>
            Loading {homeResources[target].label.toLowerCase()}…
          </LoadingState>
        )}
        {inv.state === 'unavailable' && (
          <p className="home-empty">Could not load this inventory.</p>
        )}
        {inv.state === 'ready' && (
          <>
            <ul
              className={`home-entries${target === 'packages' && !preview ? ' home-package-grid' : ''}`}
            >
              {(preview ? matches.slice(0, 3) : matches).map((i) =>
                entry(target, i),
              )}
            </ul>
            {!matches.length && (
              <p className="home-empty">
                {query
                  ? 'No matches in the loaded inventory.'
                  : target === 'attention'
                    ? 'Nothing waiting.'
                    : (homeEmptyMessages[target] ??
                      `No ${homeResources[target].label.toLowerCase()} found.`)}
              </p>
            )}
            {!preview && inv.partial && (
              <p className="home-muted">Showing a partial inventory.</p>
            )}
          </>
        )}
      </>
    )
  }
  function card(target: HomeSection) {
    const Icon = homeResources[target].icon
    const inv = inventories[target]
    return (
      <section
        className="home-card"
        key={target}
        aria-label={homeResources[target].label}
      >
        <header>
          <h2>
            {resourceLink(
              target,
              <>
                <Icon size={18} aria-hidden />
                {homeResources[target].label}
                {inv?.state === 'ready' && (
                  <span className="home-count">
                    {inv.items.length}
                    {inv.partial ? '+' : ''}
                  </span>
                )}
              </>,
            )}
          </h2>
          {target !== 'conversations' &&
            resourceLink(
              target,
              <ArrowRight
                size={17}
                aria-label={`Browse ${homeResources[target].label}`}
              />,
              undefined,
              'home-browse',
            )}
        </header>
        {inv ? (
          inventory(target, true)
        ) : (
          <Link {...destination(target)} className="home-shortcut">
            <p>{homeResources[target].description}</p>
            <span>
              Open {homeResources[target].label.toLowerCase()}{' '}
              <ArrowRight size={15} aria-hidden />
            </span>
          </Link>
        )}
      </section>
    )
  }
  function related(target: HomeSection, items: Entry[], empty: string) {
    return (
      <section className="home-related">
        <h2>{resourceLink(target, homeResources[target].label)}</h2>
        <ul className="home-entries">
          {items.slice(0, 3).map((i) => entry(target, i))}
        </ul>
        {!items.length && <p className="home-muted">{empty}</p>}
      </section>
    )
  }
  function details() {
    if (!section || !asset) return null
    if (!selected && section === 'skills')
      return <SkillDetail key={asset} id={asset} />
    if (!selected && section === 'activity' && ready)
      return <KodyRunDetails key={asset} runId={asset} initiallyOpen />
    if (!selected)
      return (
        <p className="home-empty">
          {inventories[section]?.state === 'loading'
            ? 'Loading…'
            : 'This item is not in the loaded inventory. It may have changed or require a fuller listing.'}
        </p>
      )
    const p =
      section === 'packages'
        ? data?.packages.items.find((p) => p.id === asset)
        : undefined
    const origin =
      selected.source &&
      data?.packages.items.find((p) => p.sourceId === selected.source)
    return (
      <article className="home-detail" aria-label={`${selected.name} details`}>
        <header>
          {p && <PackageIdentity name={p.name} iconUrl={p.iconUrl} />}
          <h2>{p ? packageName(selected.name).title : selected.name}</h2>
          {selected.status && (
            <span className="home-badge">{selected.status}</span>
          )}
        </header>
        {selected.description && section !== 'skills' && (
          <p>{selected.description}</p>
        )}
        {selected.time && <p className="home-muted">{selected.time}</p>}
        {origin && (
          <p className="home-origin">
            Package {resourceLink('packages', origin.name, origin.id)}
          </p>
        )}
        {p && (
          <>
            <KodySavedPackages
              accountScope={userId}
              items={[p]}
              limited={false}
              initiallyOpen
            />
            <div className="home-relations">
              {related(
                'skills',
                inventories.skills!.items.filter((s) => s.source === p.id),
                'No linked skills in the loaded catalog.',
              )}
              {related(
                'activity',
                inventories.activity!.items.filter((r) => r.source === p.id),
                'No linked runs in recent activity.',
              )}
            </div>
          </>
        )}
        {section === 'skills' && <SkillDetail key={asset} id={asset} />}
        {section === 'activity' && (
          <KodyRunDetails key={asset} runId={asset} initiallyOpen />
        )}
        {ready &&
          (section === 'routines' ||
            section === 'workflows' ||
            section === 'integrations' ||
            section === 'servers') && (
            <AccountAssetDetail
              key={asset}
              id={asset}
              kind={
                section === 'routines'
                  ? 'job'
                  : section === 'workflows'
                    ? 'workflow-run'
                    : section === 'integrations'
                      ? 'integration'
                      : 'mcp-server'
              }
            />
          )}
        {(section === 'routines' || section === 'workflows') && (
          <>
            {section === 'routines' &&
              data?.jobs.items
                .filter((job) => job.id === asset)
                .map((job) => <KodyJobControl key={job.id} job={job} />)}
            <dl>
              <dt>Source</dt>
              <dd>{selected.source ?? 'Not reported'}</dd>
            </dl>
            {selected.source &&
              related(
                'activity',
                (data?.runs.items ?? [])
                  .filter((r) => r.sourceId === selected.source)
                  .map((r) => ({
                    id: r.id,
                    name: r.name ?? r.surface,
                    status: r.status,
                    time: time(r.startedAt),
                  })),
                'No runs with this source in recent activity.',
              )}
          </>
        )}
        {(section === 'integrations' || section === 'servers') && (
          <Button variant="secondary" onClick={() => onSettings('connection')}>
            Manage connection
          </Button>
        )}
        {section === 'attention' && (
          <a
            href={selected.href ?? 'https://kody.codes/account/waiting'}
            target="_blank"
            rel="noreferrer"
          >
            Resolve in Kody <ArrowUpRight size={14} aria-hidden />
          </a>
        )}
      </article>
    )
  }
  return (
    <div className="home-shell">
      {toolbar}
      <div className="home-dashboard" ref={content}>
        <div className="home-page">
          {section && selected && (
            <nav className="home-breadcrumb" aria-label="Breadcrumb">
              {resourceLink(section, homeResources[section].label)}
              <ChevronRight size={13} aria-hidden />
              <span>{selected.name}</span>
            </nav>
          )}
          <header className="home-heading">
            <div className="home-heading-title">
              <h1>{section ? homeResources[section].label : 'Home'}</h1>
            </div>
            {!section && <Button onClick={onNew}>New conversation</Button>}
            {section === 'skills' && (
              <Button variant="secondary" onClick={() => onSettings('skills')}>
                Manage skills
              </Button>
            )}
          </header>
          {section &&
          !['conversations', 'skills', 'attention'].includes(section) &&
          !ready ? (
            <div className="home-notice" role="status">
              <p>
                {fixture
                  ? 'Account features are unavailable in this local preview.'
                  : allowed
                    ? 'Connect Kody to use its packages and activity.'
                    : 'Kody is disabled for this workspace.'}
              </p>
              {!fixture && allowed && (
                <Button
                  variant="secondary"
                  onClick={() => onSettings('general')}
                >
                  Connect Kody
                </Button>
              )}
            </div>
          ) : section && account.isError ? (
            <div className="home-notice" role="alert">
              <p>
                Could not refresh Kody. Some information may be out of date.
              </p>
              <Button
                variant="secondary"
                onClick={() => void account.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : null}
          {params.homeSection && !section ? (
            <p>That page was not found.</p>
          ) : !section ? (
            <>
              <div className="home-grid">
                {card('conversations')}
                {card('attention')}
                {card('skills')}
              </div>
              <section
                className="home-card home-integration-card"
                aria-label="Kody integration"
              >
                <header>
                  <h2>Kody</h2>
                  {ready && <span className="tag">Connected</span>}
                </header>
                <p>
                  {ready
                    ? 'Reusable tools, skills, memory, and automation from Kody.'
                    : 'Connect Kody for reusable tools, skills, memory, and automation.'}
                </p>
                {ready ? (
                  <div className="home-utility-links">
                    {(
                      ['packages', 'memories', 'activity', 'routines'] as const
                    ).map((id) => (
                      <span key={id}>
                        {resourceLink(
                          id,
                          homeResources[id].label,
                          undefined,
                          'home-utility-link',
                        )}
                      </span>
                    ))}
                  </div>
                ) : allowed && !fixture ? (
                  <Button
                    variant="secondary"
                    onClick={() => onSettings('general')}
                  >
                    Connect Kody
                  </Button>
                ) : null}
              </section>
              <div className="home-utility-links">
                <Button
                  variant="secondary"
                  onClick={() => onSettings('connection')}
                >
                  Manage integrations
                </Button>
              </div>
            </>
          ) : asset ? (
            details()
          ) : (
            <>
              {inventories[section] && canBrowseInventory(section) && (
                <>
                  <label className="home-search">
                    <Search size={17} aria-hidden />
                    <input
                      type="search"
                      aria-label={`Search ${homeResources[section].label.toLowerCase()}`}
                      placeholder={`Search ${homeResources[section].label.toLowerCase()}…`}
                      value={query}
                      onChange={(e) =>
                        void navigate({
                          ...destination(section),
                          search: {
                            ...defaultWorkspaceSearch,
                            homeQuery: e.target.value || undefined,
                          },
                          replace: true,
                          resetScroll: false,
                        })
                      }
                    />
                    {query && (
                      <button
                        aria-label="Clear search"
                        onClick={() =>
                          void navigate({
                            ...destination(section),
                            replace: true,
                            resetScroll: false,
                          })
                        }
                      >
                        <X size={15} />
                      </button>
                    )}
                  </label>
                  <section className="home-list">{inventory(section)}</section>
                </>
              )}
              {section === 'skills' && (
                <div className="home-page-actions">
                  {skills.hasNextPage && (
                    <Button
                      disabled={skills.isFetchingNextPage}
                      onClick={() => void skills.fetchNextPage()}
                    >
                      Load more personal skills
                    </Button>
                  )}
                  {externalSkills.hasNextPage && (
                    <Button
                      disabled={externalSkills.isFetchingNextPage}
                      onClick={() => void externalSkills.fetchNextPage()}
                    >
                      Load more Kody skills
                    </Button>
                  )}
                </div>
              )}
              {ready && (
                <div
                  className={
                    section === 'community'
                      ? 'home-marketplace-view'
                      : 'home-native-view'
                  }
                >
                  {section === 'memories' && (
                    <KodyMemorySearch
                      userId={userId}
                      accountScope={userId}
                      visible
                      readOnly
                    />
                  )}
                  {section === 'mail' && (
                    <KodyMail userId={userId} accountScope={userId} visible />
                  )}
                  {section === 'usage' && <KodyUsage accountScope={userId} />}
                  {section === 'account' && <KodyAccountSettings />}
                  {section === 'community' && (
                    <KodyCommunity
                      accountScope={userId}
                      installedNames={
                        data?.packages.items
                          .map((item) => item.sourceListing)
                          .filter((name): name is string => !!name) ?? []
                      }
                    />
                  )}
                  {section === 'activity' && (
                    <KodyRunHistory accountScope={userId} />
                  )}
                  {kodyResourceKindSchema.safeParse(section).success && (
                    <KodyResources
                      key={section}
                      kind={kodyResourceKindSchema.parse(section)}
                      accountScope={userId}
                    />
                  )}
                </div>
              )}
            </>
          )}
          {data &&
            [
              'overview',
              'packages',
              'attention',
              'routines',
              'workflows',
              'integrations',
              'servers',
            ].includes(section ?? 'overview') && (
              <p className="home-updated">Updated {time(data.checkedAt)}</p>
            )}
        </div>
      </div>
    </div>
  )
}
