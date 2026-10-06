import { describe, expect, it, vi } from 'vitest'
import {
  KODY_RUN_HISTORY_CODE,
  projectKodyRunHistory,
} from '../../src/chat/server/kody-run-history'
import { KODY_INTERNAL_READ_PREFIX } from '../../src/chat/server/kody-internal-read'

const id = '2117ab5c-72df-49b8-b685-043409559c2c'
const run = {
  id,
  surface: 'execute',
  status: 'error',
  name: 'Morning brief',
  package_id: '@example/brief',
  job_id: null,
  started_at: '2026-09-28T09:00:00Z',
  duration_ms: 1000,
  error_name: 'TimeoutError',
  error_triage: 'resolved',
  metadata: { token: 'do-not-copy' },
  idempotency_key: null,
}

describe('Kody run history', () => {
  it('limits triage queries to errors because upstream triage does not exclude successful runs', async () => {
    const runList = vi.fn(async () => ({ runs: [], next_cursor: null }))
    const main = new Function(
      'kody',
      KODY_RUN_HISTORY_CODE.replace(
        "import { kody } from 'kody:runtime'",
        '',
      ).replace('export default async function main', 'async function main') +
        '\nreturn main',
    )({ runList })
    for (const triage of ['open', 'ignored', 'resolved']) {
      await main({ triage })
      expect(runList).toHaveBeenLastCalledWith({
        limit: 25,
        error_triage: triage,
        status: 'error',
      })
    }
    await main({ triage: 'all', status: 'success' })
    expect(runList).toHaveBeenLastCalledWith({
      limit: 25,
      error_triage: 'all',
      status: 'success',
    })
  })
  it('pages past maintenance runs without losing the Kody cursor or copying payloads', async () => {
    const internal = Array.from({ length: 25 }, (_, index) => ({
      ...run,
      id: `internal-${index}`,
      idempotency_key: `${KODY_INTERNAL_READ_PREFIX}${index}`,
    }))
    const runList = vi.fn(async ({ cursor, status, error_triage }: any) =>
      cursor
        ? { runs: [run], next_cursor: 'page-3' }
        : { runs: internal, next_cursor: 'page-2' },
    )
    const program = KODY_RUN_HISTORY_CODE.replace(
      "import { kody } from 'kody:runtime'",
      '',
    ).replace('export default async function main', 'async function main')
    const main = new Function('kody', `${program}\nreturn main`)({
      runList,
    }) as (params: unknown) => Promise<unknown>
    const page = projectKodyRunHistory({
      structuredContent: {
        result: await main({ status: 'error' }),
      },
    })
    expect(runList).toHaveBeenNthCalledWith(1, {
      limit: 25,
      error_triage: 'all',
      status: 'error',
    })
    expect(runList).toHaveBeenNthCalledWith(2, {
      limit: 25,
      error_triage: 'all',
      status: 'error',
      cursor: 'page-2',
    })
    expect(page).toMatchObject({
      runs: [
        {
          id,
          status: 'error',
          errorName: 'TimeoutError',
          errorTriage: 'resolved',
        },
      ],
      nextCursor: 'page-3',
    })
    expect(JSON.stringify(page)).not.toContain('do-not-copy')
  })

  it('rejects a malformed page instead of presenting incomplete history', () => {
    expect(() =>
      projectKodyRunHistory({ structuredContent: { result: { runs: [run] } } }),
    ).not.toThrow()
    expect(() =>
      projectKodyRunHistory({
        structuredContent: { result: { runs: [{ ...run, id: 'bad' }] } },
      }),
    ).toThrow('unsupported run page')
    expect(() => projectKodyRunHistory({ isError: true })).toThrow()
  })
})
