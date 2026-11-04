import { describe, expect, it, vi } from 'vitest'
import { defaultPolicy } from '../../src/chat/core/types'
import {
  applyKodyMemoryChange,
  reviewKodyMemoryChange,
} from '../../src/chat/server/kody-memory-change'
import type { kodyCall } from '../../src/chat/server/kody'

vi.mock('../../src/chat/server/kody-reference-access', () => ({
  kodyReferenceAccount: vi.fn(async () => ({
    enabled: true,
    fingerprint: 'account-1',
    policyText: '{}',
    subject: 'person-1',
  })),
  assertKodyReferenceAccountUnchanged: vi.fn(async () => undefined),
}))

const env = {
  KODY_ORIGIN: 'https://kody.codes',
  ENCRYPTION_KEY: 'test-only-encryption-key-with-more-than-32-characters',
}
const scope = { workspaceId: 'personal:person-1', userId: 'person-1' }
const options = { policy: defaultPolicy, fixture: false }
const signal = new AbortController().signal
const id = 'memory-1'
const original = () => ({
  id,
  status: 'active',
  subject: 'Editor',
  summary: 'Uses the old editor.',
  details: 'More detail.',
  category: 'preference',
  tags: ['coding'],
  source_uris: ['https://example.com/source'],
  dedupe_key: 'editor',
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-28T10:00:00Z',
})

function moduleMain(code: string, kody: object) {
  const program = code
    .replace("import { kody } from 'kody:runtime'", '')
    .replace('export default async function main', 'async function main')
  return new Function('kody', `${program}\nreturn main`)(kody) as (
    params: Record<string, unknown>,
  ) => Promise<unknown>
}

function harness() {
  let memory = original()
  const metaMemoryGet = vi.fn(async () => memory)
  const metaMemoryVerify = vi.fn(async () => ({
    related_memories: [
      {
        id: 'other-memory',
        status: 'active',
        subject: 'Other',
        summary: 'Related',
      },
    ],
    recommended_actions: ['upsert', 'none'],
  }))
  const metaMemoryUpsert = vi.fn(async (input: Record<string, unknown>) => {
    memory = {
      ...memory,
      subject: String(input.subject),
      summary: String(input.summary),
      details: String(input.details),
      updated_at: '2026-09-28T11:00:00Z',
    }
    return { memory }
  })
  const metaMemoryDelete = vi.fn(async () => {
    memory = {
      ...memory,
      status: 'deleted',
      updated_at: '2026-09-28T11:00:00Z',
    }
    return { memory }
  })
  const kody = {
    metaMemoryGet,
    metaMemoryVerify,
    metaMemoryUpsert,
    metaMemoryDelete,
  }
  const call = vi.fn(async (_env, _user, _tool, args) => ({
    structuredContent: {
      result: await moduleMain(
        args.code as string,
        kody,
      )(args.params as Record<string, unknown>),
    },
  })) as unknown as typeof kodyCall
  return {
    call,
    metaMemoryVerify,
    metaMemoryUpsert,
    metaMemoryDelete,
    setMemory: (next: ReturnType<typeof original>) => {
      memory = next
    },
  }
}

describe('native Kody memory changes', () => {
  it('reviews related memories, then updates the exact version with one idempotent action', async () => {
    const test = harness()
    const review = await reviewKodyMemoryChange(
      env,
      scope,
      options,
      id,
      {
        type: 'update',
        expectedUpdatedAt: original().updated_at,
        subject: 'Editor',
        summary: 'Uses the new editor.',
        details: 'Updated detail.',
      },
      signal,
      test.call,
    )
    expect(review.related).toEqual([
      {
        id: 'other-memory',
        subject: 'Other',
        summary: 'Related',
        status: 'active',
      },
    ])
    expect(test.metaMemoryUpsert).not.toHaveBeenCalled()

    const changed = await applyKodyMemoryChange(
      env,
      scope,
      options,
      id,
      {
        token: review.token,
        operationId: '63e6e3e0-cc04-4c3a-aa8d-a56cbf3bf9c7',
      },
      signal,
      test.call,
    )
    expect(changed.summary).toBe('Uses the new editor.')
    expect(test.metaMemoryVerify).toHaveBeenCalledTimes(2)
    expect(test.metaMemoryUpsert).toHaveBeenCalledOnce()
    expect(test.metaMemoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        memory_id: id,
        verified_by_agent: true,
        tags: ['coding'],
        source_uris: ['https://example.com/source'],
      }),
    )
    expect(vi.mocked(test.call).mock.calls[1]?.[3]).toMatchObject({
      idempotencyKey: 'banks-memory-63e6e3e0-cc04-4c3a-aa8d-a56cbf3bf9c7',
    })
  })

  it('refuses to apply a review when the Kody record changed', async () => {
    const test = harness()
    const review = await reviewKodyMemoryChange(
      env,
      scope,
      options,
      id,
      {
        type: 'delete',
        expectedUpdatedAt: original().updated_at,
      },
      signal,
      test.call,
    )
    test.setMemory({ ...original(), updated_at: '2026-09-28T10:30:00Z' })
    await expect(
      applyKodyMemoryChange(
        env,
        scope,
        options,
        id,
        {
          token: review.token,
          operationId: '63e6e3e0-cc04-4c3a-aa8d-a56cbf3bf9c7',
        },
        signal,
        test.call,
      ),
    ).rejects.toMatchObject({ status: 409 })
    expect(test.metaMemoryDelete).not.toHaveBeenCalled()
  })

  it('keeps a review bound to its account and related-memory state', async () => {
    const test = harness()
    const review = await reviewKodyMemoryChange(
      env,
      scope,
      options,
      id,
      {
        type: 'delete',
        expectedUpdatedAt: original().updated_at,
      },
      signal,
      test.call,
    )
    await expect(
      applyKodyMemoryChange(
        env,
        {
          ...scope,
          userId: 'person-2',
        },
        options,
        id,
        {
          token: review.token,
          operationId: '2c315691-247b-4ff4-9419-6cce359243fc',
        },
        signal,
        test.call,
      ),
    ).rejects.toMatchObject({ status: 409 })
    expect(test.metaMemoryDelete).not.toHaveBeenCalled()

    test.metaMemoryVerify.mockResolvedValue({
      related_memories: [
        {
          id: 'other-memory',
          status: 'active',
          subject: 'Other',
          summary: 'Changed',
        },
      ],
      recommended_actions: ['upsert', 'none'],
    })
    await expect(
      applyKodyMemoryChange(
        env,
        scope,
        options,
        id,
        {
          token: review.token,
          operationId: '2c315691-247b-4ff4-9419-6cce359243fc',
        },
        signal,
        test.call,
      ),
    ).rejects.toMatchObject({ status: 409 })
    expect(test.metaMemoryDelete).not.toHaveBeenCalled()
  })

  it('soft-deletes only after review, with no hard-delete flag', async () => {
    const test = harness()
    const review = await reviewKodyMemoryChange(
      env,
      scope,
      options,
      id,
      {
        type: 'delete',
        expectedUpdatedAt: original().updated_at,
      },
      signal,
      test.call,
    )
    const changed = await applyKodyMemoryChange(
      env,
      scope,
      options,
      id,
      {
        token: review.token,
        operationId: '9be1c3fd-9829-48fa-ae2b-1079976e701b',
      },
      signal,
      test.call,
    )
    expect(changed.status).toBe('deleted')
    expect(test.metaMemoryDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        memory_id: id,
        force: false,
        verified_by_agent: true,
      }),
    )
  })
})
