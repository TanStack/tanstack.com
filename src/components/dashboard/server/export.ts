import postgres from 'postgres'
import { z } from 'zod'
import { dashboardDatabaseUrl } from './database'
import { dashboardAssetPrefix, dashboardStorage } from './cache'
import { serverRequestSchema } from '../request'
import { tripCsv } from '../csv'
import { exportStatement, rowSchema } from './queries'

export const exportRequestSchema = z.object({
  request: serverRequestSchema,
  selected: z.boolean(),
})
export async function streamDashboardCsv(
  input: z.infer<typeof exportRequestSchema>,
) {
  const { request } = input
  if (
    !input.selected &&
    !request.day &&
    !request.zone &&
    request.borough === 'All' &&
    !request.grid.query &&
    !request.grid.filters.length &&
    request.grid.sorting.length === 1 &&
    request.grid.sorting[0].id === 'pickup' &&
    !request.grid.sorting[0].desc
  ) {
    const object = await (
      await dashboardStorage()
    )?.get(`${dashboardAssetPrefix}/trips.csv`)
    if (object?.body)
      return new Response(object.body, {
        headers: {
          'Content-Type': 'text/csv;charset=utf-8',
          'Content-Disposition': 'attachment; filename="filtered-trips.csv"',
          'Cache-Control': 'no-store',
          ETag: object.etag,
        },
      })
  }
  const url = await dashboardDatabaseUrl()
  const sql = postgres(url, { max: 1, fetch_types: false, connect_timeout: 10 })
  const statement = exportStatement(input.request, input.selected)
  async function* chunks() {
    try {
      await sql.unsafe('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
      await sql.unsafe("SET LOCAL statement_timeout = '60s'")
      // The initial transaction succeeds before download headers are sent.
      yield tripCsv([]) + '\r\n'
      for await (const batch of sql
        .unsafe(statement.sql, statement.values)
        .cursor(500)) {
        const csv = tripCsv(z.array(rowSchema).parse(batch))
        yield csv.slice(csv.indexOf('\r\n') + 2) + '\r\n'
      }
      await sql.unsafe('COMMIT')
    } finally {
      await sql.unsafe('ROLLBACK').catch(() => {})
      await sql.end()
    }
  }
  const iterator = chunks()
  const encoder = new TextEncoder()
  const first = await iterator.next()
  return new Response(
    new ReadableStream({
      start(controller) {
        if (!first.done) controller.enqueue(encoder.encode(first.value))
      },
      async pull(controller) {
        try {
          const next = await iterator.next()
          if (next.done) controller.close()
          else controller.enqueue(encoder.encode(next.value))
        } catch (error) {
          controller.error(error)
        }
      },
      async cancel() {
        await iterator.return()
        await sql.end()
      },
    }),
    {
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': `attachment; filename="${input.selected ? 'selected' : 'filtered'}-trips.csv"`,
        'Cache-Control': 'no-store',
      },
    },
  )
}
