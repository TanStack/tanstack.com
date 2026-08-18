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

export type NotebookWorkbenchTabsState = {
  tabs: Array<NotebookWorkbenchTab>
  activeTabId: string | null
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

export function createNotebookWorkbenchTabsState(): NotebookWorkbenchTabsState {
  const preview = createNotebookWorkbenchTab([], { kind: 'preview' })
  return { tabs: [preview], activeTabId: preview.id }
}

export function addNotebookWorkbenchTab(
  state: NotebookWorkbenchTabsState,
  tab: NewNotebookWorkbenchTab,
): NotebookWorkbenchTabsState {
  const nextTab = createNotebookWorkbenchTab(state.tabs, tab)
  return {
    tabs: [...state.tabs, nextTab],
    activeTabId: nextTab.id,
  }
}

export function activateNotebookWorkbenchTab(
  state: NotebookWorkbenchTabsState,
  tabId: string,
): NotebookWorkbenchTabsState {
  if (
    state.activeTabId === tabId ||
    !state.tabs.some((tab) => tab.id === tabId)
  ) {
    return state
  }
  return { ...state, activeTabId: tabId }
}

export function closeNotebookWorkbenchTab(
  state: NotebookWorkbenchTabsState,
  tabId: string,
): NotebookWorkbenchTabsState {
  const closedIndex = state.tabs.findIndex((tab) => tab.id === tabId)
  if (closedIndex === -1) return state

  const tabs = state.tabs.filter((tab) => tab.id !== tabId)
  if (state.activeTabId !== tabId) return { ...state, tabs }

  return {
    tabs,
    activeTabId: tabs[Math.min(closedIndex, tabs.length - 1)]?.id ?? null,
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

export function getNotebookWorkbenchTabNavigationTarget(
  state: NotebookWorkbenchTabsState,
  key: NotebookWorkbenchTabNavigationKey,
) {
  if (state.tabs.length === 0) return null
  if (key === 'Home') return state.tabs[0].id
  if (key === 'End') return state.tabs[state.tabs.length - 1].id

  const activeIndex = state.tabs.findIndex(
    (tab) => tab.id === state.activeTabId,
  )
  if (activeIndex === -1) return state.tabs[0].id

  const offset = key === 'ArrowRight' ? 1 : -1
  const targetIndex =
    (activeIndex + offset + state.tabs.length) % state.tabs.length
  return state.tabs[targetIndex].id
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

function getNextNotebookWorkbenchTabId(
  tabs: ReadonlyArray<NotebookWorkbenchTab>,
) {
  const ids = new Set(tabs.map((tab) => tab.id))
  let ordinal = 1
  while (ids.has(`tab-${ordinal}`)) ordinal += 1
  return `tab-${ordinal}`
}
