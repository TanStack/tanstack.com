import type { SqlStorage } from '@cloudflare/workers-types'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  contextObservationSchema,
  parseContextObservation,
  type ContextObservation,
} from '../../src/chat/core/context-observation'
import { usageSummary } from '../../src/chat/core/usage'
import { UsageLedger } from '../../src/chat/server/usage'

const identity = {
  turnId: 'task-one',
  userId: 'user',
  workspaceId: 'workspace',
}
const operation = {
  kind: 'model' as const,
  provider: 'included',
  model: 'synthetic-model',
  operation: 'Model pass',
}
const databases: DatabaseSync[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const db of databases.splice(0)) db.close()
})

function storage() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  const sql = {
    exec(query: string, ...args: Array<string | number | null>) {
      const statement = db.prepare(query)
      const rows = query.startsWith('SELECT')
        ? statement.all(...args)
        : (statement.run(...args), [])
      return { toArray: () => rows }
    },
  } as unknown as SqlStorage
  return { db, sql, ledger: new UsageLedger(sql) }
}

function observation(
  phase: ContextObservation['phase'] = 'beforeModel',
): ContextObservation {
  return {
    schemaVersion: 1,
    scope: 'assistant-history',
    stage: 'prepared',
    unit: 'utf8-json-bytes',
    observedAt: 1_790_210_000_000,
    transcriptEpoch: 'epoch-one',
    runId: 'run-one',
    phase,
    history: {
      budgetBytes: 1_024,
      inputBytes: 2_048,
      retainedBytes: 960,
      inputMessages: 8,
      retainedMessages: 4,
      compactedMessages: 4,
      archivedLargeMessages: 1,
      pinnedEvidenceMessages: 1,
    },
    request: {
      systemPromptBytes: 256,
      toolDefinitionBytes: 512,
      systemPrompts: 2,
      tools: 3,
      mediaParts: 1,
      attachmentPayloadMessages: 1,
    },
    exclusions: ['media-payloads', 'attachment-payloads'],
  }
}

type ModelSession = ReturnType<UsageLedger['model']>
async function begin(session: ModelSession, iteration = 0) {
  await session.middleware.onIteration?.({} as never, {
    iteration,
    messageId: `message-${iteration}`,
  })
}

function completeAttempt(session: ModelSession) {
  session.observer.start('openai-chat').update({
    bodyState: 'complete',
    providerFinished: true,
    usagePresent: true,
    inputTokens: 17,
    outputTokens: 3,
    totalTokens: 20,
    cost: 0.002,
    httpStatus: 200,
    finishReason: 'stop',
  })
}

describe('prepared context observations in the durable usage ledger', () => {
  it('records bytes and scope on the active pass without inventing provider token usage', async () => {
    const { ledger, sql } = storage()
    const session = ledger.model(identity, operation)
    await begin(session)
    const snapshot = observation()
    session.context(snapshot)
    const [pass] = ledger.list()
    expect(pass).toMatchObject({
      ...identity,
      ...operation,
      outcome: 'running',
      accounting: 'provider-attempts',
      context: snapshot,
      attempts: [],
      cost: { status: 'unavailable' },
    })
    expect(pass.inputTokens).toBeUndefined()
    expect(pass.outputTokens).toBeUndefined()
    expect(pass.totalTokens).toBeUndefined()
    expect(new UsageLedger(sql).list()[0].context).toEqual(snapshot)
    expect(usageSummary(ledger.list())).toMatchObject({
      usd: 0,
      observedAttempts: 0,
      pricedRecords: 0,
      unavailable: 1,
    })
  })

  it('rejects a snapshot before a pass starts and after the pass settles', async () => {
    const { ledger } = storage()
    const session = ledger.model(identity, operation)
    expect(() => session.context(observation())).toThrow()
    expect(ledger.list()).toEqual([])
    await begin(session)
    session.context(observation())
    completeAttempt(session)
    session.assertComplete()
    const saved = ledger.list()
    expect(saved[0].outcome).toBe('succeeded')
    expect(() => session.context(observation('structuredOutput'))).toThrow()
    expect(ledger.list()).toEqual(saved)
  })

  it('does not copy a previous snapshot into the next model pass', async () => {
    const { ledger, sql } = storage()
    const session = ledger.model(identity, operation)
    await begin(session)
    const first = observation()
    session.context(first)
    const firstId = ledger.list()[0].id
    completeAttempt(session)
    await begin(session, 1)
    const next = ledger.list().find((step) => step.id !== firstId)!
    expect(next.outcome).toBe('running')
    expect(next.context).toBeUndefined()
    expect(ledger.list().find((step) => step.id === firstId)?.context).toEqual(
      first,
    )
    const second = observation()
    second.observedAt++
    second.history.inputBytes = 3_072
    second.history.retainedBytes = 1_000
    second.request.tools = 5
    session.context(second)
    completeAttempt(session)
    session.assertComplete()
    const recovered = new UsageLedger(sql).list()
    expect(recovered.find((step) => step.id === firstId)?.context).toEqual(
      first,
    )
    expect(recovered.find((step) => step.id === next.id)?.context).toEqual(
      second,
    )
  })

  it('selects the newest pass when two iterations start in the same millisecond', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_790_210_000_000)
    const { ledger, sql } = storage()
    const session = ledger.model(identity, operation)
    await begin(session)
    session.context(observation())
    const firstId = ledger.list()[0].id
    completeAttempt(session)
    await begin(session, 1)
    const passes = ledger.list()
    expect(passes).toHaveLength(2)
    expect(passes[0].startedAt).toBe(passes[1].startedAt)
    expect(passes[0].id).not.toBe(firstId)
    expect(passes[0].outcome).toBe('running')
    expect(passes[0].context).toBeUndefined()
    expect(passes[1].id).toBe(firstId)
    expect(passes[1].context).toEqual(observation())
    expect(new UsageLedger(sql).list(1)[0]).toEqual(passes[0])
  })

  it('binds a structured-output snapshot to its own newly started pass', async () => {
    const { ledger } = storage()
    const session = ledger.model(identity, operation)
    await begin(session)
    const first = observation()
    session.context(first)
    const firstId = ledger.list()[0].id
    completeAttempt(session)
    await session.middleware.onStructuredOutputConfig?.(
      {} as never,
      {} as never,
    )
    const structured = ledger.list().find((step) => step.id !== firstId)!
    expect(structured.context).toBeUndefined()
    const snapshot = observation('structuredOutput')
    snapshot.request.outputSchemaBytes = 384
    session.context(snapshot)
    completeAttempt(session)
    session.assertComplete()
    expect(ledger.list().find((step) => step.id === firstId)?.context).toEqual(
      first,
    )
    expect(
      ledger.list().find((step) => step.id === structured.id)?.context,
    ).toEqual(snapshot)
  })

  it('stores a detached snapshot that cannot change when the caller mutates its input', async () => {
    const { ledger } = storage()
    const session = ledger.model(identity, operation)
    await begin(session)
    const input = observation()
    const expected = structuredClone(input)
    session.context(input)
    input.history.retainedBytes = 1
    input.request.tools = 0
    input.exclusions.reverse()
    completeAttempt(session)
    session.assertComplete()
    expect(ledger.list()[0].context).toEqual(expected)
  })

  it('rejects invalid replacement metadata without changing the saved observation', async () => {
    const { ledger } = storage()
    const session = ledger.model(identity, operation)
    await begin(session)
    session.context(observation())
    const saved = ledger.list()
    const invalid = observation()
    invalid.history.retainedBytes = NaN
    expect(() => session.context(invalid)).toThrow()
    expect(ledger.list()).toEqual(saved)
  })

  it('keeps SDK retries separate from the prepared context and accounting totals', async () => {
    const { db, ledger } = storage()
    const session = ledger.model(identity, operation)
    await begin(session)
    const snapshot = observation()
    session.context(snapshot)
    session.observer.start('openai-chat').update({
      bodyState: 'failed',
      providerFinished: false,
      usagePresent: false,
      httpStatus: 503,
    })
    completeAttempt(session)
    session.assertComplete()
    const [pass] = ledger.list()
    expect(pass.context).toEqual(snapshot)
    expect(pass.attempts).toHaveLength(2)
    expect(pass.attempts?.[1]).toMatchObject({
      inputTokens: 17,
      outputTokens: 3,
      totalTokens: 20,
    })
    expect(pass.inputTokens).toBeUndefined()
    expect(pass.totalTokens).toBeUndefined()
    for (const row of db.prepare('SELECT json FROM usage_attempts').all()) {
      const stored = JSON.parse(String(row.json))
      expect(stored).not.toHaveProperty('context')
      expect(stored).not.toHaveProperty('history')
      expect(stored).not.toHaveProperty('request')
    }
    expect(usageSummary(ledger.list())).toMatchObject({
      usd: 0.002,
      observedAttempts: 2,
      pricedRecords: 1,
      unavailable: 1,
    })
  })

  it('leaves legacy steps without context metadata unchanged across reconstruction', () => {
    const { sql, ledger } = storage()
    const pass = ledger.start(identity, operation)
    pass.usage({
      promptTokens: 5,
      completionTokens: 2,
      totalTokens: 7,
      cost: 0.01,
    })
    pass.finish('succeeded')
    const saved = ledger.list()
    expect(saved[0]).not.toHaveProperty('context')
    expect(saved[0]).not.toHaveProperty('accounting')
    expect(saved[0]).toMatchObject({
      inputTokens: 5,
      outputTokens: 2,
      totalTokens: 7,
    })
    expect(new UsageLedger(sql).list()).toEqual(saved)
  })

  it('rejects late observations after recovery marks the active pass interrupted', async () => {
    const { sql, ledger } = storage()
    const session = ledger.model(identity, operation)
    await begin(session)
    session.context(observation())
    const restarted = new UsageLedger(sql)
    restarted.interrupt()
    const interrupted = restarted.list()
    expect(() => session.context(observation('structuredOutput'))).toThrow()
    expect(restarted.list()).toEqual(interrupted)
    expect(interrupted[0].outcome).toBe('interrupted')
  })
})

describe('context observation data boundary', () => {
  it('accepts the explicit byte scope and preserves zero counters', () => {
    const snapshot = observation()
    Object.keys(snapshot.history).forEach((key) => {
      if (key !== 'budgetBytes')
        snapshot.history[key as keyof typeof snapshot.history] = 0
    })
    Object.keys(snapshot.request).forEach((key) => {
      snapshot.request[key as keyof typeof snapshot.request] = 0
    })
    expect(contextObservationSchema.parse(snapshot)).toEqual(snapshot)
  })

  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid numeric counters: %s',
    (invalid) => {
      for (const section of ['history', 'request'] as const) {
        for (const field of Object.keys(observation()[section])) {
          const snapshot = observation()
          Object.assign(snapshot[section], { [field]: invalid })
          expect(contextObservationSchema.safeParse(snapshot).success).toBe(
            false,
          )
        }
      }
      expect(
        contextObservationSchema.safeParse({
          ...observation(),
          observedAt: invalid,
        }).success,
      ).toBe(false)
      const structured = observation('structuredOutput')
      structured.request.outputSchemaBytes = invalid
      expect(contextObservationSchema.safeParse(structured).success).toBe(false)
    },
  )

  it.each([
    { schemaVersion: 2 },
    { scope: 'model-context' },
    { stage: 'sent' },
    { unit: 'tokens' },
    { phase: 'unknown' },
    { transcriptEpoch: '' },
    { runId: '' },
    { exclusions: [] },
    { exclusions: ['media-payloads'] },
    { exclusions: ['media-payloads', 'attachment-payloads', 'tools'] },
    { inputTokens: 42 },
  ])('rejects an unsupported or misleading observation: %j', (change) => {
    expect(
      contextObservationSchema.safeParse({ ...observation(), ...change })
        .success,
    ).toBe(false)
  })

  it('does not accept private content inside counter objects', () => {
    const snapshot = observation()
    expect(
      contextObservationSchema.safeParse({
        ...snapshot,
        history: { ...snapshot.history, messages: ['private user prompt'] },
      }).success,
    ).toBe(false)
    expect(
      contextObservationSchema.safeParse({
        ...snapshot,
        request: { ...snapshot.request, systemPrompt: 'private instructions' },
      }).success,
    ).toBe(false)
  })

  it('reads missing and invalid legacy observations as unavailable, not zero', () => {
    expect(parseContextObservation(undefined)).toBeUndefined()
    expect(parseContextObservation(null)).toBeUndefined()
    expect(parseContextObservation({})).toBeUndefined()
    expect(
      parseContextObservation({ ...observation(), unit: 'tokens' }),
    ).toBeUndefined()
    expect(parseContextObservation(observation())).toEqual(observation())
  })
})
