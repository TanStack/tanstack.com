import type { SqlStorage } from '@cloudflare/workers-types'
import { afterEach, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import {
  chat,
  maxIterations,
  toolDefinition,
  type ModelMessage,
} from '@tanstack/ai'
import { createCloudflareText } from '@tanstack/ai-cloudflare'
import { z } from 'zod'
import type { ContextObservation } from '../../src/chat/core/context-observation'
import { assistantContextMiddlewares } from '../../src/chat/server/assistant-context'
import { UsageLedger } from '../../src/chat/server/usage'
import { observeProviderBinding } from '../../src/chat/server/provider-observation'

const model = '@cf/zai-org/glm-5.3-flash'
const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length
afterEach(() => vi.unstubAllGlobals())

function setup() {
  const saved = new Map<string, unknown>()
  const observations: ContextObservation[] = []
  const current = vi.fn()
  const pair = assistantContextMiddlewares(
    {
      put: async (id, value) => {
        saved.set(id, value)
      },
      get: async (id) => saved.get(id),
    },
    {
      scope: { transcriptEpoch: 'epoch', runId: 'run' },
      assertCurrent: current,
      record: (value) => {
        observations.push(value)
      },
    },
  )
  const network = vi.fn(() => {
    throw new Error('Network is forbidden')
  })
  vi.stubGlobal('fetch', network)
  return { saved, observations, pair, current, network }
}

function response(tool = false) {
  const delta = tool
    ? {
        role: 'assistant',
        tool_calls: [
          {
            index: 0,
            id: 'read-call',
            type: 'function',
            function: { name: 'read_item', arguments: '{}' },
          },
        ],
      }
    : { role: 'assistant', content: 'Finished.' }
  return new Response(
    `data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', model, choices: [{ index: 0, delta, finish_reason: tool ? 'tool_calls' : 'stop' }] })}\n\ndata: [DONE]\n\n`,
    { headers: { 'content-type': 'text/event-stream' } },
  )
}

it('observes each actual SDK pass once and carries init compaction into only the first pass', async () => {
  const state = setup()
  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: 'evidence '.repeat(2200),
      metadata: { gumActionEvidence: true },
    },
    ...Array.from({ length: 25 }, (_, i) => [
      { role: 'user' as const, content: `Request ${i}` },
      { role: 'assistant' as const, content: 'Earlier answer '.repeat(500) },
    ]).flat(),
    { role: 'user', content: 'Read the item.' },
  ]
  const run = vi
    .fn()
    .mockImplementationOnce(async () => response(true))
    .mockImplementationOnce(async () => response())
  const read = vi.fn(async () => ({ value: 'fresh result' }))
  for await (const _ of chat({
    adapter: createCloudflareText(model, { binding: { run } as never }),
    messages,
    tools: [
      toolDefinition({
        name: 'read_item',
        description: 'Read the item.',
        inputSchema: z.object({}),
      }).server(read),
    ],
    systemPrompts: ['Be helpful.'],
    agentLoopStrategy: maxIterations(2),
    middleware: [state.pair.context, state.pair.observation],
  })) {
  }
  expect(run).toHaveBeenCalledTimes(2)
  expect(read).toHaveBeenCalledOnce()
  expect(state.observations).toHaveLength(2)
  const [first, second] = state.observations
  expect(first.history.inputBytes).toBe(bytes(messages))
  expect(first.history.inputMessages).toBe(messages.length)
  expect(first.history.retainedBytes).toBeLessThan(80000)
  expect(first.history.compactedMessages).toBeGreaterThan(0)
  expect(first.history.archivedLargeMessages).toBe(1)
  expect(second.history.compactedMessages).toBe(0)
  expect(second.history.archivedLargeMessages).toBe(0)
  expect(second.history.pinnedEvidenceMessages).toBe(1)
  expect(first.request).toMatchObject({
    systemPrompts: 1,
    tools: 1,
    mediaParts: 0,
    attachmentPayloadMessages: 0,
  })
  expect(JSON.stringify(state.observations)).not.toContain('Read the item')
  expect(state.network).not.toHaveBeenCalled()
})

it('measures the final provider-only configuration after later middleware transforms', async () => {
  const state = setup()
  const finalMessages: ModelMessage[] = [{ role: 'user', content: '中文: 🐈' }]
  const run = vi.fn(async () => response())
  for await (const _ of chat({
    adapter: createCloudflareText(model, { binding: { run } as never }),
    messages: [{ role: 'user', content: 'Original' }],
    middleware: [
      state.pair.context,
      {
        name: 'later-transform',
        onConfig: (ctx) =>
          ctx.phase === 'beforeModel'
            ? {
                providerMessages: finalMessages,
                systemPrompts: ['Final system prompt.'],
              }
            : undefined,
      },
      state.pair.observation,
    ],
    agentLoopStrategy: maxIterations(1),
  })) {
  }
  expect(state.observations).toHaveLength(1)
  expect(state.observations[0].history.retainedBytes).toBe(bytes(finalMessages))
  expect(state.observations[0].request.systemPromptBytes).toBe(
    bytes(['Final system prompt.']),
  )
  expect(state.observations[0].history.retainedBytes).toBeGreaterThan(
    JSON.stringify(finalMessages).length,
  )
})

it('does not count materialized attachment or media bytes as the Gum history budget', async () => {
  const state = setup()
  const secret = 'PRIVATE-FILE-CONTENT'.repeat(4000)
  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: secret,
      metadata: { gumAttachmentContext: { prompt: 'Inspect attached text.' } },
    },
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'data', value: secret, mimeType: 'image/png' },
        },
      ],
    },
  ]
  const run = vi.fn(async () => response())
  for await (const _ of chat({
    adapter: createCloudflareText(model, { binding: { run } as never }),
    messages,
    middleware: [state.pair.context, state.pair.observation],
    agentLoopStrategy: maxIterations(1),
  })) {
  }
  expect(run).toHaveBeenCalledOnce()
  const observation = state.observations[0]
  expect(observation.history.retainedBytes).toBeLessThan(2000)
  expect(observation.history.archivedLargeMessages).toBe(0)
  expect(observation.request).toMatchObject({
    mediaParts: 1,
    attachmentPayloadMessages: 1,
  })
  expect(JSON.stringify(observation)).not.toContain('PRIVATE')
  expect(state.saved.size).toBe(0)
})

it('does not publish or dispatch after an async projection outlives its active run', async () => {
  const state = setup()
  const run = vi.fn(async () => response())
  // First guard before the async projection succeeds; the second sees a reset/stop.
  state.current
    .mockImplementationOnce(() => {})
    .mockImplementation(() => {
      throw new Error('No longer active')
    })
  await expect(
    (async () => {
      for await (const _ of chat({
        adapter: createCloudflareText(model, { binding: { run } as never }),
        messages: [{ role: 'user', content: 'Hello' }],
        middleware: [state.pair.context, state.pair.observation],
      })) {
      }
    })(),
  ).rejects.toThrow('No longer active')
  expect(run).not.toHaveBeenCalled()
  expect(state.observations).toHaveLength(0)
})

it('retains a prepared reading but never dispatches when the run ends during its publication', async () => {
  const saved: ContextObservation[] = []
  let current = true
  const pair = assistantContextMiddlewares(
    {
      put: async () => {},
      get: async () => undefined,
    },
    {
      scope: { transcriptEpoch: 'old-epoch', runId: 'old-run' },
      assertCurrent: () => {
        if (!current) throw new Error('Stopped')
      },
      record: async (value) => {
        saved.push(value)
        await Promise.resolve()
        current = false
      },
    },
  )
  const run = vi.fn(async () => response())
  await expect(
    (async () => {
      for await (const _ of chat({
        adapter: createCloudflareText(model, { binding: { run } as never }),
        messages: [{ role: 'user', content: 'Hello' }],
        middleware: [pair.context, pair.observation],
      })) {
      }
    })(),
  ).rejects.toThrow('Stopped')
  expect(saved).toHaveLength(1)
  expect(saved[0]).toMatchObject({
    stage: 'prepared',
    transcriptEpoch: 'old-epoch',
    runId: 'old-run',
  })
  expect(run).not.toHaveBeenCalled()
})

it('rejects over-budget pinned evidence without publishing a successful reading', async () => {
  const state = setup()
  const run = vi.fn(async () => response())
  await expect(
    (async () => {
      for await (const _ of chat({
        adapter: createCloudflareText(model, { binding: { run } as never }),
        messages: Array.from({ length: 20 }, () => ({
          role: 'user' as const,
          content: 'Known action result. '.repeat(450),
          metadata: { gumActionEvidence: true },
        })),
        middleware: [state.pair.context, state.pair.observation],
      })) {
      }
    })(),
  ).rejects.toThrow('context budget')
  expect(run).not.toHaveBeenCalled()
  expect(state.observations).toHaveLength(0)
})

it('binds the final SDK snapshot to its persisted pass before the provider attempt is dispatched', async () => {
  const db = new DatabaseSync(':memory:')
  try {
    const sql = {
      exec(query: string, ...args: Array<string | number | null>) {
        const statement = db.prepare(query)
        const rows = query.startsWith('SELECT')
          ? statement.all(...args)
          : (statement.run(...args), [])
        return { toArray: () => rows }
      },
    } as unknown as SqlStorage
    const ledger = new UsageLedger(sql)
    const usage = ledger.model(
      { turnId: 'task', workspaceId: 'workspace', userId: 'user' },
      {
        kind: 'model',
        provider: 'included',
        model,
        operation: 'Model pass',
      },
    )
    const pair = assistantContextMiddlewares(
      { put: async () => {}, get: async () => undefined },
      {
        scope: { transcriptEpoch: 'epoch', runId: 'run' },
        assertCurrent: () => {},
        record: (value) => usage.context(value),
      },
    )
    const run = vi.fn(async () => {
      const [pass] = ledger.list()
      expect(pass.context).toMatchObject({
        phase: 'beforeModel',
        stage: 'prepared',
        transcriptEpoch: 'epoch',
        runId: 'run',
      })
      expect(pass.context?.history.inputMessages).toBe(1)
      expect(pass.attempts).toHaveLength(1)
      expect(pass.attempts?.[0]).toMatchObject({
        stepId: pass.id,
        bodyState: 'pending',
      })
      return response()
    })
    for await (const _ of chat({
      adapter: createCloudflareText(model, {
        binding: observeProviderBinding({ run }, usage.observer) as never,
      }),
      messages: [{ role: 'user', content: 'One request' }],
      middleware: [pair.context, usage.middleware, pair.observation],
      agentLoopStrategy: maxIterations(1),
    })) {
    }
    usage.assertComplete()
    expect(run).toHaveBeenCalledOnce()
    expect(ledger.list()).toHaveLength(1)
    expect(new UsageLedger(sql).list()[0]).toMatchObject({
      outcome: 'succeeded',
      context: { phase: 'beforeModel' },
    })
  } finally {
    db.close()
  }
})
