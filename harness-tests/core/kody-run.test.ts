import { describe, expect, it } from 'vitest'
import {
  kodyExecutionRunId,
  projectKodyRun,
} from '../../src/chat/server/kody-run'

const id = '2117ab5c-72df-49b8-b685-043409559c2c'

describe('Kody run receipts', () => {
  it('takes the run ID only from a valid execution envelope', () => {
    expect(kodyExecutionRunId({ structuredContent: { runId: id } })).toBe(id)
    expect(
      kodyExecutionRunId({ content: [{ type: 'text', text: id }] }),
    ).toBeUndefined()
    expect(
      kodyExecutionRunId({ structuredContent: { runId: 'invalid' } }),
    ).toBeUndefined()
  })

  it('projects the selected run without copying arbitrary metadata or log fields', () => {
    const logs = Array.from({ length: 51 }, (_, sequence) => ({
      sequence,
      level: 'info',
      message: `Log ${sequence}`,
      fields: { secret: 'do-not-copy' },
    }))
    const result = projectKodyRun(
      {
        structuredContent: {
          result: {
            run: {
              id,
              status: 'success',
              surface: 'execute',
              name: 'skill-list',
              package_id: '@tannerlinsley/skills',
              source_id: 'source-1',
              published_commit: 'abc123',
              started_at: '2026-09-28T00:00:00Z',
              finished_at: '2026-09-28T00:00:01Z',
              duration_ms: 444,
              error_name: null,
              error_message: null,
              log_count: 51,
              metadata: { secret: 'do-not-copy' },
            },
            logs,
          },
        },
      },
      id,
    )
    expect(result).toMatchObject({
      id,
      status: 'success',
      packageId: '@tannerlinsley/skills',
      publishedCommit: 'abc123',
      logCount: 51,
    })
    expect(result.logs).toHaveLength(50)
    expect(result.logs[0].sequence).toBe(1)
    expect(JSON.stringify(result)).not.toContain('do-not-copy')
  })

  it('rejects a different run or a Kody error', () => {
    const run = { id, status: 'success', surface: 'execute' }
    expect(() =>
      projectKodyRun(
        { structuredContent: { result: { run } } },
        '16f96b46-0a91-4f86-9969-6cc5ce669b53',
      ),
    ).toThrow()
    expect(() =>
      projectKodyRun(
        { isError: true, structuredContent: { result: { run } } },
        id,
      ),
    ).toThrow()
  })
})
