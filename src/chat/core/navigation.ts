import { z } from 'zod'
import {
  isPanelId,
  maxWorkspacePanels,
  readPanelState,
  type PanelId,
} from './workspace-panels'

export const settingFocuses = ['profile', 'response', 'timezone'] as const
export type SettingFocus = (typeof settingFocuses)[number]

const panelSchema = z.custom<PanelId>(isPanelId)
const executionHistorySchema = z.strictObject({
  conversationId: z.string().min(1).max(1000),
  sessionId: z.uuid(),
})
export type ExecutionHistorySelection = z.infer<typeof executionHistorySchema>

const navigationSchema = z.object({
  project: z.uuid().optional().catch(undefined),
  projectTemplate: z.string().min(1).max(200).optional().catch(undefined),
  asset: z.string().min(1).max(1000).optional().catch(undefined),
  homeQuery: z.string().max(200).optional().catch(undefined),
  navigation: z.literal(true).optional().catch(undefined),
  view: z
    .enum(['bots', 'recent', 'attention', 'archived', 'trash'])
    .catch('bots'),
  q: z.string().max(200).catch(''),
  sort: z
    .enum(['position', 'name', 'created', 'activity', 'unread'])
    .catch('position'),
  group: z.enum(['section', 'status', 'none']).catch('section'),
  sectionSort: z
    .enum(['position', 'name', 'activity'])
    .optional()
    .catch(undefined),
  message: z.string().min(1).max(128).optional().catch(undefined),
  conversation: z.string().min(1).max(1000).optional().catch(undefined),
  executionHistory: executionHistorySchema.optional().catch(undefined),
  navigatorSearch: z
    .strictObject({
      rootBotId: z.string().min(1).max(200),
      query: z.string().max(200),
    })
    .optional()
    .catch(undefined),
  thread: z.string().min(1).max(1000).optional().catch(undefined),
  threadMessage: z.string().min(1).max(128).optional().catch(undefined),
  draft: z.string().uuid().optional().catch(undefined),
  parent: z.string().min(1).max(200).optional().catch(undefined),
  connectionSetup: z.string().uuid().optional().catch(undefined),
  plugin: z.string().uuid().optional().catch(undefined),
  setting: z.enum(settingFocuses).optional().catch(undefined),
  settings: z
    .enum([
      'general',
      'preferences',
      'appearance',
      'developer',
      'usage',
      'connection',
      'actions',
      'policy',
      'mcp',
      'contracts',
      'skills',
      'plugins',
    ])
    .optional()
    .catch(undefined),
  panelHidden: z.boolean().optional().catch(undefined),
  panel: panelSchema.optional().catch(undefined),
  panels: z
    .array(z.unknown())
    .max(maxWorkspacePanels)
    .transform((values) => values.filter(isPanelId))
    .optional()
    .catch(undefined),
  fullscreen: z.boolean().optional().catch(undefined),
  details: z.boolean().optional().catch(undefined),
})

export type WorkspaceSearch = z.infer<typeof navigationSchema>
export const defaultWorkspaceSearch: WorkspaceSearch = {
  view: 'bots',
  q: '',
  sort: 'position',
  group: 'section',
}
export function validateWorkspaceSearch(
  search: Record<string, unknown>,
): WorkspaceSearch {
  const { panel, panels, fullscreen, details, ...rest } =
    navigationSchema.parse(search)
  if (
    rest.settings === 'general' &&
    (rest.setting === 'response' || rest.setting === 'timezone')
  )
    rest.settings = 'preferences'
  if (
    !(
      (rest.settings === 'general' && rest.setting === 'profile') ||
      (rest.settings === 'preferences' &&
        (rest.setting === 'response' || rest.setting === 'timezone'))
    )
  )
    delete rest.setting
  if (rest.draft) delete rest.executionHistory
  // Old Details links now open the independent card, never a workspace tab.
  const legacyDetails = (panel ?? panels?.[0]) === 'summary'
  const state = readPanelState({
    panel: panel === 'summary' ? undefined : panel,
    panels: panels?.filter((id) => id !== 'summary'),
    fullscreen: legacyDetails ? undefined : fullscreen,
  })
  if (!rest.thread || rest.thread === rest.conversation) {
    delete rest.thread
    delete rest.threadMessage
    state.tabs = state.tabs.filter((id) => id !== 'thread')
    if (state.active === 'thread') state.active = state.tabs[0]
  }
  return {
    ...rest,
    ...((details ?? legacyDetails) ? { details: true } : {}),
    ...(state.active
      ? {
          panel: state.active,
          panels: state.tabs,
          ...(state.fullscreen ? { fullscreen: true } : {}),
        }
      : {}),
  }
}

/** A selected receipt is a read destination, never a grant to operate a runtime. */
export function executionHistorySession(
  selection: ExecutionHistorySelection | undefined,
  conversationId: string,
): string | undefined {
  return selection?.conversationId === conversationId
    ? selection.sessionId
    : undefined
}

export function selectExecutionHistory(
  search: WorkspaceSearch,
  conversationId: string,
  sessionId: string | undefined,
): WorkspaceSearch {
  const { executionHistory: _history, ...rest } = search
  return sessionId === undefined
    ? rest
    : {
        ...rest,
        executionHistory: executionHistorySchema.parse({
          conversationId,
          sessionId,
        }),
      }
}

// Includes three 1000-character opaque conversation IDs, bounded route/filter IDs,
// and eight file tabs at UTF-8 percent encoding's maximum expansion.
export const maxWorkspaceReturnPathCharacters = 48_000

// Both saving and consuming the sign-in return path use this same boundary.
// Never let a saved return destination leave this application's navigation space.
export function signInDestination(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\/chat\/w\//.test(value) ||
    value.length > maxWorkspaceReturnPathCharacters
  )
    return '/'
  try {
    const url = new URL(value, 'https://gum.invalid')
    if (
      url.origin !== 'https://gum.invalid' ||
      url.hash ||
      !url.pathname.startsWith('/chat/w/') ||
      url.pathname.startsWith('//')
    )
      return '/'
    const destination = url.pathname + url.search
    return destination.length <= maxWorkspaceReturnPathCharacters
      ? destination
      : '/'
  } catch {
    return '/'
  }
}
