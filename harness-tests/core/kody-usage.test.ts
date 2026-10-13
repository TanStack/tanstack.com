import { describe, expect, it, vi } from 'vitest'
import {
  KODY_USAGE_CODE,
  projectKodyUsage,
} from '../../src/chat/server/kody-usage'

function moduleMain(code: string, kody: object) {
  const program = code
    .replace("import { kody } from 'kody:runtime'", '')
    .replace('export default async function main', 'async function main')
  return new Function('kody', `${program}\nreturn main`)(
    kody,
  ) as () => Promise<unknown>
}

describe('Kody usage read', () => {
  it('reads Kody limits with the daily and weekly amounts intact', async () => {
    const usageGet = vi.fn(async () => ({
      plan: 'pro',
      day: '2026-09-28',
      weekStart: '2026-09-28',
      resources: [
        {
          resource: 'execute_calls_per_day',
          label: 'execute calls per day',
          group: 'daily',
          kind: 'counter',
          whatCounts: 'MCP execute tool runs today.',
          howToReduce: 'Run fewer calls.',
          current: 885,
          limit: 1500,
          percent: 0.59,
          overEightyPercent: false,
          week: {
            current: 885,
            limit: 4000,
            percent: 0.22125,
            overEightyPercent: false,
          },
        },
        {
          resource: 'email_message_bytes',
          label: 'bytes per email message',
          group: 'limits',
          kind: 'per_unit_max',
          whatCounts: 'Maximum stored MIME bytes.',
          current: 0,
          limit: 786432,
          percent: null,
          overEightyPercent: false,
        },
      ],
      warnings: [],
    }))
    const value = await moduleMain(KODY_USAGE_CODE, { usageGet })()
    expect(usageGet).toHaveBeenCalledWith({})
    const result = projectKodyUsage({ structuredContent: { result: value } })
    expect(result.resources[0]).toMatchObject({
      current: 885,
      limit: 1500,
      percent: 0.59,
      week: { current: 885, limit: 4000, percent: 0.22125 },
    })
    expect(result.resources[1].percent).toBeNull()
    expect(JSON.stringify(result)).not.toContain('howToReduce')
  })

  it('rejects an unsupported account-usage shape', () => {
    expect(() =>
      projectKodyUsage({
        structuredContent: {
          result: {
            plan: 'pro',
            day: '2026-09-28',
            weekStart: '2026-09-28',
            resources: [{ resource: 'execute_calls_per_day', current: -1 }],
          },
        },
      }),
    ).toThrow('unsupported usage data')
  })
})
