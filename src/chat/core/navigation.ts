import * as v from 'valibot'
import {
  isPanelId,
  maxWorkspacePanels,
  readPanelState,
  type PanelId,
} from './workspace-panels'

export const settingFocuses = ['profile', 'response', 'timezone'] as const
export type SettingFocus = (typeof settingFocuses)[number]

const panelSchema = v.custom<PanelId>(isPanelId)
const optionalText = (max: number, min = 1) =>
  v.fallback(
    v.optional(v.pipe(v.string(), v.minLength(min), v.maxLength(max))),
    undefined,
  )
const optionalId = v.fallback(
  v.optional(v.pipe(v.string(), v.uuid())),
  undefined,
)
const optionalBoolean = v.fallback(v.optional(v.boolean()), undefined)
const executionHistorySchema = v.strictObject({
  conversationId: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
  sessionId: v.pipe(v.string(), v.uuid()),
})
export type ExecutionHistorySelection = v.InferOutput<
  typeof executionHistorySchema
>
const navigationSchema = v.object({
  project: optionalId,
  projectTemplate: optionalText(200),
  asset: optionalText(1000),
  homeQuery: optionalText(200, 0),
  navigation: v.fallback(v.optional(v.literal(true)), undefined),
  view: v.fallback(
    v.picklist(['bots', 'recent', 'attention', 'archived', 'trash']),
    'bots',
  ),
  q: v.fallback(v.pipe(v.string(), v.maxLength(200)), ''),
  sort: v.fallback(
    v.picklist(['position', 'name', 'created', 'activity', 'unread']),
    'position',
  ),
  group: v.fallback(v.picklist(['section', 'status', 'none']), 'section'),
  sectionSort: v.fallback(
    v.optional(v.picklist(['position', 'name', 'activity'])),
    undefined,
  ),
  message: optionalText(128),
  conversation: optionalText(1000),
  executionHistory: v.fallback(v.optional(executionHistorySchema), undefined),
  navigatorSearch: v.fallback(
    v.optional(
      v.strictObject({
        rootBotId: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
        query: v.pipe(v.string(), v.maxLength(200)),
      }),
    ),
    undefined,
  ),
  thread: optionalText(1000),
  threadMessage: optionalText(128),
  draft: optionalId,
  parent: optionalText(200),
  connectionSetup: optionalId,
  plugin: optionalId,
  setting: v.fallback(v.optional(v.picklist(settingFocuses)), undefined),
  settings: v.fallback(
    v.optional(
      v.picklist([
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
      ]),
    ),
    undefined,
  ),
  panelHidden: optionalBoolean,
  panel: v.fallback(v.optional(panelSchema), undefined),
  panels: v.fallback(
    v.optional(
      v.pipe(
        v.array(v.unknown()),
        v.maxLength(maxWorkspacePanels),
        v.transform((values) => values.filter(isPanelId)),
      ),
    ),
    undefined,
  ),
  fullscreen: optionalBoolean,
  details: optionalBoolean,
})
export type WorkspaceSearch = v.InferOutput<typeof navigationSchema>
export const defaultWorkspaceSearch: WorkspaceSearch = {
  view: 'bots',
  q: '',
  sort: 'position',
  group: 'section',
}
export function validateWorkspaceSearch(
  search: Record<string, unknown>,
): WorkspaceSearch {
  const { panel, panels, fullscreen, details, ...rest } = v.parse(
    navigationSchema,
    search,
  )
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
        executionHistory: v.parse(executionHistorySchema, {
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
    !/^\/chat\/(?:w|c|b)\//.test(value) ||
    value.length > maxWorkspaceReturnPathCharacters
  )
    return '/'
  try {
    const url = new URL(value, 'https://gum.invalid')
    if (
      url.origin !== 'https://gum.invalid' ||
      url.hash ||
      !/^\/chat\/(?:w|c|b)\//.test(url.pathname) ||
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
