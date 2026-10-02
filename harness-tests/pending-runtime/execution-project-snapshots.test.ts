import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'
import { handleConversationExecution } from '../../src/chat/server/conversation-execution-http.server'
import {
  bindRuntimeEnv,
  getRuntimeEnv,
  getRuntimeAuth,
  prepareSharedSessionRuntime,
  createSharedSession,
} from './fixtures/shared-session-runtime'
vi.mock('~/auth/index.server', () => ({
  getAuthService: () => getRuntimeAuth(),
}))
vi.mock(import('../../src/server/runtime/host.server'), async (original) => ({
  ...(await original()),
  getHostRuntimeEnv: async () => getRuntimeEnv(),
}))
async function api(request: Request, env: Record<string, unknown>) {
  bindRuntimeEnv(env)
  const match = new URL(request.url).pathname.match(
    /^\/api\/chat\/conversations\/([^/]+)\/execution(?:\/snapshots\/([^/]+))?$/,
  )
  if (!match) return new Response(null, { status: 404 })
  return handleConversationExecution(
    request,
    decodeURIComponent(match[1]),
    match[2] ? decodeURIComponent(match[2]) : undefined,
  )
}
import { executionSnapshotObjectKey } from '../../src/chat/server/execution-project-snapshots'
import {
  decodeProjectSnapshot,
  encodeProjectSnapshot,
  inspectProjectSnapshot,
  maxProjectSnapshotBytes,
} from '../../src/chat/core/execution-project-snapshot'
import {
  browserExecutionRuntime,
  type ExecutionSessionSnapshot,
} from '../../src/chat/core/execution-sessions'
import { executionSessionSnapshotSchema } from '../../src/chat/core/execution-snapshot'

const identity = {
  workspaceId: 'w',
  userId: '00000000-0000-4000-8000-000000000001',
  botId: 'b',
  conversationId: 'main-conversation',
}
const origin = 'http://127.0.0.1:3002'
const base = '/api/chat/conversations/main-conversation/execution'
const bytes = encodeProjectSnapshot({
  version: 5,
  files: {
    '/project/notes.txt': new TextEncoder().encode('\uFEFFHello, café 🌱\r\n'),
    '/project/data.bin': new Uint8Array([0, 128, 255]),
  },
  directories: ['/project', '/project/empty'],
  symlinks: { '/project/link': 'notes.txt' },
  fileModes: { '/project/notes.txt': 0o640, '/project/data.bin': 0o644 },
  directoryModes: { '/': 0o755, '/project': 0o755, '/project/empty': 0o700 },
})
function snapshot(result: any): ExecutionSessionSnapshot {
  if (!result.ok) throw new Error(result.error)
  return executionSessionSnapshotSchema.parse(result.snapshot)
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function setup() {
  vi.stubGlobal('__GUM_LOCAL_DEVELOPMENT__', true)
  let now = Date.parse('2030-01-01T00:00:00Z')
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const h = await conversationHarness()
  const objects = new Map<
    string,
    { bytes: Uint8Array<ArrayBuffer>; checksum: ArrayBuffer }
  >()
  const options = {
    failPut: false,
    losePutResponse: false,
    afterPut: undefined as undefined | (() => void | Promise<void>),
    afterGet: undefined as undefined | (() => void | Promise<void>),
    beforeRead: undefined as undefined | (() => void | Promise<void>),
  }
  const canceled = vi.fn()
  const meta = (key: string) => {
    const value = objects.get(key)
    return value
      ? {
          key,
          size: value.bytes.byteLength,
          checksums: { sha256: value.checksum },
        }
      : null
  }
  const put = vi.fn(async (key: string, data: Uint8Array, input: any) => {
    if (options.failPut) throw new Error('Synthetic R2 failure')
    expect(input.onlyIf).toEqual({ etagDoesNotMatch: '*' })
    if (objects.has(key)) return null
    const copy = new Uint8Array(data)
    const checksum = await crypto.subtle.digest('SHA-256', copy)
    expect(Buffer.from(checksum).toString('hex')).toBe(input.sha256)
    // Another concurrent conditional writer may have won during checksum IO.
    if (objects.has(key)) return null
    objects.set(key, { bytes: copy, checksum })
    await options.afterPut?.()
    if (options.losePutResponse) throw new Error('Synthetic lost R2 response')
    return meta(key)
  })
  const head = vi.fn(async (key: string) => meta(key))
  const get = vi.fn(async (key: string) => {
    const value = objects.get(key)
    await options.afterGet?.()
    return value
      ? {
          ...meta(key),
          body: new ReadableStream<Uint8Array>({
            async pull(controller) {
              await options.beforeRead?.()
              controller.enqueue(value.bytes)
              controller.close()
            },
            cancel: canceled,
          }),
        }
      : null
  })
  Object.assign(h.env, {
    APP_MODE: 'auth-test',
    GUM_DEV_EXECUTION: 'enabled',
    FILES: { put, get, head },
  })
  Object.assign(h.env.CONVERSATIONS, { getByName: () => h.c })
  const env = h.env
  await prepareSharedSessionRuntime(h)
  const cookie = await createSharedSession(identity.userId)
  const create = snapshot(
    await h.c.changeExecution(identity, {
      type: 'create',
      commandId: crypto.randomUUID(),
      runtime: browserExecutionRuntime,
      project: { source: 'trusted-fixture', digest: 'a'.repeat(64) },
    }),
  )
  const claim = {
    type: 'claim' as const,
    commandId: crypto.randomUUID(),
    sessionId: create.session!.id,
    expectedVersion: create.session!.version,
    ownerInstanceId: crypto.randomUUID(),
    runtimeId: crypto.randomUUID(),
    leaseProof: Buffer.alloc(32, 19).toString('base64url'),
    runtime: browserExecutionRuntime,
  }
  const claimed = snapshot(await h.c.changeExecution(identity, claim))
  const host = {
    sessionId: claimed.session!.id,
    hostGeneration: claimed.session!.hostGeneration,
    ownerInstanceId: claim.ownerInstanceId,
    runtimeId: claim.runtimeId,
    leaseProof: claim.leaseProof,
  }
  snapshot(
    await h.c.changeExecution(identity, {
      type: 'enqueue',
      commandId: crypto.randomUUID(),
      sessionId: host.sessionId,
      expectedVersion: claimed.session!.version,
      operation: { type: 'save_snapshot' },
    }),
  )
  const command = snapshot(
    await h.c.changeExecution(identity, { type: 'dispatch', ...host }),
  ).delivery!
  const metadata = {
    snapshotId: command.id,
    ...(await inspectProjectSnapshot(bytes)),
  }
  const input = {
    ...host,
    commandId: command.id,
    digest: command.digest,
    snapshot: metadata,
  }
  const url = origin + base + '/snapshots/' + command.id
  const request = (
    method = 'PUT',
    config: {
      input?: unknown
      body?: Uint8Array | ReadableStream<Uint8Array>
      url?: string
      cookie?: string
      origin?: string
      contentLength?: string
      header?: string
    } = {},
  ) => {
    const target = new URL(config.url ?? url)
    if (!target.searchParams.has('workspaceId'))
      target.searchParams.set('workspaceId', 'w')
    return new Request(target, {
      method,
      headers: {
        cookie: config.cookie ?? cookie,
        origin: config.origin ?? origin,
        ...(method === 'PUT'
          ? {
              'x-gum-execution-snapshot':
                config.header ?? JSON.stringify(config.input ?? input),
            }
          : {}),
        ...(config.contentLength === undefined
          ? {}
          : { 'content-length': config.contentLength }),
      },
      ...(method === 'PUT'
        ? { body: config.body ?? bytes, duplex: 'half' }
        : {}),
    } as RequestInit)
  }
  const upload = (config?: Parameters<typeof request>[1]) =>
    api(request('PUT', config), env)
  const revoke = async () => {
    await h.db`DELETE FROM chat_memberships WHERE workspace_id='w' AND user_id=${identity.userId}`
  }
  const key = executionSnapshotObjectKey(identity, command.id)
  return {
    ...h,
    env,
    cookie,
    host,
    input,
    command,
    metadata,
    url,
    request,
    upload,
    key,
    objects,
    options,
    put,
    get,
    head,
    canceled,
    revoke,
    advance: (ms: number) => {
      now += ms
    },
  }
}

describe('authenticated project snapshot API and R2 publication', () => {
  it('uploads exact binary data, then acknowledges, reconstructs and downloads immutable ready evidence', async () => {
    const h = await setup()
    const response = await h.upload()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    const saved = executionSessionSnapshotSchema.parse(await response.json())
    expect(saved.savedSnapshots[0]).toMatchObject({
      ...h.metadata,
      state: 'ready',
      identity,
    })
    expect(saved.commands[0].state).toBe('dispatched')
    expect(JSON.stringify(saved)).not.toContain(h.host.leaseProof)
    const repeat = executionSessionSnapshotSchema.parse(
      await (await h.upload()).json(),
    )
    expect(repeat).toEqual(saved)
    expect(h.put).toHaveBeenCalledTimes(1)
    const ack = {
      type: 'acknowledge' as const,
      ...h.host,
      commandId: h.command.id,
      digest: h.command.digest,
      eventsThrough: 0,
      outcome: 'succeeded' as const,
      result: { type: 'save_snapshot' as const, ...h.metadata },
    }
    expect(
      snapshot(await h.c.changeExecution(identity, ack)).commands[0].state,
    ).toBe('succeeded')
    const restored = await h.reconstruct()
    expect(
      snapshot(await restored.executionSnapshot(identity)).savedSnapshots,
    ).toEqual(saved.savedSnapshots)
    const metadata = await api(
      h.request('GET', { url: h.url + '?metadata=1' }),
      h.env,
    )
    expect(await metadata.json()).toEqual(saved.savedSnapshots[0])
    const download = await api(h.request('GET'), h.env)
    expect(download.status).toBe(200)
    expect(download.headers.get('content-type')).toBe(
      'application/octet-stream',
    )
    expect(download.headers.get('content-disposition')).toMatch(/^attachment/)
    expect(download.headers.get('x-content-type-options')).toBe('nosniff')
    const actual = new Uint8Array(await download.arrayBuffer())
    expect(actual).toEqual(bytes)
    expect(decodeProjectSnapshot(actual)).toEqual(decodeProjectSnapshot(bytes))
  })

  it('keeps unknown/failed R2 writes pending and exact retries recover without another object or changed metadata', async () => {
    const h = await setup()
    h.options.failPut = true
    expect((await h.upload()).status).toBe(503)
    expect(
      snapshot(await h.c.executionSnapshot(identity)).savedSnapshots[0].state,
    ).toBe('pending')
    expect((await api(h.request('GET'), h.env)).status).toBe(409)
    h.options.failPut = false
    h.options.losePutResponse = true
    expect((await h.upload()).status).toBe(503)
    expect(h.objects.size).toBe(1)
    h.options.losePutResponse = false
    expect((await h.upload()).status).toBe(200)
    expect(h.head).toHaveBeenCalledTimes(1)
    expect(h.objects.size).toBe(1)
    expect(
      (
        await h.upload({
          input: {
            ...h.input,
            snapshot: { ...h.metadata, sha256: 'b'.repeat(64) },
          },
        })
      ).status,
    ).toBe(409)
    expect(h.objects.get(h.key)!.bytes).toEqual(bytes)
  })

  it('concurrent identical uploads share one immutable reservation/object and conflicting payloads cannot overwrite it', async () => {
    const h = await setup()
    const responses = await Promise.all([h.upload(), h.upload(), h.upload()])
    expect(responses.map((value) => value.status)).toEqual([200, 200, 200])
    const current = snapshot(await h.c.executionSnapshot(identity))
    expect(current.savedSnapshots).toHaveLength(1)
    expect(current.savedSnapshots[0].state).toBe('ready')
    expect(h.objects.size).toBe(1)
    const changed = bytes.slice()
    changed[changed.length - 1] ^= 1
    expect((await h.upload({ body: changed })).status).toBe(409)
    expect(h.objects.get(h.key)!.bytes).toEqual(bytes)
  })

  it.each(['membership', 'archive', 'expiry', 'close'] as const)(
    'rechecks %s after R2 and never publishes a stale pending receipt',
    async (change) => {
      const h = await setup()
      if (change === 'close') {
        h.put.mockImplementationOnce(
          async (key: string, data: Uint8Array, options: any) => {
            const copy = new Uint8Array(data)
            h.objects.set(key, {
              bytes: copy,
              checksum: await crypto.subtle.digest('SHA-256', copy),
            })
            const current = snapshot(await h.c.executionSnapshot(identity))
            snapshot(
              await h.c.changeExecution(identity, {
                type: 'enqueue',
                sessionId: h.host.sessionId,
                commandId: crypto.randomUUID(),
                expectedVersion: current.session!.version,
                operation: { type: 'close' },
              }),
            )
            return {
              size: copy.byteLength,
              checksums: { sha256: h.objects.get(key)!.checksum },
            } as any
          },
        )
      } else
        h.options.afterPut = async () => {
          if (change === 'membership') await h.revoke()
          if (change === 'archive')
            await h.db`UPDATE chat_bots SET archived_at=to_timestamp(0.001) WHERE id='b'`
          if (change === 'expiry') h.advance(60_001)
        }
      expect((await h.upload()).status).toBe(
        change === 'membership' ? 404 : change === 'expiry' ? 403 : 409,
      )
      const row = h.local
        .prepare('SELECT data FROM execution_project_snapshots')
        .get()!
      expect(JSON.parse(row.data as string).state).toBe(
        ['expiry', 'close'].includes(change) ? 'unavailable' : 'pending',
      )
      expect(h.objects.size).toBe(1)
    },
  )

  it('does not contact R2 when access or the owner lease expires while reading the upload', async () => {
    const h = await setup()
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        h.advance(60_001)
        controller.enqueue(bytes)
        controller.close()
      },
    })
    expect((await h.upload({ body })).status).toBe(403)
    expect(h.put).not.toHaveBeenCalled()
    expect(
      h.local
        .prepare('SELECT count(*) AS n FROM execution_project_snapshots')
        .get()!.n,
    ).toBe(0)
  })

  it.each(['get', 'body'] as const)(
    'reauthorizes download after R2 %s and does not expose revoked bytes',
    async (when) => {
      const h = await setup()
      expect((await h.upload()).status).toBe(200)
      if (when === 'get') h.options.afterGet = h.revoke
      else h.options.beforeRead = h.revoke
      const response = await api(h.request('GET'), h.env)
      expect(response.status).toBe(404)
      expect(response.headers.get('content-type')).toContain('json')
      expect(await response.text()).not.toContain('Hello')
    },
  )

  it('requires actual current auth/exact conversation, safe origin, strict bounded headers, and supported methods', async () => {
    const h = await setup()
    expect((await h.upload({ cookie: '' })).status).toBe(401)
    expect((await h.upload({ origin: 'https://other.example' })).status).toBe(
      403,
    )
    expect(
      (await h.upload({ input: { ...h.input, userId: 'forged' } })).status,
    ).toBe(400)
    expect((await h.upload({ header: 'x'.repeat(8193) })).status).toBe(400)
    expect((await h.upload({ header: '{' })).status).toBe(400)
    expect(
      (
        await h.upload({
          input: {
            ...h.input,
            snapshot: {
              ...h.metadata,
              byteLength: maxProjectSnapshotBytes + 1,
            },
          },
        })
      ).status,
    ).toBe(400)
    expect((await api(h.request('POST'), h.env)).status).toBe(405)
    expect(
      (
        await api(
          h.request('GET', { url: h.url + '?metadata=1&metadata=1' }),
          h.env,
        )
      ).status,
    ).toBe(400)
    await h.db`INSERT INTO chat_conversations(id,bot_id,user_id,created_at) VALUES('sibling','b',${identity.userId},to_timestamp(0.001))`
    expect(
      (await h.upload({ url: h.url.replace('main-conversation', 'sibling') }))
        .status,
    ).toBe(404)
    await h.db`INSERT INTO users(id,email,name,capabilities,session_version,signup_sources,created_at,updated_at) VALUES('00000000-0000-4000-8000-000000000002','other@example.invalid','Other',ARRAY['builder']::capability[],0,'[]',now(),now())`
    await h.db`INSERT INTO chat_memberships(workspace_id,user_id,role) VALUES('w','00000000-0000-4000-8000-000000000002','member')`
    await h.db`INSERT INTO chat_access(user_id) VALUES('00000000-0000-4000-8000-000000000002')`
    const otherCookie = (
      await createSharedSession('00000000-0000-4000-8000-000000000002')
    ).split(';')[0]
    expect((await h.upload({ cookie: otherCookie })).status).toBe(404)
    expect(h.put).not.toHaveBeenCalled()
  })

  it('rejects invalid, short, long, or mismatched snapshot bytes before R2 and leaves bounded reservations pending', async () => {
    const h = await setup()
    expect(
      (await h.upload({ contentLength: String(bytes.length + 1) })).status,
    ).toBe(400)
    expect((await h.upload({ body: bytes.slice(1) })).status).toBe(400)
    expect(
      (await h.upload({ body: new Uint8Array(bytes.length + 1) })).status,
    ).toBe(400)
    const invalid = bytes.slice()
    invalid[0] = 0
    expect((await h.upload({ body: invalid })).status).toBe(400)
    const changed = bytes.slice()
    changed[changed.length - 1] ^= 1
    expect((await h.upload({ body: changed })).status).toBe(409)
    expect(h.put).not.toHaveBeenCalled()
    expect(
      snapshot(await h.c.executionSnapshot(identity)).savedSnapshots,
    ).toHaveLength(1)
  })

  it('keeps a ready reference immutable when R2 is missing or has corrupted bytes/checksums', async () => {
    const h = await setup()
    expect((await h.upload()).status).toBe(200)
    const object = h.objects.get(h.key)!
    h.objects.delete(h.key)
    expect((await api(h.request('GET'), h.env)).status).toBe(503)
    h.objects.set(h.key, { ...object, checksum: new ArrayBuffer(32) })
    expect((await api(h.request('GET'), h.env)).status).toBe(503)
    const corrupt = object.bytes.slice()
    corrupt[corrupt.length - 1] ^= 1
    h.objects.set(h.key, { ...object, bytes: corrupt })
    expect((await api(h.request('GET'), h.env)).status).toBe(503)
    expect(
      snapshot(await h.c.executionSnapshot(identity)).savedSnapshots[0].state,
    ).toBe('ready')
  })

  it('rolls back failed ready publication, retaining R2 bytes for an exact recovery after reconstruction', async () => {
    const h = await setup()
    h.local
      .exec(`CREATE TRIGGER reject_snapshot_ready BEFORE UPDATE ON execution_project_snapshots
      WHEN json_extract(NEW.data,'$.state')='ready' BEGIN SELECT RAISE(ABORT,'synthetic finalization failure'); END`)
    await expect(h.upload()).rejects.toThrow('synthetic finalization failure')
    expect(h.objects.size).toBe(1)
    expect(
      snapshot(await h.c.executionSnapshot(identity)).savedSnapshots[0].state,
    ).toBe('pending')
    h.local.exec('DROP TRIGGER reject_snapshot_ready')
    const restored = await h.reconstruct()
    Object.assign(h.env.CONVERSATIONS, { getByName: () => restored })
    expect((await h.upload()).status).toBe(200)
    expect(h.objects.size).toBe(1)
    expect(h.head).toHaveBeenCalledTimes(1)
  })

  it('keys storage by the complete authenticated scope, even for the same chosen snapshot UUID', async () => {
    const h = await setup()
    const values = new Set([h.key])
    for (const field of Object.keys(identity))
      values.add(
        executionSnapshotObjectKey(
          { ...identity, [field]: 'different' },
          h.command.id,
        ),
      )
    expect(values.size).toBe(5)
    expect(h.key).not.toContain(identity.userId + '/')
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      h.metadata.sha256,
    )
  })

  it('sanitizes upload and R2 body errors without marking unfinished uploads ready', async () => {
    const h = await setup()
    const broken = () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error('private-provider-detail'))
        },
      })
    const failed = await h.upload({ body: broken() })
    expect(failed.status).toBe(503)
    expect(await failed.text()).not.toContain('private-provider-detail')
    expect(h.put).not.toHaveBeenCalled()
    expect((await h.upload()).status).toBe(200)
    h.get.mockImplementationOnce(
      async () =>
        ({
          size: bytes.length,
          checksums: { sha256: h.objects.get(h.key)!.checksum },
          body: broken(),
        }) as any,
    )
    const download = await api(h.request('GET'), h.env)
    expect(download.status).toBe(503)
    expect(await download.text()).not.toContain('private-provider-detail')
  })

  it('uses an authorized ready ref for a new empty session and requires current access again for restore admission', async () => {
    const h = await setup()
    expect((await h.upload()).status).toBe(200)
    let current = snapshot(await h.c.executionSnapshot(identity))
    snapshot(
      await h.c.changeExecution(identity, {
        type: 'enqueue',
        sessionId: h.host.sessionId,
        commandId: crypto.randomUUID(),
        expectedVersion: current.session!.version,
        operation: { type: 'close' },
      }),
    )
    const close = snapshot(
      await h.c.changeExecution(identity, { type: 'dispatch', ...h.host }),
    ).delivery!
    current = snapshot(
      await h.c.changeExecution(identity, {
        type: 'acknowledge',
        ...h.host,
        commandId: close.id,
        digest: close.digest,
        eventsThrough: 0,
        outcome: 'succeeded',
        result: { type: 'close', shutdownAcknowledged: true },
      }),
    )
    expect(current.savedSnapshots[0].state).toBe('ready')
    const create = {
      type: 'create',
      commandId: crypto.randomUUID(),
      runtime: browserExecutionRuntime,
      project: {
        source: 'snapshot',
        snapshotId: h.command.id,
        digest: h.metadata.sha256,
      },
    }
    const post = () =>
      api(
        new Request(origin + base + '?workspaceId=w', {
          method: 'POST',
          headers: { origin, cookie: h.cookie },
          body: JSON.stringify(create),
        }),
        h.env,
      )
    const restored = executionSessionSnapshotSchema.parse(
      await (await post()).json(),
    )
    expect(restored.session!.project).toEqual(create.project)
    expect(restored.session!.status).toBe('awaiting_host')
    expect(restored.session!.id).not.toBe(h.host.sessionId)
    expect(restored.commands).toEqual([])
    expect(restored.processes).toEqual([])
    expect(restored.savedSnapshots).toEqual([])
    expect(
      (await api(h.request('GET', { url: h.url + '?metadata=1' }), h.env))
        .status,
    ).toBe(200)
    await h.revoke()
    expect((await post()).status).toBe(404)
    expect((await api(h.request('GET'), h.env)).status).toBe(404)
  })
})
