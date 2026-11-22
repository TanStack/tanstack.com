import './fixtures/loaded-assistant-tools'
import { describe, expect, it, vi } from 'vitest'
import { defaultPolicy } from '../../src/chat/core/types'
import { usageSummary } from '../../src/chat/core/usage'
import { interpretDiscovery } from '../../src/chat/server/discovery-model'
import { UsageLedger, configuredRates } from '../../src/chat/server/usage'
import { conversationHarness } from './fixtures/conversation-runtime'

type Harness = Awaited<ReturnType<typeof conversationHarness>>
const usage = { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }
function response({
  content = 'Synthetic answer.',
  tool,
  finish = true,
  done = true,
  reportedUsage = usage as Record<string, unknown> | null,
}: {
  content?: string
  tool?: { name: string; arguments: Record<string, unknown> }
  finish?: boolean
  done?: boolean
  reportedUsage?: Record<string, unknown> | null
} = {}) {
  const frame = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`
  const delta = tool
    ? {
        role: 'assistant',
        tool_calls: [
          {
            index: 0,
            id: 'synthetic-tool-call',
            type: 'function',
            function: {
              name: tool.name,
              arguments: JSON.stringify(tool.arguments),
            },
          },
        ],
      }
    : { role: 'assistant', content }
  const body =
    frame({
      id: 'synthetic-response',
      object: 'chat.completion.chunk',
      created: 1,
      choices: [{ index: 0, delta, finish_reason: null }],
    }) +
    (finish
      ? frame({
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: tool ? 'tool_calls' : 'stop',
            },
          ],
        })
      : '') +
    (reportedUsage ? frame({ choices: [], usage: reportedUsage }) : '') +
    (done ? 'data: [DONE]\n\n' : '')
  return new Response(body, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}
const modelInput = (h: Harness, id: string) => ({
  ...h.input(id, 'Complete the synthetic task.'),
  fixture: false,
  policy: { ...defaultPolicy, allowKody: false, allowMcp: false },
})
function bind(h: Harness, run: ReturnType<typeof vi.fn>) {
  ;(h.env as any).AI = { run }
}

describe('durable provider attempts through the real Conversation and SDK', () => {
  it('records an internal provider retry under one logical pass and retains it through reset and reconstruction', async () => {
    const h = await conversationHarness()
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('Synthetic transport failure'))
      .mockImplementation(async () => response())
    bind(h, run)
    await h.c.begin(modelInput(h, 'retry-task'))
    await h.settle()
    const state = await h.c.snapshot()
    expect(state.error).toBeUndefined()
    expect(state.assistantTask).toMatchObject({
      status: 'answered',
      modelPasses: 1,
    })
    expect(run).toHaveBeenCalledTimes(2)
    expect(state.usageSteps).toHaveLength(1)
    const step = state.usageSteps[0]
    expect(step).toMatchObject({
      accounting: 'provider-attempts',
      outcome: 'succeeded',
      cost: { status: 'unavailable' },
    })
    expect(step.attempts).toMatchObject([
      {
        ordinal: 1,
        stepId: step.id,
        bodyState: 'failed',
        usagePresent: false,
        cost: { status: 'unavailable' },
      },
      {
        ordinal: 2,
        stepId: step.id,
        bodyState: 'complete',
        providerFinished: true,
        usagePresent: true,
        inputTokens: 100,
        outputTokens: 20,
      },
    ])
    expect(usageSummary(state.usageSteps)).toMatchObject({
      observedAttempts: 2,
      pricedRecords: 1,
      unavailable: 1,
    })
    expect(
      Number(
        (await h.db`SELECT COUNT(*) AS count FROM chat_run_usage_receipts`)[0]
          .count,
      ),
    ).toBe(1)
    await h.c.reset()
    const restored = await h.reconstruct()
    expect((await restored.snapshot()).messages).toEqual([])
    expect((await restored.snapshot()).usageSteps).toEqual(state.usageSteps)
  })

  it.each([
    { finish: false, done: false },
    { finish: true, done: false },
  ])(
    'does not execute a complete-looking tool call from truncated transport: %j',
    async (terminal) => {
      const h = await conversationHarness()
      const run = vi.fn(async () =>
        response({
          ...terminal,
          tool: {
            name: 'save_file',
            arguments: {
              name: 'must-not-exist.txt',
              mediaType: 'text/plain',
              content: 'The unfinished provider turn must not save this.',
            },
          },
        }),
      )
      bind(h, run)
      await h.c.begin(modelInput(h, 'incomplete-tool-task'))
      await h.settle()
      const state = await h.c.snapshot()
      expect(state.status).toBe('error')
      expect(state.assistantTask).toMatchObject({
        status: 'incomplete',
        modelPasses: 1,
        toolCalls: 0,
      })
      expect(state.error).toContain('verified completion')
      expect(run).toHaveBeenCalledTimes(1)
      expect(
        Number(
          (await h.db`SELECT COUNT(*) AS count FROM chat_saved_files`)[0].count,
        ),
      ).toBe(0)
      expect(state.usageSteps[0]).toMatchObject({
        outcome: 'incomplete',
        attempts: [{ bodyState: 'incomplete' }],
      })
    },
  )

  it('preserves partial prose without marking the task answered when the provider has no terminal', async () => {
    const h = await conversationHarness()
    bind(
      h,
      vi.fn(async () => response({ finish: false, done: false })),
    )
    await h.c.begin(modelInput(h, 'partial-text-task'))
    await h.settle()
    const state = await h.c.snapshot()
    expect(state.assistantTask?.status).toBe('incomplete')
    expect(state.status).toBe('error')
    expect(state.messages.flatMap((message) => message.parts)).toContainEqual({
      type: 'text',
      content: 'Synthetic answer.',
    })
    expect(state.usageSteps[0].outcome).toBe('incomplete')
  })

  it.each([
    { reportedUsage: null, usagePresent: false, zero: false },
    { reportedUsage: {}, usagePresent: true, zero: false },
    {
      reportedUsage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
      usagePresent: true,
      zero: true,
    },
  ])(
    'does not let adapter defaults invent a free request: %j',
    async ({ reportedUsage, usagePresent, zero }) => {
      const h = await conversationHarness()
      const run = vi.fn(async () => response({ reportedUsage }))
      bind(h, run)
      await h.c.begin(modelInput(h, 'usage-presence-task'))
      await h.settle()
      const state = await h.c.snapshot()
      expect(state.assistantTask?.status).toBe('answered')
      expect(run).toHaveBeenCalledTimes(1)
      const recorded = state.usageSteps[0].attempts![0]
      expect(recorded).toMatchObject({ bodyState: 'complete', usagePresent })
      expect(recorded.inputTokens).toBe(zero ? 0 : undefined)
      expect(recorded.outputTokens).toBe(zero ? 0 : undefined)
      expect(recorded.cost.status).toBe(zero ? 'estimated' : 'unavailable')
      expect(usageSummary(state.usageSteps)).toMatchObject({
        usd: 0,
        pricedRecords: zero ? 1 : 0,
        unavailable: zero ? 0 : 1,
      })
    },
  )
})

describe('discovery structured output provider attempts', () => {
  const entry = {
    id: 'real-entry-id',
    serverId: 'synthetic-server',
    serverLabel: 'Synthetic server',
    kind: 'resource' as const,
    name: 'guide',
    title: 'Guide',
    description: 'Synthetic read-only guide.',
    target: { method: 'resources/read' as const, uri: 'guide://synthetic' },
  }
  const result = {
    message: 'Read the advertised guide.',
    capabilities: [],
    next: [{ entryId: 'entry_0', arguments: {}, purpose: 'Read metadata.' }],
  }
  it.each([true, false])(
    'requires a verified terminal before returning discovery calls, complete=%s',
    async (complete) => {
      const h = await conversationHarness()
      const run = vi.fn(async () =>
        response({
          content: JSON.stringify(result),
          finish: complete,
          done: complete,
        }),
      )
      bind(h, run)
      const ledger = new UsageLedger(
        h.ctx.storage.sql as never,
        configuredRates(),
      )
      const context = {
        turnId: 'discovery-task',
        workspaceId: 'w',
        userId: '00000000-0000-4000-8000-000000000001',
      }
      const session = ledger.model(context, {
        kind: 'model',
        provider: 'included',
        model: h.env.INCLUDED_MODEL,
        operation: 'Interpret MCP discovery',
      })
      const pending = interpretDiscovery(
        'Find the advertised tools.',
        [entry],
        [],
        h.env,
        context,
        new AbortController().signal,
        session,
      )
      if (complete)
        await expect(pending).resolves.toMatchObject({
          next: [{ entryId: 'real-entry-id', purpose: 'Read metadata.' }],
        })
      else await expect(pending).rejects.toThrow('verified completion')
      expect(run).toHaveBeenCalledTimes(1)
      expect(ledger.list()).toHaveLength(1)
      expect(ledger.list()[0]).toMatchObject({
        accounting: 'provider-attempts',
        outcome: complete ? 'succeeded' : 'incomplete',
        attempts: [
          { ordinal: 1, bodyState: complete ? 'complete' : 'incomplete' },
        ],
      })
    },
  )
})
