import { describe, expect, it } from 'vitest'
import {
  decodeExecutionBytes,
  encodeExecutionBytes,
  executionEventBatchSchema,
  executionEventPageSchema,
  executionEventSummarySchema,
  maxExecutionEventChunkBytes,
} from '../../src/chat/core/execution-events'

const commandId = '12345678-1234-4123-8123-123456789001'
const sessionId = '12345678-1234-4123-8123-123456789002'
const runtimeId = '12345678-1234-4123-8123-123456789003'
const output = (sequence = 1, bytes = new Uint8Array([0, 255, 128])) => ({
  type: 'output' as const,
  sequence,
  commandId,
  digest: 'a'.repeat(64),
  stream: 'stdout' as const,
  dataBase64: encodeExecutionBytes(bytes),
})
const page = () => ({
  sessionId,
  runtimeId,
  hostGeneration: 1,
  after: 0,
  nextSequence: 1,
  summary: {
    lastSequence: 1,
    outputBytes: 3,
    outputEvents: 1,
    droppedBytes: 0,
  },
  events: [output()],
  hasMore: false,
})

describe('execution output wire contract', () => {
  it('preserves arbitrary bytes including invalid UTF-8 and all byte values', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i)
    expect(decodeExecutionBytes(encodeExecutionBytes(bytes))).toEqual(bytes)
    const parsed = executionEventBatchSchema.parse([output(1, bytes)])[0]
    expect(parsed.type).toBe('output')
    if (parsed.type === 'output')
      expect(decodeExecutionBytes(parsed.dataBase64)).toEqual(bytes)
  })

  it.each(['AA', 'AA===', 'AB==', 'AA==\n', '%%%=', ''])(
    'rejects noncanonical or malformed bytes without throwing from safeParse: %j',
    (dataBase64) => {
      const event = { ...output(), dataBase64 }
      expect(executionEventBatchSchema.safeParse([event]).success).toBe(false)
      expect(
        executionEventPageSchema.safeParse({ ...page(), events: [event] })
          .success,
      ).toBe(false)
    },
  )

  it('bounds decoded bytes independently of record count and keeps event order exact', () => {
    const chunk = new Uint8Array(maxExecutionEventChunkBytes)
    expect(
      executionEventBatchSchema.safeParse([output(1, chunk)]).success,
    ).toBe(true)
    expect(
      executionEventBatchSchema.safeParse([
        output(1, new Uint8Array(chunk.length + 1)),
      ]).success,
    ).toBe(false)
    const four = Array.from({ length: 4 }, (_, i) => output(i + 1, chunk))
    expect(executionEventBatchSchema.safeParse(four).success).toBe(true)
    expect(
      executionEventBatchSchema.safeParse([
        ...four,
        output(5, new Uint8Array([1])),
      ]).success,
    ).toBe(false)
    expect(
      executionEventBatchSchema.safeParse([output(1), output(3)]).success,
    ).toBe(false)
    expect(
      executionEventBatchSchema.safeParse([output(1), output(1)]).success,
    ).toBe(false)
  })

  it('rejects cursors that claim missing, duplicated or unloaded data is complete', () => {
    expect(executionEventPageSchema.safeParse(page()).success).toBe(true)
    for (const bad of [
      { ...page(), nextSequence: 2 },
      { ...page(), after: 1 },
      { ...page(), hasMore: true },
      { ...page(), hostGeneration: 0 },
      { ...page(), runtimeId: undefined },
      { ...page(), events: [] },
      { ...page(), events: [output(2)] },
      { ...page(), summary: { ...page().summary, lastSequence: 2 } },
    ])
      expect(executionEventPageSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects impossible totals while allowing a control-only stream', () => {
    expect(
      executionEventSummarySchema.safeParse({
        lastSequence: 1,
        outputEvents: 0,
        outputBytes: 0,
        droppedBytes: 20,
      }).success,
    ).toBe(true)
    for (const changes of [
      { outputBytes: 0 },
      { outputEvents: 2 },
      { outputEvents: 0 },
      { lastSequence: 0 },
    ])
      expect(
        executionEventSummarySchema.safeParse({ ...page().summary, ...changes })
          .success,
      ).toBe(false)
  })
})
