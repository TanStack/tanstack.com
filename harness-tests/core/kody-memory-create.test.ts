import { describe, expect, it, vi } from 'vitest'
import { defaultPolicy } from '../../src/chat/core/types'
import {
  applyKodyMemoryCreate,
  reviewKodyMemoryCreate,
} from '../../src/chat/server/kody-memory-create'
import type { kodyCall } from '../../src/chat/server/kody'
import { KodyConnectionError } from '../../src/chat/server/kody'

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
  KODY_ORIGIN: 'https://kody.test',
  ENCRYPTION_KEY: 'test-only-encryption-key-with-more-than-32-characters',
}
const scope = { workspaceId: 'personal:person-1', userId: 'person-1' }
const options = { policy: defaultPolicy, fixture: false }
const signal = new AbortController().signal
const candidate = {
  subject: 'Response style',
  summary: 'Prefers short answers.',
  details: 'Keep ordinary answers concise.',
}

function moduleMain(code: string, kody: object) {
  const program = code
    .replace("import { kody } from 'kody:runtime'", '')
    .replace('export default async function main', 'async function main')
  return new Function('kody', `${program}\nreturn main`)(kody) as (
    params: Record<string, unknown>,
  ) => Promise<unknown>
}

function harness() {
  let related: Array<Record<string, unknown>> = []
  const metaMemoryVerify = vi.fn(async () => ({
    related_memories: related,
    recommended_actions: ['upsert'],
  }))
  const metaMemoryUpsert = vi.fn(async (input: Record<string, unknown>) => ({
    mode: 'created',
    memory: {
      id: 'new-memory',
      status: 'active',
      subject: input.subject,
      summary: input.summary,
      details: input.details,
      category: null,
      tags: [],
      source_uris: [],
      created_at: '2026-09-28T16:00:00Z',
      updated_at: '2026-09-28T16:00:00Z',
    },
  }))
  const call = vi.fn(async (_env, _user, _tool, args) => ({
    structuredContent: {
      result: await moduleMain(args.code as string, {
        metaMemoryVerify,
        metaMemoryUpsert,
      })(args.params as Record<string, unknown>),
    },
  })) as unknown as typeof kodyCall
  return {
    call,
    metaMemoryVerify,
    metaMemoryUpsert,
    setRelated: (items: Array<Record<string, unknown>>) => {
      related = items
    },
  }
}

describe('native Kody memory creation', () => {
  it('reviews related memories before one account-bound, keyed write', async () => {
    const test = harness()
    test.setRelated([
      {
        id: 'other-memory',
        status: 'active',
        subject: 'Writing preference',
        summary: 'Likes examples.',
      },
    ])
    const review = await reviewKodyMemoryCreate(
      env,
      scope,
      options,
      candidate,
      signal,
      test.call,
    )
    expect(review.related).toEqual([
      {
        id: 'other-memory',
        status: 'active',
        subject: 'Writing preference',
        summary: 'Likes examples.',
      },
    ])
    expect(test.metaMemoryUpsert).not.toHaveBeenCalled()

    const memory = await applyKodyMemoryCreate(
      env,
      scope,
      options,
      review.token,
      signal,
      test.call,
    )
    expect(memory).toMatchObject({
      id: 'new-memory',
      status: 'active',
      summary: candidate.summary,
    })
    expect(test.metaMemoryVerify).toHaveBeenCalledTimes(2)
    expect(test.metaMemoryUpsert).toHaveBeenCalledOnce()
    expect(test.metaMemoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        ...candidate,
        verified_by_agent: true,
        verification_reference: expect.any(String),
      }),
    )
    const applyArgs = vi.mocked(test.call).mock.calls[1]?.[3]
    const params = applyArgs?.params
    if (!params || typeof params !== 'object' || !('operationId' in params))
      throw new Error('Missing memory operation identity')
    expect(applyArgs?.idempotencyKey).toBe(
      `banks-memory-create-${params.operationId}`,
    )
  })

  it('does not create an identical active memory', async () => {
    const test = harness()
    test.setRelated([
      {
        id: 'existing-memory',
        status: 'active',
        subject: candidate.subject,
        summary: candidate.summary,
      },
    ])
    const review = await reviewKodyMemoryCreate(
      env,
      scope,
      options,
      candidate,
      signal,
      test.call,
    )
    expect(review.duplicateId).toBe('existing-memory')
    await expect(
      applyKodyMemoryCreate(
        env,
        scope,
        options,
        review.token,
        signal,
        test.call,
      ),
    ).rejects.toMatchObject({ status: 409 })
    expect(test.metaMemoryUpsert).not.toHaveBeenCalled()
  })

  it('rejects a changed verification and a token from another account', async () => {
    const test = harness()
    const review = await reviewKodyMemoryCreate(
      env,
      scope,
      options,
      candidate,
      signal,
      test.call,
    )
    await expect(
      applyKodyMemoryCreate(
        env,
        { ...scope, userId: 'person-2' },
        options,
        review.token,
        signal,
        test.call,
      ),
    ).rejects.toMatchObject({ status: 409 })
    test.setRelated([
      {
        id: 'new-related-memory',
        status: 'active',
        subject: 'Response style',
        summary: 'Another preference.',
      },
    ])
    await expect(
      applyKodyMemoryCreate(
        env,
        scope,
        options,
        review.token,
        signal,
        test.call,
      ),
    ).rejects.toMatchObject({ status: 409 })
    expect(test.metaMemoryUpsert).not.toHaveBeenCalled()
  })

  it('keeps the reviewed token after an uncertain transport outcome and retries with the same key', async () => {
    const test = harness()
    const review = await reviewKodyMemoryCreate(
      env,
      scope,
      options,
      candidate,
      signal,
      test.call,
    )
    vi.mocked(test.call).mockRejectedValueOnce(
      new KodyConnectionError('The connection ended.'),
    )
    await expect(
      applyKodyMemoryCreate(
        env,
        scope,
        options,
        review.token,
        signal,
        test.call,
      ),
    ).rejects.toMatchObject({ status: 502 })
    const saved = await applyKodyMemoryCreate(
      env,
      scope,
      options,
      review.token,
      signal,
      test.call,
    )
    expect(saved.id).toBe('new-memory')
    const calls = vi.mocked(test.call).mock.calls
    expect(calls[1]?.[3].idempotencyKey).toBe(calls[2]?.[3].idempotencyKey)
    expect(test.metaMemoryUpsert).toHaveBeenCalledOnce()
  })
})
