import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activateNotebookWorkbenchTab,
  addNotebookWorkbenchTab,
  closeNotebookWorkbenchTab,
  createNotebookWorkbenchTabsState,
  getActiveNotebookWorkbenchTab,
  getNotebookWorkbenchPaneForTab,
  getNotebookWorkbenchPaneTabs,
  getNotebookWorkbenchTabLabel,
  getNotebookWorkbenchTabNavigationTarget,
  moveNotebookWorkbenchTab,
  repairNotebookWorkbenchEditorPaths,
  resizeNotebookWorkbenchPanes,
  splitNotebookWorkbenchTab,
  updateNotebookWorkbenchEditorTab,
} from '../src/utils/notebook-workbench-tabs'

test('starts with one active preview pane', () => {
  assert.deepEqual(createNotebookWorkbenchTabsState(), {
    tabs: [{ id: 'tab-1', kind: 'preview' }],
    panes: [
      {
        id: 'pane-1',
        tabIds: ['tab-1'],
        activeTabId: 'tab-1',
        fraction: 1,
      },
    ],
    activePaneId: 'pane-1',
  })
})

test('adds tabs to the focused pane with unique ids and ordinal labels', () => {
  let state = createNotebookWorkbenchTabsState()
  state = addNotebookWorkbenchTab(state, { kind: 'preview' })
  state = addNotebookWorkbenchTab(state, {
    kind: 'editor',
    path: '/index.tsx',
    filesOpen: true,
  })
  state = addNotebookWorkbenchTab(state, { kind: 'console' })
  state = addNotebookWorkbenchTab(state, {
    kind: 'editor',
    path: '/styles.css',
  })

  assert.deepEqual(
    state.tabs.map((tab) => tab.id),
    ['tab-1', 'tab-2', 'tab-3', 'tab-4', 'tab-5'],
  )
  assert.deepEqual(
    state.tabs.map((tab) => getNotebookWorkbenchTabLabel(state.tabs, tab)),
    ['Preview 1', 'Preview 2', 'Editor 1', 'Console', 'Editor 2'],
  )
  assert.deepEqual(state.panes[0].tabIds, [
    'tab-1',
    'tab-2',
    'tab-3',
    'tab-4',
    'tab-5',
  ])
  assert.deepEqual(getActiveNotebookWorkbenchTab(state), state.tabs[4])
})

test('splits a tab above or below and focuses the new pane', () => {
  let state = addNotebookWorkbenchTab(createNotebookWorkbenchTabsState(), {
    kind: 'editor',
    path: '/index.tsx',
  })
  state = splitNotebookWorkbenchTab(state, 'tab-2', 'after')

  assert.deepEqual(
    state.panes.map((pane) => ({
      id: pane.id,
      tabIds: pane.tabIds,
      activeTabId: pane.activeTabId,
      fraction: pane.fraction,
    })),
    [
      {
        id: 'pane-1',
        tabIds: ['tab-1'],
        activeTabId: 'tab-1',
        fraction: 0.5,
      },
      {
        id: 'pane-2',
        tabIds: ['tab-2'],
        activeTabId: 'tab-2',
        fraction: 0.5,
      },
    ],
  )
  assert.equal(state.activePaneId, 'pane-2')

  let above = addNotebookWorkbenchTab(createNotebookWorkbenchTabsState(), {
    kind: 'console',
  })
  above = splitNotebookWorkbenchTab(above, 'tab-2', 'before')
  assert.deepEqual(
    above.panes.map((pane) => pane.tabIds),
    [['tab-2'], ['tab-1']],
  )
  assert.equal(
    splitNotebookWorkbenchTab(
      createNotebookWorkbenchTabsState(),
      'tab-1',
      'after',
    ).panes.length,
    1,
  )

  let inactive = createNotebookWorkbenchTabsState()
  inactive = addNotebookWorkbenchTab(inactive, {
    kind: 'editor',
    path: '/index.tsx',
  })
  inactive = addNotebookWorkbenchTab(inactive, { kind: 'preview' })
  inactive = activateNotebookWorkbenchTab(inactive, 'tab-1')
  inactive = splitNotebookWorkbenchTab(inactive, 'tab-3', 'after')
  assert.equal(inactive.panes[0].activeTabId, 'tab-1')
})

test('moves tabs between panes and collapses an empty source pane', () => {
  let state = createNotebookWorkbenchTabsState()
  state = addNotebookWorkbenchTab(state, { kind: 'editor', path: '/index.tsx' })
  state = addNotebookWorkbenchTab(state, { kind: 'console' })
  state = splitNotebookWorkbenchTab(state, 'tab-3', 'after')

  state = moveNotebookWorkbenchTab(state, 'tab-2', 'pane-2')
  assert.deepEqual(
    state.panes.map((pane) => pane.tabIds),
    [['tab-1'], ['tab-3', 'tab-2']],
  )
  assert.equal(state.panes[1].activeTabId, 'tab-2')
  assert.equal(state.activePaneId, 'pane-2')
  assert.deepEqual(
    getNotebookWorkbenchPaneTabs(state, state.panes[1]).map((tab) => tab.id),
    ['tab-3', 'tab-2'],
  )

  state = moveNotebookWorkbenchTab(state, 'tab-1', 'pane-2')
  assert.deepEqual(
    state.panes.map((pane) => pane.tabIds),
    [['tab-3', 'tab-2', 'tab-1']],
  )
  assert.equal(state.panes[0].fraction, 1)
  assert.equal(state.activePaneId, 'pane-2')
})

test('closing chooses a neighbor and removes an empty pane', () => {
  let state = createNotebookWorkbenchTabsState()
  state = addNotebookWorkbenchTab(state, { kind: 'editor', path: '/index.tsx' })
  state = addNotebookWorkbenchTab(state, { kind: 'console' })
  state = activateNotebookWorkbenchTab(state, 'tab-2')
  state = splitNotebookWorkbenchTab(state, 'tab-3', 'after')

  state = closeNotebookWorkbenchTab(state, 'tab-2')
  assert.deepEqual(state.panes[0].tabIds, ['tab-1'])
  assert.equal(state.panes[0].activeTabId, 'tab-1')

  state = closeNotebookWorkbenchTab(state, 'tab-3')
  assert.equal(state.panes.length, 1)
  assert.equal(state.panes[0].fraction, 1)
  assert.equal(state.activePaneId, 'pane-1')

  state = closeNotebookWorkbenchTab(state, 'tab-1')
  assert.deepEqual(state, { tabs: [], panes: [], activePaneId: 'pane-1' })
})

test('resizes two panes within stable bounds', () => {
  let state = addNotebookWorkbenchTab(createNotebookWorkbenchTabsState(), {
    kind: 'editor',
    path: '/index.tsx',
  })
  state = splitNotebookWorkbenchTab(state, 'tab-2', 'after')

  state = resizeNotebookWorkbenchPanes(state, 0.63)
  assert.equal(state.panes[0].fraction, 0.63)
  assert.equal(state.panes[1].fraction, 0.37)
  assert.equal(resizeNotebookWorkbenchPanes(state, 0.63), state)
  assert.equal(resizeNotebookWorkbenchPanes(state, 0).panes[0].fraction, 0.2)
  assert.equal(resizeNotebookWorkbenchPanes(state, 1).panes[0].fraction, 0.8)
})

test('updates and repairs editor tabs in either pane', () => {
  let state = addNotebookWorkbenchTab(createNotebookWorkbenchTabsState(), {
    kind: 'editor',
    path: '/deleted.tsx',
  })
  state = splitNotebookWorkbenchTab(state, 'tab-2', 'after')
  state = updateNotebookWorkbenchEditorTab(state, 'tab-2', {
    filesOpen: true,
  })
  state = repairNotebookWorkbenchEditorPaths(
    state,
    ['/index.tsx'],
    '/index.tsx',
  )

  assert.deepEqual(state.tabs[1], {
    id: 'tab-2',
    kind: 'editor',
    path: '/index.tsx',
    filesOpen: true,
  })
  assert.equal(getNotebookWorkbenchPaneForTab(state, 'tab-2')?.id, 'pane-2')
  assert.deepEqual(
    getNotebookWorkbenchPaneTabs(state, state.panes[1]).map((tab) => tab.id),
    ['tab-2'],
  )
})

test('finds wrapping keyboard targets within the tab pane', () => {
  let state = createNotebookWorkbenchTabsState()
  state = addNotebookWorkbenchTab(state, { kind: 'editor', path: '/index.tsx' })
  state = addNotebookWorkbenchTab(state, { kind: 'console' })
  state = splitNotebookWorkbenchTab(state, 'tab-3', 'after')

  assert.equal(
    getNotebookWorkbenchTabNavigationTarget(state, 'tab-2', 'ArrowRight'),
    'tab-1',
  )
  assert.equal(
    getNotebookWorkbenchTabNavigationTarget(state, 'tab-1', 'ArrowLeft'),
    'tab-2',
  )
  assert.equal(
    getNotebookWorkbenchTabNavigationTarget(state, 'tab-2', 'Home'),
    'tab-1',
  )
  assert.equal(
    getNotebookWorkbenchTabNavigationTarget(state, 'tab-1', 'End'),
    'tab-2',
  )
  assert.equal(
    getNotebookWorkbenchTabNavigationTarget(state, 'missing', 'Home'),
    null,
  )
})
