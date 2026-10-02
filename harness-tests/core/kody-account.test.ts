import { describe, expect, it, vi } from 'vitest'
import {
  KODY_ACCOUNT_CODE,
  projectKodyAccount,
  projectKodyMemories,
} from '../../src/chat/server/kody-account'
import { KODY_INTERNAL_READ_PREFIX } from '../../src/chat/server/kody-internal-read'

const wrap = (result: unknown) => ({ structuredContent: { result } })

describe('Kody account projection', () => {
  it('pages past TanChat background reads while keeping user and other-host runs', async () => {
    const internal = Array.from({ length: 100 }, (_, index) => ({
      id: `internal-${index}`,
      idempotency_key: `${KODY_INTERNAL_READ_PREFIX}${index}`,
    }))
    const external = {
      id: 'external-run',
      surface: 'execute',
      status: 'success',
      name: null,
      package_id: null,
      source_id: null,
      published_commit: null,
      started_at: '2026-09-28T00:00:00Z',
      duration_ms: 100,
      idempotency_key: null,
    }
    const userAction = {
      ...external,
      id: 'user-action',
      idempotency_key: 'gum-answer-request-1',
    }
    const runList = vi.fn(async ({ cursor }: { cursor?: string }) =>
      cursor
        ? { runs: [external, userAction], next_cursor: null }
        : { runs: internal, next_cursor: 'page-2' },
    )
    const program = KODY_ACCOUNT_CODE.replace(
      "import { kody } from 'kody:runtime'",
      '',
    ).replace('export default async function main', 'async function main')
    const main = new Function('kody', `${program}\nreturn main`)({
      runList,
    }) as (params: { sources: string[] }) => Promise<unknown>
    const account = projectKodyAccount(
      wrap(await main({ sources: ['runList'] })),
      'https://kody.codes',
      ['runs'],
    )
    expect(runList).toHaveBeenCalledTimes(2)
    expect(runList).toHaveBeenNthCalledWith(1, { limit: 100 })
    expect(runList).toHaveBeenNthCalledWith(2, {
      limit: 100,
      cursor: 'page-2',
    })
    expect(account.runs.items.map((run) => run.id)).toEqual([
      'external-run',
      'user-action',
    ])
    expect(JSON.stringify(account)).not.toContain('idempotency_key')
  })

  it('reports more activity when one Kody page contains over ten visible runs', async () => {
    const runs = Array.from({ length: 11 }, (_, index) => ({
      id: `run-${index}`,
      surface: 'execute',
      status: 'success',
      name: null,
      started_at: '2026-09-28T00:00:00Z',
      idempotency_key: null,
    }))
    const program = KODY_ACCOUNT_CODE.replace(
      "import { kody } from 'kody:runtime'",
      '',
    ).replace('export default async function main', 'async function main')
    const main = new Function('kody', `${program}\nreturn main`)({
      runList: async () => ({ runs, next_cursor: null }),
    }) as (params: { sources: string[] }) => Promise<unknown>
    const account = projectKodyAccount(
      wrap(await main({ sources: ['runList'] })),
      'https://kody.codes',
      ['runs'],
    )
    expect(account.runs.items).toHaveLength(10)
    expect(account.runs.more).toBe(true)
  })

  it('keeps account resources distinct and omits run payloads', () => {
    const account = projectKodyAccount(
      wrap({
        metaGetCurrentUser: {
          ok: true,
          value: {
            user_id: 'kody-user',
            display_name: 'Tanner',
            email: 'tanner@example.test',
            private_profile: 'do-not-copy',
          },
        },
        packageList: {
          ok: true,
          value: {
            packages: [
              {
                package_id: 'package-1',
                name: '@tanner/example',
                description: 'Example',
                visibility: 'private',
                updated_at: '2026-09-28T00:00:00Z',
                origin_commit: 'revision-1',
                source_listing_id: 'listing-1',
                listing_name: '@kody/example',
                source: 'do-not-copy',
              },
            ],
          },
        },
        jobList: {
          ok: true,
          value: {
            jobs: [
              {
                id: 'job-1',
                name: 'Morning update',
                source_id: 'source-1',
                published_commit: 'revision-1',
                schedule_summary: 'Every morning',
                enabled: true,
                kill_switch_enabled: false,
                expired: false,
                updated_at: '2026-09-28T00:00:00Z',
                next_run_at: '2026-09-29T08:00:00Z',
                last_run_status: 'success',
                last_run_error: null,
                params: { token: 'do-not-copy' },
              },
            ],
          },
        },
        workflowRunList: {
          ok: true,
          value: {
            workflows: [
              {
                id: 'workflow-1',
                workflow_name: 'Review',
                status: 'running',
                source_id: 'source-1',
                updated_at: '2026-09-28T01:00:00Z',
                last_error: null,
                idempotency_key: 'do-not-copy',
              },
            ],
          },
        },
        runList: {
          ok: true,
          value: {
            runs: [
              {
                id: 'run-1',
                surface: 'execute',
                status: 'success',
                name: 'Example',
                package_id: 'package-1',
                source_id: 'source-1',
                published_commit: 'revision-1',
                started_at: '2026-09-28T01:00:00Z',
                duration_ms: 50,
                error_message: null,
                metadata: { result: 'do-not-copy' },
              },
            ],
            next_cursor: 'next-page',
          },
        },
        integrationList: { ok: true, value: { integrations: [] } },
        mcpServerList: { ok: true, value: { servers: [] } },
        secretList: { ok: true, value: { secrets: [] } },
        waitingSummary: { ok: true, value: { items: [] } },
      }),
      'https://kody.codes',
    )
    expect(account.identity).toMatchObject({
      status: 'ready',
      userId: 'kody-user',
      displayName: 'Tanner',
    })
    expect(account.packages.items[0]).toMatchObject({
      id: 'package-1',
      revision: 'revision-1',
      sourceListing: '@kody/example',
      iconUrl: 'https://kody.codes/community/listing-1/icon/revision-1',
    })
    expect(account.packages.executionReadiness).toBe('not_checked')
    expect(account.jobs.items[0]).toMatchObject({
      id: 'job-1',
      sourceId: 'source-1',
      enabled: true,
    })
    expect(account.workflows.items[0]).toMatchObject({
      id: 'workflow-1',
      status: 'running',
    })
    expect(account.runs).toMatchObject({
      status: 'ready',
      more: true,
      items: [{ id: 'run-1', status: 'success' }],
    })
    expect(JSON.stringify(account)).not.toContain('do-not-copy')
    expect(JSON.stringify(account)).not.toContain('next-page')
  })

  it('keeps integration status, server readiness and setup links distinct', () => {
    const account = projectKodyAccount(
      wrap({
        integrationList: {
          ok: true,
          value: {
            integrations: [
              {
                name: 'Slack',
                usageMode: 'packages',
                tokenUrl: 'secret',
                lastAuthFailure: {
                  title: 'Sign in again',
                  why: 'Grant expired',
                  reconnectHref: 'https://kody.codes/connect/slack',
                },
              },
            ],
          },
        },
        mcpServerList: {
          ok: true,
          value: {
            servers: [
              {
                id: 'server-1',
                name: 'Calendar',
                enabled: true,
                connected: false,
                state: 'needs_auth',
                toolCount: 4,
                updatedAt: '2026-09-28T00:00:00Z',
                error: 'Reconnect',
                authUrl: 'https://example.test/private',
              },
            ],
          },
        },
        secretList: {
          ok: true,
          value: {
            secrets: [
              {
                name: 'SLACK_TOKEN',
                scope: 'personal',
                value: 'super-secret-value',
              },
            ],
          },
        },
        waitingSummary: {
          ok: true,
          value: {
            items: [
              {
                kind: 'integration',
                title: 'Slack needs access',
                href: 'https://evil.example/steal',
                severity: 'block',
              },
            ],
          },
        },
      }),
      'https://kody.codes',
    )
    expect(account.status).toBe('connected')
    expect(account.integrations.items[0].authFailure?.reconnectHref).toBe(
      'https://kody.codes/connect/slack',
    )
    expect(account.servers.items[0]).toMatchObject({
      connected: false,
      toolCount: 4,
    })
    expect(account.secrets.items[0]).toEqual({
      name: 'SLACK_TOKEN',
      scope: 'personal',
      expiresAt: undefined,
    })
    expect(account.waiting.items[0].href).toBeUndefined()
    expect(JSON.stringify(account)).not.toContain('super-secret-value')
    expect(JSON.stringify(account)).not.toContain(
      'https://example.test/private',
    )
  })

  it('does not present a failed source as an empty account', () => {
    const account = projectKodyAccount(
      wrap({
        integrationList: { ok: false },
        mcpServerList: { ok: true, value: { servers: [] } },
        secretList: { ok: false },
        waitingSummary: { ok: false },
      }),
      'https://kody.codes',
    )
    expect(account.integrations.status).toBe('unavailable')
    expect(account.servers.status).toBe('ready')
    expect(account.secrets.status).toBe('unavailable')
    expect(account.waiting.status).toBe('unavailable')
    expect(account.identity.status).toBe('unavailable')
    expect(account.packages.status).toBe('unavailable')
    expect(account.jobs.status).toBe('unavailable')
    expect(account.workflows.status).toBe('unavailable')
    expect(account.runs.status).toBe('unavailable')
  })

  it('keeps unrequested account sections distinct from failed reads', () => {
    const account = projectKodyAccount(
      wrap({
        packageList: {
          ok: true,
          value: {
            packages: [{ package_id: 'package-1', name: '@owner/example' }],
          },
        },
        workflowRunList: { ok: false },
      }),
      'https://kody.codes',
      ['packages', 'workflows'],
    )
    expect(account.packages.status).toBe('ready')
    expect(account.packages.executionReadiness).toBe('not_checked')
    expect(account.workflows.status).toBe('unavailable')
    expect(account.secrets.status).toBe('not_requested')
    expect(account.identity.status).toBe('not_requested')
  })

  it('uses only active, bounded memory summaries', () => {
    expect(
      projectKodyMemories(
        wrap({
          matches: [
            {
              id: 'deleted',
              subject: 'Old',
              summary: 'Ignore',
              status: 'deleted',
            },
            {
              id: 'one',
              subject: 'Preference',
              summary: 'x'.repeat(2000),
              status: 'active',
              details: 'private',
            },
            {
              id: 'two',
              subject: 'Project',
              summary: 'Current',
              status: 'active',
            },
            {
              id: 'three',
              subject: 'Extra',
              summary: 'Skip',
              status: 'active',
            },
          ],
        }),
      ),
    ).toEqual([
      { id: 'one', subject: 'Preference', summary: 'x'.repeat(1200) },
      { id: 'two', subject: 'Project', summary: 'Current' },
    ])
  })
})
