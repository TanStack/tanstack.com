/** Workspace previews stay disabled until the sandbox runtime is released. */
export const workspacePreviewsEnabled = false

import type { WorkspaceSearch } from './navigation'

export const workspacePanelIds = [
  'summary',
  'usage',
  'activity',
  'files',
  'projects',
  'schedules',
  'memory',
  'mail',
  'commands',
  'preview',
  'browser',
] as const
export type BuiltinPanelId = (typeof workspacePanelIds)[number]
/** URL syntax never grants execution access. Callers supply the current gate. */
export function availableWorkspacePanels(
  executionAvailable = false,
  desktopBrowserAvailable = false,
  kodyAvailable = false,
  projectsAvailable = false,
): readonly BuiltinPanelId[] {
  return workspacePanelIds.filter(
    (id) =>
      (id !== 'preview' || workspacePreviewsEnabled) &&
      ((id !== 'commands' && id !== 'preview') || executionAvailable) &&
      (id !== 'projects' || projectsAvailable) &&
      (id !== 'browser' || desktopBrowserAvailable) &&
      (id !== 'mail' || kodyAvailable),
  )
}
export type PanelId =
  | BuiltinPanelId
  | `file:${string}`
  | `source:${string}`
  | `diff:${string}:${string}`
  | 'thread'
export const maxWorkspacePanels = 8
const fileIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type FilePanel =
  | { kind: 'file' | 'source'; fileId: string }
  | { kind: 'diff'; beforeId: string; afterId: string }

/** Resource names and paths never stand in for scoped file identities. */
export function readFilePanel(value: unknown): FilePanel | undefined {
  if (typeof value !== 'string') return
  const [kind, first, second, extra] = value.split(':')
  if (!first || !fileIdPattern.test(first)) return
  if ((kind === 'file' || kind === 'source') && second === undefined)
    return { kind, fileId: first }
  if (
    kind === 'diff' &&
    second &&
    fileIdPattern.test(second) &&
    extra === undefined
  )
    return { kind, beforeId: first, afterId: second }
}

export interface WorkspacePanelState {
  tabs: PanelId[]
  active?: PanelId
  hidden?: boolean
  fullscreen: boolean
}

export function isPanelId(value: unknown): value is PanelId {
  return (
    workspacePanelIds.some((id) => id === value) ||
    value === 'thread' ||
    readFilePanel(value) !== undefined
  )
}

export function readPanelState(search: {
  panelHidden?: unknown
  panel?: unknown
  panels?: unknown
  fullscreen?: unknown
}): WorkspacePanelState {
  const tabs =
    Array.isArray(search.panels) && search.panels.length <= maxWorkspacePanels
      ? [...new Set(search.panels.filter(isPanelId))]
      : []
  const active = isPanelId(search.panel) ? search.panel : tabs[0]
  if (active && !tabs.includes(active)) {
    if (tabs.length === maxWorkspacePanels) tabs.shift()
    tabs.push(active)
  }
  return {
    tabs,
    ...(search.panelHidden === true ? { hidden: true } : {}),
    ...(active ? { active } : {}),
    fullscreen: Boolean(active && search.fullscreen === true),
  }
}

function writePanelState(
  search: WorkspaceSearch,
  state: WorkspacePanelState,
): WorkspaceSearch {
  const {
    panelHidden: _hidden,
    panel: _panel,
    panels: _panels,
    fullscreen: _fullscreen,
    ...rest
  } = search
  if (!state.active) return rest
  return {
    ...rest,
    ...(state.hidden ? { panelHidden: true } : {}),
    panel: state.active,
    panels: state.tabs,
    ...(state.fullscreen ? { fullscreen: true } : {}),
  }
}

/** Resource identities belong to their original conversation. Builtin views can follow navigation. */
export function clearConversationFilePanels(
  search: WorkspaceSearch,
): WorkspaceSearch {
  const {
    thread: _thread,
    threadMessage: _threadMessage,
    executionHistory: _executionHistory,
    ...rest
  } = search
  const state = readPanelState(rest)
  const tabs = state.tabs.filter((id) => !readFilePanel(id) && id !== 'thread')
  const active =
    state.active && tabs.includes(state.active) ? state.active : tabs[0]
  return writePanelState(rest, {
    tabs,
    active,
    fullscreen: Boolean(active && state.fullscreen),
  })
}

export function openWorkspacePanel(
  search: WorkspaceSearch,
  id: PanelId,
): WorkspaceSearch {
  if (id === 'summary') return { ...search, details: true }
  const state = readPanelState(search)
  if (!isPanelId(id)) return writePanelState(search, state)
  if (!state.tabs.includes(id)) {
    if (state.tabs.length === maxWorkspacePanels) state.tabs.shift()
    state.tabs.push(id)
  }
  return writePanelState(search, { ...state, active: id, hidden: false })
}

export function closeWorkspacePanel(
  search: WorkspaceSearch,
  id: PanelId,
): WorkspaceSearch {
  const state = readPanelState(search)
  const index = state.tabs.indexOf(id)
  if (index === -1) return writePanelState(search, state)
  state.tabs.splice(index, 1)
  if (state.active === id)
    state.active = state.tabs[Math.min(index, state.tabs.length - 1)]
  return writePanelState(search, state)
}

export function selectWorkspacePanel(
  search: WorkspaceSearch,
  id: PanelId,
): WorkspaceSearch {
  return openWorkspacePanel(search, id)
}

export function togglePanelFullscreen(
  search: WorkspaceSearch,
): WorkspaceSearch {
  const state = readPanelState(search)
  return writePanelState(search, {
    ...state,
    fullscreen: Boolean(state.active && !state.fullscreen),
  })
}
