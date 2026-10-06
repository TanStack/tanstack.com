import { expect, it, vi } from 'vitest'
import type { ModelMessage } from '@tanstack/ai'
import { projectAssistantContext } from '../../src/chat/server/assistant-context'
import type { ContextObservation } from '../../src/chat/core/context-observation'

const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length
const request: ModelMessage = {
  role: 'user',
  content: 'Inspect the selected sources.',
}
const call = (ids: string[]): ModelMessage => ({
  role: 'assistant',
  content: null,
  toolCalls: ids.map((id) => ({
    id,
    type: 'function',
    function: { name: 'read_record', arguments: JSON.stringify({ id }) },
  })),
})
const result = (
  id: string,
  content = 'Returned data '.repeat(1500),
): ModelMessage => ({ role: 'tool', toolCallId: id, content })
function memory() {
  const values = new Map<string, unknown>()
  return {
    values,
    put: vi.fn(async (id: string, value: unknown) => {
      values.set(id, value)
    }),
    get: async (id: string) => values.get(id),
  }
}

it('keeps a fresh completed exchange inline across repeated context projections', async () => {
  const store = memory()
  const messages = [request, call(['one']), result('one')]
  let projected = messages
  for (let pass = 0; pass < 4; pass++) {
    const observations: ContextObservation['history'][] = []
    projected = await projectAssistantContext(
      projected,
      store,
      80000,
      (value) => {
        observations.push(value)
      },
    )
    expect(projected).toEqual(messages)
    expect(observations[0]).toMatchObject({
      archivedLargeMessages: 0,
      compactedMessages: 0,
      retainedBytes: bytes(messages),
    })
  }
  expect(store.put).not.toHaveBeenCalled()
})

it('keeps every parallel result and an unfinished parallel group together', async () => {
  const store = memory()
  const first = result('first')
  const second = result('second')
  const partial = [request, call(['first', 'second']), first]
  expect(await projectAssistantContext(partial, store)).toEqual(partial)
  const complete = [...partial, second]
  expect(await projectAssistantContext(complete, store)).toEqual(complete)
  expect(store.put).not.toHaveBeenCalled()
})

it('lets a later assistant response supersede the fresh exchange without losing its original result', async () => {
  const store = memory()
  const original = result('one')
  const completed = [
    request,
    call(['one']),
    original,
    { role: 'assistant' as const, content: 'The result has been inspected.' },
  ]
  const projected = await projectAssistantContext(completed, store)
  const ref = JSON.parse(projected[2].content as string)
  expect(await store.get(ref.archivedMessage)).toEqual(original)
  expect(projected[1]).toEqual(completed[1])
  expect(projected.at(-1)).toEqual(completed.at(-1))
})

it('retains the latest exchange and compacts an older exchange and earlier turns under pressure', async () => {
  const store = memory()
  const pinned: ModelMessage = {
    role: 'user',
    content: 'Earlier effect remains unknown.',
    metadata: { gumActionEvidence: true },
  }
  const latest = [call(['fresh']), result('fresh', '新'.repeat(14000))]
  const messages = [
    pinned,
    ...Array.from({ length: 15 }, (_, i) => ({
      role: 'user' as const,
      content: `Old${i}:` + 'history '.repeat(1000),
    })),
    request,
    call(['older']),
    result('older'),
    ...latest,
  ]
  const projected = await projectAssistantContext(messages, store)
  expect(projected).toContainEqual(pinned)
  for (const item of latest) expect(projected).toContainEqual(item)
  expect(projected).toContainEqual(request)
  expect(bytes(projected)).toBeLessThanOrEqual(80000)
  expect(projected.length).toBeLessThan(messages.length)
})

it('archives full overflowing parallel content once without dropping its call or nesting references on later passes', async () => {
  const store = memory()
  const large = result('large', '新'.repeat(27000))
  const small = result('small', 'Small fresh result.')
  const messages = [request, call(['large', 'small']), large, small]
  let observed: ContextObservation['history'] | undefined
  const first = await projectAssistantContext(
    messages,
    store,
    80000,
    (value) => {
      observed = value
    },
  )
  expect(bytes(messages)).toBeGreaterThan(80000)
  expect(bytes(first)).toBeLessThanOrEqual(80000)
  expect(first[1]).toEqual(messages[1])
  expect(first[3]).toEqual(small)
  const ref = JSON.parse(first[2].content as string)
  expect(await store.get(ref.archivedMessage)).toEqual(large)
  expect(observed?.archivedLargeMessages).toBe(1)
  expect(store.put).toHaveBeenCalledOnce()
  for (let pass = 0; pass < 3; pass++)
    expect(await projectAssistantContext(first, store)).toEqual(first)
  expect(store.put).toHaveBeenCalledOnce()
})

it('falls back for many small parallel results when their complete exchange exceeds the global budget', async () => {
  const store = memory()
  const ids = Array.from({ length: 15 }, (_, i) => String(i))
  const originals = ids.map((id) => result(id, 'x'.repeat(6500)))
  const messages = [request, call(ids), ...originals]
  const projected = await projectAssistantContext(messages, store)
  expect(bytes(projected)).toBeLessThanOrEqual(80000)
  expect(projected[1]).toEqual(messages[1])
  expect(projected.filter((item) => item.role === 'tool')).toHaveLength(
    ids.length,
  )
  for (const message of projected.filter((item) => item.role === 'tool')) {
    const original = originals.find(
      (item) => item.toolCallId === message.toolCallId,
    )!
    if (message.content !== original.content)
      expect(
        await store.get(JSON.parse(message.content as string).archivedMessage),
      ).toEqual(original)
  }
  expect(store.put).toHaveBeenCalled()
})

it('rejects an exchange whose immutable arguments alone cannot fit instead of dropping protocol fields', async () => {
  const store = memory()
  const invocation = call(['large'])
  invocation.toolCalls![0].function.arguments = JSON.stringify({
    source: 'x'.repeat(82000),
  })
  await expect(
    projectAssistantContext(
      [request, invocation, result('large', 'done')],
      store,
    ),
  ).rejects.toThrow('context budget')
  expect(invocation.toolCalls![0].function.arguments).toContain(
    'x'.repeat(82000),
  )
})
