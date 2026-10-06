import { useWorkspaceSearch } from './useWorkspaceSearch'
import { WorkspaceSkeleton } from './WorkspaceSkeleton'
import { RailNavigation } from './RailNavigation'
import { HomeDashboard } from './HomeDashboard'
import { PersonalAssistant } from './PersonalAssistant'
import { InstallApp } from './InstallApp'
import { DeviceSettings } from './DeviceSettings'
import { useMobileDrawer } from './useMobileDrawer'
import { AuthPopupForm } from './AuthPopupForm'
import { useDebugDetails } from './useDebugDetails'
import { TabPanels } from './ui/TabPanels'
import { Button } from './ui/Button'
import { Menu } from '@base-ui/react/menu'
import {
  conversationLocation,
  selectedConversationLocation,
} from '../core/conversation-destination'
import type { TurnOutcome } from '../core/message-navigation'
import { SelectField } from './SelectField'
import { deferredPanel } from './deferredPanel'
import { useWorkspaceCollections } from './useWorkspaceCollections'
import { BotWorkspace, BotControls } from './BotWorkspace'
import { ResizableSidebar } from './ResizableSidebar'
import { useExecutionOwners } from './execution-context'
import { CopyBotDialog } from './CopyBotDialog'
import { DraftBot } from './DraftBot'
import { Dialog } from './Dialog'
import { ConversationView } from './ConversationView'
import { conversationRouteQuery } from './conversationRouteQuery'
import { chatIdentityQuery, rememberChatIdentity } from './chatIdentityQuery'
import { ConversationDetailsToggle } from './ConversationDetailsCard'
import {
  ConversationNavigator,
  ConversationNavigatorToggle,
} from './ConversationNavigator'
import { ConversationNavigatorScope } from './ConversationNavigatorScope'
import { CommandPaletteTrigger } from './CommandPalette'
import { WorkspaceCommands } from './WorkspaceCommands'
import { SettingsFocusSection } from './SettingsFocusSection'
import { IconButton } from './IconButton'
import { Onboarding, AccountSetupSettings } from './Onboarding'
import {
  applyBootstrapOnboarding,
  mergeBootstrapOnboarding,
} from './bootstrap-onboarding'
import type { Onboarding as OnboardingSnapshot } from '../core/onboarding'
import {
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  PanelLeft,
  PanelRight,
  LogOut,
  Bookmark,
  Copy,
} from 'lucide-react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { WorkspaceApiProvider, useWorkspaceApi, ApiError } from './WorkspaceApi'

import {
  readPanelState,
  clearConversationFilePanels,
  openWorkspacePanel,
} from '../core/workspace-panels'
import { type ConversationCopyOrigin } from './ConversationOrigin'

import {
  composerFocusHandoff,
  type ComposerFocusHandoff,
} from './composer-focus'

import type { AssistantTask } from '../core/assistant-task'
import type { QueueSnapshot } from '../core/conversation-queue'
import type { ConversationRun } from '../core/conversation-runs'

import type { ToolReceipt } from '../core/conversation-copy'
import type { WorkspaceBot, BotSection } from '../core/bot-workspace'
import type { BotActivity, BotView } from '../core/bot-views'
import {
  validateWorkspaceSearch,
  defaultWorkspaceSearch,
  type WorkspaceSearch,
  type SettingFocus,
} from '../core/navigation'
import type { McpAccountSummary } from '../core/mcp-accounts'
import { definiteConnectionRejection } from './connection-errors'
import {
  mcpSetupSummarySchema,
  type PluginConnectionTarget,
  prepareMcpSetupSchema,
} from '../core/mcp-setup'

import { AppearanceAccountSync } from './AppearanceSettings'
import { AppearanceSettings } from './AppearanceSettings'
import { useSendBehavior } from './useComposerDraft'

import type { PendingTask } from '../core/tasks'
import type { UsageStep } from '../core/usage'
import { SignInForm } from '~/routes/login'
import { authClient } from '~/auth/client'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useId,
  useRef,
  useState,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { UIMessage } from '@tanstack/ai'
import {
  providers,
  type Connection,
  type Provider,
  type Policy,
  type Recipe,
  type Trace,
  type Approval,
  type User,
} from '../core/types'
const AccountTimezone = deferredPanel(async () => {
  const module = await import('./AccountTimezone')
  return { default: module.AccountTimezone }
}, 'timezone')
const ConnectionSettings = deferredPanel(async () => {
  const module = await import('./ConnectionSettings')
  return { default: module.ConnectionSettings }
}, 'connections')
const McpContractInspector = deferredPanel(async () => {
  const module = await import('./McpContractInspector')
  return { default: module.McpContractInspector }
}, 'MCP contracts')
const PluginSettings = deferredPanel(async () => {
  const module = await import('./PluginSettings')
  return { default: module.PluginSettings }
}, 'plugins')
const SkillSettings = deferredPanel(async () => {
  const module = await import('./SkillSettings')
  return { default: module.SkillSettings }
}, 'skills')
const ResponsePreferences = deferredPanel(async () => {
  const module = await import('./ResponsePreferences')
  return { default: module.ResponsePreferences }
}, 'response preferences')

export type Bootstrap = {
  user: User
  workspace: { id: string; name: string }
  workspaces?: { id: string; name: string }[]
  onboarding: OnboardingSnapshot
  bots: WorkspaceBot[]
  personalAssistant?: WorkspaceBot
  sections: BotSection[]
  activity?: Record<string, BotActivity>
  recipes: Recipe[]
  policy: Policy
  fixture: boolean
  browserExecution?: boolean
  mcpServers?: Pick<
    McpAccountSummary,
    'id' | 'label' | 'url' | 'enabled' | 'hasToken'
  >[]
  kodyConnected: boolean
  kodyNeedsSignIn?: boolean
  kodyPrimary: boolean
  kodyUsername?: string
  connection: Connection & { hasKey: boolean }
  includedModel: string
  connections: Partial<Record<Provider, Connection & { hasKey: boolean }>>
  usage: number
  dailyTurnLimit: number | null
  fundedSpend: {
    estimatedUsd: number
    remainingUsd: number
    dailyLimitUsd: number
    sharedEstimatedUsd: number
    sharedRemainingUsd: number
    sharedDailyLimitUsd: number
    unknownRuns: number
  }
}
export type History = {
  workflowWorker?: {
    ownerConversationId: string
    runId: string
    stepId: string
  }
  transcriptEpoch?: string
  runs?: ConversationRun[]
  identity?: {
    userId: string
    workspaceId: string
    botId: string
    conversationId?: string
  }
  assistantTask?: AssistantTask
  queue?: QueueSnapshot
  toolReceipts?: Record<string, ToolReceipt[]>
  inheritedTurns?: Record<string, { partial: boolean }>
  copyOrigin?: ConversationCopyOrigin
  resetRetry?: {
    attemptId: string
    submittedMessageId?: string
    submittedDraftRevision?: number
  }
  turnTimings?: Record<string, { startedAt: number; completedAt?: number }>
  activity?: { summary: { eventVersion: number; status: string } }
  turnOutcomes?: Record<string, TurnOutcome>
  archivedTurns?: number
  streamOffset: string
  toolStates?: Record<string, string>
  delegationWait?: string
  pendingTask?: PendingTask
  usageSteps?: UsageStep[]
  messages: UIMessage[]
  traces: Trace[]
  approvals: Approval[]
  status: string
  activeRun: string | null
  error?: string
}
const names: Record<string, string> = {
  included: 'Included AI',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  groq: 'Groq',
  grok: 'xAI',
  openrouter: 'OpenRouter',
  vercel: 'Vercel AI Gateway',
  cloudflare: 'Cloudflare Workers AI',
  cf_gateway: 'Cloudflare AI Gateway',
  compatible: 'OpenAI-compatible endpoint',
}
export function App() {
  const params = useParams({ strict: false })
  const identity = useQuery({
    ...chatIdentityQuery(params.conversationId ?? ''),
    enabled: !!params.conversationId,
  })
  if (params.conversationId && !identity.data) {
    if (identity.error)
      return (
        <main className="loading" role="alert">
          {identity.error.message}
        </main>
      )
    return <WorkspaceSkeleton />
  }
  const workspaceId = identity.data?.workspaceId ?? params.workspaceId
  return (
    <WorkspaceApiProvider workspaceId={workspaceId}>
      <WorkspaceApp
        key={workspaceId ?? 'home'}
        workspaceId={workspaceId}
        botId={identity.data?.botId ?? params.botId}
      />
    </WorkspaceApiProvider>
  )
}
function WorkspaceApp({
  workspaceId,
  botId,
}: {
  workspaceId?: string
  botId?: string
}) {
  const { request: api } = useWorkspaceApi()
  const params = useParams({ strict: false })
  const executionOwners = useExecutionOwners()
  const navigate = useNavigate()
  const search = useWorkspaceSearch()
  const latestDraft = useRef(search.draft)
  latestDraft.current = search.draft
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const queryClient = useQueryClient()
  const bootstrap = useQuery({
    queryKey: ['bootstrap', workspaceId],
    queryFn: () => api<Bootstrap>('bootstrap'),
    refetchInterval: 5 * 60_000,
    structuralSharing: (previous: unknown, incoming: unknown) =>
      mergeBootstrapOnboarding(
        previous as Bootstrap | undefined,
        incoming as Bootstrap,
      ),
    retry: (count, error) =>
      !(error instanceof ApiError && [401, 403, 404].includes(error.status)) &&
      count < 2,
  })
  const [pendingDraft, setPendingDraft] = useState<{
    id: string
    botId?: string
    text: string
    userId: string
    workspaceId: string
  } | null>(null)
  const mobile = search.navigation === true
  const setMobile = useCallback(
    (open: boolean) => {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({
          ...validateWorkspaceSearch(previous),
          navigation: open ? true : undefined,
        }),
        replace: !open,
        resetScroll: false,
      })
    },
    [navigate],
  )
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [narrow, setNarrow] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const sidebarTrigger = useRef<HTMLButtonElement>(null)
  useMobileDrawer(sidebarRef, narrow, mobile, setMobile)
  const sidebarOpen = narrow ? mobile : desktopSidebarOpen
  const previousSidebarOpen = useRef(sidebarOpen)
  const closeSidebar = () => {
    if (narrow) setMobile(false)
    else setDesktopSidebarOpen(false)
  }
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const update = () => {
      setNarrow(media.matches)
      if (!media.matches && window.location.search.includes('navigation='))
        setMobile(false)
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (narrow && previousSidebarOpen.current !== sidebarOpen) {
      if (sidebarOpen) {
        sidebarRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
      } else {
        sidebarTrigger.current?.focus()
      }
    }
    previousSidebarOpen.current = sidebarOpen
  }, [sidebarOpen, narrow])
  const setSettings = (
    tab: WorkspaceSearch['settings'],
    focus?: SettingFocus,
  ) => {
    const destination =
      tab === 'general' && focus && focus !== 'profile' ? 'preferences' : tab
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({
        ...validateWorkspaceSearch(previous),
        navigation: undefined,
        settings: destination,
        setting:
          destination === 'general' || destination === 'preferences'
            ? focus
            : undefined,
        connectionSetup:
          destination === 'mcp' ? previous.connectionSetup : undefined,
        plugin: destination === 'plugins' ? previous.plugin : undefined,
      }),
      resetScroll: false,
    })
  }
  const [copyTarget, setCopyTarget] = useState<{
    bot: WorkspaceBot
    messageId?: string
    conversationId?: string
  }>()
  const [composerFocus, setComposerFocus] = useState<{
    botId: string
    handoff: ComposerFocusHandoff
  }>()
  useEffect(() => () => composerFocus?.handoff.cancel(), [composerFocus])
  const [developer, setDeveloper] = useState(false)
  const [debugDetails] = useDebugDetails()
  const detailsTrigger = useRef<HTMLButtonElement>(null)
  const panelState = readPanelState(search)
  useEffect(() => {
    setDeveloper(localStorage.getItem('gum.developer') === 'true')
  }, [])
  const accessDenied =
    bootstrap.error instanceof ApiError &&
    [401, 403, 404].includes(bootstrap.error.status)
  const workspaceState = useWorkspaceCollections(
    accessDenied ? undefined : bootstrap.data,
    bootstrap.dataUpdatedAt,
  )
  const workspaceError =
    workspaceState.indexQuery.error ?? workspaceState.activityQuery.error
  const indexDenied =
    workspaceError instanceof ApiError &&
    [401, 403, 404].includes(workspaceError.status)
  const data = useMemo(() => {
    if (indexDenied || !workspaceState.data) return undefined
    const current = workspaceState.data
    const assistant = current.personalAssistant
    if (!assistant) return current
    return {
      ...current,
      personalAssistant: { ...assistant, name: 'Assistant' },
      bots: current.bots.map((bot) =>
        bot.id === assistant.id ? { ...bot, name: 'Assistant' } : bot,
      ),
    }
  }, [indexDenied, workspaceState.data])
  const workspaceRequest = workspaceState.request
  const [historyError, setHistoryError] = useState('')
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target?.isContentEditable ||
        target?.closest(
          'input,textarea,select,[role="textbox"],[role="dialog"],[role="menu"]',
        )
      )
        return
      const key = event.key.toLowerCase()
      const redo = (key === 'z' && event.shiftKey) || key === 'y'
      if (key !== 'z' && key !== 'y') return
      const store = workspaceState.store
      if (!store || !(redo ? store.canRedo() : store.canUndo())) return
      event.preventDefault()
      event.stopPropagation()
      setHistoryError('')
      void (redo ? store.redo() : store.undo()).catch((error) =>
        setHistoryError(error.message),
      )
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [workspaceState.store])

  useEffect(() => {
    const userId = data?.user.id
    if (!userId || !data.kodyConnected) return
    let active = true
    let running = false
    const check = async () => {
      if (!active || running || document.visibilityState !== 'visible') return
      running = true
      try {
        const result = await api<{ changed: boolean }>('kody/sync', {})
        if (active && result.changed)
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: ['reference-catalog', userId, workspaceId],
            }),
            queryClient.invalidateQueries({
              queryKey: ['external-skills', userId, workspaceId],
            }),
            queryClient.invalidateQueries({
              queryKey: ['kody-account', userId, workspaceId],
            }),
          ])
      } catch {
        // Existing catalogs remain available; the next visible check retries.
      } finally {
        running = false
      }
    }
    const onVisible = () => void check()
    void check()
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    const interval = window.setInterval(onVisible, 65_000)
    return () => {
      active = false
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
    }
  }, [api, data?.user.id, data?.kodyConnected, queryClient, workspaceId])
  const previousViewer = useRef<string | undefined>(undefined)
  useLayoutEffect(() => {
    // Bind the account before child effects can inspect a replacement owner.
    if (
      (bootstrap.error instanceof ApiError && bootstrap.error.status === 401) ||
      (workspaceError instanceof ApiError && workspaceError.status === 401)
    )
      executionOwners?.setAccount(null)
    else if (data?.user.id) executionOwners?.setAccount(data.user.id)
    // Workspace navigation only changes the subscription. It is not sign-out.
  }, [data?.user.id, bootstrap.error, workspaceError, executionOwners])
  useLayoutEffect(() => {
    const viewer = data?.user.id
    if (!viewer) return
    const changed = previousViewer.current && previousViewer.current !== viewer
    previousViewer.current = viewer
    if (changed)
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => {
          const { executionHistory: _history, ...rest } =
            validateWorkspaceSearch(previous)
          return rest
        },
        replace: true,
        resetScroll: false,
      })
  }, [data?.user.id, navigate])
  const currentViewer = useRef(data?.user.id)
  currentViewer.current = data?.user.id
  const selected = search.draft
    ? undefined
    : data?.bots.find((bot) => bot.id === botId)
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['bootstrap', workspaceId] }),
      workspaceState.store?.refresh(),
    ])
  }
  const activityQuery = workspaceState.activityQuery
  const selectBot = (id: string) => {
    if (!data) return
    const bot =
      data.bots.find((candidate) => candidate.id === id) ??
      (data.personalAssistant?.id === id ? data.personalAssistant : undefined)
    const identity = bot
      ? rememberChatIdentity(queryClient, bot, data.user.id)
      : undefined
    void navigate({
      ...selectedConversationLocation(
        {
          workspaceId: identity?.workspaceId ?? data.workspace.id,
          botId: id,
          conversationId: identity?.conversationId,
        },
        search,
      ),
      search: {
        ...(id === botId && !search.draft && !search.conversation
          ? search
          : clearConversationFilePanels(search)),
        navigation: undefined,
        message: undefined,
        conversation: undefined,
        draft: undefined,
        parent: undefined,
        settings: undefined,
        setting: undefined,
        connectionSetup: undefined,
        plugin: undefined,
      },
      resetScroll: false,
    })
  }
  const createDraft = (parentId: string | null) => {
    if (!data) return
    void navigate({
      to: '/chat/w/$workspaceId',
      params: { workspaceId: data.workspace.id },
      search: {
        ...clearConversationFilePanels(search),
        navigation: undefined,
        draft: crypto.randomUUID(),
        conversation: undefined,
        parent: parentId ?? undefined,
        message: undefined,
        settings: undefined,
      },
      resetScroll: false,
    })
  }
  const changeView = (view: BotView) => {
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({
        ...validateWorkspaceSearch(previous),
        ...view,
        q: view.q ?? '',
        settings: undefined,
        setting: undefined,
        connectionSetup: undefined,
        plugin: undefined,
      }),
      replace: view.q !== search.q,
      resetScroll: false,
    })
  }
  useEffect(() => {
    if (!data || botId || search.draft || params.homeSection) return
    if (workspaceId && data.personalAssistant) {
      const identity = rememberChatIdentity(
        queryClient,
        data.personalAssistant,
        data.user.id,
      )
      void navigate({
        ...conversationLocation(
          {
            workspaceId: data.personalAssistant.workspace_id,
            botId: data.personalAssistant.id,
            conversationId: identity?.conversationId,
          },
          search,
        ),
        search: { ...search, conversation: undefined },
        replace: true,
      })
      return
    }
    if (!workspaceId) {
      void navigate({
        to: '/chat/w/$workspaceId',
        params: { workspaceId: data.workspace.id },
        search: {
          ...clearConversationFilePanels(search),
          conversation: undefined,
        },
        replace: true,
      })
    }
  }, [
    data,
    botId,
    workspaceId,
    navigate,
    search,
    params.homeSection,
    queryClient,
  ])
  if (bootstrap.isPending && !data) return <WorkspaceSkeleton />
  if (
    (workspaceError instanceof ApiError && workspaceError.status === 401) ||
    (bootstrap.error instanceof ApiError && bootstrap.error.status === 401)
  )
    return <SignInForm returnTo="/chat" />
  if (!data)
    return (
      <main className="loading" role="alert">
        <p>
          {indexDenied ||
          (bootstrap.error instanceof ApiError &&
            [403, 404].includes(bootstrap.error.status))
            ? 'This workspace is unavailable or you do not have access.'
            : (bootstrap.error?.message ?? 'Could not open this workspace.')}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void refresh()}
        >
          Retry
        </Button>
        <a className="quiet-button" href="/">
          Open your workspace
        </a>
      </main>
    )
  const onSetupSaved = (snapshot: OnboardingSnapshot) => {
    queryClient.setQueriesData<Bootstrap>(
      { queryKey: ['bootstrap'] },
      (previous) =>
        previous
          ? applyBootstrapOnboarding(previous, data.user.id, snapshot)
          : previous,
    )
    void queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
  }
  if (data.onboarding.status === 'pending')
    return (
      <Onboarding
        key={data.user.id}
        userId={data.user.id}
        snapshot={data.onboarding}
        onSaved={onSetupSaved}
      />
    )
  const toggleDeveloper = (value: boolean) => {
    setDeveloper(value)
    localStorage.setItem('gum.developer', String(value))
  }
  const parentId =
    selected?.parent_id ?? (search.draft ? search.parent : undefined)
  const parentName =
    data.bots.find((bot) => bot.id === parentId)?.name ?? 'Parent conversation'
  const conversationName = selected?.name ?? (search.draft ? 'New' : '')
  const workspaceShortcuts = (
    <RailNavigation
      userId={data.user.id}
      activeId={
        search.view === 'attention'
          ? 'attention'
          : selected || search.draft
            ? 'chat'
            : params.homeSection
      }
      onOpen={(id) => {
        setMobile(false)
        if (id === 'chat') {
          if (data.personalAssistant) {
            selectBot(data.personalAssistant.id)
          } else createDraft(null)
        } else {
          void navigate({
            to: '/chat/w/$workspaceId/home/$homeSection',
            params: { workspaceId: data.workspace.id, homeSection: id },
            search: { ...defaultWorkspaceSearch },
            resetScroll: true,
          })
        }
      }}
    />
  )
  const header = (
    <header className="main-header">
      {!sidebarOpen && narrow && (
        <IconButton
          label="Show sidebar"
          aria-expanded={false}
          aria-controls="workspace-sidebar"
          ref={sidebarTrigger}
          onClick={() => {
            if (narrow) setMobile(true)
            else setDesktopSidebarOpen(true)
          }}
        >
          <PanelLeft size={20} aria-hidden />
        </IconButton>
      )}
      <ConversationNavigatorToggle />
      <div className="breadcrumb">
        {parentId && (
          <>
            <Button
              type="button"
              variant="ghost"
              className="breadcrumb-parent"
              title={parentName}
              aria-label={parentName}
              onClick={() => selectBot(parentId)}
            >
              <ChevronLeft
                className="breadcrumb-parent-icon"
                size={14}
                aria-hidden
              />
              <span className="breadcrumb-parent-name">{parentName}</span>
            </Button>
            <ChevronRight
              className="breadcrumb-separator"
              size={15}
              aria-hidden
            />
          </>
        )}
        <strong title={conversationName}>{conversationName}</strong>
      </div>
      <div className="header-actions">
        {debugDetails && data.fixture && (
          <span className="fixture-badge">Local preview</span>
        )}
        {selected && <ConversationDetailsToggle />}
        {selected && (
          <IconButton
            ref={detailsTrigger}
            label="Side Panel"
            aria-pressed={!!panelState.active && !panelState.hidden}
            aria-controls={
              panelState.active ? 'conversation-details-pane' : undefined
            }
            onClick={() =>
              void navigate({
                to: '.',
                search: (previous: Record<string, unknown>) => {
                  const current = validateWorkspaceSearch(previous)
                  const pane = readPanelState(current)
                  if (!pane.active) return openWorkspacePanel(current, 'usage')
                  return {
                    ...current,
                    panelHidden: !pane.hidden || undefined,
                  }
                },
                resetScroll: false,
              })
            }
          >
            <PanelRight size={17} aria-hidden />
          </IconButton>
        )}
        {selected && (
          <BotControls
            bot={selected}
            bots={data.bots}
            sections={data.sections}
            onChanged={refresh}
            request={workspaceRequest}
            onCreate={createDraft}
            onDuplicate={(bot) =>
              setCopyTarget({ bot, conversationId: search.conversation })
            }
          />
        )}
      </div>
    </header>
  )
  return (
    <WorkspaceCommands
      request={workspaceRequest}
      data={data}
      selected={search.settings || copyTarget ? undefined : selected}
      locationKey={JSON.stringify([
        data.workspace.id,
        selected?.id,
        search.conversation,
        search.draft,
        search.settings,
        search.setting,
      ])}
      developer={developer}
      setDeveloper={toggleDeveloper}
      onSelect={selectBot}
      onCreate={createDraft}
      onDuplicate={(bot) =>
        setCopyTarget({
          bot,
          conversationId:
            bot.id === selected?.id ? search.conversation : undefined,
        })
      }
      onSettings={setSettings}
      onView={(view) => {
        changeView(view)
        if (narrow) setMobile(true)
      }}
      onChanged={refresh}
    >
      <AppearanceAccountSync userId={data.user.id} />
      <div className="app-shell">
        {!narrow && (
          <aside className="workspace-rail" aria-label="App navigation">
            <a
              className="workspace-rail-brand"
              href="/"
              aria-label="TanStack home"
              title="TanStack home"
            >
              <span className="workspace-rail-brand-mark" aria-hidden="true" />
            </a>
            <IconButton
              tooltipSide="right"
              label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              aria-expanded={sidebarOpen}
              aria-controls="workspace-sidebar"
              ref={sidebarTrigger}
              onClick={() => setDesktopSidebarOpen((open) => !open)}
            >
              <PanelLeft size={20} aria-hidden />
            </IconButton>
            {workspaceShortcuts}
            <IconButton
              tooltipSide="right"
              className="workspace-rail-settings"
              label="Settings"
              onClick={() => setSettings('general')}
            >
              <Settings size={20} aria-hidden />
            </IconButton>
          </aside>
        )}
        <div className="workspace-content">
          <ResizableSidebar
            key={data.user.id}
            sidebarRef={sidebarRef}
            viewerId={data.user.id}
            resizable={!narrow && sidebarOpen}
            className={`sidebar ${mobile ? 'visible' : ''}`}
            data-collapsed={!sidebarOpen || undefined}
            inert={!sidebarOpen}
            role={narrow && mobile ? 'dialog' : 'complementary'}
            aria-label="Workspace navigation"
            aria-modal={narrow && mobile ? true : undefined}
            onKeyDown={(event) => {
              if (
                !narrow ||
                !mobile ||
                event.defaultPrevented ||
                !event.currentTarget.contains(event.target as Node) ||
                document.querySelector('dialog[open]')
              )
                return
              if (event.key === 'Escape') {
                event.preventDefault()
                setMobile(false)
              }
              if (event.key !== 'Tab') return
              const items = [
                ...event.currentTarget.querySelectorAll<HTMLElement>(
                  'button, a[href], input, select, textarea, summary, [tabindex="0"]',
                ),
              ].filter(
                (item) =>
                  !item.hasAttribute('disabled') &&
                  item.getClientRects().length,
              )
              const first = items[0],
                last = items.at(-1)
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last?.focus()
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first?.focus()
              }
            }}
          >
            <div className="brand">
              {(data.workspaces?.length ?? 0) > 1 ? (
                <Menu.Root>
                  <Menu.Trigger
                    className="workspace-switcher"
                    aria-label={`Switch workspace: ${data.workspace.name}`}
                  >
                    <strong>TanChat</strong>
                    <ChevronDown size={15} aria-hidden />
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner
                      className="bw-positioner"
                      align="start"
                      sideOffset={5}
                    >
                      <Menu.Popup className="bw-menu" aria-label="Workspaces">
                        {data.workspaces?.map((item) => (
                          <Menu.Item
                            key={item.id}
                            className="bw-menu-item"
                            onClick={() => {
                              if (item.id !== data.workspace.id)
                                void navigate({
                                  to: '/chat/w/$workspaceId',
                                  params: { workspaceId: item.id },
                                  search: defaultWorkspaceSearch,
                                })
                            }}
                          >
                            {item.name}
                            {item.id === data.workspace.id && (
                              <Check size={15} aria-label="Current workspace" />
                            )}
                          </Menu.Item>
                        ))}
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              ) : (
                <strong>TanChat</strong>
              )}
              <div className="brand-search">
                <CommandPaletteTrigger />
              </div>
              {narrow && (
                <IconButton
                  className="sidebar-close"
                  label="Hide sidebar"
                  aria-expanded={sidebarOpen}
                  aria-controls="workspace-sidebar"
                  onClick={closeSidebar}
                >
                  <PanelLeft size={20} aria-hidden />
                </IconButton>
              )}
            </div>
            {data.personalAssistant &&
              data.personalAssistant.deleted_at === null && (
                <PersonalAssistant
                  userId={data.user.id}
                  assistant={data.personalAssistant}
                  active={
                    data.workspace.id === `personal:${data.user.id}` &&
                    selected?.id === data.personalAssistant.id
                  }
                  working={
                    workspaceState.activity[data.personalAssistant.id]
                      ?.status === 'running'
                  }
                  onChanged={refresh}
                  onOpen={() => {
                    setMobile(false)
                    selectBot(data.personalAssistant!.id)
                  }}
                />
              )}
            {narrow && workspaceShortcuts}
            <BotWorkspace
              pendingRow={
                pendingDraft &&
                pendingDraft.id === search.draft &&
                pendingDraft.userId === data.user.id &&
                pendingDraft.workspaceId === data.workspace.id &&
                !data.bots.some((bot) => bot.id === pendingDraft.botId)
                  ? {
                      id: pendingDraft.botId ?? pendingDraft.id,
                      text: pendingDraft.text,
                    }
                  : undefined
              }
              bots={data.bots}
              sections={data.sections}
              activity={workspaceState.activity}
              activityPending={activityQuery.isPending}
              activityError={activityQuery.isError}
              activeId={selected?.id ?? null}
              view={search}
              onViewChange={changeView}
              onSelect={selectBot}
              onCompose={(id, source) => {
                setComposerFocus({
                  botId: id,
                  handoff: composerFocusHandoff(source),
                })
                selectBot(id)
              }}
              onPrefetch={(bot) => {
                if (bot.deleted_at !== null) return
                rememberChatIdentity(queryClient, bot, data.user.id)
                void queryClient.prefetchQuery(
                  conversationRouteQuery({
                    queries: queryClient,
                    request: api,
                    workspaceId: data.workspace.id,
                    bot,
                    userId: data.user.id,
                  }),
                )
              }}
              onCreate={createDraft}
              viewerId={data.user.id}
              onChanged={refresh}
              request={workspaceRequest}
              onDuplicate={(bot) => setCopyTarget({ bot })}
            />
            {workspaceState.indexQuery.error && (
              <p className="error" role="alert">
                Workspace changes could not sync.{' '}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void workspaceState.store?.refresh()}
                >
                  Retry
                </Button>
              </p>
            )}
            {historyError && (
              <p className="error" role="alert">
                {historyError}
                <Button variant="secondary" onClick={() => setHistoryError('')}>
                  Dismiss
                </Button>
              </p>
            )}
            {workspaceState.mutationError && (
              <p className="error" role="alert">
                {workspaceState.mutationError.message}{' '}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={workspaceState.clearMutationError}
                >
                  Dismiss
                </Button>
              </p>
            )}
            <div className="sidebar-bottom">
              {debugDetails && (
                <div className="connection-indicator">
                  <span
                    className={`status-dot ${data.fixture ? 'fixture' : ''}`}
                  />
                  {data.fixture ? 'Local preview' : 'Personal workspace'}
                </div>
              )}
              <button
                className="settings-button"
                onClick={() => setSettings('general')}
              >
                <Settings size={18} />
                <span>Settings</span>
                <span className="user-avatar">
                  {data.user.username.slice(0, 1).toUpperCase()}
                </span>
              </button>
            </div>
          </ResizableSidebar>
          {narrow && (
            <button
              className="sidebar-shade"
              data-open={mobile || undefined}
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setMobile(false)}
            />
          )}
          <main className="main" inert={narrow && mobile}>
            {!selected && (search.draft || botId) && header}
            {!selected && !search.draft && !botId && params.homeSection && (
              <HomeDashboard
                toolbar={narrow && !sidebarOpen ? header : undefined}
                key={`${data.user.id}:${data.workspace.id}`}
                userId={data.user.id}
                bots={data.bots.filter(
                  (bot) => bot.id !== `kody:${data.user.id}`,
                )}
                activity={workspaceState.activity}
                fixture={data.fixture}
                connected={data.kodyConnected}
                allowed={data.policy.allowKody}
                onConversation={selectBot}
                onNew={() => createDraft(null)}
                onSettings={setSettings}
              />
            )}
            {!selected && !search.draft && botId && (
              <p className="loading">Conversation unavailable.</p>
            )}
            {search.draft && (
              <DraftBot
                key={`${data.user.id}:${data.workspace.id}:${search.draft}`}
                draftId={search.draft}
                visible={!search.settings && !copyTarget}
                parentId={search.parent ?? null}
                userId={data.user.id}
                onPending={setPendingDraft}
                onCreated={async (id, options) => {
                  const isCurrent = () =>
                    mounted.current &&
                    currentViewer.current === data.user.id &&
                    latestDraft.current === search.draft
                  if (!isCurrent()) return
                  const handoff =
                    options?.focusComposer &&
                    document.activeElement instanceof HTMLElement
                      ? composerFocusHandoff(document.activeElement)
                      : undefined
                  try {
                    await refresh()
                    if (!isCurrent()) {
                      handoff?.cancel()
                      return
                    }
                    if (handoff) setComposerFocus({ botId: id, handoff })
                    await navigate({
                      to: '/chat/b/$botId',
                      params: { botId: id },
                      search: {
                        ...clearConversationFilePanels(search),
                        conversation: undefined,
                        draft: undefined,
                        parent: undefined,
                        message: undefined,
                        view: 'bots',
                        q: '',
                      },
                      resetScroll: false,
                    })
                  } catch (error) {
                    handoff?.cancel()
                    throw error
                  }
                }}
              />
            )}
            {selected && (
              <ConversationNavigatorScope
                selected={selected}
                bots={data.bots}
                userId={data.user.id}
              >
                <ConversationNavigator
                  visible={
                    !(narrow && mobile) && !search.settings && !copyTarget
                  }
                >
                  <ConversationView
                    key={JSON.stringify([
                      data.user.id,
                      data.workspace.id,
                      selected.id,
                      search.conversation ?? selected.mainConversationId,
                    ])}
                    conversationId={search.conversation}
                    bot={selected}
                    visible={
                      !(narrow && mobile) && !search.settings && !copyTarget
                    }
                    data={data}
                    detailsTrigger={detailsTrigger}
                    header={header}
                    developer={developer}
                    refresh={refresh}
                    focusAfterCreate={
                      composerFocus?.botId === selected.id
                        ? composerFocus.handoff
                        : undefined
                    }
                    onFork={
                      selected.deleted_at === null
                        ? (messageId, conversationId) =>
                            setCopyTarget({
                              bot: selected,
                              messageId,
                              conversationId,
                            })
                        : undefined
                    }
                  />
                </ConversationNavigator>
              </ConversationNavigatorScope>
            )}
          </main>
        </div>
        {search.settings && (
          <SettingsDialog
            key={`${data.user.id}:${data.workspace.id}`}
            tab={search.settings}
            focus={search.setting}
            setTab={setSettings}
            data={data}
            developer={developer}
            setDeveloper={toggleDeveloper}
            onClose={() => setSettings(undefined)}
            refresh={refresh}
            onAccountSetupSaved={onSetupSaved}
            setupId={search.connectionSetup}
            pluginId={search.plugin}
            returnBotId={selected?.id}
            onSetup={(id) =>
              void navigate({
                to: '.',
                search: (previous: Record<string, unknown>) => ({
                  ...validateWorkspaceSearch(previous),
                  settings: 'mcp',
                  connectionSetup: id,
                  plugin: undefined,
                }),
                resetScroll: false,
              })
            }
            onPlugin={(id) =>
              void navigate({
                to: '.',
                search: (previous: Record<string, unknown>) => ({
                  ...validateWorkspaceSearch(previous),
                  settings: 'plugins',
                  plugin: id,
                  connectionSetup: undefined,
                }),
                resetScroll: false,
              })
            }
          />
        )}{' '}
        {copyTarget && (
          <CopyBotDialog
            bot={copyTarget.bot}
            bots={data.bots}
            userId={data.user.id}
            messageId={copyTarget.messageId}
            conversationId={copyTarget.conversationId}
            onClose={() => setCopyTarget(undefined)}
            onCreated={async (id) => {
              await refresh()
              setCopyTarget(undefined)
              await navigate({
                to: '/chat/b/$botId',
                params: { botId: id },
                search: {
                  ...clearConversationFilePanels(search),
                  navigation: undefined,
                  conversation: undefined,
                  view: 'bots',
                  q: '',
                  message: undefined,
                  draft: undefined,
                  parent: undefined,
                },
                resetScroll: false,
              })
            }}
          />
        )}
      </div>
    </WorkspaceCommands>
  )
}
function formatUsageUsd(usd: number) {
  return `$${usd > 0 && usd < 0.01 ? usd.toFixed(4) : usd.toFixed(2)}`
}

function UsageAllowanceBar({
  label,
  used,
  remaining,
  limit,
}: {
  label: string
  used: number
  remaining: number
  limit: number
}) {
  const percent = Math.min(100, Math.max(0, (used / limit) * 100))
  return (
    <div className="usage-allowance">
      <div className="usage-allowance-heading">
        <span>{label}</span>
        <span>
          {formatUsageUsd(used)} / {formatUsageUsd(limit)}
        </span>
      </div>
      <div
        className="usage-allowance-track"
        role="progressbar"
        aria-label={`${label} included usage`}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        aria-valuetext={`${formatUsageUsd(used)} used or reserved of ${formatUsageUsd(limit)}`}
      >
        <span
          className="usage-allowance-fill"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="usage-allowance-remaining">
        {formatUsageUsd(remaining)} left
      </span>
    </div>
  )
}

function SettingsDialog({
  tab,
  focus,
  setTab,
  data,
  developer,
  setDeveloper,
  onClose,
  refresh,
  onAccountSetupSaved,
  setupId,
  pluginId,
  returnBotId,
  onSetup,
  onPlugin,
}: {
  tab: NonNullable<WorkspaceSearch['settings']>
  focus?: SettingFocus
  setTab: (tab: WorkspaceSearch['settings']) => void
  data: Bootstrap
  developer: boolean
  setDeveloper: (value: boolean) => void
  onClose: () => void
  refresh: () => Promise<unknown>
  onAccountSetupSaved: (snapshot: OnboardingSnapshot) => void
  setupId?: string
  pluginId?: string
  returnBotId?: string
  onSetup: (id?: string) => void
  onPlugin: (id: string) => void
}) {
  const connectionPickerId = useId()
  const executionOwners = useExecutionOwners()
  const [debugDetails, setDebugDetails] = useDebugDetails()
  const [sendBehavior, setSendBehavior] = useSendBehavior()
  const { request: api } = useWorkspaceApi()
  const [connection, setConnection] = useState({
    ...data.connection,
    apiKey: '',
  })
  const [policy, setPolicy] = useState(data.policy)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmKodyUnlink, setConfirmKodyUnlink] = useState(false)
  const [recipe, setRecipe] = useState({ title: '', description: '', code: '' })
  const pendingPluginSetup = useRef<ReturnType<
    typeof prepareMcpSetupSchema.parse
  > | null>(null)
  const settingsMounted = useRef(true)
  useEffect(() => {
    settingsMounted.current = true
    return () => {
      settingsMounted.current = false
    }
  }, [])
  async function connectPlugin(target: PluginConnectionTarget) {
    const previous = pendingPluginSetup.current
    if (
      previous?.plugin &&
      (previous.plugin.installationId !== target.installationId ||
        previous.plugin.version !== target.version ||
        previous.plugin.requirementKey !== target.requirementKey)
    )
      throw Error(
        `Retry setup for ${previous.plugin.requirementKey} before starting another connection.`,
      )
    const value =
      previous ??
      prepareMcpSetupSchema.parse({
        id: crypto.randomUUID(),
        plugin: target,
        returnBotId,
      })
    pendingPluginSetup.current = value
    try {
      const setup = mcpSetupSummarySchema.parse(await api('mcp/setup', value))
      pendingPluginSetup.current = null
      if (settingsMounted.current) onSetup(setup.id)
    } catch (cause) {
      if (definiteConnectionRejection(cause)) pendingPluginSetup.current = null
      throw cause
    }
  }
  async function save(path: string, value: unknown) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api(path, value)
      await refresh()
      if (path === 'connection')
        setConnection((current) => ({
          ...current,
          apiKey: '',
          hasKey:
            current.provider !== 'included' &&
            (current.hasKey || !!current.apiKey),
        }))
      setNotice('Saved')
      if (path === 'recipes')
        setRecipe({ title: '', description: '', code: '' })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      title="Settings"
      onClose={onClose}
      className="dialog settings-dialog"
    >
      <TabPanels<NonNullable<WorkspaceSearch['settings']>>
        label="Settings"
        value={tab}
        onValueChange={setTab}
        panelClassName="settings-content"
        orientation="vertical"
        options={[
          { value: 'general', label: 'Account' },
          { value: 'preferences', label: 'Preferences' },
          { value: 'appearance', label: 'Appearance' },
          { value: 'usage', label: 'Usage' },
          { value: 'mcp', label: 'Connections' },
          { value: 'plugins', label: 'Plugins' },
          { value: 'skills', label: 'Skills' },
          { value: 'actions', label: 'Saved actions' },
          { value: 'developer', label: 'Developer' },
          ...(developer
            ? [
                { value: 'connection' as const, label: 'AI connections' },
                { value: 'contracts' as const, label: 'MCP contracts' },
                { value: 'policy' as const, label: 'Workspace policy' },
              ]
            : []),
        ]}
      >
        {tab === 'plugins' && (
          <PluginSettings
            userId={data.user.id}
            servers={data.mcpServers ?? []}
            allowMcp={data.policy.allowMcp}
            onConnections={() => onSetup(undefined)}
            initialId={pluginId}
            onConnect={connectPlugin}
          />
        )}
        {tab === 'skills' && <SkillSettings userId={data.user.id} />}
        {tab === 'mcp' && (
          <ConnectionSettings
            userId={data.user.id}
            setupId={setupId}
            onSetup={onSetup}
            onPlugin={onPlugin}
            developer={developer}
            returnBotId={returnBotId}
            allowed={data.policy.allowMcp}
            kodyAllowed={data.policy.allowKody}
            kodyConnected={data.kodyConnected}
            onKodySettings={() => setTab('general')}
            refresh={refresh}
          />
        )}
        {developer && tab === 'contracts' && <McpContractInspector />}
        <>
          {tab === 'general' && (
            <>
              <Button
                onClick={() => {
                  window.location.assign('/chat-access')
                }}
              >
                Invite someone
              </Button>
              <DeviceSettings userId={data.user.id} />
              <SettingsFocusSection
                active={focus === 'profile'}
                label="Your profile"
              >
                <AccountSetupSettings
                  userId={data.user.id}
                  onSaved={onAccountSetupSaved}
                />
              </SettingsFocusSection>
            </>
          )}
          {tab === 'appearance' && <AppearanceSettings userId={data.user.id} />}
          {tab === 'preferences' && (
            <>
              <SettingsFocusSection
                active={focus === 'timezone'}
                label="Timezone"
              >
                <InstallApp />
                <AccountTimezone userId={data.user.id} />
              </SettingsFocusSection>
              <div className="settings-row">
                <label htmlFor="send-behavior">
                  Messages sent while working
                </label>
                <SelectField
                  id="send-behavior"
                  value={sendBehavior}
                  onValueChange={(value) =>
                    setSendBehavior(
                      value === 'interrupt' ? 'interrupt' : 'queue',
                    )
                  }
                  items={[
                    { value: 'queue', label: 'Queue follow-ups' },
                    { value: 'interrupt', label: 'Interrupt and send' },
                  ]}
                />
              </div>
              <SettingsFocusSection
                active={focus === 'response'}
                label="Response preferences"
              >
                <ResponsePreferences userId={data.user.id} />
              </SettingsFocusSection>
            </>
          )}
          {tab === 'general' && (
            <>
              <div className="settings-row">
                <div>
                  <strong>Kody account</strong>
                  <p>
                    {data.fixture
                      ? 'Local fixture session'
                      : data.kodyNeedsSignIn
                        ? 'Sign in again to restore Kody access'
                        : data.kodyUsername
                          ? `@${data.kodyUsername}`
                          : data.kodyConnected
                            ? 'Connected'
                            : 'Optional integration for tools, skills, memory, and automation'}
                  </p>
                </div>
                <span className="tag">
                  {data.fixture
                    ? 'Preview'
                    : data.kodyConnected
                      ? 'Connected'
                      : 'Not connected'}
                </span>
                {!data.fixture && (
                  <div className="settings-kody-actions">
                    <AuthPopupForm action="/api/chat/kody/connect">
                      <Button type="submit" variant="ghost">
                        {data.kodyConnected ? 'Reconnect' : 'Sign in to Kody'}
                      </Button>
                    </AuthPopupForm>
                    {data.kodyConnected && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setConfirmKodyUnlink(true)}
                      >
                        Unlink
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {confirmKodyUnlink && data.kodyConnected && (
                <div className="settings-row">
                  <p>Unlink this Kody account?</p>
                  <div className="settings-kody-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setConfirmKodyUnlink(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          setBusy(true)
                          const response = await fetch(
                            '/api/chat/kody/unlink',
                            {
                              method: 'POST',
                            },
                          )
                          if (!response.ok) throw Error(await response.text())
                          setConfirmKodyUnlink(false)
                          await refresh()
                        } catch (cause) {
                          setError((cause as Error).message)
                        } finally {
                          setBusy(false)
                        }
                      }}
                      disabled={busy}
                    >
                      Unlink Kody
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
          {tab === 'developer' && (
            <>
              <div className="settings-row">
                <div>
                  <strong>Developer mode</strong>
                  <p>Model connections, code, and policy controls.</p>
                </div>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Developer mode"
                  checked={developer}
                  onChange={(e) => setDeveloper(e.target.checked)}
                />
              </div>
              <div className="settings-row">
                <div>
                  <strong>Show debug details</strong>
                  <p>
                    Environment labels, model thinking, diagnostics, and routing
                    traces.
                  </p>
                </div>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Show debug details"
                  checked={debugDetails}
                  onChange={(event) => setDebugDetails(event.target.checked)}
                />
              </div>
            </>
          )}
          {tab === 'general' && (
            <>
              {!data.fixture && (
                <form
                  onSubmit={async (event) => {
                    event.preventDefault()
                    executionOwners?.setAccount(null)
                    await authClient.signOut()
                  }}
                >
                  <Button type="submit" variant="secondary">
                    <LogOut size={15} />
                    Sign out
                  </Button>
                </form>
              )}
            </>
          )}
        </>
        {tab === 'usage' && (
          <>
            <div className="settings-row">
              <div>
                <strong>AI turns today</strong>
                <p>
                  {data.dailyTurnLimit === null
                    ? `${data.usage} turns · no limit in local development`
                    : `${data.usage} of ${data.dailyTurnLimit} turns`}
                </p>
              </div>
            </div>
            <div className="settings-row settings-allowances">
              <div className="settings-allowances-content">
                <div className="settings-allowances-title">
                  <strong>Included usage today</strong>
                  <span>Used or reserved</span>
                </div>
                <UsageAllowanceBar
                  label="You"
                  used={data.fundedSpend.estimatedUsd}
                  remaining={data.fundedSpend.remainingUsd}
                  limit={data.fundedSpend.dailyLimitUsd}
                />
                <UsageAllowanceBar
                  label="Shared"
                  used={data.fundedSpend.sharedEstimatedUsd}
                  remaining={data.fundedSpend.sharedRemainingUsd}
                  limit={data.fundedSpend.sharedDailyLimitUsd}
                />
                <p className="settings-allowances-note">
                  Resets at midnight UTC.
                  {data.fundedSpend.unknownRuns > 0
                    ? ` ${data.fundedSpend.unknownRuns} run${data.fundedSpend.unknownRuns === 1 ? '' : 's'} had unknown cost; their reservations remain held.`
                    : ''}
                </p>
              </div>
            </div>
          </>
        )}
        {tab === 'connection' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void save('connection', connection)
            }}
          >
            <label htmlFor={connectionPickerId}>
              AI connection
              <SelectField
                id={connectionPickerId}
                value={connection.provider}
                onValueChange={(value) => {
                  const saved =
                    data.connections[value as Provider] ??
                    (data.connection.provider === value
                      ? data.connection
                      : undefined)
                  setConnection({
                    provider: value as Connection['provider'],
                    model:
                      value === 'included'
                        ? data.includedModel
                        : (saved?.model ??
                          (value === 'openrouter' ? 'openrouter/auto' : '')),
                    apiKey: '',
                    accountId: saved?.accountId ?? '',
                    gatewayId: saved?.gatewayId ?? '',
                    baseUrl: saved?.baseUrl ?? '',
                    hasKey: saved?.hasKey ?? false,
                  })
                }}
                items={[
                  ...providers.map((p) => ({
                    value: p,
                    label: names[p],
                    disabled: !policy.allowedProviders.includes(p),
                  })),
                ]}
              />
            </label>
            {connection.provider === 'included' ? (
              <p className="muted">
                Included AI runs on Cloudflare. No API key needed.
              </p>
            ) : (
              <>
                <label>
                  Model ID
                  <input
                    required
                    value={connection.model}
                    onChange={(e) =>
                      setConnection({ ...connection, model: e.target.value })
                    }
                    placeholder="The provider’s model identifier"
                  />
                </label>
                <label>
                  API key
                  <input
                    type="password"
                    autoComplete="off"
                    value={connection.apiKey}
                    onChange={(e) =>
                      setConnection({ ...connection, apiKey: e.target.value })
                    }
                    placeholder={
                      data.connections[connection.provider]?.hasKey ||
                      (data.connection.hasKey &&
                        data.connection.provider === connection.provider)
                        ? 'Saved securely. Leave blank to keep.'
                        : 'Paste your provider key'
                    }
                  />
                </label>
                <p className="field-note">
                  Encrypted on the server. Never added to model context.
                </p>
                {(connection.provider === 'cloudflare' ||
                  connection.provider === 'cf_gateway') && (
                  <>
                    <label>
                      Cloudflare account ID
                      <input
                        required
                        value={connection.accountId}
                        onChange={(e) =>
                          setConnection({
                            ...connection,
                            accountId: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Gateway ID
                      {connection.provider === 'cloudflare' && ' (optional)'}
                      <input
                        required={connection.provider === 'cf_gateway'}
                        value={connection.gatewayId}
                        onChange={(e) =>
                          setConnection({
                            ...connection,
                            gatewayId: e.target.value,
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {connection.provider === 'cf_gateway' && (
                  <p className="field-note">
                    Use a Cloudflare API token with Workers AI read access.
                    Models can use Cloudflare billing or keys saved in your
                    Gateway.
                  </p>
                )}
                {connection.provider === 'compatible' && (
                  <label>
                    HTTPS API base URL
                    <input
                      type="url"
                      required
                      value={connection.baseUrl}
                      onChange={(e) =>
                        setConnection({
                          ...connection,
                          baseUrl: e.target.value,
                        })
                      }
                      placeholder="https://api.example.com/v1"
                    />
                  </label>
                )}
              </>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={busy || data.fixture}
            >
              Save connection
            </Button>
            {data.fixture && (
              <p className="field-note">
                Use live mode to save real credentials.
              </p>
            )}
          </form>
        )}
        {tab === 'policy' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void save('policy', policy)
            }}
          >
            <p className="muted">
              Applies to this personal workspace. Organization membership and
              shared company conversations are not enabled yet.
            </p>
            <fieldset>
              <legend>Allowed AI connections</legend>
              <div className="check-grid">
                {providers.map((p) => (
                  <label className="check-label" key={p}>
                    <input
                      type="checkbox"
                      checked={policy.allowedProviders.includes(p)}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          allowedProviders: e.target.checked
                            ? [...policy.allowedProviders, p]
                            : policy.allowedProviders.filter((v) => v !== p),
                        })
                      }
                    />
                    {names[p]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              Allowed model IDs (one per line, empty allows all)
              <textarea
                rows={2}
                value={policy.allowedModels.join('\n')}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    allowedModels: e.target.value.split('\n').filter(Boolean),
                  })
                }
              />
            </label>
            <label>
              Daily AI turn limit
              <input
                type="number"
                min={1}
                max={200}
                value={policy.dailyTurns}
                onChange={(e) =>
                  setPolicy({ ...policy, dailyTurns: Number(e.target.value) })
                }
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={policy.allowChatModels}
                onChange={(e) =>
                  setPolicy({ ...policy, allowChatModels: e.target.checked })
                }
              />
              Allow chat models
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={policy.allowJev}
                onChange={(e) =>
                  setPolicy({ ...policy, allowJev: e.target.checked })
                }
              />
              Allow Jev experiments
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={policy.allowKody}
                onChange={(e) =>
                  setPolicy({ ...policy, allowKody: e.target.checked })
                }
              />
              Allow Kody integration
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={policy.allowMcp}
                onChange={(e) =>
                  setPolicy({ ...policy, allowMcp: e.target.checked })
                }
              />
              Allow additional MCP servers
            </label>
            <p className="field-note">
              Workspace policy cannot restrict model calls made inside custom
              code.
            </p>
            <Button type="submit" variant="primary" disabled={busy}>
              Save policy
            </Button>
          </form>
        )}
        {tab === 'actions' && (
          <>
            <p className="muted">
              Save a reviewed action to reuse it. Run it by name with{' '}
              <code>/Action name</code>. Each execution still asks for approval.
            </p>
            {data.recipes.map((r) => (
              <div className="saved-action" key={r.id}>
                <Bookmark size={18} />
                <div>
                  <strong>{r.title}</strong>
                  <p>{r.description}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(`/${r.title}`)
                      .then(() => setNotice('Command copied'))
                  }
                >
                  <Copy size={14} />
                  Copy command
                </Button>
              </div>
            ))}
            {!developer && (
              <p className="field-note">
                Enable Developer mode to add reviewed code. You can also ask
                Kody to help create reusable software.
              </p>
            )}
            {developer && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void save('recipes', recipe)
                }}
              >
                <label>
                  Action name
                  <input
                    required
                    value={recipe.title}
                    onChange={(e) =>
                      setRecipe({ ...recipe, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  When should TanChat use it?
                  <textarea
                    required
                    rows={2}
                    value={recipe.description}
                    onChange={(e) =>
                      setRecipe({ ...recipe, description: e.target.value })
                    }
                    placeholder="Describe exactly what this action does without additional inputs."
                  />
                </label>
                <label>
                  Kody execute code
                  <textarea
                    required
                    className="code-input"
                    rows={6}
                    value={recipe.code}
                    onChange={(e) =>
                      setRecipe({ ...recipe, code: e.target.value })
                    }
                    placeholder={
                      'export default async function main() {\n  // Call your reviewed Kody package\n}'
                    }
                  />
                </label>
                <Button type="submit" variant="primary" disabled={busy}>
                  Save action
                </Button>
              </form>
            )}
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="success" role="status">
            <Check size={15} />
            {notice}
          </p>
        )}
      </TabPanels>
    </Dialog>
  )
}
