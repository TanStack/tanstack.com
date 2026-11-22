import './fixtures/loaded-assistant-tools'
import { afterEach, expect, it, vi } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import { connectionSchema } from '../../src/chat/core/types'
import { taskContext } from '../../src/chat/core/task-context'
import { McpAccounts } from '../../src/chat/server/mcp-accounts'
import { Plugins } from '../../src/chat/server/plugins'
import { hash } from '../../src/chat/server/crypto'
import {
  parsePluginPackage,
  pluginManifestSchemaId,
  pluginMcpSchemaId,
} from '../../src/chat/core/plugins'
import { writeCredentials } from '../../src/chat/server/credentials'
import * as kodySkills from '../../src/chat/server/kody-skill-catalog'
import * as kodyReferences from '../../src/chat/server/kody-reference-catalog'
import * as kodyGuidance from '../../src/chat/server/kody-guidance'
import * as mcpCatalog from '../../src/chat/server/mcp-catalog'
import * as mcpTransport from '../../src/chat/server/mcp'
import { refreshToolReferences } from '../../src/chat/server/tool-reference-catalog'
import * as connections from '../../src/chat/server/mcp-connections'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function response(call?: { name: string; args: unknown }) {
  const frame = (delta: unknown, finish_reason: string | null = null) =>
    `data: ${JSON.stringify({ id: crypto.randomUUID(), choices: [{ index: 0, delta, finish_reason }] })}\n\n`
  return new Response(
    frame(
      call
        ? {
            role: 'assistant',
            tool_calls: [
              {
                index: 0,
                id: crypto.randomUUID(),
                type: 'function',
                function: {
                  name: call.name,
                  arguments: JSON.stringify(call.args),
                },
              },
            ],
          }
        : {
            role: 'assistant',
            content: 'Cedar was ready in the selected package.',
          },
    ) +
      frame({}, call ? 'tool_calls' : 'stop') +
      'data: [DONE]\n\n',
    { headers: { 'Content-Type': 'text/event-stream' } },
  )
}
const files = (version: number) => [
  {
    path: 'plugin.json',
    text: JSON.stringify({
      $schema: pluginManifestSchemaId,
      name: 'project.notes',
      version: `${version}.0.0`,
    }),
  },
  {
    path: `skills/review-v${version}/SKILL.md`,
    text: `---\nname: review-v${version}\ndescription: Read the retained project notes.\n---\nRead notes.txt from this exact package. Version ${version} instructions.`,
  },
  {
    path: 'skills/unused/SKILL.md',
    text: '---\nname: unused\ndescription: An unrelated skill.\n---\nUNRELATED INSTRUCTIONS MUST NOT ACTIVATE.',
  },
  {
    path: 'notes.txt',
    text:
      version === 1
        ? 'Cedar: ready. Retained version one.'
        : 'Cedar: blocked. New version two.',
  },
]

async function setup() {
  const h = await conversationHarness()
  h.env.APP_MODE = 'test'
  const policy = {
    ...h.input('seed').policy,
    allowKody: false,
    allowMcp: false,
  }
  await h.db`UPDATE chat_workspaces SET policy=${h.db.json(policy)} WHERE id='w'`
  const plugins = new Plugins(h.env, {
    workspaceId: 'w',
    userId: '00000000-0000-4000-8000-000000000001',
  })
  const one = files(1)
  const installation = await plugins.command({
    type: 'install',
    id: crypto.randomUUID(),
    commandId: crypto.randomUUID(),
    enabled: true,
    files: one,
    digest: (await parsePluginPackage(one)).digest,
  })
  const references = [
    { kind: 'plugin' as const, installationId: installation.id, version: 1 },
  ]
  const input = () => ({
    ...h.input(crypto.randomUUID(), 'Read the selected project notes.'),
    fixture: false,
    policy,
    references,
  })
  const update = async () => {
    const two = files(2)
    await plugins.command({
      type: 'update',
      id: installation.id,
      commandId: crypto.randomUUID(),
      expectedRevision: 1,
      files: two,
      digest: (await parsePluginPackage(two)).digest,
    })
  }
  const network = vi.fn(() => {
    throw Error('External requests are forbidden.')
  })
  vi.stubGlobal('fetch', network)
  return { ...h, plugins, installation, references, input, update, network }
}

function latestResult(payload: any) {
  return JSON.parse(
    payload.messages.filter((m: any) => m.role === 'tool').at(-1).content,
  )
}

it('pins a selected old package before dispatch and discovers its exact old skill and resource through the actual model loop', async () => {
  const h = await setup()
  await h.update()
  let skillId: string | undefined
  const payloads: any[] = []
  const discovery = vi
    .spyOn(connections, 'connectedMcpServers')
    .mockImplementation(async (_env, _user, _policy, _id, options) => {
      expect(options?.versions).toEqual([
        { installationId: h.installation.id, version: 1 },
      ])
      const persisted = JSON.parse(
        h.local.prepare('SELECT json FROM state WHERE id=1').get()!
          .json as string,
      )
      expect(persisted.assistantTask.loadedPlugins).toEqual(options?.versions)
      return []
    })
  const run = vi.fn(async (_model: string, payload: any) => {
    const pass = payloads.length
    payloads.push(structuredClone(payload))
    const persisted = JSON.parse(
      h.local.prepare('SELECT json FROM state WHERE id=1').get()!
        .json as string,
    )
    expect(persisted.assistantTask.loadedPlugins).toEqual([
      { installationId: h.installation.id, version: 1 },
    ])
    if (pass === 0) {
      expect(JSON.stringify(payload.messages)).toContain(h.installation.id)
      expect(persisted.assistantTask.loadedSkills).toBeUndefined()
      expect(JSON.stringify(payload)).not.toContain(
        'UNRELATED INSTRUCTIONS MUST NOT ACTIVATE',
      )
      return response({
        name: 'inspect_plugin',
        args: { installationId: h.installation.id, version: 1 },
      })
    }
    const result = latestResult(payload)
    expect(result.ok).toBe(true)
    if (pass === 1) {
      const skill = result.skills.find(
        (item: any) => item.path === 'skills/review-v1/SKILL.md',
      )
      expect(skill).toMatchObject({
        id: expect.stringMatching(/^plugin:/),
        version: 1,
      })
      skillId = skill.id
      expect(result.skills.some((item: any) => item.name === 'review-v2')).toBe(
        false,
      )
      return response({
        name: 'read_skill',
        args: { skillId, version: skill.version },
      })
    }
    if (pass === 2) {
      expect(result.document.instructions).toContain('Version 1 instructions')
      expect(result.origin).toMatchObject({
        installationId: h.installation.id,
        installedVersion: 1,
      })
      return response({
        name: 'read_plugin_file',
        args: {
          installationId: result.origin.installationId,
          version: result.origin.installedVersion,
          path: 'notes.txt',
        },
      })
    }
    expect(pass).toBe(3)
    expect(result.text).toBe('Cedar: ready. Retained version one.')
    expect(JSON.stringify(payload)).not.toContain('New version two')
    return response()
  })
  Object.assign(h.env, { AI: { run } })
  await h.c.begin(h.input())
  await h.settle()
  const state = await h.c.snapshot()
  expect(state.error).toBeUndefined()
  const persistedTask = JSON.parse(
    h.local.prepare('SELECT json FROM state WHERE id=1').get()!.json as string,
  ).assistantTask
  expect(taskContext([], persistedTask).sources).toEqual([
    expect.objectContaining({
      kind: 'plugin',
      installationId: h.installation.id,
      version: 1,
      detail: 'Installed v1',
    }),
  ])
  expect(run).toHaveBeenCalledTimes(4)
  expect(state.assistantTask?.loadedSkills).toEqual([{ skillId, version: 1 }])
  expect(state.assistantTask?.loadedPlugins).toEqual([
    { installationId: h.installation.id, version: 1 },
  ])
  // Model approval/continuation messages can push the task's original request
  // outside the live window. Exercise actual archival and SQLite reconstruction.
  const target = h.c as any
  const originalMessageId = state.assistantTask!.messageId
  for (let index = 0; index < 7; index++)
    target.state.messages.push({
      id: `synthetic-continuation-${index}`,
      role: 'user',
      parts: [{ type: 'text', content: 'Continue the same task.' }],
    })
  await target.save()
  const restored = await h.reconstruct()
  const recovered = await restored.snapshot()
  expect(
    recovered.messages.some((message) => message.id === originalMessageId),
  ).toBe(false)
  expect(recovered.archivedTurns).toBeGreaterThan(0)
  expect(
    taskContext(recovered.messages, recovered.assistantTask).sources,
  ).toEqual(taskContext([], persistedTask).sources)
  expect(recovered.assistantTask?.loadedPlugins).toEqual(
    state.assistantTask?.loadedPlugins,
  )
  expect(h.network).not.toHaveBeenCalled()
  expect(discovery).not.toHaveBeenCalled()
  discovery.mockRestore()
})

it('blocks dispatch if a selected plugin is disabled after context preparation', async () => {
  const h = await setup()
  const target = h.c as any
  const original = target.save.bind(target)
  let disabled = false
  vi.spyOn(target, 'save').mockImplementation(async () => {
    const result = await original()
    const prepared = h.local
      .prepare('SELECT json FROM usage_steps')
      .all()
      .some(
        (row) =>
          typeof row.json === 'string' && row.json.includes('"context":'),
      )
    if (!disabled && prepared) {
      disabled = true
      await h.db`UPDATE chat_plugin_installations SET enabled=false WHERE id=${h.installation.id}`
    }
    return result
  })
  const run = vi.fn(async () => response())
  Object.assign(h.env, { AI: { run } })
  await h.c.begin(h.input())
  await h.settle()
  expect(disabled).toBe(true)
  expect(run).not.toHaveBeenCalled()
  expect((await h.c.snapshot()).error).toMatch(/unavailable|disabled|removed/)
  expect(h.network).not.toHaveBeenCalled()
})

it('rolls back selected pins if their durable publication fails before model dispatch', async () => {
  const h = await setup()
  const target = h.c as any
  const original = target.save.bind(target)
  let failed = false
  vi.spyOn(target, 'save').mockImplementation(async () => {
    if (!failed && target.state.assistantTask?.loadedPlugins?.length) {
      failed = true
      throw Error('Synthetic pin publication failure')
    }
    return original()
  })
  const run = vi.fn(async () => response())
  Object.assign(h.env, { AI: { run } })
  await h.c.begin(h.input())
  await h.settle()
  expect(failed).toBe(true)
  expect(run).not.toHaveBeenCalled()
  const persisted = JSON.parse(
    h.local.prepare('SELECT json FROM state WHERE id=1').get()!.json as string,
  )
  expect(persisted.assistantTask.loadedPlugins).toBeUndefined()
  expect((await h.c.snapshot()).assistantTask?.loadedPlugins).toBeUndefined()
})

it('retains a queued plugin version through update and reconstruction before its first model request', async () => {
  const h = await setup()
  await h.c.updateQueue({ type: 'pause', version: 0 })
  await h.c.begin(h.input())
  await h.update()
  const run = vi.fn(async (_model: string, payload: any) => {
    expect(JSON.stringify(payload.messages)).toContain('Installed v1')
    return response()
  })
  Object.assign(h.env, { AI: { run } })
  const restored = await h.reconstruct()
  const queued = await restored.snapshot()
  expect(queued.queue?.items[0].references).toMatchObject(h.references)
  await restored.updateQueue({ type: 'resume', version: queued.queue!.version })
  await h.settle()
  const completed = await restored.snapshot()
  expect(completed.error).toBeUndefined()
  expect(completed.assistantTask?.loadedPlugins).toEqual([
    { installationId: h.installation.id, version: 1 },
  ])
  expect(run).toHaveBeenCalledOnce()
  expect(h.network).not.toHaveBeenCalled()
})

it.each(['disable', 'remove'] as const)(
  'does not dispatch a queued selected plugin after %s',
  async (action) => {
    const h = await setup()
    await h.c.updateQueue({ type: 'pause', version: 0 })
    await h.c.begin(h.input())
    await h.plugins.command({
      type: action === 'disable' ? 'enabled' : 'remove',
      id: h.installation.id,
      commandId: crypto.randomUUID(),
      expectedRevision: 1,
      ...(action === 'disable' ? { enabled: false } : {}),
    })
    const run = vi.fn(async () => response())
    Object.assign(h.env, { AI: { run } })
    const restored = await h.reconstruct()
    const state = await restored.snapshot()
    await restored.updateQueue({
      type: 'resume',
      version: state.queue!.version,
    })
    await h.settle()
    expect((await restored.snapshot()).queue).toMatchObject({
      paused: true,
      error: expect.any(String),
    })
    expect(run).not.toHaveBeenCalled()
    expect(h.network).not.toHaveBeenCalled()
  },
)

it('reauthorizes the selected package before tools after the model responds', async () => {
  const h = await setup()
  const run = vi.fn(async () => {
    await h.db`UPDATE chat_plugin_installations SET enabled=false WHERE id=${h.installation.id}`
    return response({
      name: 'read_plugin_file',
      args: {
        installationId: h.installation.id,
        version: 1,
        path: 'notes.txt',
      },
    })
  })
  Object.assign(h.env, { AI: { run } })
  await h.c.begin(h.input())
  await h.settle()
  expect(run).toHaveBeenCalledOnce()
  const state = await h.c.snapshot()
  expect(state.assistantTask?.status).toBe('incomplete')
  expect(JSON.stringify(state.messages)).not.toContain('Retained version one')
  expect(h.network).not.toHaveBeenCalled()
})

it('keeps selected pins across an approval restart and rejects disabled package approval before execution', async () => {
  const h = await setup()
  vi.spyOn(kodyGuidance, 'readKodyGuidance').mockResolvedValue(undefined)
  vi.spyOn(kodySkills.KodySkillCatalog.prototype, 'list').mockResolvedValue([])
  vi.spyOn(kodySkills, 'suggestKodySkills').mockResolvedValue([])
  vi.spyOn(kodyReferences, 'suggestKodyReferences').mockResolvedValue([])
  await writeCredentials(h.env, '00000000-0000-4000-8000-000000000001', {
    connection: connectionSchema.parse({
      provider: 'included',
      model: h.env.INCLUDED_MODEL,
    }),
    kody: {
      access_token: 'synthetic-never-transmitted-token',
      expires_at: Date.now() + 3_600_000,
      client_id: 'synthetic-client',
    },
  })
  const run = vi.fn(async () =>
    response({
      name: 'kody_propose_execution',
      args: {
        title: 'Synthetic action',
        code: 'export default function main() { return "synthetic" }',
      },
    }),
  )
  Object.assign(h.env, { AI: { run } })
  const input = {
    ...h.input(),
    policy: { ...h.input().policy, allowKody: true },
  }
  await h.db`UPDATE chat_workspaces SET policy=${h.db.json(input.policy)} WHERE id='w'`
  await h.c.begin(input)
  await h.settle()
  const waiting = await h.c.snapshot()
  expect(waiting.approvals).toHaveLength(1)
  expect(waiting.assistantTask?.loadedPlugins).toEqual([
    { installationId: h.installation.id, version: 1 },
  ])
  await h.update()
  const restored = await h.reconstruct()
  await h.db`UPDATE chat_plugin_installations SET enabled=false WHERE id=${h.installation.id}`
  await expect(
    restored.decideApproval(waiting.approvals[0].id, true, input),
  ).rejects.toThrow(/unavailable|disabled|removed/)
  expect((await restored.snapshot()).approvals[0].status).toBe('pending')
  expect(run).toHaveBeenCalledOnce()
  expect(h.network).not.toHaveBeenCalled()
})

async function packageConnectionSetup() {
  const h = await setup()
  // The shared fixture excludes MCP by default. Exercise the real local
  // connection resolver here; only catalog/effect transport is replaced below.
  const actual = await vi.importActual<
    typeof import('../../src/chat/server/mcp-connections')
  >('../../src/chat/server/mcp-connections')
  vi.spyOn(connections, 'connectedMcpServers').mockImplementation(
    actual.connectedMcpServers,
  )
  const policy = { ...h.input().policy, allowMcp: true }
  await h.db`UPDATE chat_workspaces SET policy=${h.db.json(policy)} WHERE id='w'`
  const accountId = crypto.randomUUID()
  await writeCredentials(h.env, '00000000-0000-4000-8000-000000000001', {
    connection: connectionSchema.parse({
      provider: 'included',
      model: h.env.INCLUDED_MODEL,
    }),
    mcpServers: [
      {
        id: accountId,
        label: 'Synthetic notes',
        url: 'https://notes.example.com/mcp',
        enabled: true,
      },
    ],
  })
  await new McpAccounts(h.env, {
    workspaceId: 'w',
    userId: '00000000-0000-4000-8000-000000000001',
  }).ensureLegacy()
  const bundle = [
    ...files(2),
    {
      path: 'mcp.json',
      text: JSON.stringify({
        $schema: pluginMcpSchemaId,
        mcpServers: {
          notes: {
            type: 'streamable-http',
            url: 'https://notes.example.com/mcp',
          },
        },
      }),
    },
  ]
  await h.plugins.command({
    type: 'update',
    id: h.installation.id,
    expectedRevision: 1,
    commandId: crypto.randomUUID(),
    files: bundle,
    digest: (await parsePluginPackage(bundle)).digest,
  })
  await h.plugins.command({
    type: 'bind',
    id: h.installation.id,
    expectedRevision: 2,
    commandId: crypto.randomUUID(),
    version: 2,
    requirementKey: 'notes',
    serverId: accountId,
  })
  const id = `plugin:${h.installation.id}:2:${await hash('notes')}`
  return { ...h, policy, accountId, id, bundle }
}
it('pins a selected package connection before model dispatch without granting a tool call', async () => {
  const h = await packageConnectionSetup()
  const { policy, id } = h
  const run = vi.fn(async () => {
    const persisted = JSON.parse(
      h.local.prepare('SELECT json FROM state WHERE id=1').get()!
        .json as string,
    )
    expect(persisted.assistantTask.loadedPlugins).toEqual([
      { installationId: h.installation.id, version: 2 },
    ])
    return response()
  })
  Object.assign(h.env, { AI: { run } })
  await h.c.begin({
    ...h.input(),
    policy,
    references: [{ kind: 'connection', serverId: id }],
  })
  await h.settle()
  expect((await h.c.snapshot()).error).toBeUndefined()
  expect(run).toHaveBeenCalledOnce()
  expect(h.network).not.toHaveBeenCalled()
})

it.each(['approved', 'account-disabled', 'package-disabled'] as const)(
  'keeps package tool approval scoped through update and restart: %s',
  async (outcome) => {
    const h = await packageConnectionSetup()
    const entry = {
      id: JSON.stringify([h.id, 'tool', 'read_status']),
      serverId: h.id,
      serverLabel: 'project.notes / notes',
      kind: 'tool' as const,
      name: 'read_status',
      title: 'Read synthetic status',
      description: 'Read synthetic status.',
      target: { method: 'tools/call' as const, name: 'read_status' },
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    }
    const catalog = {
      serverId: h.id,
      complete: true,
      fetchedAt: Date.now(),
      scope: 'server-advertised' as const,
      warnings: [],
      entries: [entry],
    }
    expect(
      await connections.connectedMcpServers(
        h.env,
        '00000000-0000-4000-8000-000000000001',
        h.policy,
        h.id,
        { workspaceId: 'w' },
      ),
    ).toEqual([expect.objectContaining({ id: h.id, accountId: h.accountId })])
    await refreshToolReferences(
      h.env,
      { workspaceId: 'w', userId: '00000000-0000-4000-8000-000000000001' },
      { policy: h.policy, fixture: false },
      h.id,
      new AbortController().signal,
      async () => catalog,
    )
    const contracts = vi
      .spyOn(mcpCatalog, 'cachedMcpCatalog')
      .mockImplementation(async (connection) => {
        expect(connection.id).toBe(h.id)
        expect(connection.plugin).toEqual({
          installationId: h.installation.id,
          version: 2,
        })
        return { ...catalog, key: h.id, cache: 'hit' as const }
      })
    const effect = vi.spyOn(mcpTransport, 'mcpCall').mockResolvedValue({
      content: [{ type: 'text', text: 'Synthetic status: ready.' }],
    })
    let passes = 0
    Object.assign(h.env, {
      AI: {
        run: vi.fn(async () =>
          ++passes === 1
            ? response({
                name: 'call_connected_tool',
                args: { entryId: entry.id, arguments: {} },
              })
            : response(),
        ),
      },
    })
    const input = {
      ...h.input(),
      policy: h.policy,
      references: [
        { kind: 'tool' as const, serverId: h.id, toolName: 'read_status' },
      ],
    }
    await h.c.begin(input)
    await h.settle()
    const waiting = await h.c.snapshot()
    expect(waiting.approvals).toHaveLength(1)
    expect(waiting.approvals[0].assistantMcpCall?.entry.serverId).toBe(h.id)
    expect(effect).not.toHaveBeenCalled()
    await h.plugins.command({
      type: 'update',
      id: h.installation.id,
      expectedRevision: 3,
      commandId: crypto.randomUUID(),
      files: h.bundle,
      digest: (await parsePluginPackage(h.bundle)).digest,
    })
    const restored = await h.reconstruct()
    if (outcome !== 'approved') {
      if (outcome === 'account-disabled')
        await h.db`UPDATE chat_mcp_accounts SET enabled=false,revision=revision+1 WHERE id=${h.accountId}`
      else
        await h.db`UPDATE chat_plugin_installations SET enabled=false,revision=revision+1 WHERE id=${h.installation.id}`
      await expect(
        restored.decideApproval(waiting.approvals[0].id, true, input),
      ).rejects.toThrow()
      expect(effect).not.toHaveBeenCalled()
      expect(h.network).not.toHaveBeenCalled()
      return
    }
    await restored.decideApproval(waiting.approvals[0].id, true, input)
    await h.settle()
    const completed = await restored.snapshot()
    expect(completed.approvals[0]).toMatchObject({
      status: 'done',
      executionOutcome: 'succeeded',
    })
    expect(completed.assistantTask?.loadedPlugins).toEqual([
      { installationId: h.installation.id, version: 2 },
    ])
    expect(effect).toHaveBeenCalledTimes(1)
    expect(effect.mock.calls[0][0]).toMatchObject({
      id: h.id,
      plugin: { installationId: h.installation.id, version: 2 },
    })
    await expect(
      restored.decideApproval(waiting.approvals[0].id, true, input),
    ).rejects.toThrow()
    expect(effect).toHaveBeenCalledTimes(1)
    expect(contracts).toHaveBeenCalled()
    expect(h.network).not.toHaveBeenCalled()
  },
)
