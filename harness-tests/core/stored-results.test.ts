import { expect, it, vi } from 'vitest'
import {
  StoredResults,
  withStoredResults,
} from '../../src/chat/server/stored-results'
import type { TaskDependencies } from '../../src/chat/server/system-one-loop'

function setup() {
  const data = new Map<string, unknown>()
  const archive = new StoredResults(
    {
      put: async (id, value) => {
        data.set(id, structuredClone(value))
      },
      get: async (id) => data.get(id),
    },
    100,
  )
  return { archive, data }
}
it('preserves a full result and pages its exact text with offsets', async () => {
  const { archive, data } = setup()
  const text = 'λ'.repeat(13000)
  const value = { content: [{ type: 'text', text }] }
  const receipt = (await archive.retain(value)) as {
    resultId: string
    contentInspected: boolean
    defaultPath: string
  }
  expect(receipt.contentInspected).toBe(false)
  expect(receipt.defaultPath).toBe('/content/0/text')
  expect(data.get(receipt.resultId)).toEqual(value)
  const first = await archive.read(receipt.resultId)
  const second = await archive.read(
    receipt.resultId,
    undefined,
    first.nextOffset!,
  )
  const third = await archive.read(
    receipt.resultId,
    undefined,
    second.nextOffset!,
  )
  expect(first.text + second.text + third.text).toBe(text)
  expect(first.start).toBe(0)
  expect(third.end).toBe(text.length)
  expect(third.nextOffset).toBeNull()
})
it('searches a literal phrase without treating punctuation as a regular expression', async () => {
  const { archive } = setup()
  const text =
    'unrelated\n'.repeat(100) + 'Needle.* original text' + '\nother'.repeat(100)
  const receipt = (await archive.retain({ 'a/b~c': text })) as {
    resultId: string
  }
  const result = await archive.search(receipt.resultId, 'needle.*', '/a~1b~0c')
  expect(result.matches).toHaveLength(1)
  expect(result.matches[0].matchStart).toBe(text.indexOf('Needle.*'))
  expect(result.matches[0].text).toBe(
    text.slice(result.matches[0].start, result.matches[0].end),
  )
  expect((await archive.search(receipt.resultId, 'absent')).matches).toEqual([])
})
it('rejects unknown scopes, prototype paths, invalid pointers, and out-of-range offsets', async () => {
  const { archive } = setup()
  const receipt = (await archive.retain({ text: 'data'.repeat(100) })) as {
    resultId: string
  }
  await expect(setup().archive.read(receipt.resultId)).rejects.toThrow(
    'unavailable',
  )
  await expect(archive.read(receipt.resultId, '/__proto__')).rejects.toThrow(
    'not found',
  )
  await expect(archive.read(receipt.resultId, '/text~2')).rejects.toThrow(
    'pointer',
  )
  await expect(archive.read(receipt.resultId, '/text', -1)).rejects.toThrow(
    'Offset',
  )
  await expect(archive.read(receipt.resultId, '/text', 99999)).rejects.toThrow(
    'Offset',
  )
})
it('keeps external authorization and uses single-use scoped grants for local reads', async () => {
  const { archive } = setup()
  const deps: TaskDependencies = {
    select: async () => ({ decision: { type: 'done' } }),
    bind: async () => ({ status: 'ready', arguments: {} }),
    authorize: vi.fn(async () => false),
    invoke: vi.fn(async () => ({ ok: true, value: {} })),
  }
  const configured = withStoredResults([], deps, archive)
  const entry = configured.entries.find(
    (entry) => entry.name === 'read_stored_result',
  )!
  const receipt = (await archive.retain({ text: 'data'.repeat(100) })) as {
    resultId: string
  }
  const args = { resultId: receipt.resultId, offset: 0 }
  const signal = new AbortController().signal
  await expect(
    configured.dependencies.invoke(entry, args, signal),
  ).rejects.toThrow('grant')
  expect(await configured.dependencies.authorize(entry, args, signal)).toEqual({
    allowed: true,
    effect: 'read',
  })
  expect(
    await configured.dependencies.invoke(entry, args, signal),
  ).toMatchObject({ ok: true })
  await expect(
    configured.dependencies.invoke(entry, args, signal),
  ).rejects.toThrow('grant')
  expect(deps.invoke).not.toHaveBeenCalled()
  const external = { ...entry, id: 'external', serverId: 'remote' }
  expect(await configured.dependencies.authorize(external, {}, signal)).toBe(
    false,
  )
  expect(deps.authorize).toHaveBeenCalledOnce()
  await expect(
    configured.dependencies.authorize(
      { ...entry, serverId: 'impostor' },
      args,
      signal,
    ),
  ).rejects.toThrow('identity')
})
it('offers local tools only after an archived result exists in this task', async () => {
  const { archive } = setup()
  const select = vi.fn<TaskDependencies['select']>(async () => ({
    decision: { type: 'done' },
  }))
  const configured = withStoredResults(
    [],
    {
      select,
      bind: async () => ({ status: 'ready', arguments: {} }),
      authorize: async () => false,
      invoke: async () => ({ ok: true, value: {} }),
    },
    archive,
  )
  const state = {
    request: 'Search returned data',
    observations: [],
    unresolved: [],
  }
  const signal = new AbortController().signal
  await configured.dependencies.select(state, configured.entries, signal)
  expect(select.mock.calls[0][1]).toEqual([])
  const receipt = await archive.retain({ text: 'data'.repeat(100) })
  const observed = {
    ...state,
    observations: [
      {
        id: 'o',
        toolId: 'remote',
        toolName: 'remote',
        arguments: {},
        ok: true,
        value: receipt,
      },
    ],
  }
  await configured.dependencies.select(observed, configured.entries, signal)
  expect(select.mock.calls[1][1]).toHaveLength(2)
  const other = withStoredResults(
    [],
    { ...configured.dependencies, select },
    setup().archive,
  )
  await other.dependencies.select(observed, other.entries, signal)
  expect(select.mock.calls[2][1]).toEqual([])
})
it('keeps record identifiers searchable when a large result has many short fields', async () => {
  const { archive } = setup()
  const value = {
    records: Array.from({ length: 400 }, (_, i) => ({
      id: 'P-' + i,
      name: i === 317 ? 'Cedar workshop' : 'Project ' + i,
      description: 'An ordinary project record with a stable identifier.',
    })),
  }
  const receipt = (await archive.retain(value)) as {
    resultId: string
    defaultPath: string
    views: Array<{ path: string }>
  }
  expect(receipt.defaultPath).toBe('')
  expect(receipt.views.some((v) => v.path === '')).toBe(true)
  const found = await archive.search(receipt.resultId, 'Cedar workshop')
  expect(found.matches).toHaveLength(1)
  expect(found.matches[0].text).toContain('P-317')
})
it('returns exact complete JSON records around search matches without repairing snippets', async () => {
  const { archive } = setup()
  const record = { id: 'P-317', name: 'Cedar "workshop" }', status: 'open' }
  const value = {
    records: [{ id: 'P-1', name: 'Other' }, record],
    padding: Array.from({ length: 100 }, () => ({ other: 'unrelated' })),
  }
  const receipt = (await archive.retain(value)) as { resultId: string }
  const result = await archive.search(receipt.resultId, 'Cedar', '')
  expect(result.matches[0].context?.value).toEqual(record)
  const context = result.matches[0].context!
  expect(
    JSON.parse(
      JSON.stringify(value, null, 2).slice(context.start, context.end),
    ),
  ).toEqual(record)
  const read = await archive.read(receipt.resultId, '/records/1')
  expect(read.value).toEqual(record)
})
it('retains neighboring matching records across search pages', async () => {
  const { archive } = setup()
  const records = Array.from({ length: 11 }, (_, i) => ({
    id: String(i),
    name: i === 7 ? 'Cedar workshop' : `Cedar workshop ${i}`,
  }))
  const receipt = (await archive.retain({ records })) as { resultId: string }
  const first = await archive.search(receipt.resultId, 'Cedar workshop', '')
  const second = await archive.search(
    receipt.resultId,
    'Cedar workshop',
    '',
    first.nextOffset!,
  )
  expect(first.matches).toHaveLength(8)
  expect(second.matches).toHaveLength(3)
  expect(
    [...first.matches, ...second.matches].map((m) => m.context?.value),
  ).toEqual(records)
  expect(second.complete).toBe(true)
  expect(first.matches[7].context?.value).toEqual(records[7])
})

it('defaults MCP results to structured content while preserving the entire envelope', async () => {
  const { archive, data } = setup()
  const structuredContent = {
    results: [
      {
        title: 'Example document',
        url: 'https://example.test/guide#section',
        description: 'x'.repeat(200),
      },
    ],
  }
  const value = {
    content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    structuredContent,
  }
  const receipt = (await archive.retain(value)) as {
    resultId: string
    defaultPath: string
    views: unknown[]
  }
  expect(receipt.defaultPath).toBe('/structuredContent')
  expect(receipt.views).toContainEqual(
    expect.objectContaining({ path: '/structuredContent', format: 'json' }),
  )
  expect(JSON.parse((await archive.read(receipt.resultId)).text)).toEqual(
    structuredContent,
  )
  expect(JSON.parse((await archive.read(receipt.resultId, '')).text)).toEqual(
    value,
  )
  expect(data.get(receipt.resultId)).toEqual(value)
})

it('does not replace a full document with unrelated structured metadata', async () => {
  const { archive } = setup()
  const receipt = (await archive.retain({
    content: [{ type: 'text', text: 'Full document body. '.repeat(100) }],
    structuredContent: { documentId: 'doc-17' },
  })) as { defaultPath: string }
  expect(receipt.defaultPath).toBe('/content/0/text')
})
