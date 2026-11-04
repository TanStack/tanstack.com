import { describe, expect, it, vi } from 'vitest'
import type { AssistantTask } from '../../src/chat/core/assistant-task'
import { defaultPolicy } from '../../src/chat/core/types'
import {
  assertKodyIntegrationReady,
  KODY_INTEGRATION_READINESS_CODE,
  missingKodyIntegration,
  projectKodyIntegrationReadiness,
  requiredKodyIntegration,
} from '../../src/chat/server/kody-setup-readiness'

vi.mock('../../src/chat/server/kody-reference-access', () => ({
  kodyReferenceAccount: vi.fn(async () => ({ enabled: true })),
  assertKodyReferenceAccountUnchanged: vi.fn(async () => undefined),
}))

const error = (message: string) => ({
  isError: true,
  content: [{ type: 'text', text: message }],
})

describe('Kody package setup readiness', () => {
  it('uses only an exact missing-integration error from a failed Kody action', () => {
    expect(
      missingKodyIntegration(error('Integration "notes" was not found.')),
    ).toBe('notes')
    expect(
      missingKodyIntegration(
        error(
          'conversationId: e5fpr16ye4kv Error: Integration "slack" was not found.',
        ),
      ),
    ).toBe('slack')
    expect(
      missingKodyIntegration({
        ...error('Integration "notes" was not found.'),
        isError: false,
      }),
    ).toBeUndefined()
    expect(
      missingKodyIntegration(
        error('A page mentioned Integration "notes" was not found.'),
      ),
    ).toBeUndefined()
    expect(
      missingKodyIntegration(error('Integration "notes" needs authorization.')),
    ).toBeUndefined()
  })

  it('binds the prerequisite to the failed package and the guide used for setup', () => {
    const observations = [
      {
        approvalId: 'approved-action',
        title: 'List notes',
        outcome: 'failed' as const,
        result: error('Integration "notes" was not found.'),
        kodyEntity: 'package:notes#./list',
        packageDocumentation: {
          entity: 'package:notes#README.md',
          content: 'Connect at https://example.com/setup',
          excerpted: false,
        },
        missingKodyIntegration: 'notes',
      },
    ] satisfies AssistantTask['observations']
    expect(
      requiredKodyIntegration(
        observations,
        'package:notes#README.md',
        'https://example.com/setup',
      ),
    ).toBe('notes')
    expect(
      requiredKodyIntegration(
        [
          {
            ...observations[0],
            result: error(
              'conversationId: e5fpr16ye4kv Error: Integration "notes" was not found.',
            ),
            missingKodyIntegration: undefined,
          },
        ],
        'package:notes#README.md',
        'https://example.com/setup',
      ),
    ).toBe('notes')
    expect(
      requiredKodyIntegration(
        observations,
        'package:other#README.md',
        'https://example.com/setup',
      ),
    ).toBeUndefined()
    expect(
      requiredKodyIntegration(
        observations,
        'package:notes#README.md',
        'https://example.com/other',
      ),
    ).toBeUndefined()
  })

  it('checks the exact integration name without returning credentials', async () => {
    const program = KODY_INTEGRATION_READINESS_CODE.replace(
      "import { kody } from 'kody:runtime'",
      '',
    ).replace('export default async function main', 'async function main')
    const moduleMain = new Function('kody', `${program}\nreturn main`)({
      integrationGet: async () => ({
        integration: {
          name: 'notes',
          clientId: 'private-client-id',
          lastAuthFailure: { reason: 'provider_rejected' },
        },
      }),
    }) as (params: { name: string }) => Promise<unknown>
    expect(await moduleMain({ name: 'notes' })).toEqual({
      found: true,
      authFailed: true,
    })
    const call = vi.fn().mockResolvedValue({
      structuredContent: { result: { found: false, authFailed: false } },
    })
    const check = () =>
      assertKodyIntegrationReady(
        {
          KODY_ORIGIN: 'https://kody.test',
          ENCRYPTION_KEY:
            'test-only-encryption-key-with-more-than-32-characters',
        },
        'user',
        'workspace',
        defaultPolicy,
        false,
        'notes',
        call,
      )
    await expect(check()).rejects.toThrow(
      'Finish connecting notes in Kody before continuing.',
    )
    call.mockResolvedValueOnce({
      isError: true,
      structuredContent: { result: { found: true, authFailed: false } },
    })
    await expect(check()).rejects.toThrow(
      'Could not check Kody integrations. Try again.',
    )
    call.mockResolvedValueOnce({
      structuredContent: { result: { found: true, authFailed: true } },
    })
    await expect(check()).rejects.toThrow(
      'Kody reports an authentication problem for notes. Check the connection in Kody before continuing.',
    )
    call.mockResolvedValueOnce({
      structuredContent: { result: { found: true, authFailed: false } },
    })
    await expect(check()).resolves.toBeUndefined()
    expect(call).toHaveBeenCalledWith(
      expect.anything(),
      'user',
      'execute',
      expect.objectContaining({
        code: KODY_INTEGRATION_READINESS_CODE,
        params: { name: 'notes' },
      }),
      expect.any(AbortSignal),
    )
    expect(
      projectKodyIntegrationReadiness({
        structuredContent: { result: { found: true, authFailed: false } },
      }),
    ).toEqual({ found: true, authFailed: false })
  })
})
