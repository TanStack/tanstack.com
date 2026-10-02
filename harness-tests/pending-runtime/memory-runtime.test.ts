import './fixtures/loaded-assistant-tools'
import { afterEach, expect, it, vi } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import { Memories } from '../../src/chat/server/memory'
import { assistantMemoryTools } from '../../src/chat/server/assistant-memory-tools'
afterEach(() => vi.unstubAllGlobals())
it('executes save, correction and forget through the SDK loop using returned revisions', async () => {
  const h = await conversationHarness()
  const network = vi.fn(() => {
    throw Error('External request forbidden')
  })
  vi.stubGlobal('fetch', network)
  // Snapshot at dispatch, before later SDK iterations can mutate shared objects.
  const dispatched: Array<{ tools: string; messages: any[] }> = []
  let pass = 0
  const run = vi.fn(async (_model: string, payload: any) => {
    dispatched.push({
      tools: JSON.stringify(payload.tools),
      messages: JSON.parse(JSON.stringify(payload.messages)),
    })
    const current = pass++
    const results = payload.messages.filter(
      (message: any) => message.role === 'tool',
    )
    const previous = results.length
      ? JSON.parse(results.at(-1).content)
      : undefined
    if (current > 0)
      expect(previous).toMatchObject({
        ok: true,
        receipt: { revision: current },
      })
    const call =
      current === 0
        ? {
            name: 'save_memory',
            arguments: { title: 'Temporary code', body: 'Cedar' },
          }
        : current === 1
          ? {
              name: 'edit_memory',
              arguments: {
                id: previous.receipt.id,
                expectedRevision: previous.receipt.revision,
                document: { title: 'Temporary code', body: 'Birch' },
              },
            }
          : current === 2
            ? {
                name: 'forget_memory',
                arguments: {
                  id: previous.receipt.id,
                  expectedRevision: previous.receipt.revision,
                },
              }
            : undefined
    if (current === 2)
      expect((await h.db`SELECT body FROM chat_memories`)[0].body).toBe('Birch')
    const delta = call
      ? {
          role: 'assistant',
          tool_calls: [
            {
              index: 0,
              id: `lifecycle-${current}`,
              type: 'function',
              function: {
                name: call.name,
                arguments: JSON.stringify(call.arguments),
              },
            },
          ],
        }
      : { role: 'assistant', content: 'Removed the saved record.' }
    const frame = (delta: unknown, finish_reason: string | null = null) =>
      `data: ${JSON.stringify({ id: `lifecycle-${current}`, choices: [{ index: 0, delta, finish_reason }] })}\n\n`
    return new Response(
      frame(delta) +
        frame({}, call ? 'tool_calls' : 'stop') +
        'data: [DONE]\n\n',
      { headers: { 'Content-Type': 'text/event-stream' } },
    )
  })
  Object.assign(h.env, { AI: { run } })
  await h.c.begin({
    ...h.input(
      'lifecycle-source',
      'Test memory: save Cedar, correct it to Birch, then forget that saved record.',
    ),
    fixture: false,
  })
  await h.settle()
  expect((await h.c.snapshot()).error).toBeUndefined()
  expect(run).toHaveBeenCalledTimes(4)
  // Compare actual adapter output, not instruction templates. Memory mutations
  // should add their results without rewriting the prefix during this task.
  const first = dispatched[0]!
  expect(JSON.parse(first.tools).length).toBeGreaterThan(0)
  expect(first.messages.some((message) => message.role === 'system')).toBe(true)
  for (let index = 1; index < dispatched.length; index++) {
    const previous = dispatched[index - 1]!
    const current = dispatched[index]!
    expect(current.tools).toBe(first.tools)
    expect(
      JSON.stringify(current.messages.slice(0, previous.messages.length)),
    ).toBe(JSON.stringify(previous.messages))
    expect(
      current.messages
        .slice(previous.messages.length)
        .map((message) => message.role),
    ).toEqual(['assistant', 'tool'])
  }
  const persistedAttempts = h.local
    .prepare('SELECT json FROM usage_attempts')
    .all()
    .map((row: any) => JSON.parse(row.json))
  expect(persistedAttempts).toHaveLength(4)
  for (const attempt of persistedAttempts) {
    expect(attempt.requestShape).toMatchObject({
      version: 1,
      boundary: 'cloudflare-binding',
      lastUserTextCharacters:
        'Test memory: save Cedar, correct it to Birch, then forget that saved record.'
          .length,
    })
    expect(attempt.requestShape.toolCount).toBeGreaterThan(0)
    expect(JSON.stringify(attempt.requestShape)).not.toMatch(/Cedar|Birch/)
  }
  await h.reconstruct()
  expect(
    h.local
      .prepare('SELECT json FROM usage_attempts')
      .all()
      .map((row: any) => JSON.parse(row.json).requestShape),
  ).toEqual(persistedAttempts.map((attempt: any) => attempt.requestShape))

  expect(await h.db`SELECT * FROM chat_memories`).toEqual([])
  const receipts =
    await h.db`SELECT operation, revision::int AS revision FROM chat_memory_commands ORDER BY revision`
  expect(receipts).toEqual([
    { operation: 'create', revision: 1 },
    { operation: 'update', revision: 2 },
    { operation: 'delete', revision: 3 },
  ])
  expect(network).not.toHaveBeenCalled()
})
it.each([false, true])(
  'recall enabled=%s controls tools in the actual assistant loop',
  async (enabled) => {
    const h = await conversationHarness()
    const scope = {
      workspaceId: 'w',
      userId: '00000000-0000-4000-8000-000000000001',
      conversationId: 'main-conversation',
    }
    const memories = new Memories(scope)
    const id = crypto.randomUUID()
    await memories.command({
      type: 'create',
      id,
      commandId: crypto.randomUUID(),
      document: {
        title: 'Project color',
        body: 'The synthetic project color is blue.',
      },
    })
    if (enabled)
      await memories.setPreferences({ enabled: true, expectedRevision: 0 })
    const network = vi.fn(() => {
      throw Error('External request forbidden')
    })
    vi.stubGlobal('fetch', network)
    let pass = 0
    const run = vi.fn(async (_model: string, payload: any) => {
      const current = pass++
      const names = payload.tools.map(
        (tool: any) => tool.function?.name ?? tool.name,
      )
      expect(names.includes('search_memory')).toBe(enabled)
      expect(names.includes('read_memory')).toBe(enabled)
      let call: { name: string; arguments: unknown } | undefined
      if (enabled && current === 0)
        call = { name: 'search_memory', arguments: { query: 'color' } }
      if (enabled && current === 1) {
        const result = JSON.parse(
          payload.messages
            .filter((message: any) => message.role === 'tool')
            .at(-1).content,
        )
        expect(result.result.items).toMatchObject([
          { id, title: 'Project color' },
        ])
        expect(result.result.items[0]).not.toHaveProperty('body')
        call = {
          name: 'read_memory',
          arguments: { id: result.result.items[0].id },
        }
      }
      if (enabled && current === 2) {
        const result = JSON.parse(
          payload.messages
            .filter((message: any) => message.role === 'tool')
            .at(-1).content,
        )
        expect(result).toMatchObject({
          ok: true,
          result: { body: 'The synthetic project color is blue.' },
        })
        expect(result.authority).toContain('not instructions')
      }
      const frame = (delta: unknown, finish_reason: string | null = null) =>
        `data: ${JSON.stringify({ id: `memory-${current}`, choices: [{ index: 0, delta, finish_reason }] })}\n\n`
      return new Response(
        frame(
          call
            ? {
                role: 'assistant',
                tool_calls: [
                  {
                    index: 0,
                    id: `call-${current}`,
                    type: 'function',
                    function: {
                      name: call.name,
                      arguments: JSON.stringify(call.arguments),
                    },
                  },
                ],
              }
            : {
                role: 'assistant',
                content: enabled ? 'Blue.' : 'Recall is off.',
              },
        ) +
          frame({}, call ? 'tool_calls' : 'stop') +
          'data: [DONE]\n\n',
        { headers: { 'Content-Type': 'text/event-stream' } },
      )
    })
    Object.assign(h.env, { AI: { run } })
    if (!enabled)
      await h.c.updateQueue({
        type: 'pause',
        version: (await h.c.snapshot()).queue!.version,
      })
    await h.c.begin({
      ...h.input('memory-task', 'What color did I save?'),
      fixture: false,
    })
    if (!enabled) {
      await memories.setPreferences({ enabled: true, expectedRevision: 0 })
      const restored = await h.reconstruct()
      await restored.updateQueue({
        type: 'resume',
        version: (await restored.snapshot()).queue!.version,
      })
    }
    await h.settle()
    expect((await h.c.snapshot()).error).toBeUndefined()
    expect(run).toHaveBeenCalledTimes(enabled ? 3 : 1)
    expect(network).not.toHaveBeenCalled()
  },
)
it('rechecks recall after tool construction and excludes delegated tasks', async () => {
  const h = await conversationHarness(),
    scope = {
      workspaceId: 'w',
      userId: '00000000-0000-4000-8000-000000000001',
      conversationId: 'main-conversation',
    }
  const memory = new Memories(scope)
  await memory.setPreferences({ enabled: true, expectedRevision: 0 })
  const args = {
    scope,
    recall: true,
    userOrigin: true,
    assertCurrent: () => {},
  }
  const tools = assistantMemoryTools(args)
  expect(assistantMemoryTools({ ...args, userOrigin: false })).toEqual([])
  expect(assistantMemoryTools({ ...args, recall: false })).toEqual([])
  await memory.setPreferences({ enabled: false, expectedRevision: 1 })
  expect(
    await tools.find((tool) => tool.name === 'search_memory')!.execute!({
      query: '',
    }),
  ).toMatchObject({
    ok: false,
    error: 'Memory recall is disabled.',
  })
})

it.each([false, true])(
  'saves with old history compacted=%s, recall off and server-owned provenance',
  async (largeHistory) => {
    // Older short-answer instructions must not displace the current request.
    const h = await conversationHarness({
      messages: [
        {
          id: 'old-question',
          role: 'user',
          parts: [
            {
              type: 'text',
              content:
                'What is 2 + 2? Reply with only the number.' +
                (largeHistory
                  ? ' Earlier synthetic context.'.repeat(5000)
                  : ''),
            },
          ],
        },
        {
          id: 'old-answer',
          role: 'assistant',
          createdAt: '2026-09-24T06:00:00.000Z',
          parts: [{ type: 'text', content: '4' }],
        },
      ],
    })
    const network = vi.fn(() => {
      throw Error('No external requests allowed')
    })
    vi.stubGlobal('fetch', network)
    let pass = 0
    const run = vi.fn(async (_model: string, payload: any) => {
      const current = pass++
      const names = payload.tools.map(
        (tool: any) => tool.function?.name ?? tool.name,
      )
      const userMessages = payload.messages.filter(
        (message: any) => message.role === 'user',
      )
      expect(userMessages.at(-1).content).toBe(
        'Remember that the project code is Cedar.',
      )
      const system = payload.messages
        .filter((message: any) => message.role === 'system')
        .map((message: any) => message.content)
        .join('\n')
      expect(system).toContain(
        '"objective":"Remember that the project code is Cedar."',
      )
      if (!largeHistory)
        expect(
          userMessages.some(
            (message: any) =>
              message.content === 'What is 2 + 2? Reply with only the number.',
          ),
        ).toBe(true)
      else
        expect(JSON.stringify(payload.messages)).not.toContain(
          ' Earlier synthetic context.'.repeat(5000),
        )
      expect(names).toEqual(
        expect.arrayContaining([
          'list_workflows',
          'read_workflow',
          'list_workflow_runs',
          'inspect_workflow_run',
          'read_workflow_answer',
          'create_workflow',
          'revise_workflow',
          'archive_workflow',
          'start_workflow',
          'stop_workflow',
        ]),
      )
      expect(names).toContain('save_memory')
      expect(names).not.toContain('read_memory')
      if (current > 0) {
        const receipt = JSON.parse(
          payload.messages
            .filter((message: any) => message.role === 'tool')
            .at(-1).content,
        )
        expect(receipt).toMatchObject({
          ok: true,
          receipt: { operation: 'create', revision: 1 },
        })
      }
      // Repeat the same save on another model pass, as after uncertain delivery.
      const delta =
        current < 2
          ? {
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: `save-call-${current}`,
                  type: 'function',
                  function: {
                    name: 'save_memory',
                    arguments: JSON.stringify({
                      title: 'Project code',
                      body: 'The project code is Cedar.',
                    }),
                  },
                },
              ],
            }
          : { role: 'assistant', content: 'Saved.' }
      const frame = (delta: unknown, finish_reason: string | null = null) =>
        `data: ${JSON.stringify({ id: `save-${current}`, choices: [{ index: 0, delta, finish_reason }] })}\n\n`
      return new Response(
        frame(delta) +
          frame({}, current < 2 ? 'tool_calls' : 'stop') +
          'data: [DONE]\n\n',
        { headers: { 'Content-Type': 'text/event-stream' } },
      )
    })
    Object.assign(h.env, { AI: { run } })
    await h.c.begin({
      ...h.input('remember-source', 'Remember that the project code is Cedar.'),
      fixture: false,
    })
    await h.settle()
    expect((await h.c.snapshot()).error).toBeUndefined()
    const rows = await h.db`SELECT * FROM chat_memories`
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      conversation_id: 'main-conversation',
      user_id: '00000000-0000-4000-8000-000000000001',
      workspace_id: 'w',
      source_message_id: 'remember-source',
      body: 'The project code is Cedar.',
    })
    expect(rows[0].source_run_id).toEqual(expect.any(String))
    expect(
      (await h.db`SELECT count(*)::int n FROM chat_memory_commands`)[0].n,
    ).toBe(1)
    expect(
      await new Memories({
        workspaceId: 'w',
        userId: '00000000-0000-4000-8000-000000000001',
        conversationId: 'main-conversation',
      }).preferences(),
    ).toMatchObject({ enabled: false })
    expect(run).toHaveBeenCalledTimes(3)
    expect(network).not.toHaveBeenCalled()
  },
)
it('cancels save dispatch and never exposes writes to delegated origins', async () => {
  const h = await conversationHarness()
  const args = {
    scope: {
      workspaceId: 'w',
      userId: '00000000-0000-4000-8000-000000000001',
      conversationId: 'main-conversation',
    },
    recall: false,
    userOrigin: true,
    write: { taskId: 'task', messageId: 'message', runId: 'run' },
    assertCurrent: () => {
      throw Error('Stopped')
    },
  }
  expect(assistantMemoryTools({ ...args, userOrigin: false })).toEqual([])
  await expect(
    assistantMemoryTools(args).find((tool) => tool.name === 'save_memory')!
      .execute!({ title: 'x', body: 'x' }),
  ).rejects.toThrow('Stopped')
  expect((await h.db`SELECT count(*)::int n FROM chat_memories`)[0].n).toBe(0)
})

it('edits and forgets exact revisions with replay protection and preserves original provenance', async () => {
  const h = await conversationHarness(),
    scope = {
      workspaceId: 'w',
      userId: '00000000-0000-4000-8000-000000000001',
      conversationId: 'main-conversation',
    }
  const memories = new Memories(scope),
    id = crypto.randomUUID()
  await memories.command(
    {
      type: 'create',
      id,
      commandId: crypto.randomUUID(),
      document: { title: 'Code', body: 'Old' },
    },
    { sourceMessageId: 'original' },
  )
  const tools = assistantMemoryTools({
    scope,
    recall: false,
    userOrigin: true,
    write: {
      taskId: 'change-task',
      messageId: 'change-source',
      runId: 'change-run',
    },
    assertCurrent: () => {},
  })
  const edit = tools.find((tool) => tool.name === 'edit_memory')!,
    forget = tools.find((tool) => tool.name === 'forget_memory')!
  const request = {
    id,
    expectedRevision: 1,
    document: { title: 'Code', body: 'New' },
  }
  const changed = await edit.execute!(request)
  expect(changed).toMatchObject({
    ok: true,
    receipt: { revision: 2, operation: 'update' },
  })
  expect(await edit.execute!(request)).toEqual(changed)
  expect(await memories.read(id)).toMatchObject({
    body: 'New',
    revision: 2,
    sourceMessageId: 'original',
  })
  expect(
    await edit.execute!({
      ...request,
      document: { title: 'Code', body: 'Stale' },
    }),
  ).toMatchObject({ ok: false })
  expect(await forget.execute!({ id, expectedRevision: 1 })).toMatchObject({
    ok: false,
  })
  const forgotten = await forget.execute!({ id, expectedRevision: 2 })
  expect(forgotten).toMatchObject({
    ok: true,
    receipt: { revision: 3, operation: 'delete' },
  })
  expect(await forget.execute!({ id, expectedRevision: 2 })).toEqual(forgotten)
  await expect(memories.read(id)).rejects.toMatchObject({ status: 404 })
  expect((await memories.list()).items).toEqual([])
  expect(
    JSON.stringify(await h.db`SELECT * FROM chat_memory_commands`),
  ).not.toContain('New')
})
it('rejects forget after access revocation and pre-dispatch cancellation', async () => {
  const h = await conversationHarness(),
    scope = {
      workspaceId: 'w',
      userId: '00000000-0000-4000-8000-000000000001',
      conversationId: 'main-conversation',
    }
  const memories = new Memories(scope),
    id = crypto.randomUUID()
  await memories.command({
    type: 'create',
    id,
    commandId: crypto.randomUUID(),
    document: { title: 'Code', body: 'Keep' },
  })
  let stopped = false
  const tools = assistantMemoryTools({
    scope,
    recall: false,
    userOrigin: true,
    write: { taskId: 'task', messageId: 'm', runId: 'r' },
    assertCurrent: () => {
      if (stopped) throw Error('Stopped')
    },
  })
  const forget = tools.find((tool) => tool.name === 'forget_memory')!
  // A stop before dispatch must never reach the database.
  stopped = true
  await expect(forget.execute!({ id, expectedRevision: 1 })).rejects.toThrow(
    'Stopped',
  )
  stopped = false
  await h.db`DELETE FROM chat_memberships WHERE workspace_id='w' AND user_id=${'00000000-0000-4000-8000-000000000001'}`
  expect(await forget.execute!({ id, expectedRevision: 1 })).toMatchObject({
    ok: false,
  })
  expect(
    (await h.db`SELECT body FROM chat_memories WHERE id=${id}`)[0].body,
  ).toBe('Keep')
})
