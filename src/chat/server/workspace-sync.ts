import type {
  WorkspaceProjection,
  WorkspaceSyncSnapshot,
} from '../core/workspace-sync'
import { workspaceCommit } from '../core/workspace-sync'
import { confirmedAppendOffset } from './stream-append'
import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import type { DurableObjectState } from '@cloudflare/workers-types'
import type { DefaultAuthEnv } from '@durable-streams/server-cloudflare'
import { readSyncProjection, syncMembership } from './workspace-sync-projection'
export { readSyncProjection, syncMembership } from './workspace-sync-projection'
export type WorkspaceSyncEnvironment = DefaultAuthEnv & {
  WORKSPACE_SYNC?: {
    getByName(id: string): { publish(workspaceId: string): Promise<unknown> }
  }
}

export async function workspaceStreamRequest(
  env: WorkspaceSyncEnvironment,
  generation: string,
  init: RequestInit = {},
  query = '',
) {
  const { createStreamsHandler } =
    await import('@durable-streams/server-cloudflare')
  return createStreamsHandler({ cors: false })(
    new Request(
      `https://streams.internal/workspaces/${encodeURIComponent(generation)}${query}`,
      init,
    ),
    env,
  )
}

type Viewer = {
  user_id: string
  membership: string
  generation: string
  source_revision: number
  version: number
  snapshot: string | null
  offset: string | null
  pending: string | null
  pending_snapshot: string | null
  pending_source: number | null
  bytes: number
  created_at: number
}

/** Coordination and durable publishing only. PostgreSQL remains authoritative. */
export class WorkspaceSyncPublisher {
  private queue: Promise<unknown> = Promise.resolve()
  constructor(
    private ctx: DurableObjectState,
    private env: WorkspaceSyncEnvironment,
  ) {
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS scope (id INTEGER PRIMARY KEY CHECK(id=1),workspace_id TEXT NOT NULL)`,
    )
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS viewers (
      user_id TEXT PRIMARY KEY,membership TEXT NOT NULL,generation TEXT NOT NULL,source_revision INTEGER NOT NULL DEFAULT -1,
      version INTEGER NOT NULL DEFAULT -1,snapshot TEXT,offset TEXT,pending TEXT,pending_snapshot TEXT,pending_source INTEGER,
      bytes INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL)`)
  }
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work)
    this.queue = next.catch(() => {})
    return next
  }
  private scope(workspaceId: string) {
    const row = this.ctx.storage.sql
      .exec<{ workspace_id: string }>('SELECT workspace_id FROM scope')
      .toArray()[0]
    if (row && row.workspace_id !== workspaceId)
      throw new Error('Workspace sync scope mismatch.')
    if (!row)
      this.ctx.storage.sql.exec('INSERT INTO scope VALUES(1,?)', workspaceId)
  }
  private viewer(userId: string) {
    return this.ctx.storage.sql
      .exec<Viewer>('SELECT * FROM viewers WHERE user_id=?', userId)
      .toArray()[0]
  }
  private async flush(row: Viewer): Promise<void> {
    if (!row.pending) return
    const created = await workspaceStreamRequest(this.env, row.generation, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Stream-TTL': '86400' },
    })
    if (!created.ok) throw new Error('Could not create the workspace stream.')
    if (created.status === 201 && row.version >= 0) {
      // The backend expired an idle stream while an append was pending.
      // Rebase the durable projection into a new generation, never reuse an
      // old cursor or skip the pending state to repair producer sequencing.
      const generation = crypto.randomUUID()
      const state = JSON.parse(row.pending_snapshot!) as WorkspaceProjection
      const event = workspaceCommit(undefined, state, generation, 0)
      this.ctx.storage.sql.exec(
        `UPDATE viewers SET generation=?,version=-1,source_revision=-1,snapshot=NULL,offset=NULL,
         bytes=0,created_at=?,pending=? WHERE user_id=?`,
        generation,
        Date.now(),
        JSON.stringify([event]),
        row.user_id,
      )
      return this.flush(this.viewer(row.user_id))
    }
    const response = await workspaceStreamRequest(this.env, row.generation, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Producer-Id': row.generation,
        'Producer-Epoch': '0',
        'Producer-Seq': String(row.version + 1),
      },
      body: row.pending,
    })
    const { offset } = await confirmedAppendOffset(
      response,
      { epoch: 0, sequence: row.version + 1 },
      () =>
        workspaceStreamRequest(this.env, row.generation, { method: 'HEAD' }),
    )
    if (!offset) throw new Error('Could not publish workspace changes.')
    this.ctx.storage.sql.exec(
      `UPDATE viewers SET snapshot=pending_snapshot,source_revision=pending_source,
      version=version+1,offset=?,bytes=bytes+?,pending=NULL,pending_snapshot=NULL,pending_source=NULL WHERE user_id=?`,
      offset,
      new TextEncoder().encode(row.pending).length,
      row.user_id,
    )
  }
  private async update(workspaceId: string, userId: string) {
    const current = await readSyncProjection(workspaceId, userId)
    if (!current) {
      this.ctx.storage.sql.exec('DELETE FROM viewers WHERE user_id=?', userId)
      return undefined
    }
    let row = this.viewer(userId)
    if (row && row.membership !== current.generation) {
      this.ctx.storage.sql.exec('DELETE FROM viewers WHERE user_id=?', userId)
      row = undefined!
    }
    // The immutable pending append always finishes before deriving another delta.
    if (row?.pending) {
      await this.flush(row)
      row = this.viewer(userId)
    }
    const rotate =
      row &&
      (row.version >= 255 ||
        row.bytes >= 1_000_000 ||
        Date.now() - row.created_at > 3_600_000)
    if (!row || rotate) {
      this.ctx.storage.sql.exec(
        `INSERT OR REPLACE INTO viewers(user_id,membership,generation,created_at) VALUES(?,?,?,?)`,
        userId,
        current.generation,
        crypto.randomUUID(),
        Date.now(),
      )
      row = this.viewer(userId)
    }
    if (row.source_revision < current.revision) {
      const event = workspaceCommit(
        row.snapshot ? JSON.parse(row.snapshot) : undefined,
        current.state,
        row.generation,
        row.version + 1,
      )
      this.ctx.storage.sql.exec(
        'UPDATE viewers SET pending=?,pending_snapshot=?,pending_source=? WHERE user_id=?',
        JSON.stringify([event]),
        JSON.stringify(current.state),
        current.revision,
        userId,
      )
      await this.flush(this.viewer(userId))
      row = this.viewer(userId)
    }
    return {
      protocol: 1,
      generation: row.generation,
      version: row.version,
      offset: row.offset!,
      state: JSON.parse(row.snapshot!),
    } satisfies WorkspaceSyncSnapshot
  }
  snapshot(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceSyncSnapshot | undefined> {
    return this.serial(async () => {
      this.scope(workspaceId)
      await this.ctx.storage.setAlarm(Date.now() + 30_000)
      const result = await this.update(workspaceId, userId)
      const member = await syncMembership(workspaceId, userId)
      return member && this.viewer(userId)?.membership === member.generation
        ? result
        : undefined
    })
  }
  publish(workspaceId: string) {
    return this.serial(async () => {
      this.scope(workspaceId)
      await this.ctx.storage.setAlarm(Date.now() + 30_000)
      const [clock] = await db.execute<
        { revision: number } & Record<string, unknown>
      >(
        sql`SELECT revision::float8 AS revision FROM chat_workspace_sync_clock WHERE workspace_id=${workspaceId}`,
      )
      for (const row of this.ctx.storage.sql
        .exec<Viewer>('SELECT * FROM viewers')
        .toArray())
        await this.update(workspaceId, row.user_id)
      if (clock)
        await db.execute(
          sql`UPDATE chat_workspace_sync_clock SET published_revision=greatest(published_revision,${clock.revision}) WHERE workspace_id=${workspaceId}`,
        )
      await this.ctx.storage.deleteAlarm()
    })
  }
  async read(
    workspaceId: string,
    userId: string,
    generation: string,
    query: string,
  ) {
    const row = await this.serial(async () => {
      this.scope(workspaceId)
      const member = await syncMembership(workspaceId, userId)
      const row = this.viewer(userId)
      return member &&
        row?.membership === member.generation &&
        row.generation === generation
        ? row
        : undefined
    })
    if (!row) return new Response(null, { status: 409 })
    // Do not hold the publisher queue while waiting for new data.
    return workspaceStreamRequest(this.env, generation, {}, query)
  }
  async alarm() {
    const scope = this.ctx.storage.sql
      .exec<{ workspace_id: string }>('SELECT workspace_id FROM scope')
      .toArray()[0]
    if (scope) await this.publish(scope.workspace_id)
  }
}

export async function wakeWorkspaceSync(
  env: Pick<WorkspaceSyncEnvironment, 'WORKSPACE_SYNC'>,
  workspaceId: string,
) {
  if (!env.WORKSPACE_SYNC) return // Unit fixtures without Cloudflare bindings.
  try {
    await env.WORKSPACE_SYNC.getByName(workspaceId).publish(workspaceId)
  } catch {
    console.error(
      JSON.stringify({ event: 'workspace_sync_publish_failed', workspaceId }),
    )
  }
}
export async function recoverWorkspaceSync(
  env: Pick<WorkspaceSyncEnvironment, 'WORKSPACE_SYNC'>,
) {
  let after = ''
  while (true) {
    const rows = await db.execute<
      { workspace_id: string } & Record<string, unknown>
    >(
      sql`SELECT workspace_id FROM chat_workspace_sync_clock WHERE revision>published_revision AND workspace_id>${after} ORDER BY workspace_id LIMIT 32`,
    )
    if (!rows.length) return
    await Promise.all(
      rows.map((row) => wakeWorkspaceSync(env, row.workspace_id)),
    )
    // Move past failed scopes too, so a broken stream cannot starve others.
    after = rows.at(-1)!.workspace_id
  }
}
