import type { DurableObjectState } from '@cloudflare/workers-types'
import type { DefaultAuthEnv } from '@durable-streams/server-cloudflare'
import { createStreamsHandler } from '@durable-streams/server-cloudflare'
import { confirmedAppendOffset } from './stream-append'
import {
  conversationEvents,
  type ProjectableConversation,
} from './conversation-events'

const handleStream = createStreamsHandler({ cors: false })

// Only reached after the API authenticates the conversation, or internally by
// its owner. Never mount the unprotected protocol handler on a public route.
export function streamRequest(
  env: DefaultAuthEnv,
  id: string,
  init: RequestInit = {},
  query = '',
) {
  return handleStream(
    new Request(
      `https://streams.internal/conversations/${encodeURIComponent(id)}${query}`,
      init,
    ),
    env,
  )
}

export class ConversationStream<T extends ProjectableConversation> {
  private flushing?: Promise<void>
  constructor(
    private ctx: DurableObjectState,
    private env: DefaultAuthEnv,
  ) {
    ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS stream_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, events TEXT NOT NULL, projection TEXT NOT NULL)',
    )
    ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS stream_projection (id INTEGER PRIMARY KEY CHECK(id=1), queued TEXT, published TEXT, cursor TEXT)',
    )
  }
  // Called in the same synchronous storage transaction as the conversation save.
  enqueue(state: T) {
    const projection = JSON.stringify(state)
    // Read within the caller's transaction. An outer rollback must also restore
    // the base used for the next patch, including when this instance survives.
    const row = this.ctx.storage.sql
      .exec<{ queued: string }>(
        'SELECT queued FROM stream_projection WHERE id=1',
      )
      .toArray()[0]
    if (row?.queued === projection) return
    const previous = row?.queued ? JSON.parse(row.queued) : undefined
    const events = conversationEvents(
      previous,
      state,
      state.identity?.conversationId ?? this.ctx.id.toString(),
    )
    this.ctx.storage.sql.exec(
      'INSERT INTO stream_outbox (events,projection) VALUES (?,?)',
      JSON.stringify(events),
      projection,
    )
    this.ctx.storage.sql.exec(
      'INSERT INTO stream_projection (id,queued) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET queued=excluded.queued',
      projection,
    )
  }
  async flush(): Promise<void> {
    do {
      if (!this.flushing)
        this.flushing = this.drain().finally(() => {
          this.flushing = undefined
        })
      await this.flushing
    } while (
      this.ctx.storage.sql
        .exec('SELECT id FROM stream_outbox LIMIT 1')
        .toArray().length
    )
  }
  private async drain() {
    if (
      !this.ctx.storage.sql
        .exec('SELECT id FROM stream_outbox LIMIT 1')
        .toArray().length
    )
      return
    const id = this.ctx.id.toString()
    const created = await streamRequest(this.env, id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!created.ok) throw new Error('Could not open the conversation stream.')
    while (true) {
      const row = this.ctx.storage.sql
        .exec<{ id: number; events: string; projection: string }>(
          'SELECT id,events,projection FROM stream_outbox ORDER BY id LIMIT 1',
        )
        .toArray()[0]
      if (!row) return
      const response = await streamRequest(this.env, id, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Producer-Id': id,
          'Producer-Epoch': '0',
          'Producer-Seq': String(row.id - 1),
        },
        body: row.events,
      })
      const { offset: cursor, recoveryStatus } = await confirmedAppendOffset(
        response,
        { epoch: 0, sequence: row.id - 1 },
        () => streamRequest(this.env, id, { method: 'HEAD' }),
      )
      if (!response.ok || !cursor) {
        console.error('conversation_stream_append_failed', {
          status: response.status,
          recoveryStatus,
          hasCursor: Boolean(cursor),
          producerSequence: row.id - 1,
          expectedSequence: response.headers.get('Producer-Expected-Seq'),
          receivedSequence: response.headers.get('Producer-Received-Seq'),
          producerEpoch: response.headers.get('Producer-Epoch'),
          streamClosed: response.headers.get('Stream-Closed'),
        })
        throw new Error('Could not persist conversation updates.')
      }
      this.ctx.storage.transactionSync(() => {
        this.ctx.storage.sql.exec(
          'UPDATE stream_projection SET published=?,cursor=? WHERE id=1',
          row.projection,
          cursor,
        )
        this.ctx.storage.sql.exec(
          'DELETE FROM stream_outbox WHERE id=?',
          row.id,
        )
      })
    }
  }
  async snapshot(): Promise<(T & { streamOffset: string }) | undefined> {
    await this.flush()
    const row = this.ctx.storage.sql
      .exec<{ published: string; cursor: string }>(
        'SELECT published,cursor FROM stream_projection WHERE id=1',
      )
      .toArray()[0]
    return row?.published
      ? { ...JSON.parse(row.published), streamOffset: row.cursor }
      : undefined
  }
}
