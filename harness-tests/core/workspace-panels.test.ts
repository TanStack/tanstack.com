import { describe, expect, it } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  ConversationFiles,
  SavedFileViewer,
} from '../../src/chat/components/SavedFiles'
import {
  ApiError,
  WorkspaceApiProvider,
} from '../../src/chat/components/WorkspaceApi'
import { ConversationWorkspace } from '../../src/chat/components/ConversationWorkspace'
import { savedFileQueryKey } from '../../src/chat/core/conversation-destination'
import {
  defaultParseSearch,
  defaultStringifySearch,
} from '@tanstack/react-router'
import {
  defaultWorkspaceSearch,
  validateWorkspaceSearch,
} from '../../src/chat/core/navigation'
import {
  clearConversationFilePanels,
  availableWorkspacePanels,
  closeWorkspacePanel,
  isPanelId,
  maxWorkspacePanels,
  openWorkspacePanel,
  readPanelState,
  readFilePanel,
  selectWorkspacePanel,
  togglePanelFullscreen,
} from '../../src/chat/core/workspace-panels'

describe('workspace panels', () => {
  it('opens details independently without replacing or resizing an existing workspace pane', () => {
    const workspace = validateWorkspaceSearch({
      panel: 'files',
      panels: ['files', 'usage'],
    })
    const opened = openWorkspacePanel(workspace, 'summary')
    expect(opened.details).toBe(true)
    expect(readPanelState(opened)).toEqual(readPanelState(workspace))
    expect(validateWorkspaceSearch(opened)).toEqual(opened)
    expect(validateWorkspaceSearch({ ...opened, details: false })).toEqual(
      workspace,
    )
    const detailsOnly = openWorkspacePanel(defaultWorkspaceSearch, 'summary')
    expect(readPanelState(detailsOnly)).toEqual({ tabs: [], fullscreen: false })
  })
  it('migrates old Details links to the card while keeping other tabs available', () => {
    expect(
      validateWorkspaceSearch({
        panel: 'summary',
        panels: ['summary'],
        fullscreen: true,
      }),
    ).toEqual({ ...defaultWorkspaceSearch, details: true })
    const migrated = validateWorkspaceSearch({
      panel: 'summary',
      panels: ['files', 'summary', 'usage'],
      fullscreen: true,
    })
    expect(migrated).toMatchObject({
      details: true,
      panel: 'files',
      panels: ['files', 'usage'],
    })
    expect(migrated.fullscreen).toBeUndefined()
    const inactive = validateWorkspaceSearch({
      panel: 'usage',
      panels: ['summary', 'usage'],
    })
    expect(inactive.details).toBeUndefined()
    expect(inactive.panels).toEqual(['usage'])
  })
  it('keeps both execution views mounted when only the selected tab changes', () => {
    for (const active of ['commands', 'preview'] as const) {
      const html = renderToStaticMarkup(
        createElement(ConversationWorkspace, {
          state: { tabs: ['commands', 'preview'], active, fullscreen: false },
          availablePanels: availableWorkspacePanels(true),
          storageKey: 'exact-user-workspace-conversation',
          returnFocus: { current: null },
          onOpen: () => {},
          onClose: () => {},
          onClosePane: () => {},
          onFullscreen: () => {},
          renderPanel: (id) => createElement('span', { 'data-view': id }, id),
          children: 'Conversation',
        }),
      )
      expect(html).toContain('data-view="commands"')
      expect(html).toContain('data-view="preview"')
      expect(html).toContain('aria-selected="true"')
      expect(html).toContain('aria-selected="false"')
    }
  })
  it('round trips command and preview views without storing execution requests in the URL', () => {
    let search = openWorkspacePanel(defaultWorkspaceSearch, 'commands')
    search = openWorkspacePanel(search, 'preview')
    const reloaded = validateWorkspaceSearch(
      defaultParseSearch(defaultStringifySearch(search)),
    )
    expect(readPanelState(reloaded)).toEqual({
      tabs: ['commands', 'preview'],
      active: 'preview',
      fullscreen: false,
    })
    expect(clearConversationFilePanels(reloaded)).toEqual(reloaded)
    expect(closeWorkspacePanel(reloaded, 'preview').panel).toBe('commands')
    expect(
      validateWorkspaceSearch({
        ...reloaded,
        command: 'node',
        start: true,
        sessionId: 'arbitrary',
      }),
    ).toEqual(reloaded)
    expect(availableWorkspacePanels()).not.toContain('commands')
    expect(availableWorkspacePanels()).not.toContain('preview')
    expect(availableWorkspacePanels(true)).not.toContain('preview')
    expect(availableWorkspacePanels()).not.toContain('mail')
    expect(availableWorkspacePanels(false, false, true)).toContain('mail')
    expect(availableWorkspacePanels(true)).toEqual(
      expect.arrayContaining(['commands', 'schedules']),
    )
    expect(isPanelId('terminal')).toBe(false)
    expect(isPanelId('browser')).toBe(true)
    expect(availableWorkspacePanels()).not.toContain('browser')
    expect(availableWorkspacePanels(false, true)).toContain('browser')
  })
  it('preserves history while changing panes and clears it when leaving its conversation', () => {
    const executionHistory = {
      conversationId: 'exact-main',
      sessionId: '12345678-1234-4123-8123-123456789012',
    }
    const previous = validateWorkspaceSearch({
      panel: 'commands',
      panels: ['commands', 'preview'],
      executionHistory,
    })
    const preview = selectWorkspacePanel(previous, 'preview')
    expect(preview.executionHistory).toEqual(executionHistory)
    expect(closeWorkspacePanel(preview, 'preview').executionHistory).toEqual(
      executionHistory,
    )
    const next = clearConversationFilePanels(preview)
    expect(next).not.toHaveProperty('executionHistory')
    expect(next.panels).toEqual(['commands', 'preview'])
    expect(next.panel).toBe('preview')
    // Back can return to the intact original URL without adopting its runtime.
    expect(previous.executionHistory).toEqual(executionHistory)
  })
  it('round trips ordered source and comparison identities and clears them on navigation', () => {
    const left = '12345678-1234-4123-8123-123456789012'
    const right = '12345678-1234-8123-8123-123456789013'
    const source = `source:${left}` as const
    const comparison = `diff:${left}:${right}` as const
    expect(readFilePanel(source)).toEqual({ kind: 'source', fileId: left })
    expect(readFilePanel(comparison)).toEqual({
      kind: 'diff',
      beforeId: left,
      afterId: right,
    })
    let search = openWorkspacePanel(defaultWorkspaceSearch, 'files')
    search = openWorkspacePanel(search, source)
    search = openWorkspacePanel(search, comparison)
    expect(
      validateWorkspaceSearch(
        defaultParseSearch(defaultStringifySearch(search)),
      ),
    ).toEqual(search)
    expect(closeWorkspacePanel(search, comparison).panel).toBe(source)
    expect(clearConversationFilePanels(search)).toMatchObject({
      panel: 'files',
      panels: ['files'],
    })
    expect(search.panels).toEqual(['files', source, comparison])
    for (const value of [
      `source:${left}:`,
      `diff:${left}`,
      `diff:${left}:${right}:`,
      `diff:${left}:file:${right}`,
      `diff:${left}:../secret`,
      'source:https://example.com',
      `diff:${left}:12345678-1234-4123-7123-123456789012`,
    ]) {
      expect(isPanelId(value)).toBe(false)
      expect(readFilePanel(value)).toBeUndefined()
    }
  })
  it('removes resource tabs on conversation changes while retaining ordered builtin views', () => {
    const file = 'file:12345678-1234-8123-8123-123456789012'
    const previous = validateWorkspaceSearch({
      panels: ['schedules', file, 'usage', 'activity', 'files'],
      panel: file,
      fullscreen: true,
      q: 'launch',
      view: 'attention',
    })
    const next = clearConversationFilePanels(previous)
    expect(next).toEqual({
      ...defaultWorkspaceSearch,
      q: 'launch',
      view: 'attention',
      panels: ['schedules', 'usage', 'activity', 'files'],
      panel: 'schedules',
      fullscreen: true,
    })
    expect(
      clearConversationFilePanels({ ...previous, panel: 'activity' }),
    ).toMatchObject({
      panel: 'activity',
      panels: ['schedules', 'usage', 'activity', 'files'],
    })
    // Browser Back still owns the original file URL; navigation never mutates it.
    expect(previous.panel).toBe(file)
    expect(previous.panels).toContain(file)
  })
  it('closes a file-only pane before draft creation and keeps it closed after first send', () => {
    const previous = openWorkspacePanel(
      defaultWorkspaceSearch,
      'file:12345678-1234-8123-8123-123456789012',
    )
    previous.fullscreen = true
    const draft = {
      ...clearConversationFilePanels(previous),
      draft: '12345678-1234-4123-8123-123456789012',
    }
    expect(draft).not.toHaveProperty('panel')
    expect(draft).not.toHaveProperty('panels')
    expect(draft).not.toHaveProperty('fullscreen')
    const { draft: _draft, ...created } = clearConversationFilePanels(draft)
    expect(created).toEqual(defaultWorkspaceSearch)
    expect(
      validateWorkspaceSearch(
        defaultParseSearch(defaultStringifySearch(created)),
      ),
    ).toEqual(defaultWorkspaceSearch)
  })
  it('keeps builtin-only navigation and explicit file destinations intact', () => {
    const builtins = validateWorkspaceSearch({
      panels: ['files', 'usage'],
      panel: 'usage',
    })
    expect(clearConversationFilePanels(builtins)).toEqual(builtins)
    expect(clearConversationFilePanels(defaultWorkspaceSearch)).toEqual(
      defaultWorkspaceSearch,
    )
    const file = 'file:12345678-1234-8123-8123-123456789012'
    const explicit = openWorkspacePanel(
      clearConversationFilePanels(builtins),
      file,
    )
    expect(explicit).toMatchObject({
      panels: ['files', 'usage', file],
      panel: file,
    })
  })
  it('opens tabs once, preserves their order, and selects the requested panel', () => {
    let search = openWorkspacePanel(defaultWorkspaceSearch, 'schedules')
    search = openWorkspacePanel(search, 'usage')
    search = openWorkspacePanel(search, 'schedules')
    expect(readPanelState(search)).toEqual({
      tabs: ['schedules', 'usage'],
      active: 'schedules',
      fullscreen: false,
    })
    expect(defaultWorkspaceSearch).not.toHaveProperty('panels')
  })

  it('selects an open tab without moving it and opens a missing selection', () => {
    const search = validateWorkspaceSearch({
      panels: ['activity', 'schedules'],
      panel: 'schedules',
    })
    expect(selectWorkspacePanel(search, 'activity')).toMatchObject({
      panels: ['activity', 'schedules'],
      panel: 'activity',
    })
    expect(selectWorkspacePanel(search, 'usage')).toMatchObject({
      panels: ['activity', 'schedules', 'usage'],
      panel: 'usage',
    })
    expect(search.panels).toEqual(['activity', 'schedules'])
  })

  it('closes the active tab onto its next neighbor, then its previous neighbor', () => {
    let search = validateWorkspaceSearch({
      panels: ['schedules', 'usage', 'activity'],
      panel: 'usage',
      fullscreen: true,
    })
    search = closeWorkspacePanel(search, 'usage')
    expect(readPanelState(search)).toEqual({
      tabs: ['schedules', 'activity'],
      active: 'activity',
      fullscreen: true,
    })
    search = closeWorkspacePanel(search, 'activity')
    expect(readPanelState(search)).toEqual({
      tabs: ['schedules'],
      active: 'schedules',
      fullscreen: true,
    })
    expect(closeWorkspacePanel(search, 'schedules')).toEqual(
      defaultWorkspaceSearch,
    )
  })

  it('keeps the selection when closing another tab and appends reopened tabs', () => {
    const search = validateWorkspaceSearch({
      panels: ['schedules', 'usage', 'activity'],
      panel: 'activity',
    })
    const closed = closeWorkspacePanel(search, 'schedules')
    expect(closed).toMatchObject({
      panels: ['usage', 'activity'],
      panel: 'activity',
    })
    expect(closeWorkspacePanel(closed, 'schedules')).toEqual(closed)
    expect(openWorkspacePanel(closed, 'schedules')).toMatchObject({
      panels: ['usage', 'activity', 'schedules'],
      panel: 'schedules',
    })
    expect(search.panels).toEqual(['schedules', 'usage', 'activity'])
  })

  it('only enters fullscreen with an active panel and clears the false flag', () => {
    expect(togglePanelFullscreen(defaultWorkspaceSearch)).toEqual(
      defaultWorkspaceSearch,
    )
    const open = openWorkspacePanel(defaultWorkspaceSearch, 'schedules')
    const fullscreen = togglePanelFullscreen(open)
    expect(fullscreen.fullscreen).toBe(true)
    expect(selectWorkspacePanel(fullscreen, 'usage').fullscreen).toBe(true)
    expect(togglePanelFullscreen(fullscreen)).toEqual(open)
    expect(open).not.toHaveProperty('fullscreen')
  })

  it('preserves unrelated navigation across all panel actions and URL reloads', () => {
    const route = validateWorkspaceSearch({
      view: 'attention',
      q: 'launch',
      sort: 'unread',
      group: 'status',
      message: 'message-123',
      draft: '12345678-1234-4123-8123-123456789012',
      parent: 'parent-bot',
      settings: 'policy',
    })
    let search = openWorkspacePanel(route, 'activity')
    search = selectWorkspacePanel(search, 'usage')
    search = togglePanelFullscreen(search)
    const reloaded = validateWorkspaceSearch(
      defaultParseSearch(defaultStringifySearch(search)),
    )
    expect(reloaded).toEqual(search)
    expect(reloaded).toMatchObject(route)
    search = closeWorkspacePanel(reloaded, 'activity')
    search = closeWorkspacePanel(search, 'usage')
    expect(search).toEqual(route)
  })

  it('normalizes direct reads without accepting unbounded or arbitrary panels', () => {
    expect(readPanelState({})).toEqual({ tabs: [], fullscreen: false })
    expect(
      readPanelState({ panels: ['usage', 'usage'], panel: 'schedules' }),
    ).toEqual({
      tabs: ['usage', 'schedules'],
      active: 'schedules',
      fullscreen: false,
    })
    for (const panels of [
      'schedules',
      { summary: true },
      Array(9).fill('schedules'),
    ]) {
      expect(readPanelState({ panels, fullscreen: true })).toEqual({
        tabs: [],
        fullscreen: false,
      })
    }
    expect(readPanelState({ panel: 'usage', fullscreen: 'true' })).toEqual({
      tabs: ['usage'],
      active: 'usage',
      fullscreen: false,
    })
    expect(
      readPanelState({ panels: ['schedules', 'https://example.com'] }),
    ).toEqual({
      tabs: ['schedules'],
      active: 'schedules',
      fullscreen: false,
    })
  })

  it('opens UUID file resources and the library without treating paths as resources', () => {
    const file = 'file:12345678-1234-8123-8123-123456789012' as const
    expect(isPanelId(file)).toBe(true)
    let search = openWorkspacePanel(defaultWorkspaceSearch, 'files')
    search = openWorkspacePanel(search, file)
    search = openWorkspacePanel(search, file)
    expect(readPanelState(search)).toEqual({
      tabs: ['files', file],
      active: file,
      fullscreen: false,
    })
    for (const id of [
      'file:README.md',
      'file:../private',
      'file:https://example.com',
      'file:12345678-1234-4123-7123-123456789012',
    ])
      expect(isPanelId(id)).toBe(false)
    expect(
      validateWorkspaceSearch(
        defaultParseSearch(defaultStringifySearch(search)),
      ),
    ).toEqual(search)
  })

  it('caps resource tabs at eight, retaining the newly selected file', () => {
    const resources = Array.from(
      { length: 9 },
      (_, index) =>
        `file:12345678-1234-4123-8123-${String(index).padStart(12, '0')}` as const,
    )
    let search = defaultWorkspaceSearch
    for (const id of resources) search = openWorkspacePanel(search, id)
    expect(search.panels).toHaveLength(maxWorkspacePanels)
    expect(search.panels).toEqual(resources.slice(1))
    expect(search.panel).toBe(resources[8])
    expect(
      readPanelState({ panels: resources.slice(0, 8), panel: resources[8] })
        .tabs,
    ).toEqual(resources.slice(1))
  })

  it('closes and reopens resources with the same stable identity', () => {
    const file = 'file:12345678-1234-4123-8123-123456789012' as const
    const initial = openWorkspacePanel(
      openWorkspacePanel(defaultWorkspaceSearch, 'files'),
      file,
    )
    const closed = closeWorkspacePanel(initial, file)
    expect(closed).toMatchObject({ panels: ['files'], panel: 'files' })
    expect(openWorkspacePanel(closed, file)).toEqual(initial)
  })
})

describe('saved file panel access', () => {
  const file = {
    id: '12345678-1234-8123-8123-123456789012',
    botId: 'conversation',
    name: 'private-plan.txt',
    mediaType: 'text/plain',
    size: 20,
    sha256: 'file-hash',
    source: 'upload',
    state: 'ready',
    createdAt: 1,
  }
  const render = (client: QueryClient, child: ReactNode) =>
    renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(WorkspaceApiProvider, {
          workspaceId: 'workspace',
          children: child,
        }),
      ),
    )

  it('does not render cached metadata or contents before a fresh file authorization read', () => {
    const client = new QueryClient()
    client.setQueryData(
      savedFileQueryKey(
        'workspace',
        'viewer',
        { botId: 'conversation' },
        file.id,
      ),
      file,
    )
    client.setQueryData(
      [
        'saved-file-content',
        'workspace',
        'viewer',
        'bots/conversation',
        file.id,
        file.sha256,
        file.mediaType,
      ],
      { text: 'private cached contents' },
    )
    const html = render(
      client,
      createElement(SavedFileViewer, {
        botId: 'conversation',
        userId: 'viewer',
        fileId: file.id,
      }),
    )
    expect(html).toContain('Loading file')
    expect(html).not.toContain(file.name)
    expect(html).not.toContain('private cached contents')
    client.clear()
  })

  it('hides cached library names after a server authorization failure', () => {
    const client = new QueryClient()
    const destination = { botId: 'conversation', conversationId: 'exact-room' }
    const key = savedFileQueryKey('workspace', 'viewer', destination)
    client.setQueryData(key, { files: [file] })
    client
      .getQueryCache()
      .find({ queryKey: key })!
      .setState({ status: 'error', error: new ApiError('Access denied', 403) })
    const html = render(
      client,
      createElement(ConversationFiles, {
        botId: 'conversation',
        userId: 'viewer',
        destination,
        readOnly: false,
        onOpen: () => {},
      }),
    )
    expect(html).toContain('Files are unavailable')
    expect(html).not.toContain(file.name)
    expect(html).not.toContain('type="file"')
    client.clear()
  })
})

describe('thread resource tabs', () => {
  it('retains a closed thread identity for reopening, but clears it when changing conversations', () => {
    const initial = validateWorkspaceSearch({
      ...defaultWorkspaceSearch,
      conversation: 'parent',
      thread: 'child',
      threadMessage: 'reply',
      message: 'source',
      panels: ['schedules', 'thread'],
      panel: 'thread',
    })
    const closed = closeWorkspacePanel(initial, 'thread')
    expect(closed).toMatchObject({
      conversation: 'parent',
      thread: 'child',
      threadMessage: 'reply',
      panel: 'schedules',
      panels: ['schedules'],
    })
    expect(openWorkspacePanel(closed, 'thread')).toMatchObject({
      panel: 'thread',
      panels: ['schedules', 'thread'],
      thread: 'child',
    })
    const next = clearConversationFilePanels(initial)
    expect(next.thread).toBeUndefined()
    expect(next.threadMessage).toBeUndefined()
    expect(next.panels).toEqual(['schedules'])
    expect(initial.thread).toBe('child')
  })
})

it('preserves side panel tabs and selection when hidden and reopens on selection', () => {
  const opened = openWorkspacePanel(
    openWorkspacePanel(defaultWorkspaceSearch, 'files'),
    'usage',
  )
  const hidden = validateWorkspaceSearch({ ...opened, panelHidden: true })
  expect(readPanelState(hidden)).toMatchObject({
    tabs: ['files', 'usage'],
    active: 'usage',
    hidden: true,
  })
  expect(readPanelState(openWorkspacePanel(hidden, 'files'))).toMatchObject({
    tabs: ['files', 'usage'],
    active: 'files',
  })
  expect(openWorkspacePanel(hidden, 'files').panelHidden).toBeUndefined()
})
