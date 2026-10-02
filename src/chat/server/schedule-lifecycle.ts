import type { SqlStorage } from '@cloudflare/workers-types'
import { db } from '~/db/client'
import { sql as pg } from 'drizzle-orm'
import { z } from 'zod'

const lifecycleGeneration = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)

/** Read before entering the conversation's local storage transaction. */
export async function readScheduleLifecycleGeneration(
  botId: string,
): Promise<number> {
  const [row] = await db.execute<{ generation: number }>(
    pg`SELECT generation::double precision AS generation FROM chat_bot_schedule_suspensions WHERE bot_id=${botId}`,
  )
  return lifecycleGeneration.parse(row?.generation ?? 0)
}

/** The caller must pause definitions and commit this marker in the same local
 * transaction. A restore never lowers the recorded suspension generation. */
export function applyScheduleLifecycleGeneration(
  sql: SqlStorage,
  botId: string,
  generation: number,
): boolean {
  lifecycleGeneration.parse(generation)
  sql.exec(`CREATE TABLE IF NOT EXISTS schedule_lifecycle_generations (
    bot_id TEXT PRIMARY KEY,
    generation INTEGER NOT NULL
      CHECK (generation >= 0 AND generation <= 9007199254740991)
  )`)
  if (generation === 0) return false
  return (
    sql
      .exec<{ generation: number }>(
        `INSERT INTO schedule_lifecycle_generations (bot_id, generation) VALUES (?,?)
       ON CONFLICT (bot_id) DO UPDATE SET generation=excluded.generation
       WHERE schedule_lifecycle_generations.generation < excluded.generation
       RETURNING generation`,
        botId,
        generation,
      )
      .toArray().length > 0
  )
}

/** Read before entering the conversation's local storage transaction. */
export async function readThreadScheduleLifecycleGeneration(
  conversationId: string,
): Promise<number> {
  const [row] = await db.execute<{ generation: number }>(
    pg`SELECT generation::double precision AS generation FROM chat_thread_schedule_suspensions WHERE conversation_id=${conversationId}`,
  )
  return lifecycleGeneration.parse(row?.generation ?? 0)
}

/** The caller must pause definitions and commit this marker in the same local
 * transaction. A restore never lowers the recorded suspension generation. */
export function applyThreadScheduleLifecycleGeneration(
  sql: SqlStorage,
  conversationId: string,
  generation: number,
): boolean {
  lifecycleGeneration.parse(generation)
  sql.exec(`CREATE TABLE IF NOT EXISTS thread_schedule_lifecycle_generations (
    conversation_id TEXT PRIMARY KEY,
    generation INTEGER NOT NULL
      CHECK (generation >= 0 AND generation <= 9007199254740991)
  )`)
  if (generation === 0) return false
  return (
    sql
      .exec<{ generation: number }>(
        `INSERT INTO thread_schedule_lifecycle_generations (conversation_id, generation) VALUES (?,?)
       ON CONFLICT (conversation_id) DO UPDATE SET generation=excluded.generation
       WHERE thread_schedule_lifecycle_generations.generation < excluded.generation
       RETURNING generation`,
        conversationId,
        generation,
      )
      .toArray().length > 0
  )
}
