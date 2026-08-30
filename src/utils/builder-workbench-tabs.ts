export type BuilderWorkbenchTabKind = 'preview' | 'editor' | 'console'

export type BuilderWorkbenchPreviewTab = {
  id: string
  kind: 'preview'
}

export type BuilderWorkbenchEditorTab = {
  id: string
  kind: 'editor'
  path: string
  filesOpen: boolean
}

export type BuilderWorkbenchConsoleTab = {
  id: string
  kind: 'console'
}

export type BuilderWorkbenchTab =
  | BuilderWorkbenchPreviewTab
  | BuilderWorkbenchEditorTab
  | BuilderWorkbenchConsoleTab

export type BuilderWorkbenchPane = {
  id: string
  tabIds: Array<string>
  activeTabId: string | null
  fraction: number
}

export type BuilderWorkbenchTabsState = {
  tabs: Array<BuilderWorkbenchTab>
  panes: Array<BuilderWorkbenchPane>
  activePaneId: string
}

export type NewBuilderWorkbenchTab =
  | { kind: 'preview' }
  | { kind: 'console' }
  | { kind: 'editor'; path: string; filesOpen?: boolean }

export type BuilderWorkbenchTabNavigationKey =
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'

export type BuilderWorkbenchSplitPosition = 'before' | 'after'

export function createBuilderWorkbenchTabsState(): BuilderWorkbenchTabsState {
  const preview = createBuilderWorkbenchTab([], { kind: 'preview' })
  return {
    tabs: [preview],
    panes: [createBuilderWorkbenchPane('pane-1', [preview.id], preview.id, 1)],
    activePaneId: 'pane-1',
  }
}

export function addBuilderWorkbenchTab(
  state: BuilderWorkbenchTabsState,
  tab: NewBuilderWorkbenchTab,
): BuilderWorkbenchTabsState {
  const nextTab = createBuilderWorkbenchTab(state.tabs, tab)
  const activePane = getActiveBuilderWorkbenchPane(state)
  if (!activePane) {
    return {
      tabs: [...state.tabs, nextTab],
      panes: [
        createBuilderWorkbenchPane('pane-1', [nextTab.id], nextTab.id, 1),
      ],
      activePaneId: 'pane-1',
    }
  }

  return {
    ...state,
    tabs: [...state.tabs, nextTab],
    panes: state.panes.map((pane) =>
      pane.id === activePane.id
        ? {
            ...pane,
            tabIds: [...pane.tabIds, nextTab.id],
            activeTabId: nextTab.id,
          }
        : pane,
    ),
  }
}

export function activateBuilderWorkbenchTab(
  state: BuilderWorkbenchTabsState,
  tabId: string,
): BuilderWorkbenchTabsState {
  const pane = getBuilderWorkbenchPaneForTab(state, tabId)
  if (!pane) return state
  if (state.activePaneId === pane.id && pane.activeTabId === tabId) return state

  return {
    ...state,
    activePaneId: pane.id,
    panes: state.panes.map((candidate) =>
      candidate.id === pane.id
        ? { ...candidate, activeTabId: tabId }
        : candidate,
    ),
  }
}

export function activateBuilderWorkbenchPane(
  state: BuilderWorkbenchTabsState,
  paneId: string,
): BuilderWorkbenchTabsState {
  if (
    state.activePaneId === paneId ||
    !state.panes.some((pane) => pane.id === paneId)
  ) {
    return state
  }
  return { ...state, activePaneId: paneId }
}

export function closeBuilderWorkbenchTab(
  state: BuilderWorkbenchTabsState,
  tabId: string,
): BuilderWorkbenchTabsState {
  const pane = getBuilderWorkbenchPaneForTab(state, tabId)
  if (!pane) return state

  const closedIndex = pane.tabIds.indexOf(tabId)
  const nextTabIds = pane.tabIds.filter((candidate) => candidate !== tabId)
  const nextActiveTabId =
    pane.activeTabId === tabId
      ? (nextTabIds[Math.min(closedIndex, nextTabIds.length - 1)] ?? null)
      : pane.activeTabId
  const panes = state.panes
    .map((candidate) =>
      candidate.id === pane.id
        ? {
            ...candidate,
            tabIds: nextTabIds,
            activeTabId: nextActiveTabId,
          }
        : candidate,
    )
    .filter((candidate) => candidate.tabIds.length > 0)
  const normalizedPanes = normalizeBuilderWorkbenchPaneFractions(panes)
  const activePaneId = normalizedPanes.some(
    (candidate) => candidate.id === state.activePaneId,
  )
    ? state.activePaneId
    : (normalizedPanes[0]?.id ?? 'pane-1')

  return {
    tabs: state.tabs.filter((tab) => tab.id !== tabId),
    panes: normalizedPanes,
    activePaneId,
  }
}

export function splitBuilderWorkbenchTab(
  state: BuilderWorkbenchTabsState,
  tabId: string,
  position: BuilderWorkbenchSplitPosition,
): BuilderWorkbenchTabsState {
  const sourcePane = getBuilderWorkbenchPaneForTab(state, tabId)
  if (!sourcePane || sourcePane.tabIds.length === 1) return state

  if (state.panes.length === 2) {
    const destination = state.panes.find((pane) => pane.id !== sourcePane.id)
    return destination
      ? moveBuilderWorkbenchTab(state, tabId, destination.id)
      : state
  }

  const nextPaneId = getNextBuilderWorkbenchPaneId(state.panes)
  const nextPane = createBuilderWorkbenchPane(nextPaneId, [tabId], tabId, 0.5)
  const source = {
    ...sourcePane,
    tabIds: sourcePane.tabIds.filter((candidate) => candidate !== tabId),
    activeTabId:
      sourcePane.activeTabId === tabId
        ? getNeighborBuilderWorkbenchTabId(sourcePane, tabId)
        : sourcePane.activeTabId,
    fraction: 0.5,
  }
  const panes = position === 'before' ? [nextPane, source] : [source, nextPane]

  return {
    ...state,
    panes,
    activePaneId: nextPaneId,
  }
}

export function moveBuilderWorkbenchTab(
  state: BuilderWorkbenchTabsState,
  tabId: string,
  destinationPaneId: string,
): BuilderWorkbenchTabsState {
  const sourcePane = getBuilderWorkbenchPaneForTab(state, tabId)
  const destinationPane = state.panes.find(
    (pane) => pane.id === destinationPaneId,
  )
  if (!sourcePane || !destinationPane || sourcePane.id === destinationPane.id) {
    return state
  }

  const sourceTabIds = sourcePane.tabIds.filter(
    (candidate) => candidate !== tabId,
  )
  const panes = state.panes
    .map((pane) => {
      if (pane.id === sourcePane.id) {
        return {
          ...pane,
          tabIds: sourceTabIds,
          activeTabId:
            sourcePane.activeTabId === tabId
              ? getNeighborBuilderWorkbenchTabId(sourcePane, tabId)
              : sourcePane.activeTabId,
        }
      }
      if (pane.id === destinationPane.id) {
        return {
          ...pane,
          tabIds: [...pane.tabIds, tabId],
          activeTabId: tabId,
        }
      }
      return pane
    })
    .filter((pane) => pane.tabIds.length > 0)

  return {
    ...state,
    panes: normalizeBuilderWorkbenchPaneFractions(panes),
    activePaneId: destinationPane.id,
  }
}

export function resizeBuilderWorkbenchPanes(
  state: BuilderWorkbenchTabsState,
  upperFraction: number,
): BuilderWorkbenchTabsState {
  if (state.panes.length !== 2) return state
  const clamped = Math.min(0.8, Math.max(0.2, upperFraction))
  if (
    state.panes[0].fraction === clamped &&
    state.panes[1].fraction === 1 - clamped
  ) {
    return state
  }
  return {
    ...state,
    panes: state.panes.map((pane, index) => ({
      ...pane,
      fraction: index === 0 ? clamped : 1 - clamped,
    })),
  }
}

export function updateBuilderWorkbenchEditorTab(
  state: BuilderWorkbenchTabsState,
  tabId: string,
  update: { path?: string; filesOpen?: boolean },
): BuilderWorkbenchTabsState {
  let changed = false
  const tabs = state.tabs.map((tab) => {
    if (tab.id !== tabId || tab.kind !== 'editor') return tab

    const path = update.path ?? tab.path
    const filesOpen = update.filesOpen ?? tab.filesOpen
    if (path === tab.path && filesOpen === tab.filesOpen) return tab

    changed = true
    return { ...tab, path, filesOpen }
  })
  return changed ? { ...state, tabs } : state
}

export function repairBuilderWorkbenchEditorPaths(
  state: BuilderWorkbenchTabsState,
  availablePaths: ReadonlyArray<string>,
  replacementPath: string,
): BuilderWorkbenchTabsState {
  const available = new Set(availablePaths)
  let changed = false
  const tabs = state.tabs.map((tab) => {
    if (tab.kind !== 'editor' || available.has(tab.path)) return tab

    changed = true
    return { ...tab, path: replacementPath }
  })
  return changed ? { ...state, tabs } : state
}

export function getBuilderWorkbenchTabLabel(
  tabs: ReadonlyArray<BuilderWorkbenchTab>,
  tab: BuilderWorkbenchTab,
) {
  if (tab.kind === 'editor') return tab.path

  let ordinal = 0
  for (const candidate of tabs) {
    if (candidate.kind === tab.kind) ordinal += 1
    if (candidate.id === tab.id) break
  }

  const name = tab.kind === 'preview' ? 'Preview' : 'Console'
  const count = tabs.filter((candidate) => candidate.kind === tab.kind).length
  return count === 1 ? name : `${name} ${ordinal}`
}

export function getActiveBuilderWorkbenchPane(
  state: BuilderWorkbenchTabsState,
) {
  return state.panes.find((pane) => pane.id === state.activePaneId)
}

export function getActiveBuilderWorkbenchTab(state: BuilderWorkbenchTabsState) {
  const pane = getActiveBuilderWorkbenchPane(state)
  return state.tabs.find((tab) => tab.id === pane?.activeTabId)
}

export function getBuilderWorkbenchPaneForTab(
  state: BuilderWorkbenchTabsState,
  tabId: string,
) {
  return state.panes.find((pane) => pane.tabIds.includes(tabId))
}

export function getBuilderWorkbenchPaneTabs(
  state: BuilderWorkbenchTabsState,
  pane: BuilderWorkbenchPane,
) {
  const tabs = new Map(state.tabs.map((tab) => [tab.id, tab]))
  return pane.tabIds.flatMap((id) => {
    const tab = tabs.get(id)
    return tab ? [tab] : []
  })
}

export function getBuilderWorkbenchTabNavigationTarget(
  state: BuilderWorkbenchTabsState,
  tabId: string,
  key: BuilderWorkbenchTabNavigationKey,
) {
  const pane = getBuilderWorkbenchPaneForTab(state, tabId)
  if (!pane || pane.tabIds.length === 0) return null
  if (key === 'Home') return pane.tabIds[0]
  if (key === 'End') return pane.tabIds[pane.tabIds.length - 1]

  const activeIndex = pane.tabIds.indexOf(tabId)
  if (activeIndex === -1) return pane.tabIds[0]

  const offset = key === 'ArrowRight' ? 1 : -1
  const targetIndex =
    (activeIndex + offset + pane.tabIds.length) % pane.tabIds.length
  return pane.tabIds[targetIndex]
}

function createBuilderWorkbenchPane(
  id: string,
  tabIds: Array<string>,
  activeTabId: string | null,
  fraction: number,
): BuilderWorkbenchPane {
  return { id, tabIds, activeTabId, fraction }
}

function createBuilderWorkbenchTab(
  tabs: ReadonlyArray<BuilderWorkbenchTab>,
  tab: NewBuilderWorkbenchTab,
): BuilderWorkbenchTab {
  const id = getNextBuilderWorkbenchTabId(tabs)
  if (tab.kind === 'editor') {
    return {
      id,
      kind: tab.kind,
      path: tab.path,
      filesOpen: tab.filesOpen ?? false,
    }
  }
  return { id, kind: tab.kind }
}

function getNeighborBuilderWorkbenchTabId(
  pane: BuilderWorkbenchPane,
  tabId: string,
) {
  const index = pane.tabIds.indexOf(tabId)
  return pane.tabIds[index + 1] ?? pane.tabIds[index - 1] ?? null
}

function getNextBuilderWorkbenchTabId(
  tabs: ReadonlyArray<BuilderWorkbenchTab>,
) {
  const ids = new Set(tabs.map((tab) => tab.id))
  let ordinal = 1
  while (ids.has(`tab-${ordinal}`)) ordinal += 1
  return `tab-${ordinal}`
}

function getNextBuilderWorkbenchPaneId(
  panes: ReadonlyArray<BuilderWorkbenchPane>,
) {
  const ids = new Set(panes.map((pane) => pane.id))
  let ordinal = 1
  while (ids.has(`pane-${ordinal}`)) ordinal += 1
  return `pane-${ordinal}`
}

function normalizeBuilderWorkbenchPaneFractions(
  panes: Array<BuilderWorkbenchPane>,
) {
  if (panes.length === 1) return [{ ...panes[0], fraction: 1 }]
  if (panes.length === 2) {
    const total = panes[0].fraction + panes[1].fraction
    return total > 0
      ? panes.map((pane) => ({ ...pane, fraction: pane.fraction / total }))
      : panes.map((pane) => ({ ...pane, fraction: 0.5 }))
  }
  return panes
}
