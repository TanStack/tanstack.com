import { describe, expect, it, vi } from 'vitest'
import {
  KODY_MEMORY_GET_CODE,
  KODY_MEMORY_SEARCH_CODE,
  projectKodyMemoryDetail,
  projectKodyMemorySearch,
} from '../../src/chat/server/kody-memory'

const id = 'memory-1'
const memory = {
  id,
  status: 'active',
  subject: 'Preferred editor',
  summary: 'Uses a particular editor.',
  details: 'The private details stay out of search results.',
  category: 'preference',
  tags: ['editor'],
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-28T10:00:00Z',
  source_uris: ['https://example.com/source'],
}

function moduleMain(code: string, kody: object) {
  const program = code
    .replace("import { kody } from 'kody:runtime'", '')
    .replace('export default async function main', 'async function main')
  return new Function('kody', `${program}\nreturn main`)(kody) as (
    params: Record<string, unknown>,
  ) => Promise<unknown>
}

describe('Kody memory reads', () => {
  it('searches the connected account and projects summaries without details', async () => {
    const metaMemorySearch = vi.fn(async () => ({ matches: [memory] }))
    const value = await moduleMain(KODY_MEMORY_SEARCH_CODE, {
      metaMemorySearch,
    })({ query: 'editor' })
    expect(metaMemorySearch).toHaveBeenCalledWith({
      query: 'editor',
      limit: 20,
    })
    const result = projectKodyMemorySearch({
      structuredContent: { result: value },
    })
    expect(result.items).toEqual([
      {
        id,
        status: memory.status,
        subject: memory.subject,
        summary: memory.summary,
        category: memory.category,
        updatedAt: memory.updated_at,
        canMutate: false,
      },
    ])
    expect(JSON.stringify(result)).not.toContain(memory.details)
  })

  it('reads a selected memory and rejects a different identity', async () => {
    const metaMemoryGet = vi.fn(async () => memory)
    const value = await moduleMain(KODY_MEMORY_GET_CODE, { metaMemoryGet })({
      id,
    })
    expect(metaMemoryGet).toHaveBeenCalledWith({ memory_id: id })
    expect(
      projectKodyMemoryDetail({ structuredContent: { result: value } }, id),
    ).toMatchObject({ id, details: memory.details })
    expect(() =>
      projectKodyMemoryDetail(
        { structuredContent: { result: value } },
        'another-memory',
      ),
    ).toThrow('unsupported memory record')
    expect(() =>
      projectKodyMemoryDetail({ structuredContent: { result: null } }, id),
    ).toThrow('not found')
  })
})
