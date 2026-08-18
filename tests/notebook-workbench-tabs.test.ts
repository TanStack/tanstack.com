import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activateNotebookWorkbenchTab,
  addNotebookWorkbenchTab,
  closeNotebookWorkbenchTab,
  createNotebookWorkbenchTabsState,
  getNotebookWorkbenchTabLabel,
  getNotebookWorkbenchTabNavigationTarget,
  repairNotebookWorkbenchEditorPaths,
  updateNotebookWorkbenchEditorTab,
} from '../src/utils/notebook-workbench-tabs'

test('starts with one active preview', () => {
  assert.deepEqual(createNotebookWorkbenchTabsState(), {
    tabs: [{ id: 'tab-1', kind: 'preview' }],
    activeTabId: 'tab-1',
  })
})

test('adds independent tabs with unique ids and ordinal labels', () => {
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
  assert.deepEqual(state.tabs[2], {
    id: 'tab-3',
    kind: 'editor',
    path: '/index.tsx',
    filesOpen: true,
  })
  assert.deepEqual(state.tabs[4], {
    id: 'tab-5',
    kind: 'editor',
    path: '/styles.css',
    filesOpen: false,
  })
  assert.equal(state.activeTabId, 'tab-5')
})

test('activates only tabs in the state', () => {
  const state = addNotebookWorkbenchTab(createNotebookWorkbenchTabsState(), {
    kind: 'console',
  })
  const activated = activateNotebookWorkbenchTab(state, 'tab-1')

  assert.equal(activated.activeTabId, 'tab-1')
  assert.equal(activateNotebookWorkbenchTab(activated, 'missing'), activated)
  assert.equal(activateNotebookWorkbenchTab(activated, 'tab-1'), activated)
})

test('closing the active tab selects the right neighbor, then the left', () => {
  let state = createNotebookWorkbenchTabsState()
  state = addNotebookWorkbenchTab(state, { kind: 'editor', path: '/index.tsx' })
  state = addNotebookWorkbenchTab(state, { kind: 'console' })
  state = activateNotebookWorkbenchTab(state, 'tab-2')

  state = closeNotebookWorkbenchTab(state, 'tab-2')
  assert.deepEqual(
    state.tabs.map((tab) => tab.id),
    ['tab-1', 'tab-3'],
  )
  assert.equal(state.activeTabId, 'tab-3')

  state = closeNotebookWorkbenchTab(state, 'tab-3')
  assert.equal(state.activeTabId, 'tab-1')
  state = closeNotebookWorkbenchTab(state, 'tab-1')
  assert.deepEqual(state, { tabs: [], activeTabId: null })
})

test('closing an inactive tab preserves the active tab', () => {
  const state = addNotebookWorkbenchTab(createNotebookWorkbenchTabsState(), {
    kind: 'console',
  })
  const closed = closeNotebookWorkbenchTab(state, 'tab-1')

  assert.equal(closed.activeTabId, 'tab-2')
  assert.equal(closeNotebookWorkbenchTab(closed, 'missing'), closed)
})

test('updates editor path and file explorer state', () => {
  const initial = addNotebookWorkbenchTab(createNotebookWorkbenchTabsState(), {
    kind: 'editor',
    path: '/index.tsx',
  })
  const updated = updateNotebookWorkbenchEditorTab(initial, 'tab-2', {
    path: '/app.tsx',
    filesOpen: true,
  })

  assert.deepEqual(updated.tabs[1], {
    id: 'tab-2',
    kind: 'editor',
    path: '/app.tsx',
    filesOpen: true,
  })
  assert.equal(updateNotebookWorkbenchEditorTab(updated, 'tab-1', {}), updated)
  assert.equal(
    updateNotebookWorkbenchEditorTab(updated, 'missing', {
      path: '/missing.tsx',
    }),
    updated,
  )
})

test('repairs paths deleted from the workspace', () => {
  let state = createNotebookWorkbenchTabsState()
  state = addNotebookWorkbenchTab(state, {
    kind: 'editor',
    path: '/deleted.tsx',
  })
  state = addNotebookWorkbenchTab(state, {
    kind: 'editor',
    path: '/styles.css',
  })

  const repaired = repairNotebookWorkbenchEditorPaths(
    state,
    ['/index.tsx', '/styles.css'],
    '/index.tsx',
  )

  assert.equal(repaired.tabs[1].kind, 'editor')
  assert.deepEqual(repaired.tabs[1], {
    id: 'tab-2',
    kind: 'editor',
    path: '/index.tsx',
    filesOpen: false,
  })
  assert.equal(repaired.tabs[2], state.tabs[2])
  assert.equal(
    repairNotebookWorkbenchEditorPaths(
      repaired,
      ['/index.tsx', '/styles.css'],
      '/index.tsx',
    ),
    repaired,
  )
})

test('finds wrapping and boundary keyboard targets', () => {
  let state = createNotebookWorkbenchTabsState()
  state = addNotebookWorkbenchTab(state, { kind: 'editor', path: '/index.tsx' })
  state = addNotebookWorkbenchTab(state, { kind: 'console' })

  assert.equal(
    getNotebookWorkbenchTabNavigationTarget(state, 'ArrowRight'),
    'tab-1',
  )
  assert.equal(
    getNotebookWorkbenchTabNavigationTarget(state, 'ArrowLeft'),
    'tab-2',
  )
  assert.equal(getNotebookWorkbenchTabNavigationTarget(state, 'Home'), 'tab-1')
  assert.equal(getNotebookWorkbenchTabNavigationTarget(state, 'End'), 'tab-3')
  assert.equal(
    getNotebookWorkbenchTabNavigationTarget(
      { tabs: [], activeTabId: null },
      'Home',
    ),
    null,
  )
})
