import { AsyncLocalStorage } from 'node:async_hooks'
import * as Sentry from '@sentry/tanstackstart-react'

// On deployed Workers this clock advances only on I/O. These spans locate
// waits; platform CPU/wall metrics are required to measure CPU-only work.
// https://developers.cloudflare.com/workers/runtime-apis/performance/
type Timing = { name: string; startMs: number; durationMs: number }
type Timings = {
  startedAt: number
  entries: Array<Timing>
  databaseUsed: boolean
}
const storage = new AsyncLocalStorage<Timings>()
let instanceId: string | undefined
let docsRequests = 0

export function markRequestDatabaseUse() {
  const timings = storage.getStore()
  if (timings) timings.databaseUsed = true
}

export async function timeRequestWork<T>(
  name: string,
  work: () => T | Promise<T>,
): Promise<T> {
  const timings = storage.getStore()
  if (!timings) return work()
  const startedAt = performance.now()
  try {
    return await Sentry.startSpan({ name, op: 'docs.server' }, work)
  } finally {
    timings.entries.push({
      name,
      startMs: startedAt - timings.startedAt,
      durationMs: performance.now() - startedAt,
    })
  }
}

export async function withDocsRequestTimings(
  request: Request,
  work: () => Promise<Response>,
) {
  if (!/^\/[^/]+\/[^/]+\/docs\//.test(new URL(request.url).pathname))
    return work()
  instanceId ??= crypto.randomUUID()
  const workerInstance = instanceId
  const docsRequest = ++docsRequests
  const timings: Timings = {
    startedAt: performance.now(),
    entries: [],
    databaseUsed: false,
  }
  return storage.run(timings, async () => {
    const response = await work()
    const durationMs = performance.now() - timings.startedAt
    const totals = new Map<string, number>()
    for (const entry of timings.entries)
      totals.set(entry.name, (totals.get(entry.name) ?? 0) + entry.durationMs)
    const headers = new Headers(response.headers)
    headers.set(
      'Server-Timing',
      [
        `app_headers;dur=${durationMs.toFixed(1)}`,
        ...Array.from(
          totals,
          ([name, duration]) => `${name};dur=${duration.toFixed(1)}`,
        ),
        `db_used;desc="${timings.databaseUsed}"`,
        `docs_request;desc="${docsRequest}"`,
      ].join(', '),
    )
    console.log(
      JSON.stringify({
        logType: 'docs_timing',
        workerInstance,
        docsRequest,
        phase: 'headers_ready',
        pathname: new URL(request.url).pathname,
        ray: request.headers.get('cf-ray'),
        status: response.status,
        headersReadyMs: durationMs,
        databaseUsed: timings.databaseUsed,
        phases: timings.entries,
      }),
    )
    // This measures work through response creation, not streamed body completion.
    const reader = response.body?.getReader()
    let firstByte = true
    const logBodyPhase = (phase: string) =>
      console.log(
        JSON.stringify({
          logType: 'docs_timing',
          workerInstance,
          docsRequest,
          phase,
          pathname: new URL(request.url).pathname,
          ray: request.headers.get('cf-ray'),
          elapsedMs: performance.now() - timings.startedAt,
          databaseUsed: timings.databaseUsed,
          phases: timings.entries,
        }),
      )
    const body = reader
      ? new ReadableStream<Uint8Array>({
          async pull(controller) {
            try {
              const result = await reader.read()
              if (result.done) {
                logBodyPhase('body_complete')
                controller.close()
              } else {
                if (firstByte) {
                  firstByte = false
                  logBodyPhase('first_body_byte')
                }
                controller.enqueue(result.value)
              }
            } catch (error) {
              logBodyPhase('body_error')
              controller.error(error)
            }
          },
          async cancel(reason) {
            logBodyPhase('body_cancelled')
            await reader.cancel(reason)
          },
        })
      : null
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  })
}
