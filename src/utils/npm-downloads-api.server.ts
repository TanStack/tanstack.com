import { z } from 'zod'
import { isNpmPackageName } from './schemas'
import type { fetchNpmDownloadsBulkData } from './stats.server'

const MAX_BODY_BYTES = 8192
const DAY_MS = 86_400_000
const MAX_DAYS = 540

const isoDay = z.string().refine((day) => {
  const date = new Date(day)
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day
  )
})

const inputSchema = z
  .object({
    packages: z
      .array(z.string().max(214).refine(isNpmPackageName))
      .min(1)
      .max(16),
    startDate: isoDay,
    endDate: isoDay,
  })
  .refine(
    ({ startDate, endDate }) =>
      startDate <= endDate &&
      endDate <= new Date().toISOString().slice(0, 10) &&
      Date.parse(endDate) - Date.parse(startDate) < MAX_DAYS * DAY_MS,
  )

export async function readNpmDownloads(
  request: Request,
  load?: typeof fetchNpmDownloadsBulkData,
) {
  let raw: unknown
  try {
    let bytes = 0
    const limited = request.body?.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          bytes += chunk.byteLength
          if (bytes > MAX_BODY_BYTES) throw new Error('Request too large')
          controller.enqueue(chunk)
        },
      }),
    )
    raw = await new Response(limited).json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json(
      { error: 'Expected 1 to 16 npm packages and up to 540 days' },
      { status: 400 },
    )
  }

  const { packages, startDate, endDate } = parsed.data
  const read =
    load ?? (await import('./stats.server')).fetchNpmDownloadsBulkData
  const [group] = await read({
    data: {
      packageGroups: [
        { packages: [...new Set(packages)].map((name) => ({ name })) },
      ],
      startDate,
      endDate,
    },
  })
  return Response.json({
    packages:
      group?.packages.map(({ name, downloads }) => ({ name, downloads })) ?? [],
  })
}
