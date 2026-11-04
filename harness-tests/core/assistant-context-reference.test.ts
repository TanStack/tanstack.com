import { describe, expect, it, vi } from 'vitest'
import type { ModelMessage } from '@tanstack/ai'
import type { ContextObservation } from '../../src/chat/core/context-observation'
import { projectAssistantContext } from '../../src/chat/server/assistant-context'

const budget = 128_000
const serialized = (value: unknown) => JSON.stringify(value)
const bytes = (value: unknown) =>
  new TextEncoder().encode(serialized(value)).byteLength

function memory() {
  const values = new Map<string, unknown>()
  return {
    values,
    put: vi.fn(async (id: string, value: unknown) => {
      values.set(id, structuredClone(value))
    }),
    get: async (id: string) => values.get(id),
  }
}

function largeArguments(content: ModelMessage['content']): ModelMessage {
  return {
    id: 'assistant-with-large-arguments',
    role: 'assistant',
    content,
    toolCalls: [
      {
        id: 'write-report-call',
        type: 'function',
        function: {
          name: 'write_report',
          arguments: JSON.stringify({ body: 'x'.repeat(16_000) }),
        },
      },
    ],
  }
}

async function project(
  messages: ModelMessage[],
  store: ReturnType<typeof memory>,
) {
  const observations: ContextObservation['history'][] = []
  const result = await projectAssistantContext(
    messages,
    store,
    budget,
    (value) => {
      observations.push(value)
    },
  )
  expect(observations).toHaveLength(1)
  const observed = observations[0]
  expect(observed).toMatchObject({
    budgetBytes: budget,
    inputBytes: bytes(messages),
    retainedBytes: bytes(result),
    inputMessages: messages.length,
    retainedMessages: result.length,
    compactedMessages: 0,
  })
  return { result, observed }
}

describe('stable assistant context references', () => {
  it.each(
    (
      [null, '', 'Tiny content.', []] satisfies Array<ModelMessage['content']>
    ).map((content) => ({ content })),
  )(
    'does not archive a message made large only by tool arguments: $content',
    async ({ content }) => {
      const store = memory()
      const message = largeArguments(content)
      expect(bytes(message)).toBeGreaterThan(12_000)
      const original = serialized([message])
      let current = [message]
      for (let pass = 0; pass < 4; pass++) {
        const { result, observed } = await project(current, store)
        expect(serialized(result)).toBe(original)
        expect(observed.archivedLargeMessages).toBe(0)
        expect(observed.pinnedEvidenceMessages).toBe(0)
        current = result
      }
      expect(store.put).not.toHaveBeenCalled()
      expect(store.values.size).toBe(0)
    },
  )

  it('archives a large body once while keeping the tool identity and arguments intact across four later passes', async () => {
    const store = memory()
    const message = largeArguments('Original report details. '.repeat(1_000))
    const original = serialized(message)
    const first = await project([message], store)
    expect(first.observed.archivedLargeMessages).toBe(1)
    expect(first.result).toHaveLength(1)
    const replacement = first.result[0]
    expect(replacement.id).toBe(message.id)
    expect(replacement.toolCalls).toEqual(message.toolCalls)
    const reference = JSON.parse(replacement.content as string)
    expect(reference.archivedMessage).toMatch(/^context_[A-Za-z0-9_-]{43}$/)
    expect(reference.preview).toBe((message.content as string).slice(0, 1_200))
    expect(reference.notice).toContain('read_stored_result')
    expect(await store.get(reference.archivedMessage)).toEqual(message)
    expect(bytes(replacement)).toBeLessThan(bytes(message))
    // Preserved arguments keep this reference above the individual-message limit.
    expect(bytes(replacement)).toBeGreaterThan(12_000)
    const stable = serialized(first.result)
    let current = first.result
    for (let pass = 0; pass < 4; pass++) {
      const { result, observed } = await project(current, store)
      expect(serialized(result)).toBe(stable)
      expect(observed.archivedLargeMessages).toBe(0)
      current = result
    }
    expect(store.put).toHaveBeenCalledOnce()
    expect([...store.values.keys()]).toEqual([reference.archivedMessage])
    expect(serialized(message)).toBe(original)
  })

  it('measures the reduction in UTF-8 bytes even when the reference has more JavaScript code units', async () => {
    const store = memory()
    // The short non-ASCII suffix costs three bytes per code unit. A code-unit
    // comparison would reject a replacement that actually saves request bytes.
    const message = largeArguments('a'.repeat(1_200) + '界'.repeat(160))
    const { result, observed } = await project([message], store)
    expect(serialized(result).length).toBeGreaterThan(
      serialized([message]).length,
    )
    expect(bytes(result)).toBeLessThan(bytes([message]))
    expect(observed.archivedLargeMessages).toBe(1)
    const reference = JSON.parse(result[0].content as string)
    expect(await store.get(reference.archivedMessage)).toEqual(message)
    expect(result[0].toolCalls).toEqual(message.toolCalls)
    expect(store.put).toHaveBeenCalledOnce()
  })

  it('preserves an existing reference with maximally escaped preview text instead of wrapping it again', async () => {
    const store = memory()
    const message = largeArguments(
      '\u0001'.repeat(1_200) + 'Rest of the original report. '.repeat(1_000),
    )
    const first = await project([message], store)
    expect(first.observed.archivedLargeMessages).toBe(1)
    expect(store.put).toHaveBeenCalledOnce()
    const reference = JSON.parse(first.result[0].content as string)
    expect(reference.preview).toBe('\u0001'.repeat(1_200))
    expect(bytes(first.result[0])).toBeGreaterThan(12_000)
    const original = serialized(first.result)
    let current = first.result
    store.put.mockClear()
    for (let pass = 0; pass < 4; pass++) {
      const { result, observed } = await project(current, store)
      expect(serialized(result)).toBe(original)
      expect(observed.archivedLargeMessages).toBe(0)
      current = result
    }
    expect(store.put).not.toHaveBeenCalled()
    expect([...store.values.keys()]).toEqual([reference.archivedMessage])
    expect(await store.get(reference.archivedMessage)).toEqual(message)
  })

  it('keeps the pinned read-before-write evidence reference stable when metadata leaves it oversized', async () => {
    const store = memory()
    const evidence: ModelMessage = {
      id: 'earlier-action-evidence',
      role: 'user',
      content:
        'Earlier action observations. '.repeat(1_000) +
        'Write outcome: unknown.',
      metadata: {
        gumActionEvidence: true,
        evidenceMetadata: 'x'.repeat(16_000),
      },
    }
    const request: ModelMessage = {
      role: 'user',
      content: 'Verify the earlier outcome.',
    }
    const first = await project([evidence, request], store)
    expect(first.observed).toMatchObject({
      archivedLargeMessages: 1,
      pinnedEvidenceMessages: 1,
    })
    const pinned = first.result.find(
      (message) => message.metadata?.gumActionEvidence,
    )!
    expect(pinned.id).toBe(evidence.id)
    expect(pinned.metadata).toEqual(evidence.metadata)
    expect(bytes(pinned)).toBeGreaterThan(12_000)
    const reference = JSON.parse(pinned.content as string)
    expect(reference.notice).toContain('before proposing or repeating a write')
    expect(reference.notice).toContain('Do not repeat confirmed writes')
    expect(reference.notice).toContain('verify unknown outcomes first')
    const stable = serialized(first.result)
    let current = first.result
    for (let pass = 0; pass < 4; pass++) {
      const { result, observed } = await project(current, store)
      expect(serialized(result)).toBe(stable)
      expect(observed).toMatchObject({
        archivedLargeMessages: 0,
        pinnedEvidenceMessages: 1,
      })
      expect(result.at(-1)).toEqual(request)
      current = result
    }
    expect(store.put).toHaveBeenCalledOnce()
    expect(await store.get(reference.archivedMessage)).toEqual(evidence)
  })
})
