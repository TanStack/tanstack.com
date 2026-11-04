import type { SqlStorage } from '@cloudflare/workers-types'
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chat, maxIterations, toolDefinition } from '@tanstack/ai'
import { createCloudflareText } from '@tanstack/ai-cloudflare'
import { z } from 'zod'
import { UsageLedger } from '../../src/chat/server/usage'
import { usageSummary } from '../../src/chat/core/usage'
import {
  observeProviderBinding,
  observeProviderFetch,
} from '../../src/chat/server/provider-observation'

const context = { turnId: 'turn', userId: 'user', workspaceId: 'workspace' }
const model = '@cf/zai-org/glm-5.3-flash'
const operation = {
  kind: 'model' as const,
  provider: 'included',
  model,
  operation: 'Model pass',
}
const databases: DatabaseSync[] = []

afterEach(() => {
  vi.unstubAllGlobals()
  for (const db of databases.splice(0)) db.close()
})

function storage() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  let reject: ((query: string, args: unknown[]) => boolean) | undefined
  const sql = {
    exec(query: string, ...args: any[]) {
      if (reject?.(query, args)) throw new Error('Synthetic storage failure')
      const statement = db.prepare(query)
      const rows = query.startsWith('SELECT')
        ? statement.all(...args)
        : (statement.run(...args), [])
      return { toArray: () => rows }
    },
  } as unknown as SqlStorage
  const ledger = new UsageLedger(sql, {
    [`included/${model}`]: {
      inputPerMillion: 1,
      outputPerMillion: 2,
      source: 'Synthetic test rate',
    },
  })
  return {
    db,
    sql,
    ledger,
    rejectWrites: (fn: typeof reject) => {
      reject = fn
    },
  }
}

function frame(delta: unknown, finish_reason: string | null = null) {
  return `data: ${JSON.stringify({ id: 'synthetic-completion', object: 'chat.completion.chunk', created: 1, model, choices: [{ index: 0, delta, finish_reason }] })}\n\n`
}
function response(
  options: { usage?: unknown; terminal?: boolean; tool?: boolean } = {},
) {
  const delta = options.tool
    ? {
        role: 'assistant',
        tool_calls: [
          {
            index: 0,
            id: 'synthetic-call',
            type: 'function',
            function: { name: 'record_action', arguments: '{}' },
          },
        ],
      }
    : { role: 'assistant', content: 'Synthetic response.' }
  const body =
    frame(delta) +
    (options.terminal === false
      ? ''
      : frame({}, options.tool ? 'tool_calls' : 'stop')) +
    ('usage' in options
      ? `data: ${JSON.stringify({ choices: [], usage: options.usage })}\n\n`
      : '') +
    (options.terminal === false ? '' : 'data: [DONE]\n\n')
  return new Response(body, {
    headers: { 'content-type': 'text/event-stream' },
  })
}

function setup(run: (...args: any[]) => Promise<any>) {
  const state = storage()
  const onIncomplete = vi.fn()
  const session = state.ledger.model(context, operation, onIncomplete)
  const binding = observeProviderBinding({ run }, session.observer)
  const adapter = createCloudflareText(model, { binding: binding as never })
  const network = vi.fn(async () => {
    throw new Error('Network is forbidden in this test')
  })
  vi.stubGlobal('fetch', network)
  const drain = async (tools: any[] = []) => {
    const events = []
    for await (const event of chat({
      adapter,
      messages: [{ role: 'user', content: 'Run synthetic task.' }],
      middleware: [session.middleware],
      tools,
      agentLoopStrategy: maxIterations(1),
    }))
      events.push(event)
    expect(network).not.toHaveBeenCalled()
    return events
  }
  return { ...state, session, onIncomplete, drain }
}

describe('provider attempts through the installed SDK and real SQLite', () => {
  it('records an SDK retry inside one logical pass without claiming the first attempt was free', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('Private provider failure'))
      .mockImplementationOnce(async () =>
        response({
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      )
    const { ledger, drain, session } = setup(run)
    await drain()
    session.assertComplete()
    expect(run).toHaveBeenCalledTimes(2)
    const steps = ledger.list()
    expect(steps).toHaveLength(1)
    expect(steps[0]).toMatchObject({
      outcome: 'succeeded',
      accounting: 'provider-attempts',
      cost: { status: 'unavailable' },
    })
    expect(steps[0].attempts).toMatchObject([
      {
        ordinal: 1,
        bodyState: 'failed',
        usagePresent: false,
        cost: { status: 'unavailable' },
      },
      {
        ordinal: 2,
        bodyState: 'complete',
        providerFinished: true,
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        cost: { status: 'estimated', usd: 0.00002 },
      },
    ])
    expect(new Set(steps[0].attempts!.map((row) => row.id)).size).toBe(2)
    expect(usageSummary(steps)).toMatchObject({
      usd: 0.00002,
      unavailable: 1,
      observedAttempts: 2,
      pricedRecords: 1,
    })
    expect(JSON.stringify(steps)).not.toContain('Private provider failure')
    expect(ledger.task('turn')).toEqual({
      taskId: 'turn',
      steps: 1,
      runningSteps: 0,
      totals: usageSummary(steps),
    })
    expect(ledger.task('different-task').steps).toBe(0)
  })

  it('sums the full exact task beyond the recent page and preserves legacy gaps', () => {
    const { ledger } = storage()
    for (let i = 0; i < 125; i++) {
      const step = ledger.start(context, operation)
      step.usage({ promptTokens: 10, completionTokens: 5 })
      step.finish('succeeded')
    }
    const other = ledger.start({ ...context, turnId: 'other' }, operation)
    other.usage({ cost: 99 })
    other.finish('succeeded')
    ledger.start(context, operation, 'provider-attempts')
    expect(ledger.list()).toHaveLength(100)
    const task = ledger.task('turn')
    expect(task).toMatchObject({
      steps: 126,
      runningSteps: 1,
      totals: { pricedRecords: 125, unobservedModelSteps: 125, unavailable: 1 },
    })
    expect(task.totals.usd).toBeCloseTo(0.0025)
    expect(ledger.task('turn')).toEqual(task)
  })

  it.each([
    ['absent', undefined, false, undefined, undefined, 'unavailable'],
    ['empty', {}, true, undefined, undefined, 'unavailable'],
    ['null', null, false, undefined, undefined, 'unavailable'],
    ['partial', { prompt_tokens: 7 }, true, 7, undefined, 'unavailable'],
    [
      'zero',
      { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      true,
      0,
      0,
      'estimated',
    ],
  ] as const)(
    'preserves raw %s usage without normalized zero synthesis',
    async (_label, usage, present, input, output, costStatus) => {
      const { ledger, drain, session } = setup(async () => response({ usage }))
      await drain()
      session.assertComplete()
      const step = ledger.list()[0]!
      expect(step.outcome).toBe('succeeded')
      expect(step.attempts?.[0]).toMatchObject({
        usagePresent: present,
        cost: { status: costStatus },
      })
      expect(step.attempts?.[0]?.inputTokens).toBe(input)
      expect(step.attempts?.[0]?.outputTokens).toBe(output)
      expect(step.cost.status).toBe(costStatus)
    },
  )

  it('captures usage trailers once and excludes parent summaries from the total', async () => {
    const { ledger, drain, session } = setup(async () =>
      response({
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          cost: 0.02,
        },
      }),
    )
    await drain()
    session.assertComplete()
    expect(ledger.list()[0]).toMatchObject({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      cost: { status: 'known', usd: 0.02 },
    })
    expect(usageSummary(ledger.list())).toMatchObject({
      usd: 0.02,
      pricedRecords: 1,
      unavailable: 0,
    })
  })

  it('does not run a complete tool argument from a truncated response', async () => {
    const action = vi.fn(async () => 'done')
    const tool = toolDefinition({
      name: 'record_action',
      description: 'Synthetic side effect',
      inputSchema: z.object({}),
    }).server(action)
    const { ledger, drain, session, onIncomplete } = setup(async () =>
      response({ tool: true, terminal: false }),
    )
    await drain([tool])
    expect(action).not.toHaveBeenCalled()
    expect(onIncomplete).toHaveBeenCalled()
    expect(() => session.assertComplete()).toThrow(
      'without a verified completion',
    )
    expect(ledger.list()[0]).toMatchObject({
      outcome: 'incomplete',
      attempts: [{ bodyState: 'incomplete', providerFinished: false }],
    })
  })

  it('allows the same tool only after the provider stream has completed', async () => {
    const action = vi.fn(async () => 'done')
    const tool = toolDefinition({
      name: 'record_action',
      description: 'Synthetic side effect',
      inputSchema: z.object({}),
    }).server(action)
    const { ledger, drain, session } = setup(async () =>
      response({ tool: true }),
    )
    await drain([tool])
    session.assertComplete()
    expect(action).toHaveBeenCalledTimes(1)
    expect(ledger.list()[0]?.outcome).toBe('succeeded')
  })

  it('does not convert an accounting write failure after dispatch into another paid request', async () => {
    const run = vi.fn(async () =>
      response({
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    )
    const { ledger, drain, session, rejectWrites } = setup(run)
    rejectWrites(
      (query, args) =>
        query.startsWith('INSERT INTO usage_attempts') &&
        JSON.parse(args[3] as string).httpStatus !== undefined,
    )
    await drain()
    expect(run).toHaveBeenCalledTimes(1)
    expect(() => session.assertComplete()).toThrow('could not be recorded')
    expect(ledger.list()[0]).toMatchObject({
      outcome: 'incomplete',
      attempts: [{ bodyState: 'pending', usagePresent: false }],
    })
  })

  it('never dispatches when the initial durable attempt cannot be written', async () => {
    const run = vi.fn(async () => response())
    const { drain, session, rejectWrites } = setup(run)
    rejectWrites((query) => query.startsWith('INSERT INTO usage_attempts'))
    await drain()
    expect(run).not.toHaveBeenCalled()
    expect(() => session.assertComplete()).toThrow('could not be recorded')
  })
})

describe('durable attempt recovery and middleware boundaries', () => {
  const ctx = {} as never
  async function begin(
    session: ReturnType<UsageLedger['model']>,
    iteration = 0,
  ) {
    await session.middleware.onIteration?.(ctx, {
      iteration,
      messageId: String(iteration),
    })
  }
  const complete = {
    bodyState: 'complete' as const,
    providerFinished: true,
    usagePresent: true,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  }

  it('does not settle on an adapter finish event before the usage trailer or EOF', async () => {
    const { ledger } = storage()
    const session = ledger.model(context, operation)
    await begin(session)
    const attempt = session.observer.start('openai-chat')
    attempt.update({
      bodyState: 'pending',
      providerFinished: true,
      usagePresent: false,
    })
    await session.middleware.onChunk?.(ctx, {
      type: 'RUN_FINISHED',
      runId: 'r',
      threadId: 't',
      timestamp: 1,
    } as never)
    expect(ledger.list()[0]?.outcome).toBe('running')
    attempt.update(complete)
    session.assertComplete()
    expect(ledger.list()[0]).toMatchObject({
      outcome: 'succeeded',
      cost: { status: 'estimated', usd: 0 },
    })
  })

  it('interrupts pending attempts on reconstruction and fences stale callbacks', async () => {
    const { ledger, sql } = storage()
    const session = ledger.model(context, operation)
    await begin(session)
    const attempt = session.observer.start('openai-chat')
    attempt.update({
      bodyState: 'pending',
      providerFinished: false,
      usagePresent: true,
      inputTokens: 7,
    })
    const recovered = new UsageLedger(sql)
    recovered.interrupt()
    expect(recovered.list()[0]).toMatchObject({
      outcome: 'interrupted',
      attempts: [{ bodyState: 'interrupted', inputTokens: 7 }],
    })
    attempt.update(complete)
    expect(() => session.assertComplete()).toThrow('interrupted')
    expect(() => session.observer.start('openai-chat')).toThrow(
      'active durable model pass',
    )
    expect(recovered.list()[0]).toMatchObject({
      outcome: 'interrupted',
      attempts: [{ bodyState: 'interrupted' }],
    })
  })

  it('retains all attempts under a logical row rather than truncating retries with the row limit', async () => {
    const { ledger } = storage()
    const session = ledger.model(context, operation)
    await begin(session)
    for (let i = 0; i < 120; i++)
      session.observer.start('openai-chat').update(complete)
    session.assertComplete()
    expect(ledger.list(1)).toHaveLength(1)
    expect(ledger.list(1)[0]?.attempts).toHaveLength(120)
    expect(usageSummary(ledger.list(1))).toMatchObject({
      observedAttempts: 120,
      usd: 0,
      unavailable: 0,
    })
  })

  it('makes separate structured finalization a new pass and prevents restarting an incomplete pass', async () => {
    const { ledger } = storage()
    const session = ledger.model(context, operation)
    await begin(session)
    session.observer.start('openai-chat').update(complete)
    await session.middleware.onStructuredOutputConfig?.(ctx, {} as never)
    session.observer.start('openai-chat').update({
      ...complete,
      usagePresent: false,
      bodyState: 'incomplete',
      providerFinished: false,
    })
    expect(() => session.assertComplete()).toThrow(
      'without a verified completion',
    )
    await expect(begin(session, 2)).rejects.toThrow(
      'without a verified completion',
    )
    expect(
      ledger
        .list()
        .map((step) => step.outcome)
        .sort(),
    ).toEqual(['incomplete', 'succeeded'])
  })

  it('marks invalid raw usage as incomplete cost coverage even if other fields are priced', async () => {
    const { ledger } = storage()
    const session = ledger.model(context, operation)
    await begin(session)
    session.observer
      .start('openai-chat')
      .update({ ...complete, usageInvalid: true, cost: 0.01 })
    session.assertComplete()
    expect(ledger.list()[0]?.cost.status).toBe('unavailable')
    expect(usageSummary(ledger.list())).toMatchObject({
      unavailable: 1,
      usd: 0.01,
    })
  })

  it('recomputes derived validity when a later usage snapshot resolves inconsistent totals', async () => {
    const { ledger, sql } = storage()
    const session = ledger.model(context, operation)
    await begin(session)
    const recorder = session.observer.start('openai-chat')
    recorder.update({
      ...complete,
      bodyState: 'pending',
      providerFinished: false,
      inputTokens: 0,
      cacheUsage: { readTokens: 20 },
    })
    expect(ledger.list()[0]!.attempts![0]!.usageInvalid).toBe(true)
    recorder.update({
      ...complete,
      inputTokens: 100,
      cacheUsage: { readTokens: 20 },
    })
    const attempt = new UsageLedger(sql).list()[0]!.attempts![0]!
    expect(attempt.usageInvalid).not.toBe(true)
    expect(attempt.inputTokens).toBe(100)
    // Valid counts do not supply a missing cache price.
    expect(attempt.cost.status).toBe('unavailable')
  })

  it('retains observer-reported invalid usage even after totals become consistent', async () => {
    const { ledger, sql } = storage()
    const session = ledger.model(context, operation)
    await begin(session)
    const recorder = session.observer.start('openai-chat')
    recorder.update({ ...complete, usageInvalid: true, inputTokens: 0 })
    recorder.update({ ...complete, usageInvalid: true, inputTokens: 100 })
    const attempt = new UsageLedger(sql).list()[0]!.attempts![0]!
    expect(attempt.usageInvalid).toBe(true)
    expect(attempt.inputTokens).toBeUndefined()
  })

  it('persists cache categories through reload and refuses an uncached estimate', async () => {
    const { ledger, sql } = storage()
    const session = ledger.model(context, operation)
    await begin(session)
    session.observer.start('openai-chat').update({
      ...complete,
      inputTokens: 100,
      cacheUsage: { readTokens: 20, writeTokens: 0 },
    })
    const reloaded = new UsageLedger(sql).list()[0]!.attempts![0]!
    expect(reloaded.cacheUsage).toEqual({ readTokens: 20, writeTokens: 0 })
    expect(reloaded.cost.status).toBe('unavailable')
  })
  it('persists normalized Anthropic input and preserves the raw field through reload', async () => {
    const { ledger, sql } = storage()
    const session = ledger.model(context, operation)
    await begin(session)
    session.observer.start('anthropic').update({
      ...complete,
      inputTokens: 7,
      totalTokens: undefined,
      cacheUsage: { readTokens: 20, writeTokens: 30 },
    })
    const attempt = new UsageLedger(sql).list()[0]!.attempts![0]!
    expect(attempt).toMatchObject({
      tokenAccounting: 'normalized-v1',
      rawInputTokens: 7,
      inputTokens: 57,
      cost: { status: 'unavailable' },
    })
    expect(attempt.totalTokens).toBeUndefined()
  })
  it('prices Gemini thinking and cache reads from normalized persisted totals', async () => {
    const { sql } = storage()
    const ledger = new UsageLedger(sql, {
      [`included/${model}`]: {
        inputPerMillion: 1,
        outputPerMillion: 2,
        cacheReadPerMillion: 0.1,
        source: 'Synthetic Gemini rate',
      },
    })
    const session = ledger.model(context, operation)
    await begin(session)
    session.observer.start('gemini').update({
      ...complete,
      inputTokens: 8,
      outputTokens: 2,
      thinkingTokens: 3,
      totalTokens: 13,
      cacheUsage: { readTokens: 4 },
    })
    session.assertComplete()
    const attempt = new UsageLedger(sql).list()[0]!.attempts![0]!
    expect(attempt).toMatchObject({
      rawOutputTokens: 2,
      outputTokens: 5,
      thinkingTokens: 3,
      inputTokens: 8,
    })
    expect(attempt.cost.status).toBe('estimated')
    if (attempt.cost.status !== 'unavailable')
      expect(attempt.cost.usd).toBeCloseTo(14.4 / 1e6, 12)
  })
})

it('persists bounded REST request diagnostics through actual adapter dispatch and ledger reconstruction', async () => {
  const h = storage()
  const session = h.ledger.model(context, operation)
  const transport = vi.fn(async () =>
    response({
      usage: { prompt_tokens: 6, completion_tokens: 2, total_tokens: 8 },
    }),
  )
  const adapter = openaiCompatibleText('synthetic', {
    apiKey: 'synthetic-never-transmitted',
    baseURL: 'https://provider.invalid/v1',
    fetch: observeProviderFetch('openai-chat', session.observer, transport),
    maxRetries: 0,
  })
  for await (const _ of chat({
    adapter,
    messages: [{ role: 'user', content: 'Private request text' }],
    middleware: [session.middleware],
  })) {
  }
  session.assertComplete()
  const shape = h.ledger.list()[0].attempts![0].requestShape
  expect(shape).toMatchObject({
    version: 2,
    boundary: 'provider-fetch',
    protocol: 'openai-chat',
    inputItemCount: 1,
    tailKinds: ['user'],
  })
  expect(JSON.stringify(shape)).not.toMatch(
    /Private|transmitted|provider.invalid/,
  )
  const restored = new UsageLedger(h.sql)
  expect(restored.list()[0].attempts![0].requestShape).toEqual(shape)
  expect(transport).toHaveBeenCalledTimes(1)
})
