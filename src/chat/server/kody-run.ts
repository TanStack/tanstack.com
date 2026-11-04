import type { KodyEnvironment } from './kody'
import { z } from 'zod'
import { kodyRunSchema, type KodyRun } from '../core/kody-run'
import { KodyConnectionError, kodyCall } from './kody'
import { kodyInternalReadArgs } from './kody-internal-read'

export class KodyRunError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message)
    this.name = 'KodyRunError'
  }
}

const idSchema = z.uuid()
const runGetCode = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const value = await kody.runGet({ run_id: params.runId })
  const runFields = ['id', 'status', 'surface', 'name', 'package_id', 'source_id', 'published_commit', 'started_at', 'finished_at', 'duration_ms', 'error_name', 'error_message', 'error_triage', 'log_count']
  const run = Object.fromEntries(runFields.map(field => [field, typeof value.run?.[field] === 'string' ? value.run[field].slice(0, field === 'error_message' ? 2000 : 300) : value.run?.[field]]))
  const logs = Array.isArray(value.logs) ? value.logs.slice(-20).map(log => ({ sequence: log.sequence, level: log.level, message: typeof log.message === 'string' ? log.message.slice(0, 500) : log.message })) : []
  return { run, logs }
}`

export function kodyExecutionRunId(raw: unknown): string | undefined {
  const value = z
    .object({
      structuredContent: z.object({ runId: idSchema.optional() }).optional(),
    })
    .safeParse(raw)
  return value.success ? value.data.structuredContent?.runId : undefined
}

export function projectKodyRun(raw: unknown, requestedId: string): KodyRun {
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({ result: z.unknown() }),
    })
    .safeParse(raw)
  if (!envelope.success || envelope.data.isError)
    throw new KodyRunError('Kody could not read this run.')
  const parsed = z
    .object({
      run: z.object({
        id: idSchema,
        status: z.string(),
        surface: z.string(),
        name: z.string().nullish(),
        package_id: z.string().nullish(),
        source_id: z.string().nullish(),
        published_commit: z.string().nullish(),
        started_at: z.string().nullish(),
        finished_at: z.string().nullish(),
        duration_ms: z.number().nullish(),
        error_triage: z.enum(['ignored', 'resolved']).nullish(),
        error_name: z.string().nullish(),
        error_message: z.string().nullish(),
        log_count: z.number().int().nonnegative().nullish(),
      }),
      logs: z
        .array(
          z.object({
            sequence: z.number().int().nonnegative(),
            level: z.string(),
            message: z.string(),
          }),
        )
        .default([]),
    })
    .safeParse(envelope.data.structuredContent.result)
  if (!parsed.success || parsed.data.run.id !== requestedId)
    throw new KodyRunError('Kody returned an unsupported run record.')
  const { run, logs } = parsed.data
  return kodyRunSchema.parse({
    id: run.id,
    status: run.status.slice(0, 80),
    surface: run.surface.slice(0, 80),
    name: run.name?.slice(0, 200) ?? null,
    packageId: run.package_id?.slice(0, 300) ?? null,
    sourceId: run.source_id?.slice(0, 300) ?? null,
    publishedCommit: run.published_commit?.slice(0, 200) ?? null,
    startedAt: run.started_at?.slice(0, 100) ?? null,
    finishedAt: run.finished_at?.slice(0, 100) ?? null,
    durationMs: run.duration_ms ?? null,
    errorTriage: run.error_triage ?? 'open',
    errorName: run.error_name?.slice(0, 200) ?? null,
    errorMessage: run.error_message?.slice(0, 2000) ?? null,
    logCount: run.log_count ?? logs.length,
    logs: logs.slice(-50).map((log) => ({
      sequence: log.sequence,
      level: log.level.slice(0, 30),
      message: log.message.slice(0, 1000),
    })),
  })
}

export async function readKodyRun(
  env: KodyEnvironment,
  userId: string,
  runId: string,
  signal: AbortSignal,
) {
  if (!idSchema.safeParse(runId).success)
    throw new KodyRunError('Choose a valid Kody run.', 400)
  try {
    return projectKodyRun(
      await kodyCall(
        env,
        userId,
        'execute',
        kodyInternalReadArgs({
          code: runGetCode,
          params: { runId },
          responseLimit: 20000,
        }),
        signal,
      ),
      runId,
    )
  } catch (error) {
    if (error instanceof KodyConnectionError)
      throw new KodyRunError(error.message, 409)
    if (error instanceof KodyRunError) throw error
    throw new KodyRunError('Kody run could not be checked right now.')
  }
}
