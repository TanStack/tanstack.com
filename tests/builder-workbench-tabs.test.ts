import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activateBuilderWorkbenchTab,
  addBuilderWorkbenchTab,
  closeBuilderWorkbenchTab,
  createBuilderWorkbenchTabsState,
  getActiveBuilderWorkbenchTab,
  getBuilderWorkbenchPaneForTab,
  getBuilderWorkbenchPaneTabs,
  getBuilderWorkbenchTabLabel,
  getBuilderWorkbenchTabNavigationTarget,
  moveBuilderWorkbenchTab,
  repairBuilderWorkbenchEditorPaths,
  resizeBuilderWorkbenchPanes,
  splitBuilderWorkbenchTab,
  updateBuilderWorkbenchEditorTab,
} from '../src/utils/builder-workbench-tabs'

test('starts with one active preview pane', () => {
  assert.deepEqual(createBuilderWorkbenchTabsState(), {
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
  let state = createBuilderWorkbenchTabsState()
  state = addBuilderWorkbenchTab(state, { kind: 'preview' })
  state = addBuilderWorkbenchTab(state, {
    kind: 'editor',
    path: '/src/routes/index.tsx',
    filesOpen: true,
  })
  state = addBuilderWorkbenchTab(state, { kind: 'console' })
  state = addBuilderWorkbenchTab(state, {
    kind: 'editor',
    path: '/styles.css',
  })

  assert.deepEqual(
    state.tabs.map((tab) => tab.id),
    ['tab-1', 'tab-2', 'tab-3', 'tab-4', 'tab-5'],
  )
  assert.deepEqual(
    state.tabs.map((tab) => getBuilderWorkbenchTabLabel(state.tabs, tab)),
    [
      'Preview 1',
      'Preview 2',
      '/src/routes/index.tsx',
      'Console',
      '/styles.css',
    ],
  )
  assert.deepEqual(state.panes[0].tabIds, [
    'tab-1',
    'tab-2',
    'tab-3',
    'tab-4',
    'tab-5',
  ])
  assert.deepEqual(getActiveBuilderWorkbenchTab(state), state.tabs[4])
})

test('splits a tab above or below and focuses the new pane', () => {
  let state = addBuilderWorkbenchTab(createBuilderWorkbenchTabsState(), {
    kind: 'editor',
    path: '/index.tsx',
  })
  state = splitBuilderWorkbenchTab(state, 'tab-2', 'after')

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

  let above = addBuilderWorkbenchTab(createBuilderWorkbenchTabsState(), {
    kind: 'console',
  })
  above = splitBuilderWorkbenchTab(above, 'tab-2', 'before')
  assert.deepEqual(
    above.panes.map((pane) => pane.tabIds),
    [['tab-2'], ['tab-1']],
  )
  assert.equal(
    splitBuilderWorkbenchTab(
      createBuilderWorkbenchTabsState(),
      'tab-1',
      'after',
    ).panes.length,
    1,
  )

  let inactive = createBuilderWorkbenchTabsState()
  inactive = addBuilderWorkbenchTab(inactive, {
    kind: 'editor',
    path: '/index.tsx',
  })
  inactive = addBuilderWorkbenchTab(inactive, { kind: 'preview' })
  inactive = activateBuilderWorkbenchTab(inactive, 'tab-1')
  inactive = splitBuilderWorkbenchTab(inactive, 'tab-3', 'after')
  assert.equal(inactive.panes[0].activeTabId, 'tab-1')
})

test('moves tabs between panes and collapses an empty source pane', () => {
  let state = createBuilderWorkbenchTabsState()
  state = addBuilderWorkbenchTab(state, { kind: 'editor', path: '/index.tsx' })
  state = addBuilderWorkbenchTab(state, { kind: 'console' })
  state = splitBuilderWorkbenchTab(state, 'tab-3', 'after')

  state = moveBuilderWorkbenchTab(state, 'tab-2', 'pane-2')
  assert.deepEqual(
    state.panes.map((pane) => pane.tabIds),
    [['tab-1'], ['tab-3', 'tab-2']],
  )
  assert.equal(state.panes[1].activeTabId, 'tab-2')
  assert.equal(state.activePaneId, 'pane-2')
  assert.deepEqual(
    getBuilderWorkbenchPaneTabs(state, state.panes[1]).map((tab) => tab.id),
    ['tab-3', 'tab-2'],
  )

  state = moveBuilderWorkbenchTab(state, 'tab-1', 'pane-2')
  assert.deepEqual(
    state.panes.map((pane) => pane.tabIds),
    [['tab-3', 'tab-2', 'tab-1']],
  )
  assert.equal(state.panes[0].fraction, 1)
  assert.equal(state.activePaneId, 'pane-2')
})

test('closing chooses a neighbor and removes an empty pane', () => {
  let state = createBuilderWorkbenchTabsState()
  state = addBuilderWorkbenchTab(state, { kind: 'editor', path: '/index.tsx' })
  state = addBuilderWorkbenchTab(state, { kind: 'console' })
  state = activateBuilderWorkbenchTab(state, 'tab-2')
  state = splitBuilderWorkbenchTab(state, 'tab-3', 'after')

  state = closeBuilderWorkbenchTab(state, 'tab-2')
  assert.deepEqual(state.panes[0].tabIds, ['tab-1'])
  assert.equal(state.panes[0].activeTabId, 'tab-1')

  state = closeBuilderWorkbenchTab(state, 'tab-3')
  assert.equal(state.panes.length, 1)
  assert.equal(state.panes[0].fraction, 1)
  assert.equal(state.activePaneId, 'pane-1')

  state = closeBuilderWorkbenchTab(state, 'tab-1')
  assert.deepEqual(state, { tabs: [], panes: [], activePaneId: 'pane-1' })
})

test('resizes two panes within stable bounds', () => {
  let state = addBuilderWorkbenchTab(createBuilderWorkbenchTabsState(), {
    kind: 'editor',
    path: '/index.tsx',
  })
  state = splitBuilderWorkbenchTab(state, 'tab-2', 'after')

  state = resizeBuilderWorkbenchPanes(state, 0.63)
  assert.equal(state.panes[0].fraction, 0.63)
  assert.equal(state.panes[1].fraction, 0.37)
  assert.equal(resizeBuilderWorkbenchPanes(state, 0.63), state)
  assert.equal(resizeBuilderWorkbenchPanes(state, 0).panes[0].fraction, 0.2)
  assert.equal(resizeBuilderWorkbenchPanes(state, 1).panes[0].fraction, 0.8)
})

test('updates and repairs editor tabs in either pane', () => {
  let state = addBuilderWorkbenchTab(createBuilderWorkbenchTabsState(), {
    kind: 'editor',
    path: '/deleted.tsx',
  })
  state = splitBuilderWorkbenchTab(state, 'tab-2', 'after')
  state = updateBuilderWorkbenchEditorTab(state, 'tab-2', {
    filesOpen: true,
  })
  state = repairBuilderWorkbenchEditorPaths(state, ['/index.tsx'], '/index.tsx')

  assert.deepEqual(state.tabs[1], {
    id: 'tab-2',
    kind: 'editor',
    path: '/index.tsx',
    filesOpen: true,
  })
  assert.equal(getBuilderWorkbenchPaneForTab(state, 'tab-2')?.id, 'pane-2')
  assert.equal(
    getBuilderWorkbenchTabLabel(state.tabs, state.tabs[1]),
    '/index.tsx',
  )
  assert.deepEqual(
    getBuilderWorkbenchPaneTabs(state, state.panes[1]).map((tab) => tab.id),
    ['tab-2'],
  )
})

test('finds wrapping keyboard targets within the tab pane', () => {
  let state = createBuilderWorkbenchTabsState()
  state = addBuilderWorkbenchTab(state, { kind: 'editor', path: '/index.tsx' })
  state = addBuilderWorkbenchTab(state, { kind: 'console' })
  state = splitBuilderWorkbenchTab(state, 'tab-3', 'after')

  assert.equal(
    getBuilderWorkbenchTabNavigationTarget(state, 'tab-2', 'ArrowRight'),
    'tab-1',
  )
  assert.equal(
    getBuilderWorkbenchTabNavigationTarget(state, 'tab-1', 'ArrowLeft'),
    'tab-2',
  )
  assert.equal(
    getBuilderWorkbenchTabNavigationTarget(state, 'tab-2', 'Home'),
    'tab-1',
  )
  assert.equal(
    getBuilderWorkbenchTabNavigationTarget(state, 'tab-1', 'End'),
    'tab-2',
  )
  assert.equal(
    getBuilderWorkbenchTabNavigationTarget(state, 'missing', 'Home'),
    null,
  )
})
