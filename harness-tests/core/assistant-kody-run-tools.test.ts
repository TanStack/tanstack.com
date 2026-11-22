import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultPolicy } from '../../src/chat/core/types'
import { assistantKodyRunTools } from '../../src/chat/server/assistant-kody-run-tools'
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

beforeEach(() => {
  account.current.mockReset().mockResolvedValue({
    enabled: true,
    fingerprint: 'account-1',
  })
  account.unchanged.mockReset().mockResolvedValue(undefined)
})

describe('assistant Kody run history', () => {
  it('returns a filtered page and preserves the cursor for older runs', async () => {
    const call = vi.fn(async (_env, _user, _tool, args) => ({
      structuredContent: {
        result: {
          runs: [
            {
              id: '2117ab5c-72df-49b8-b685-043409559c2c',
              surface: 'job',
              status: 'error',
              name: 'Daily brief',
              package_id: null,
              job_id: 'job-1',
              started_at: '2026-09-28T09:00:00Z',
              duration_ms: 1000,
              error_name: 'TimeoutError',
              error_triage: null,
              metadata: { secret: 'not-for-assistant' },
            },
          ],
          next_cursor: 'older-page',
        },
      },
    })) as unknown as typeof kodyCall
    const tools = assistantKodyRunTools({
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
    const page = (await tools[0].execute!({
      status: 'error',
      surface: 'job',
    })) as any
    expect(page).toMatchObject({
      ok: true,
      scope: 'kody-account',
      filters: { status: 'error', surface: 'job' },
      page: {
        runs: [
          {
            id: '2117ab5c-72df-49b8-b685-043409559c2c',
            errorName: 'TimeoutError',
          },
        ],
        nextCursor: 'older-page',
      },
      complete: false,
    })
    expect(JSON.stringify(page)).not.toContain('not-for-assistant')
    expect(call).toHaveBeenCalledWith(
      expect.anything(),
      scope.userId,
      'execute',
      expect.objectContaining({
        params: { status: 'error', surface: 'job' },
      }),
      expect.any(AbortSignal),
    )
  })

  it('does not disclose a page after the task changes', async () => {
    let current = true
    const tools = assistantKodyRunTools({
      env: {
        KODY_ORIGIN: 'https://kody.test',
        ENCRYPTION_KEY: 'test-only-encryption-key-with-more-than-32-characters',
      },
      scope,
      options,
      signal: new AbortController().signal,
      call: async () => {
        current = false
        return {
          content: [],
          structuredContent: { result: { runs: [], next_cursor: null } },
        }
      },
      assertCurrent: () => {
        if (!current) throw new Error('Task changed')
      },
    })
    await expect(tools[0].execute!({})).rejects.toThrow('Task changed')
  })
})
