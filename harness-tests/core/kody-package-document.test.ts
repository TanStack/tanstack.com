import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultPolicy } from '../../src/chat/core/types'
import { readKodyPackageDocument } from '../../src/chat/server/kody-package-document'
import type { kodyReferenceAccount } from '../../src/chat/server/kody-reference-access'
import type { kodyCall } from '../../src/chat/server/kody'

const access = vi.hoisted(() => ({
  before: vi.fn<typeof kodyReferenceAccount>(async () => ({
    enabled: true as const,
    fingerprint: 'account-1',
    policyText: '{}',
    subject: 'person-1',
  })),
  unchanged: vi.fn(async () => undefined),
}))
vi.mock('../../src/chat/server/kody-reference-access', () => ({
  kodyReferenceAccount: access.before,
  assertKodyReferenceAccountUnchanged: access.unchanged,
}))

const packageId = '149fd608-2ec1-4da1-9d93-f85816d74ccc'
const otherId = '9faee978-8a5d-4d97-84e4-546ff2ef7b8b'
const scope = { workspaceId: 'workspace-1', userId: 'person-1' }
const options = { policy: defaultPolicy, fixture: false }
const signal = new AbortController().signal
const env = { KODY_ORIGIN: 'https://kody.codes', ENCRYPTION_KEY: 'test-key' }

function index(overrides: Record<string, unknown> = {}) {
  return {
    structuredContent: {
      result: {
        kind: 'entity',
        type: 'package',
        detailMode: 'index',
        packageId,
        kodyId: 'slack',
        name: '@example/slack',
        readmeIntent: { path: 'docs/README.md' },
        agentsDocs: { path: 'AGENTS.md' },
        ...overrides,
      },
    },
  }
}

function file(path: string, overrides: Record<string, unknown> = {}) {
  return {
    structuredContent: {
      result: {
        kind: 'entity',
        type: 'package',
        detailMode: 'file',
        packageId,
        path,
        content: '# Setup\nConnect the service.',
        truncated: false,
        ...overrides,
      },
    },
  }
}

beforeEach(() => {
  access.before.mockClear()
  access.unchanged.mockClear()
})

describe('native Kody package documents', () => {
  it('reads only the package-declared README and rechecks account access', async () => {
    const call = vi.fn(async (_env, _user, _tool, args) =>
      args.entity === `package:${packageId}` ? index() : file('docs/README.md'),
    ) as unknown as typeof kodyCall
    const result = await readKodyPackageDocument(
      env,
      scope,
      options,
      packageId,
      'readme',
      signal,
      call,
    )
    expect(result).toEqual({
      path: 'docs/README.md',
      content: '# Setup\nConnect the service.',
      excerpted: false,
    })
    expect(vi.mocked(call).mock.calls.map((entry) => entry[3].entity)).toEqual([
      `package:${packageId}`,
      `package:${packageId}#docs/README.md`,
    ])
    expect(access.unchanged).toHaveBeenCalledOnce()
  })

  it('reads root agent instructions and marks bounded content', async () => {
    const call = vi.fn(async (_env, _user, _tool, args) =>
      args.entity === `package:${packageId}`
        ? index()
        : file('AGENTS.md', { content: 'a'.repeat(22000) }),
    ) as unknown as typeof kodyCall
    const result = await readKodyPackageDocument(
      env,
      scope,
      options,
      packageId,
      'agents',
      signal,
      call,
    )
    expect(result.path).toBe('AGENTS.md')
    expect(result.content).toHaveLength(20000)
    expect(result.excerpted).toBe(true)
  })

  it('rejects unsafe paths and changed package or file identities', async () => {
    const unsafe = vi.fn(async () =>
      index({ readmeIntent: { path: '../private.txt' } }),
    ) as unknown as typeof kodyCall
    await expect(
      readKodyPackageDocument(
        env,
        scope,
        options,
        packageId,
        'readme',
        signal,
        unsafe,
      ),
    ).rejects.toThrow('no readable document')
    expect(unsafe).toHaveBeenCalledOnce()

    const switched = vi.fn(async () =>
      index({ packageId: otherId }),
    ) as unknown as typeof kodyCall
    await expect(
      readKodyPackageDocument(
        env,
        scope,
        options,
        packageId,
        'readme',
        signal,
        switched,
      ),
    ).rejects.toThrow('package changed')
    expect(switched).toHaveBeenCalledOnce()

    const wrongFile = vi.fn(async (_env, _user, _tool, args) =>
      args.entity === `package:${packageId}` ? index() : file('AGENTS.md'),
    ) as unknown as typeof kodyCall
    await expect(
      readKodyPackageDocument(
        env,
        scope,
        options,
        packageId,
        'readme',
        signal,
        wrongFile,
      ),
    ).rejects.toThrow('document changed')
  })

  it('does not read when Kody is disabled and rejects access changed during the read', async () => {
    access.before.mockResolvedValueOnce({
      enabled: false,
      reason: 'blocked',
      policyText: '{}',
      subject: 'person-1',
    })
    const call = vi.fn(async (_env, _user, _tool, args) =>
      args.entity === `package:${packageId}` ? index() : file('docs/README.md'),
    ) as unknown as typeof kodyCall
    await expect(
      readKodyPackageDocument(
        env,
        scope,
        options,
        packageId,
        'readme',
        signal,
        call,
      ),
    ).rejects.toThrow('disabled')
    expect(call).not.toHaveBeenCalled()

    access.unchanged.mockRejectedValueOnce(
      new Error('Kody connection or access changed. Try again.'),
    )
    await expect(
      readKodyPackageDocument(
        env,
        scope,
        options,
        packageId,
        'readme',
        signal,
        call,
      ),
    ).rejects.toThrow('Kody connection or access changed')
  })
})
