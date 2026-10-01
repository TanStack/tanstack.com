import { z } from 'zod'
import {
  executionSessionCommandSchema,
  executionSnapshotUploadSchema,
  maxExecutionResponseBytes,
  type ExecutionSnapshotUpload,
  type ExecutionIdentity,
  type ExecutionSessionCommand,
  type ExecutionSessionHistory,
  type ExecutionSessionSnapshot,
} from '../core/execution-sessions'
import {
  parseExecutionSessionHistory,
  parseExecutionSnapshot,
} from '../core/execution-snapshot'
import {
  executionEventPageSchema,
  executionEventReadSchema,
  type ExecutionEventPage,
  type ExecutionEventRead,
} from '../core/execution-events'
import {
  inspectProjectSnapshot,
  maxProjectSnapshotBytes,
  projectSnapshotRecordSchema,
  type ProjectSnapshotRecord,
} from '../core/execution-project-snapshot'

export class ExecutionHttpError extends Error {
  constructor(
    readonly status: number | null,
    message: string,
    readonly uncertain: boolean,
  ) {
    super(message)
    this.name = 'ExecutionHttpError'
  }
}
export type ExecutionHttpOptions = {
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
  backoffMs?: number
}
export type ExecutionHttp = {
  command(
    input: ExecutionSessionCommand,
    signal?: AbortSignal,
  ): Promise<ExecutionSessionSnapshot>
  snapshot(signal?: AbortSignal): Promise<ExecutionSessionSnapshot>
  history(signal?: AbortSignal): Promise<ExecutionSessionHistory>
  session(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<ExecutionSessionSnapshot>
  events(
    read: ExecutionEventRead,
    signal?: AbortSignal,
  ): Promise<ExecutionEventPage>
  uploadSnapshot(
    input: ExecutionSnapshotUpload,
    bytes: Uint8Array,
    signal?: AbortSignal,
  ): Promise<ExecutionSessionSnapshot>
  projectSnapshot(
    snapshotId: string,
    signal?: AbortSignal,
  ): Promise<ProjectSnapshotRecord>
  snapshotBytes(
    record: ProjectSnapshotRecord,
    signal?: AbortSignal,
  ): Promise<Uint8Array<ArrayBuffer>>
}
const sessionIdSchema = z.uuid()

/** One transport owns one immutable conversation scope, never the current route. */
export function createExecutionHttp(
  identity: ExecutionIdentity,
  options: ExecutionHttpOptions = {},
): ExecutionHttp {
  if (
    !identity ||
    Object.keys(identity).sort().join(',') !==
      'botId,conversationId,userId,workspaceId' ||
    Object.values(identity).some(
      (value) =>
        typeof value !== 'string' || value.length < 1 || value.length > 1000,
    )
  ) {
    throw new ExecutionHttpError(null, 'Invalid execution conversation.', false)
  }
  const scope = Object.freeze({ ...identity })
  let endpoint: string
  try {
    endpoint = `/api/chat/conversations/${encodeURIComponent(scope.conversationId)}/execution`
  } catch {
    throw new ExecutionHttpError(null, 'Invalid execution conversation.', false)
  }
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis)
  const timeoutMs = options.timeoutMs ?? 10_000
  const backoffMs = options.backoffMs ?? 250
  if (
    !Number.isFinite(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 30_000 ||
    !Number.isFinite(backoffMs) ||
    backoffMs < 0 ||
    backoffMs > 5_000
  ) {
    throw new ExecutionHttpError(
      null,
      'Invalid execution transport limits.',
      false,
    )
  }

  async function request<T>(
    body: string | Uint8Array<ArrayBuffer> | undefined,
    signal: AbortSignal | undefined,
    parse: (value: unknown) => T,
    url = endpoint,
    transfer: {
      raw?: boolean
      maxBytes?: number
      headers?: Record<string, string>
    } = {},
  ): Promise<T> {
    const scopedUrl = new URL(url, 'https://tanstack.com')
    scopedUrl.searchParams.set('workspaceId', scope.workspaceId)
    const requestUrl = scopedUrl.pathname + scopedUrl.search
    const responseLimit = transfer.maxBytes ?? maxExecutionResponseBytes
    let uncertain = false
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal?.aborted)
        throw new ExecutionHttpError(
          null,
          'Execution request cancelled.',
          uncertain,
        )
      const previousUncertain = uncertain
      const controller = new AbortController()
      let status: number | null = null
      let timedOut = false
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
      let rejectAborted: (error: ExecutionHttpError) => void = () => {}
      const aborted = new Promise<never>((_, reject) => {
        rejectAborted = reject
      })
      const abort = () => {
        controller.abort()
        void reader?.cancel().catch(() => {})
        rejectAborted(
          new ExecutionHttpError(
            status,
            timedOut
              ? 'Execution request timed out.'
              : 'Execution request cancelled.',
            uncertain,
          ),
        )
      }
      const callerAbort = () => abort()
      signal?.addEventListener('abort', callerAbort, { once: true })
      const timer = setTimeout(() => {
        timedOut = true
        abort()
      }, timeoutMs)
      let retry = false
      try {
        // Once sent, a lost response cannot tell us whether a mutation committed.
        if (body !== undefined) uncertain = true
        const pendingResponse = Promise.resolve().then(() =>
          fetcher(requestUrl, {
            method:
              body === undefined
                ? 'GET'
                : typeof body === 'string'
                  ? 'POST'
                  : 'PUT',
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            headers:
              transfer.headers ??
              (body === undefined
                ? undefined
                : { 'Content-Type': 'application/json' }),
            body,
            signal: controller.signal,
          }),
        )
        // A non-cooperative fetch can resolve after its deadline. Do not retain
        // that late response or let it reenter the owner's state machine.
        void pendingResponse.then(
          (response) => {
            if (controller.signal.aborted)
              void response.body?.cancel().catch(() => {})
          },
          () => {},
        )
        const response = await Promise.race([pendingResponse, aborted])
        status = response.status
        if (controller.signal.aborted)
          throw new ExecutionHttpError(
            status,
            timedOut
              ? 'Execution request timed out.'
              : 'Execution request cancelled.',
            uncertain,
          )
        if (!response.ok) {
          // Never reflect the server body, and preserve auth status even for HTML.
          void response.body?.cancel().catch(() => {})
          retry = status >= 500 && status <= 599
          throw new ExecutionHttpError(
            status,
            statusMessage(status),
            retry ? uncertain : previousUncertain,
          )
        }
        const length = response.headers.get('content-length')
        if (
          length !== null &&
          (!/^\d+$/.test(length) || Number(length) > responseLimit)
        ) {
          void response.body?.cancel().catch(() => {})
          throw new ExecutionHttpError(
            status,
            'Execution response exceeds its size limit.',
            uncertain,
          )
        }
        const chunks: Uint8Array[] = []
        let bytes = 0
        reader = response.body?.getReader()
        if (!reader)
          throw new ExecutionHttpError(
            status,
            'Execution response is invalid.',
            uncertain,
          )
        while (true) {
          const chunk = await Promise.race([reader.read(), aborted])
          if (controller.signal.aborted)
            throw new ExecutionHttpError(
              status,
              timedOut
                ? 'Execution request timed out.'
                : 'Execution request cancelled.',
              uncertain,
            )
          if (chunk.done) break
          bytes += chunk.value.byteLength
          if (bytes > responseLimit) {
            void reader.cancel().catch(() => {})
            throw new ExecutionHttpError(
              status,
              'Execution response exceeds its size limit.',
              uncertain,
            )
          }
          chunks.push(chunk.value)
        }
        const buffer = new Uint8Array(bytes)
        let offset = 0
        for (const chunk of chunks) {
          buffer.set(chunk, offset)
          offset += chunk.byteLength
        }
        let value: unknown
        try {
          value = transfer.raw
            ? buffer
            : JSON.parse(
                new TextDecoder('utf-8', { fatal: true }).decode(buffer),
              )
          return parse(value)
        } catch {
          throw new ExecutionHttpError(
            status,
            'The execution response is invalid for this conversation.',
            uncertain,
          )
        }
      } catch (error) {
        if (error instanceof ExecutionHttpError) {
          if (signal?.aborted || !retry || attempt === 2) throw error
        } else {
          // Fetch and body-stream failures are transport failures, not guest results.
          retry = true
          if (signal?.aborted || attempt === 2)
            throw new ExecutionHttpError(
              status,
              'Execution request could not be completed.',
              uncertain,
            )
        }
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', callerAbort)
        try {
          reader?.releaseLock()
        } catch {}
      }
      if (retry && backoffMs) await wait(backoffMs, signal, uncertain)
    }
    throw new ExecutionHttpError(
      null,
      'Execution request could not be completed.',
      uncertain,
    )
  }

  function validateRecord(value: unknown, snapshotId?: string) {
    const record = projectSnapshotRecordSchema.parse(value)
    if (
      record.state !== 'ready' ||
      (snapshotId && record.snapshotId !== snapshotId) ||
      Object.entries(scope).some(
        ([key, value]) =>
          record.identity[key as keyof ExecutionIdentity] !== value,
      )
    )
      throw new Error('Unexpected project snapshot scope.')
    return record
  }

  return {
    command(input, signal) {
      const parsed = executionSessionCommandSchema.safeParse(input)
      if (!parsed.success)
        return Promise.reject(
          new ExecutionHttpError(null, 'Invalid execution command.', false),
        )
      // All attempts use this exact serialization, including UUID, CAS and proof.
      return request(JSON.stringify(parsed.data), signal, (value) => {
        const snapshot = parseExecutionSnapshot(value, scope)
        if (
          !snapshot.session ||
          ('sessionId' in parsed.data &&
            snapshot.session.id !== parsed.data.sessionId)
        )
          throw new Error('Unexpected execution session.')
        return snapshot
      })
    },
    snapshot: (signal) =>
      request(undefined, signal, (value) =>
        parseExecutionSnapshot(value, scope),
      ),
    history: (signal) =>
      request(
        undefined,
        signal,
        (value) => parseExecutionSessionHistory(value, scope),
        `${endpoint}?history=1`,
      ),
    session(sessionId, signal) {
      const parsed = sessionIdSchema.safeParse(sessionId)
      if (!parsed.success)
        return Promise.reject(
          new ExecutionHttpError(null, 'Invalid execution session.', false),
        )
      const query = new URLSearchParams({ sessionId: parsed.data })
      return request(
        undefined,
        signal,
        (value) => {
          const snapshot = parseExecutionSnapshot(value, scope)
          if (!snapshot.session || snapshot.session.id !== parsed.data)
            throw new Error('Unexpected execution session.')
          return snapshot
        },
        `${endpoint}?${query}`,
      )
    },
    events(read, signal) {
      const parsed = executionEventReadSchema.safeParse(read)
      if (!parsed.success)
        return Promise.reject(
          new ExecutionHttpError(
            null,
            'Invalid execution event cursor.',
            false,
          ),
        )
      const cursor = parsed.data
      const query = new URLSearchParams({
        sessionId: cursor.sessionId,
        after: String(cursor.after),
      })
      return request(
        undefined,
        signal,
        (value) => {
          const page = executionEventPageSchema.parse(value)
          if (
            page.sessionId !== cursor.sessionId ||
            page.after !== cursor.after
          )
            throw new Error('Unexpected execution event scope.')
          return page
        },
        `${endpoint}?${query}`,
      )
    },
    async uploadSnapshot(input, source, signal) {
      const parsed = executionSnapshotUploadSchema.parse(input)
      if (
        !(source instanceof Uint8Array) ||
        source.byteLength > maxProjectSnapshotBytes
      )
        throw new ExecutionHttpError(
          null,
          'The project snapshot exceeds its byte limit.',
          false,
        )
      const bytes = source.slice()
      const metadata = await inspectProjectSnapshot(bytes)
      if (
        Object.entries(metadata).some(
          ([key, value]) =>
            parsed.snapshot[key as keyof typeof parsed.snapshot] !== value,
        )
      )
        throw new ExecutionHttpError(
          null,
          'The project snapshot bytes do not match its metadata.',
          false,
        )
      return request(
        bytes,
        signal,
        (value) => {
          const snapshot = parseExecutionSnapshot(value, scope)
          if (!snapshot.session || snapshot.session.id !== parsed.sessionId)
            throw new Error('Unexpected project snapshot session.')
          const record = validateRecord(
            snapshot.savedSnapshots.find(
              (item) => item.snapshotId === parsed.snapshot.snapshotId,
            ),
            parsed.snapshot.snapshotId,
          )
          if (
            record.sessionId !== parsed.sessionId ||
            record.hostGeneration !== parsed.hostGeneration ||
            record.runtimeId !== parsed.runtimeId ||
            record.commandDigest !== parsed.digest ||
            Object.entries(parsed.snapshot).some(
              ([key, value]) => record[key as keyof typeof record] !== value,
            )
          )
            throw new Error('Unexpected project snapshot receipt.')
          return snapshot
        },
        `${endpoint}/snapshots/${parsed.snapshot.snapshotId}`,
        {
          headers: {
            'Content-Type': 'application/octet-stream',
            'x-gum-execution-snapshot': JSON.stringify(parsed),
          },
        },
      )
    },
    projectSnapshot(snapshotId, signal) {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          snapshotId,
        )
      )
        return Promise.reject(
          new ExecutionHttpError(null, 'Invalid project snapshot.', false),
        )
      return request(
        undefined,
        signal,
        (value) => validateRecord(value, snapshotId),
        `${endpoint}/snapshots/${snapshotId}?metadata=1`,
      )
    },
    async snapshotBytes(input, signal) {
      const record = validateRecord(input)
      const bytes = await request(
        undefined,
        signal,
        (value) => value as Uint8Array<ArrayBuffer>,
        `${endpoint}/snapshots/${record.snapshotId}`,
        { raw: true, maxBytes: maxProjectSnapshotBytes },
      )
      const metadata = await inspectProjectSnapshot(bytes)
      if (
        Object.entries(metadata).some(
          ([key, value]) => record[key as keyof typeof record] !== value,
        )
      )
        throw new ExecutionHttpError(
          200,
          'The saved project does not match its recorded bytes.',
          false,
        )
      return bytes
    },
  }
}

function statusMessage(status: number) {
  if (status === 401) return 'Sign in to continue execution.'
  if (status === 403) return 'Execution access is no longer available.'
  if (status === 404) return 'This execution conversation is unavailable.'
  if (status === 409)
    return 'Execution state changed. Reload its current state.'
  if (status === 429) return 'Execution has reached its limit.'
  if (status >= 500) return 'Execution service is unavailable.'
  return 'Execution request was rejected.'
}

function wait(
  ms: number,
  signal: AbortSignal | undefined,
  uncertain: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      reject(
        new ExecutionHttpError(null, 'Execution request cancelled.', uncertain),
      )
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, ms)
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
  })
}
