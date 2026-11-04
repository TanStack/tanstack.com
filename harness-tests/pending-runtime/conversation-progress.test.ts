import './fixtures/loaded-assistant-tools'
import { callKey } from '../../src/chat/core/assistant-task'
import { hash } from '../../src/chat/server/crypto'
import { expect, it, vi } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import { SavedFiles } from '../../src/chat/server/saved-files'
import { readFileDeliveries } from '../../src/chat/core/file-deliveries'
import { defaultPolicy } from '../../src/chat/core/types'

type Step = { name: string; args: unknown } | { text: string }
async function setup(plan: (pass: number, files: SavedFiles) => Promise<Step>) {
  const h = await conversationHarness()
  const objects = new Map<string, { bytes: Uint8Array; digest: ArrayBuffer }>()
  ;(h.env as any).FILES = {
    put: vi.fn(async (key: string, bytes: Uint8Array) => {
      const record = {
        bytes: new Uint8Array(bytes),
        digest: await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)),
      }
      objects.set(key, record)
      return { size: bytes.length, checksums: { sha256: record.digest } }
    }),
    get: vi.fn(async (key: string) => {
      const r = objects.get(key)
      return r
        ? {
            size: r.bytes.length,
            checksums: { sha256: r.digest },
            body: new Response(Uint8Array.from(r.bytes)).body,
            arrayBuffer: async () => Uint8Array.from(r.bytes).buffer,
          }
        : null
    }),
    head: vi.fn(async (key: string) => {
      const r = objects.get(key)
      return r
        ? { size: r.bytes.length, checksums: { sha256: r.digest } }
        : null
    }),
  }
  const files = new SavedFiles(h.env as any, {
    workspaceId: 'w',
    userId: '00000000-0000-4000-8000-000000000001',
    botId: 'b',
    conversationId: 'main-conversation',
  })
  const run = vi.fn(async () => {
    const pass = run.mock.calls.length - 1,
      step = await plan(pass, files)
    const frame = (delta: unknown, finish_reason: string | null = null) =>
      'data: ' +
      JSON.stringify({
        id: 'completion-' + pass,
        object: 'chat.completion.chunk',
        created: 1,
        model: h.env.INCLUDED_MODEL,
        choices: [{ index: 0, delta, finish_reason }],
      }) +
      '\n\n'
    const body =
      'name' in step
        ? frame({
            role: 'assistant',
            tool_calls: [
              {
                index: 0,
                id: 'call-' + pass,
                type: 'function',
                function: {
                  name: step.name,
                  arguments: JSON.stringify(step.args),
                },
              },
            ],
          }) + frame({}, 'tool_calls')
        : frame({ role: 'assistant', content: step.text }) + frame({}, 'stop')
    return new Response(body + 'data: [DONE]\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  })
  ;(h.env as any).AI = { run }
  return {
    ...h,
    files,
    run,
    objects,
    start: async () => {
      await h.c.begin({
        ...h.input('task', 'Save and inspect the requested file'),
        fixture: false,
        policy: { ...defaultPolicy, allowKody: false, allowMcp: false },
      })
      await h.settle()
      return h.c.snapshot()
    },
  }
}
it('stops an unchanged real native save/read/list loop before the model cap and preserves bytes and receipts', async () => {
  const h = await setup(async (pass, files) => {
    if (pass % 3 === 0)
      return {
        name: 'save_file',
        args: {
          name: 'plan.md',
          mediaType: 'text/markdown',
          content: '# Plan',
        },
      }
    if (pass % 3 === 1)
      return { name: 'read_file', args: { id: (await files.list())[0].id } }
    return { name: 'list_files', args: {} }
  })
  const state = await h.start()
  expect(state.assistantTask?.status).toBe('incomplete')
  expect(state.assistantTask?.reason).toContain('no new evidence')
  expect(h.run.mock.calls.length).toBeLessThan(12)
  const stored = await h.files.list()
  expect(stored).toHaveLength(1)
  expect((await h.files.readText(stored[0].id)).text).toBe('# Plan')
  expect((h.env as any).FILES.put).toHaveBeenCalledTimes(1)
  const receipts = state.messages.flatMap(readFileDeliveries)
  expect(receipts.length).toBeGreaterThan(0)
  expect(new Set(receipts.map((r) => r.file.id))).toEqual(
    new Set([stored[0].id]),
  )
  expect(JSON.stringify(state.assistantTask?.progress)).not.toContain('# Plan')
  const persisted = JSON.parse(
    h.local.prepare('SELECT json FROM state WHERE id=1').get()!.json as string,
  )
  expect(persisted.assistantTask).not.toHaveProperty('recentCalls')
  expect(persisted.identity).toMatchObject({
    workspaceId: 'w',
    userId: '00000000-0000-4000-8000-000000000001',
    conversationId: 'main-conversation',
  })
  const scopedCall = await hash(
    callKey({
      scope: {
        workspaceId: 'w',
        userId: '00000000-0000-4000-8000-000000000001',
        conversationId: 'main-conversation',
      },
      name: 'save_file',
      args: { fileId: stored[0].id },
    }),
  )
  expect(persisted.assistantTask.progress.entries).toContainEqual(
    expect.objectContaining({ call: scopedCall }),
  )
  expect(persisted.assistantTask.progress).toEqual(
    state.assistantTask?.progress,
  )
})
it('permits changed file content and reads to reach a real final response', async () => {
  const h = await setup(async (pass, files) => {
    if (pass === 0 || pass === 3)
      return {
        name: 'save_file',
        args: {
          name: 'plan.md',
          content: pass === 0 ? 'First version' : 'Changed version',
        },
      }
    if (pass === 1 || pass === 4)
      return {
        name: 'read_file',
        args: {
          id: (await files.list()).find(
            (f) => f.size === (pass === 1 ? 13 : 15),
          )!.id,
        },
      }
    if (pass === 2) return { name: 'list_files', args: {} }
    return { text: 'Both versions are saved.' }
  })
  const state = await h.start()
  expect(state.error).toBeUndefined()
  expect(state.assistantTask?.status).toBe('answered')
  expect(h.run).toHaveBeenCalledTimes(6)
  const stored = await h.files.list()
  expect(stored).toHaveLength(2)
  expect(
    await Promise.all(
      stored.map(async (f) => (await h.files.readText(f.id)).text),
    ),
  ).toEqual(expect.arrayContaining(['First version', 'Changed version']))
})
it('presents an existing uploaded file through the real native tool without saving a new file', async () => {
  const id = crypto.randomUUID()
  const h = await setup(async (pass) =>
    pass === 0
      ? { name: 'present_file', args: { id } }
      : { text: 'Here is your file.' },
  )
  await h.files.save(
    { id, name: 'uploaded.txt', mediaType: 'text/plain', source: 'upload' },
    new TextEncoder().encode('Existing upload'),
  )
  const state = await h.start()
  expect(state.error).toBeUndefined()
  expect(await h.files.list()).toHaveLength(1)
  expect((h.env as any).FILES.put).toHaveBeenCalledTimes(1)
  expect(state.messages.flatMap(readFileDeliveries)).toMatchObject([
    {
      kind: 'file-reference',
      file: { id, source: 'upload', conversationId: 'main-conversation' },
    },
  ])
  expect(
    state.messages
      .flatMap(readFileDeliveries)
      .every((item) => item.kind !== 'file'),
  ).toBe(true)
})

it('stops interleaved stored reads and searches of unchanged content under fresh retained IDs', async () => {
  const { StoredResults } = await import('../../src/chat/server/stored-results')
  const { durableResultStore } =
    await import('../../src/chat/server/durable-results')
  const ids: string[] = []
  const h = await setup(async (pass) => {
    // Simulate successive large source outputs through the real durable result store.
    // Provider transport is scripted; the native tools and progress middleware are real.
    const retained = (await new StoredResults(
      durableResultStore(h.ctx.storage as any, 'assistant'),
    ).retain({ text: 'Evidence '.repeat(1800) })) as { resultId: string }
    ids.push(retained.resultId)
    return pass % 2 === 0
      ? {
          name: 'read_stored_result',
          args: { resultId: retained.resultId, path: '/text', offset: 0 },
        }
      : {
          name: 'search_stored_result',
          args: {
            resultId: retained.resultId,
            path: '/text',
            query: 'Evidence',
            offset: 0,
          },
        }
  })
  const state = await h.start()
  expect(state.assistantTask?.reason).toContain('no new evidence')
  expect(state.assistantTask?.status).toBe('incomplete')
  expect(h.run).toHaveBeenCalledTimes(7)
  expect(new Set(ids).size).toBe(7)
  expect(state.assistantTask?.progress?.entries).toHaveLength(2)
  expect(JSON.stringify(state.assistantTask?.progress)).not.toContain('result_')
})

it('permits changed stored sources, pages and queries through the real Conversation loop', async () => {
  const { StoredResults } = await import('../../src/chat/server/stored-results')
  const { durableResultStore } =
    await import('../../src/chat/server/durable-results')
  const h = await setup(async (pass) => {
    if (pass === 5)
      return { text: 'The changed source and later page were inspected.' }
    const retained = (await new StoredResults(
      durableResultStore(h.ctx.storage as any, 'assistant'),
    ).retain({
      text: (pass === 0 ? 'Original ' : 'Changed ').repeat(1800),
    })) as { resultId: string }
    if (pass < 3)
      return {
        name: 'read_stored_result',
        args: {
          resultId: retained.resultId,
          path: '/text',
          offset: pass === 2 ? 6000 : 0,
        },
      }
    return {
      name: 'search_stored_result',
      args: {
        resultId: retained.resultId,
        path: '/text',
        query: pass === 3 ? 'Changed' : 'absent',
        offset: 0,
      },
    }
  })
  const state = await h.start()
  expect(state.assistantTask?.status).toBe('answered')
  expect(state.assistantTask?.progress?.entries).toHaveLength(5)
  expect(state.assistantTask?.progress?.revision).toBe(5)
  expect(h.run).toHaveBeenCalledTimes(6)
})
