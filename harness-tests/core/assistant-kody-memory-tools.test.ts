import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultPolicy } from '../../src/chat/core/types'
import { assistantKodyMemoryReadTools } from '../../src/chat/server/assistant-kody-memory-tools'
import type { kodyCall } from '../../src/chat/server/kody'

const account = vi.hoisted(() => ({
  current: vi.fn(),
  unchanged: vi.fn(),
}))
vi.mock('../../src/chat/server/kody-reference-access', () => ({
  kodyReferenceAccount: account.current,
  assertKodyReferenceAccountUnchanged: account.unchanged,
}))

const scope = { workspaceId: 'personal:user-1', userId: 'user-1' }
const options = { policy: defaultPolicy, fixture: false }
const memory = {
  id: 'memory-1',
  status: 'active',
  subject: 'Preferred answer style',
  summary: 'Prefers short answers.',
  details: 'Use brief paragraphs for ordinary questions.',
  category: 'preference',
  tags: ['style'],
  source_uris: [],
  created_at: '2026-09-28T10:00:00Z',
  updated_at: '2026-09-28T10:00:00Z',
}

function moduleMain(code: string, kody: object) {
  const program = code
    .replace("import { kody } from 'kody:runtime'", '')
    .replace('export default async function main', 'async function main')
  return new Function('kody', `${program}\nreturn main`)(kody) as (
    params: Record<string, unknown>,
  ) => Promise<unknown>
}

beforeEach(() => {
  account.current.mockReset().mockResolvedValue({
    enabled: true,
    fingerprint: 'account-1',
  })
  account.unchanged.mockReset().mockResolvedValue(undefined)
})

describe('assistant Kody memory reads', () => {
  it('searches bounded summaries and opens one exact record through Kody', async () => {
    const metaMemorySearch = vi.fn(async () => ({ matches: [memory] }))
    const metaMemoryGet = vi.fn(async () => memory)
    const call = vi.fn(async (_env, _user, _tool, args) => ({
      structuredContent: {
        result: await moduleMain(args.code as string, {
          metaMemorySearch,
          metaMemoryGet,
        })(args.params as Record<string, unknown>),
      },
    })) as unknown as typeof kodyCall
    const tools = assistantKodyMemoryReadTools({
      env: {
        KODY_ORIGIN: 'https://kody.test',
        ENCRYPTION_KEY: 'test-only-encryption-key-with-more-than-32-characters',
      },
      scope,
      options,
      signal: new AbortController().signal,
      call,
      assertCurrent: () => undefined,
    })
    const search = tools.find((tool) => tool.name === 'search_kody_memory')!
    const found = (await search.execute!({ query: 'answer style' })) as any
    expect(found).toMatchObject({
      ok: true,
      scope: 'kody-personal',
      result: { items: [{ id: memory.id, subject: memory.subject }] },
      searchEvidence: {
        query: 'answer style',
        returnedCount: 1,
        exhaustive: false,
      },
    })
    expect(JSON.stringify(found)).not.toContain(memory.details)
    expect(metaMemorySearch).toHaveBeenCalledWith({
      query: 'answer style',
      limit: 20,
    })

    const read = tools.find((tool) => tool.name === 'read_kody_memory')!
    const opened = (await read.execute!({ id: memory.id })) as any
    expect(opened).toMatchObject({
      ok: true,
      result: { id: memory.id, details: memory.details },
    })
    expect(metaMemoryGet).toHaveBeenCalledWith({ memory_id: memory.id })
    expect(account.unchanged).toHaveBeenCalledTimes(2)
  })

  it('does not return a memory after account access changes', async () => {
    account.unchanged.mockRejectedValue(
      new Error('Kody connection or access changed. Try again.'),
    )
    const call = vi.fn(async () => ({
      structuredContent: {
        result: { items: [] },
      },
    })) as unknown as typeof kodyCall
    const tools = assistantKodyMemoryReadTools({
      env: {
        KODY_ORIGIN: 'https://kody.test',
        ENCRYPTION_KEY: 'test-only-encryption-key-with-more-than-32-characters',
      },
      scope,
      options,
      signal: new AbortController().signal,
      call,
      assertCurrent: () => undefined,
    })
    const result = (await tools[0].execute!({ query: 'answer style' })) as any
    expect(result).toEqual({
      ok: false,
      error: 'Kody connection or access changed. Try again.',
    })
  })

  it('labels an empty query as inconclusive rather than account-wide absence', async () => {
    const call = vi.fn(async () => ({
      structuredContent: { result: { items: [] } },
    })) as unknown as typeof kodyCall
    const tools = assistantKodyMemoryReadTools({
      env: {
        KODY_ORIGIN: 'https://kody.test',
        ENCRYPTION_KEY: 'test-only-encryption-key-with-more-than-32-characters',
      },
      scope,
      options,
      signal: new AbortController().signal,
      call,
      assertCurrent: () => undefined,
    })
    const result = (await tools[0].execute!({
      query: 'plum-20260928',
    })) as any
    expect(result).toMatchObject({
      ok: true,
      result: { items: [] },
      searchEvidence: {
        query: 'plum-20260928',
        returnedCount: 0,
        exhaustive: false,
      },
    })
    expect(result.searchEvidence.interpretation).toContain('does not prove')
  })
})
