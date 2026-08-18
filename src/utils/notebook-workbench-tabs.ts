export type NotebookWorkbenchTabKind = 'preview' | 'editor' | 'console'

export type NotebookWorkbenchPreviewTab = {
  id: string
  kind: 'preview'
}

export type NotebookWorkbenchEditorTab = {
  id: string
  kind: 'editor'
  path: string
  filesOpen: boolean
}

export type NotebookWorkbenchConsoleTab = {
  id: string
  kind: 'console'
}

export type NotebookWorkbenchTab =
  | NotebookWorkbenchPreviewTab
  | NotebookWorkbenchEditorTab
  | NotebookWorkbenchConsoleTab

export type NotebookWorkbenchPane = {
  id: string
  tabIds: Array<string>
  activeTabId: string | null
  fraction: number
}

export type NotebookWorkbenchTabsState = {
  tabs: Array<NotebookWorkbenchTab>
  panes: Array<NotebookWorkbenchPane>
  activePaneId: string
}

export type NewNotebookWorkbenchTab =
  | { kind: 'preview' }
  | { kind: 'console' }
  | { kind: 'editor'; path: string; filesOpen?: boolean }

export type NotebookWorkbenchTabNavigationKey =
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'

export type NotebookWorkbenchSplitPosition = 'before' | 'after'

export function createNotebookWorkbenchTabsState(): NotebookWorkbenchTabsState {
  const preview = createNotebookWorkbenchTab([], { kind: 'preview' })
  return {
    tabs: [preview],
    panes: [createNotebookWorkbenchPane('pane-1', [preview.id], preview.id, 1)],
    activePaneId: 'pane-1',
  }
}

export function addNotebookWorkbenchTab(
  state: NotebookWorkbenchTabsState,
  tab: NewNotebookWorkbenchTab,
): NotebookWorkbenchTabsState {
  const nextTab = createNotebookWorkbenchTab(state.tabs, tab)
  const activePane = getActiveNotebookWorkbenchPane(state)
  if (!activePane) {
    return {
      tabs: [...state.tabs, nextTab],
      panes: [
        createNotebookWorkbenchPane('pane-1', [nextTab.id], nextTab.id, 1),
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

export function activateNotebookWorkbenchTab(
  state: NotebookWorkbenchTabsState,
  tabId: string,
): NotebookWorkbenchTabsState {
  const pane = getNotebookWorkbenchPaneForTab(state, tabId)
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

export function activateNotebookWorkbenchPane(
  state: NotebookWorkbenchTabsState,
  paneId: string,
): NotebookWorkbenchTabsState {
  if (
    state.activePaneId === paneId ||
    !state.panes.some((pane) => pane.id === paneId)
  ) {
    return state
  }
  return { ...state, activePaneId: paneId }
}

export function closeNotebookWorkbenchTab(
  state: NotebookWorkbenchTabsState,
  tabId: string,
): NotebookWorkbenchTabsState {
  const pane = getNotebookWorkbenchPaneForTab(state, tabId)
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
  const normalizedPanes = normalizeNotebookWorkbenchPaneFractions(panes)
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

export function splitNotebookWorkbenchTab(
  state: NotebookWorkbenchTabsState,
  tabId: string,
  position: NotebookWorkbenchSplitPosition,
): NotebookWorkbenchTabsState {
  const sourcePane = getNotebookWorkbenchPaneForTab(state, tabId)
  if (!sourcePane || sourcePane.tabIds.length === 1) return state

  if (state.panes.length === 2) {
    const destination = state.panes.find((pane) => pane.id !== sourcePane.id)
    return destination
      ? moveNotebookWorkbenchTab(state, tabId, destination.id)
      : state
  }

  const nextPaneId = getNextNotebookWorkbenchPaneId(state.panes)
  const nextPane = createNotebookWorkbenchPane(nextPaneId, [tabId], tabId, 0.5)
  const source = {
    ...sourcePane,
    tabIds: sourcePane.tabIds.filter((candidate) => candidate !== tabId),
    activeTabId:
      sourcePane.activeTabId === tabId
        ? getNeighborNotebookWorkbenchTabId(sourcePane, tabId)
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

export function moveNotebookWorkbenchTab(
  state: NotebookWorkbenchTabsState,
  tabId: string,
  destinationPaneId: string,
): NotebookWorkbenchTabsState {
  const sourcePane = getNotebookWorkbenchPaneForTab(state, tabId)
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
              ? getNeighborNotebookWorkbenchTabId(sourcePane, tabId)
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
    panes: normalizeNotebookWorkbenchPaneFractions(panes),
    activePaneId: destinationPane.id,
  }
}

export function resizeNotebookWorkbenchPanes(
  state: NotebookWorkbenchTabsState,
  upperFraction: number,
): NotebookWorkbenchTabsState {
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

export function updateNotebookWorkbenchEditorTab(
  state: NotebookWorkbenchTabsState,
  tabId: string,
  update: { path?: string; filesOpen?: boolean },
): NotebookWorkbenchTabsState {
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

export function repairNotebookWorkbenchEditorPaths(
  state: NotebookWorkbenchTabsState,
  availablePaths: ReadonlyArray<string>,
  replacementPath: string,
): NotebookWorkbenchTabsState {
  const available = new Set(availablePaths)
  let changed = false
  const tabs = state.tabs.map((tab) => {
    if (tab.kind !== 'editor' || available.has(tab.path)) return tab

    changed = true
    return { ...tab, path: replacementPath }
  })
  return changed ? { ...state, tabs } : state
}

export function getNotebookWorkbenchTabLabel(
  tabs: ReadonlyArray<NotebookWorkbenchTab>,
  tab: NotebookWorkbenchTab,
) {
  let ordinal = 0
  for (const candidate of tabs) {
    if (candidate.kind === tab.kind) ordinal += 1
    if (candidate.id === tab.id) break
  }

  const name =
    tab.kind === 'preview'
      ? 'Preview'
      : tab.kind === 'editor'
        ? 'Editor'
        : 'Console'
  const count = tabs.filter((candidate) => candidate.kind === tab.kind).length
  return count === 1 ? name : `${name} ${ordinal}`
}

export function getActiveNotebookWorkbenchPane(
  state: NotebookWorkbenchTabsState,
) {
  return state.panes.find((pane) => pane.id === state.activePaneId)
}

export function getActiveNotebookWorkbenchTab(
  state: NotebookWorkbenchTabsState,
) {
  const pane = getActiveNotebookWorkbenchPane(state)
  return state.tabs.find((tab) => tab.id === pane?.activeTabId)
}

export function getNotebookWorkbenchPaneForTab(
  state: NotebookWorkbenchTabsState,
  tabId: string,
) {
  return state.panes.find((pane) => pane.tabIds.includes(tabId))
}

export function getNotebookWorkbenchPaneTabs(
  state: NotebookWorkbenchTabsState,
  pane: NotebookWorkbenchPane,
) {
  const tabs = new Map(state.tabs.map((tab) => [tab.id, tab]))
  return pane.tabIds.flatMap((id) => {
    const tab = tabs.get(id)
    return tab ? [tab] : []
  })
}

export function getNotebookWorkbenchTabNavigationTarget(
  state: NotebookWorkbenchTabsState,
  tabId: string,
  key: NotebookWorkbenchTabNavigationKey,
) {
  const pane = getNotebookWorkbenchPaneForTab(state, tabId)
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

function createNotebookWorkbenchPane(
  id: string,
  tabIds: Array<string>,
  activeTabId: string | null,
  fraction: number,
): NotebookWorkbenchPane {
  return { id, tabIds, activeTabId, fraction }
}

function createNotebookWorkbenchTab(
  tabs: ReadonlyArray<NotebookWorkbenchTab>,
  tab: NewNotebookWorkbenchTab,
): NotebookWorkbenchTab {
  const id = getNextNotebookWorkbenchTabId(tabs)
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

function getNeighborNotebookWorkbenchTabId(
  pane: NotebookWorkbenchPane,
  tabId: string,
) {
  const index = pane.tabIds.indexOf(tabId)
  return pane.tabIds[index + 1] ?? pane.tabIds[index - 1] ?? null
}

function getNextNotebookWorkbenchTabId(
  tabs: ReadonlyArray<NotebookWorkbenchTab>,
) {
  const ids = new Set(tabs.map((tab) => tab.id))
  let ordinal = 1
  while (ids.has(`tab-${ordinal}`)) ordinal += 1
  return `tab-${ordinal}`
}

function getNextNotebookWorkbenchPaneId(
  panes: ReadonlyArray<NotebookWorkbenchPane>,
) {
  const ids = new Set(panes.map((pane) => pane.id))
  let ordinal = 1
  while (ids.has(`pane-${ordinal}`)) ordinal += 1
  return `pane-${ordinal}`
}

function normalizeNotebookWorkbenchPaneFractions(
  panes: Array<NotebookWorkbenchPane>,
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
