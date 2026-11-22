import { beforeEach, expect, it, vi } from 'vitest'
import {
  exampleWorkspaceVersion,
  type ExampleWorkspace,
} from '~/utils/example-workspace'
const m = vi.hoisted(() => ({
  identity: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  current: vi.fn(),
  snapshot: vi.fn(),
  store: vi.fn(),
  update: vi.fn(),
  requestHash: vi.fn(),
  replay: vi.fn(),
  preflight: vi.fn(),
  create: vi.fn(),
  importProjects: vi.fn(),
  reserve: vi.fn(),
  limit: vi.fn(),
  snapshotHash: vi.fn(),
}))
vi.mock('~/chat/conversation-identity.server', () => ({
  resolveConversationIdentity: m.identity,
}))
vi.mock('~/utils/builder-project-events.server', () => ({
  getBuilderProjectState: m.get,
  listBuilderProjectStates: m.list,
  updateBuilderProjectState: m.update,
  getBuilderProjectMutationRequestHash: m.requestHash,
  getBuilderProjectRevisionForMutation: m.replay,
  preflightBuilderProjectCreation: m.preflight,
  createBuilderProjectState: m.create,
}))
vi.mock('~/utils/builder-project-snapshot-storage.server', () => ({
  readBuilderProjectSnapshot: m.snapshot,
  getBuilderProjectSnapshotHash: m.snapshotHash,
}))
vi.mock('~/utils/builder-project-snapshot-registry.server', () => ({
  storeBuilderProjectSnapshotForOwner: m.store,
}))
vi.mock('~/utils/builder-project-state.server', () => ({
  listOrImportBuilderProjectStates: m.importProjects,
  reserveLegacyBuilderProjectId: m.reserve,
}))
vi.mock('~/utils/rateLimit.server', () => ({
  checkUserWindowRateLimit: m.limit,
  RATE_LIMITS: { builderProjectCreateDaily: 'project-limit' },
}))
import { assistantToolDiscovery } from '../../src/chat/server/assistant-discovery'
import { upgradeBuilderAiWorkspaceToWebContainer } from '../../src/utils/builder-ai-workspace'
import { assistantProjectTools } from '../../src/chat/server/assistant-project-tools'

function handler<Value>(value: Value | undefined): Value {
  if (value === undefined)
    throw new Error('Project tool has no executable handler')
  return value
}
const scope = {
  userId: 'owner',
  workspaceId: 'personal:owner',
  botId: 'assistant',
  conversationId: 'chat:assistant',
}
beforeEach(() => {
  vi.resetAllMocks()
  m.store.mockResolvedValue({ hash: 'new-hash' })
  m.requestHash.mockResolvedValue('request-hash')
  m.update.mockResolvedValue({
    id: 'project',
    currentRevisionNumber: 3,
    snapshotHash: 'new-hash',
  })
  m.snapshot.mockResolvedValue({
    title: 'App',
    description: '',
    workspace: {
      entry: '/index.ts',
      files: { '/index.ts': 'export default 9', '/secret.ts': 'hidden' },
      imports: {},
    },
    hiddenFiles: ['/secret.ts'],
  })
})
it('lists only the authenticated conversation owner projects', async () => {
  m.importProjects.mockResolvedValue([
    {
      id: 'project',
      title: 'App',
      description: '',
      currentRevisionNumber: 2,
      updatedAt: 'today',
      ownerId: 'owner',
    },
  ])
  const [list] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  expect(await handler(list.execute)({})).toEqual({
    projects: [
      {
        id: 'project',
        title: 'App',
        description: '',
        revision: 2,
        updatedAt: 'today',
      },
    ],
  })
  expect(m.identity).toHaveBeenCalledWith(scope)
  expect(m.importProjects).toHaveBeenCalledWith('owner')
})
it('reads project metadata through the existing owner check', async () => {
  m.get.mockResolvedValue({
    id: 'project',
    title: 'App',
    description: '',
    currentRevisionNumber: 2,
    snapshotHash: 'hash',
    updatedAt: 'today',
  })
  const [, inspect] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  await handler(inspect.execute)({ projectId: 'project' })
  expect(m.get).toHaveBeenCalledWith({ projectId: 'project', ownerId: 'owner' })
})
it('does not expose personal projects in a company workspace', async () => {
  const [list] = assistantProjectTools({
    scope: { ...scope, workspaceId: 'company' },
    taskId: 'task',
    assertCurrent: m.current,
  })
  await expect(handler(list.execute)({})).rejects.toThrow(
    'Personal projects are unavailable',
  )
  expect(m.identity).not.toHaveBeenCalled()
  expect(m.importProjects).not.toHaveBeenCalled()
})
it('requires current conversation access before reading projects', async () => {
  m.identity.mockRejectedValue(new Error('Conversation not found'))
  const [list] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  await expect(handler(list.execute)({})).rejects.toThrow(
    'Conversation not found',
  )
  expect(m.importProjects).not.toHaveBeenCalled()
})
it('does not swallow the existing foreign-project ownership rejection', async () => {
  m.get.mockRejectedValue(new Error('Builder project belongs to another user'))
  const [, inspect] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  await expect(
    handler(inspect.execute)({ projectId: 'foreign' }),
  ).rejects.toThrow('belongs to another user')
})

it('returns only readable paths from the real snapshot file rules', async () => {
  m.get.mockResolvedValue({
    id: 'project',
    title: 'App',
    description: '',
    snapshotHash: 'hash',
    currentRevisionNumber: 2,
  })
  const [, inspect] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  expect(
    await handler(inspect.execute)({ projectId: 'project' }),
  ).toMatchObject({
    files: [{ path: '/index.ts', characters: 16 }],
    entry: '/index.ts',
    revision: 2,
  })
  expect(m.snapshot).toHaveBeenCalledWith('hash')
})
it('reads persisted file contents with revision and snapshot evidence', async () => {
  m.get.mockResolvedValue({
    id: 'project',
    title: 'App',
    description: '',
    snapshotHash: 'hash',
    currentRevisionNumber: 2,
  })
  const [, , read] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  expect(
    await handler(read.execute)({
      projectId: 'project',
      path: '/index.ts',
      offset: 7,
    }),
  ).toEqual({
    projectId: 'project',
    revision: 2,
    snapshotHash: 'hash',
    path: '/index.ts',
    content: 'default 9',
    offset: 7,
    totalCharacters: 16,
    nextOffset: null,
  })
})
it('preserves the Builder hidden-file restriction', async () => {
  m.get.mockResolvedValue({
    id: 'project',
    title: 'App',
    description: '',
    snapshotHash: 'hash',
    currentRevisionNumber: 2,
  })
  const [, , read] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  await expect(
    handler(read.execute)({
      projectId: 'project',
      path: '/secret.ts',
      offset: 0,
    }),
  ).rejects.toThrow()
})

it('loads project schemas through the existing progressive disclosure path', async () => {
  const tools = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  const onLoad = vi.fn().mockResolvedValue(undefined)
  const discovery = assistantToolDiscovery({ tools: [...tools], onLoad })
  expect(discovery.directory.items.map((tool) => tool.name)).toEqual([
    'list_projects',
    'inspect_project',
    'read_project_file',
    'replace_project_file',
    'create_project',
    'inspect_project_module',
    'search_project_package_resources',
    'read_project_package_resource',
    'upgrade_project_runtime',
    'install_project_dependency',
  ])
  expect(discovery.tools().map((tool) => tool.name)).toEqual([
    'list_available_tools',
    'load_tools',
  ])
  const load = discovery.tools().find((tool) => tool.name === 'load_tools')
  if (!load?.execute) throw new Error('Discovery loader missing')
  await handler(load.execute)({
    names: ['inspect_project', 'read_project_file'],
  })
  expect(onLoad).toHaveBeenCalledWith(['inspect_project', 'read_project_file'])
  expect(discovery.tools().map((tool) => tool.name)).toEqual([
    'list_available_tools',
    'load_tools',
    'inspect_project',
    'read_project_file',
  ])
  expect(m.get).not.toHaveBeenCalled()
})

it('edits with the original Builder tool and commits through shared revision checks', async () => {
  m.get.mockResolvedValue({
    id: 'project',
    title: 'App',
    description: '',
    snapshotHash: 'hash',
    currentRevisionNumber: 2,
  })
  const [, , , edit] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  const args = {
    projectId: 'project',
    expectedRevision: 2,
    path: '/index.ts',
    content: 'export default 10',
  }
  expect(
    await handler(edit.execute)(args, {
      toolCallId: 'call',
      emitCustomEvent: () => {},
    }),
  ).toEqual({
    projectId: 'project',
    revision: 3,
    snapshotHash: 'new-hash',
    path: '/index.ts',
  })
  expect(m.store).toHaveBeenCalledWith(
    'owner',
    expect.objectContaining({
      title: 'App',
      workspace: expect.objectContaining({
        files: { '/index.ts': 'export default 10', '/secret.ts': 'hidden' },
      }),
    }),
  )
  expect(m.update).toHaveBeenCalledWith(
    expect.objectContaining({
      ownerId: 'owner',
      projectId: 'project',
      expectedRevisionNumber: 2,
      snapshotHash: 'new-hash',
    }),
  )
})
it('rejects stale project edits before storing a snapshot', async () => {
  m.get.mockResolvedValue({
    id: 'project',
    snapshotHash: 'hash',
    currentRevisionNumber: 3,
  })
  const [, , , edit] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  await expect(
    handler(edit.execute)(
      {
        projectId: 'project',
        expectedRevision: 2,
        path: '/index.ts',
        content: 'changed',
      },
      { toolCallId: 'call', emitCustomEvent: () => {} },
    ),
  ).rejects.toThrow('Project revision changed')
  expect(m.store).not.toHaveBeenCalled()
  expect(m.update).not.toHaveBeenCalled()
})
it('retains hidden file protection when editing', async () => {
  m.get.mockResolvedValue({
    id: 'project',
    title: 'App',
    description: '',
    snapshotHash: 'hash',
    currentRevisionNumber: 2,
  })
  const [, , , edit] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  await expect(
    handler(edit.execute)(
      {
        projectId: 'project',
        expectedRevision: 2,
        path: '/secret.ts',
        content: 'changed',
      },
      { toolCallId: 'call', emitCustomEvent: () => {} },
    ),
  ).rejects.toThrow()
  expect(m.store).not.toHaveBeenCalled()
})

it('recovers a committed edit without writing a second revision', async () => {
  m.replay.mockResolvedValue({ revisionNumber: 3, snapshotHash: 'new-hash' })
  const [, , , edit] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  const args = {
    projectId: 'project',
    expectedRevision: 2,
    path: '/index.ts',
    content: 'export default 10',
  }
  expect(
    await handler(edit.execute)(args, {
      toolCallId: 'call',
      emitCustomEvent: () => {},
    }),
  ).toEqual({
    projectId: 'project',
    revision: 3,
    snapshotHash: 'new-hash',
    path: '/index.ts',
  })
  expect(m.snapshot).not.toHaveBeenCalled()
  expect(m.store).not.toHaveBeenCalled()
  expect(m.update).not.toHaveBeenCalled()
  expect(m.replay).toHaveBeenCalledWith(
    expect.objectContaining({
      projectId: 'project',
      ownerId: 'owner',
      requestHash: 'request-hash',
    }),
  )
})

it('creates projects through the shared limits and project persistence services', async () => {
  m.limit.mockResolvedValue({ allowed: true })
  m.snapshotHash.mockResolvedValue('new-hash')
  m.create.mockResolvedValue({
    id: 'created',
    currentRevisionNumber: 1,
    snapshotHash: 'new-hash',
  })
  const [, , , , create] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  expect(
    await handler(create.execute)(
      { title: 'Test project' },
      { toolCallId: 'create', emitCustomEvent: () => {} },
    ),
  ).toEqual({ projectId: 'created', revision: 1, snapshotHash: 'new-hash' })
  expect(m.limit).toHaveBeenCalledWith('owner', 'project-limit')
  expect(m.store).toHaveBeenCalledWith(
    'owner',
    expect.objectContaining({ title: 'Test project', description: '' }),
  )
  expect(m.create).toHaveBeenCalledWith(
    expect.objectContaining({
      ownerId: 'owner',
      title: 'Test project',
      snapshotHash: 'new-hash',
    }),
  )
})
it('replays committed creation without charging quota or storing another snapshot', async () => {
  m.preflight.mockResolvedValue({
    id: 'existing',
    currentRevisionNumber: 2,
    snapshotHash: 'saved',
  })
  const [, , , , create] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  expect(
    await handler(create.execute)(
      { title: 'Test project' },
      { toolCallId: 'create', emitCustomEvent: () => {} },
    ),
  ).toEqual({ projectId: 'existing', revision: 2, snapshotHash: 'saved' })
  expect(m.limit).not.toHaveBeenCalled()
  expect(m.store).not.toHaveBeenCalled()
})
it('does not create or reserve projects after a shared quota rejection', async () => {
  m.limit.mockResolvedValue({ allowed: false })
  const [, , , , create] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  await expect(
    handler(create.execute)(
      { title: 'Test project' },
      { toolCallId: 'create', emitCustomEvent: () => {} },
    ),
  ).rejects.toThrow('daily project creation limit')
  expect(m.reserve).not.toHaveBeenCalled()
  expect(m.store).not.toHaveBeenCalled()
  expect(m.create).not.toHaveBeenCalled()
})

it('requires a stable creation identity before any project mutation', async () => {
  const [, , , , create] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  await expect(
    handler(create.execute)({ title: 'Test project' }),
  ).rejects.toThrow('tool call identity')
  expect(m.importProjects).not.toHaveBeenCalled()
  expect(m.create).not.toHaveBeenCalled()
})
it('does not create a project after cancellation', async () => {
  const controller = new AbortController()
  controller.abort(new Error('Cancelled'))
  const [, , , , create] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  await expect(
    handler(create.execute)(
      { title: 'Test project' },
      {
        toolCallId: 'create',
        abortSignal: controller.signal,
        emitCustomEvent: () => {},
      },
    ),
  ).rejects.toThrow('Cancelled')
  expect(m.importProjects).not.toHaveBeenCalled()
  expect(m.store).not.toHaveBeenCalled()
})

it('checks conversation access before each package inspection tool', async () => {
  m.identity.mockRejectedValue(new Error('Conversation not found'))
  const [, , , , , inspectModule, searchResources, readResource] =
    assistantProjectTools({ scope, taskId: 'task', assertCurrent: m.current })
  await expect(
    handler(inspectModule.execute)({
      projectId: 'project',
      specifier: 'react',
    }),
  ).rejects.toThrow('Conversation not found')
  await expect(
    handler(searchResources.execute)({
      projectId: 'project',
      specifier: 'react',
      query: '',
    }),
  ).rejects.toThrow('Conversation not found')
  await expect(
    handler(readResource.execute)({
      projectId: 'project',
      specifier: 'react',
      path: '/index.d.ts',
      offset: 0,
    }),
  ).rejects.toThrow('Conversation not found')
  expect(m.get).not.toHaveBeenCalled()
})
it('does not fetch package resources for a cancelled request', async () => {
  const controller = new AbortController()
  controller.abort(new Error('Request cancelled'))
  const [, , , , , inspectModule] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  await expect(
    handler(inspectModule.execute)(
      { projectId: 'project', specifier: 'react' },
      {
        toolCallId: 'call',
        abortSignal: controller.signal,
        emitCustomEvent: () => {},
      },
    ),
  ).rejects.toThrow('Request cancelled')
  expect(m.get).not.toHaveBeenCalled()
})

it('persists the original runtime scaffold with revision and ownership checks', async () => {
  m.get.mockResolvedValue({
    id: 'project',
    title: 'App',
    description: '',
    snapshotHash: 'hash',
    currentRevisionNumber: 2,
  })
  const [, , , , , , , , upgrade] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  expect(
    await handler(upgrade.execute)(
      { projectId: 'project', expectedRevision: 2 },
      { toolCallId: 'upgrade-call', emitCustomEvent: () => {} },
    ),
  ).toEqual({ projectId: 'project', revision: 3, snapshotHash: 'new-hash' })
  expect(m.store).toHaveBeenCalledWith(
    'owner',
    expect.objectContaining({
      runtime: {
        type: 'webcontainer',
        install: { command: 'pnpm', args: ['install'] },
        start: { command: 'pnpm', args: ['run', 'dev'] },
      },
      workspace: expect.objectContaining({
        files: expect.objectContaining({ '/index.ts': 'export default 9' }),
      }),
    }),
  )
  expect(m.update).toHaveBeenCalledWith(
    expect.objectContaining({ ownerId: 'owner', expectedRevisionNumber: 2 }),
  )
})
it('rejects dependency writes before a runtime upgrade without saving a revision', async () => {
  m.get.mockResolvedValue({
    id: 'project',
    title: 'App',
    description: '',
    snapshotHash: 'hash',
    currentRevisionNumber: 2,
  })
  const [, , , , , , , , , install] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  await expect(
    handler(install.execute)(
      {
        projectId: 'project',
        expectedRevision: 2,
        name: 'react',
        version: '19.2.3',
      },
      { toolCallId: 'install-call', emitCustomEvent: () => {} },
    ),
  ).rejects.toThrow('upgrade_runtime')
  expect(m.store).not.toHaveBeenCalled()
  expect(m.update).not.toHaveBeenCalled()
})

it('saves an exact dependency version using the original manifest mutation', async () => {
  const starter: ExampleWorkspace = {
    version: exampleWorkspaceVersion,
    entry: '/src/index.tsx',
    files: { '/src/index.tsx': 'export default 9' },
    imports: {},
  }
  const upgraded = upgradeBuilderAiWorkspaceToWebContainer({
    workspace: starter,
  })
  m.snapshot.mockResolvedValue({ title: 'App', description: '', ...upgraded })
  m.get.mockResolvedValue({
    id: 'project',
    title: 'App',
    description: '',
    snapshotHash: 'hash',
    currentRevisionNumber: 2,
  })
  const [, , , , , , , , , install] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  await handler(install.execute)(
    {
      projectId: 'project',
      expectedRevision: 2,
      name: 'zod',
      version: '4.1.12',
    },
    { toolCallId: 'install-call', emitCustomEvent: () => {} },
  )
  const saved = m.store.mock.calls[0]?.[1]
  expect(
    JSON.parse(saved.workspace.files['/package.json']).dependencies.zod,
  ).toBe('4.1.12')
  expect(saved.workspace.files['/src/index.tsx']).toBe('export default 9')
  expect(saved.runtime).toEqual(upgraded.runtime)
  expect(m.update).toHaveBeenCalledWith(
    expect.objectContaining({ ownerId: 'owner', expectedRevisionNumber: 2 }),
  )
})
it('replays runtime and dependency receipts without changing source again', async () => {
  m.replay.mockResolvedValue({ revisionNumber: 3, snapshotHash: 'committed' })
  const [, , , , , , , , upgrade, install] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  expect(
    await handler(upgrade.execute)(
      { projectId: 'project', expectedRevision: 2 },
      { toolCallId: 'upgrade', emitCustomEvent: () => {} },
    ),
  ).toEqual({ projectId: 'project', revision: 3, snapshotHash: 'committed' })
  expect(
    await handler(install.execute)(
      {
        projectId: 'project',
        expectedRevision: 2,
        name: 'zod',
        version: '4.1.12',
      },
      { toolCallId: 'install', emitCustomEvent: () => {} },
    ),
  ).toEqual({ projectId: 'project', revision: 3, snapshotHash: 'committed' })
  expect(m.get).not.toHaveBeenCalled()
  expect(m.store).not.toHaveBeenCalled()
  expect(m.update).not.toHaveBeenCalled()
})

it('publishes project refresh only after the revision commits', async () => {
  m.get.mockResolvedValue({
    id: 'project',
    title: 'App',
    description: '',
    snapshotHash: 'hash',
    currentRevisionNumber: 2,
  })
  const emit = vi.fn()
  const [, , , edit] = assistantProjectTools({
    scope,
    taskId: 'task',
    assertCurrent: m.current,
  })
  const args = {
    projectId: 'project',
    expectedRevision: 2,
    path: '/index.ts',
    content: 'export default 10',
  }
  m.update.mockRejectedValueOnce(new Error('Revision conflict'))
  await expect(
    handler(edit.execute)(args, { toolCallId: 'edit', emitCustomEvent: emit }),
  ).rejects.toThrow('Revision conflict')
  expect(emit).not.toHaveBeenCalled()
  await handler(edit.execute)(args, {
    toolCallId: 'edit',
    emitCustomEvent: emit,
  })
  expect(emit).toHaveBeenCalledWith('tanstack.project.saved', {
    projectId: 'project',
    revision: 3,
  })
})
