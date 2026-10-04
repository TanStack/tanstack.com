import { db } from '~/db/client'
import { isAdmin } from '~/db/types'
import { DrizzleCapabilitiesRepository } from '~/auth/repositories.server'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { conversationRunIdentitySchema } from '../core/conversation-runs'
import type { Policy } from '../core/types'

/** The allowlist is deployment configuration; identity comes from authenticated storage. */
export async function hasUnlimitedUsage(
  userId: string,
  configuredEmails: string | undefined,
): Promise<boolean> {
  const emails = new Set(
    (configuredEmails ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
  if (!emails.size) return false
  const [user] = await db.execute<{ email: string }>(
    sql`SELECT email FROM users WHERE id=${userId}::uuid`,
  )
  return !!user && emails.has(user.email.trim().toLowerCase())
}

export const fundedSpendPolicy = {
  userCapMicros: 2_000_000,
  globalCapMicros: 20_000_000,
  reservationMicros: 250_000,
} as const

export class RunUsageAllowanceError extends Error {
  readonly status = 429
  constructor(
    readonly code:
      | 'user'
      | 'global'
      | 'scheduled'
      | 'user-spend'
      | 'global-spend',
  ) {
    super(
      code === 'user'
        ? 'You have reached your daily allowance. It resets at midnight UTC.'
        : code === 'global'
          ? 'The preview has reached its shared daily allowance. Please try tomorrow.'
          : code === 'scheduled'
            ? 'You have reached your daily scheduled-run allowance. It resets at midnight UTC.'
            : code === 'user-spend'
              ? 'You have reached your daily included usage allowance. It resets at midnight UTC.'
              : 'The preview has reached its shared included usage allowance. Please try tomorrow.',
    )
  }
}
export class RunUsageConflictError extends Error {
  readonly status = 409
  constructor() {
    super('This run usage receipt belongs to a different request.')
  }
}
export interface ReserveRunUsageInput {
  identity: z.infer<typeof conversationRunIdentitySchema>
  runId: string
  policy: Pick<Policy, 'dailyTurns'>
  localDevelopment: boolean
  /** Server-resolved account entitlement, never accepted from request input. */
  unlimited?: boolean
  scheduled: boolean
  scheduledDailyLimit?: number
  now?: number
  fundedSpend?: {
    userCapMicros: number
    globalCapMicros: number
    reservationMicros: number
  }
}
/** Authorize the current owner and policy before calling. This reserves
 * allowance, never permission. PostgreSQL serializes same-day admission and
 * settlement with a transaction lock, preserving the original atomic batch. */
export async function reserveRunUsage(
  input: ReserveRunUsageInput,
): Promise<{ status: 'reserved' | 'duplicate'; day: string }> {
  const identity = conversationRunIdentitySchema.parse(input.identity)
  const runId = z.string().min(1).max(128).parse(input.runId)
  const dailyLimit = z
    .number()
    .int()
    .min(1)
    .max(200)
    .parse(input.policy.dailyTurns)
  const scheduledLimit = z
    .number()
    .int()
    .min(1)
    .max(200)
    .parse(input.scheduledDailyLimit ?? 20)
  const scheduled = z.boolean().parse(input.scheduled)
  const spend =
    input.fundedSpend &&
    z
      .object({
        userCapMicros: z.number().int().positive(),
        globalCapMicros: z.number().int().positive(),
        reservationMicros: z.number().int().positive(),
      })
      .parse(input.fundedSpend)
  const unlimited = z.boolean().parse(input.unlimited ?? false)
  const lift =
    unlimited || (z.boolean().parse(input.localDevelopment) && !scheduled)
  const now = z
    .number()
    .int()
    .min(0)
    .max(8640000000000000)
    .parse(input.now ?? Date.now())
  if (identity.userId === '__global') throw new RunUsageConflictError()
  const day = new Date(now).toISOString().split('T')[0],
    attemptId = crypto.randomUUID()
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['chat-run-receipt', identity.conversationId, runId])},0))`,
    )
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${'chat-run-usage:' + day},0))`,
    )
    const [receipt] = await tx.execute<{
      workspace_id: string
      user_id: string
      bot_id: string
      scheduled: boolean
      day: string
    }>(
      sql`SELECT workspace_id,user_id,bot_id,scheduled,day FROM chat_run_usage_receipts WHERE conversation_id=${identity.conversationId} AND run_id=${runId}`,
    )
    if (receipt) {
      if (
        receipt.workspace_id !== identity.workspaceId ||
        receipt.user_id !== identity.userId ||
        receipt.bot_id !== identity.botId ||
        receipt.scheduled !== scheduled
      )
        throw new RunUsageConflictError()
      return { status: 'duplicate' as const, day: receipt.day }
    }
    const [usage] = await tx.execute<{
      user_turns: number
      global_turns: number
      scheduled_turns: number
      user_spend: number
      global_spend: number
    }>(sql`SELECT
      COALESCE((SELECT turns FROM chat_daily_usage WHERE user_id=${identity.userId} AND day=${day}),0)::double precision AS user_turns,
      COALESCE((SELECT turns FROM chat_daily_usage WHERE user_id='__global' AND day=${day}),0)::double precision AS global_turns,
      COALESCE((SELECT turns FROM chat_scheduled_daily_usage WHERE user_id=${identity.userId}::uuid AND day=${day}),0)::double precision AS scheduled_turns,
      COALESCE((SELECT SUM(billed_micros) FROM chat_funded_spend WHERE user_id=${identity.userId}::uuid AND day=${day}),0)::double precision AS user_spend,
      COALESCE((SELECT SUM(billed_micros) FROM chat_funded_spend WHERE day=${day}),0)::double precision AS global_spend`)
    if (!lift && usage.user_turns >= dailyLimit)
      throw new RunUsageAllowanceError('user')
    if (!lift && usage.global_turns >= 300)
      throw new RunUsageAllowanceError('global')
    if (!unlimited && scheduled && usage.scheduled_turns >= scheduledLimit)
      throw new RunUsageAllowanceError('scheduled')
    // Use the same effective capabilities as authentication, including roles.
    const includedAdmin =
      spend && !unlimited
        ? isAdmin(
            await new DrizzleCapabilitiesRepository().getEffectiveCapabilities(
              identity.userId,
              tx,
            ),
          )
        : false
    if (
      !unlimited &&
      !includedAdmin &&
      spend &&
      usage.user_spend + spend.reservationMicros > spend.userCapMicros
    )
      throw new RunUsageAllowanceError('user-spend')
    if (
      !unlimited &&
      !includedAdmin &&
      spend &&
      usage.global_spend + spend.reservationMicros > spend.globalCapMicros
    )
      throw new RunUsageAllowanceError('global-spend')
    await tx.execute(
      sql`INSERT INTO chat_run_usage_receipts(conversation_id,run_id,workspace_id,user_id,bot_id,scheduled,day,created_at,attempt_id) VALUES(${identity.conversationId},${runId},${identity.workspaceId},${identity.userId}::uuid,${identity.botId},${scheduled},${day},${now},${attemptId}::uuid)`,
    )
    if (spend)
      await tx.execute(
        sql`INSERT INTO chat_funded_spend(conversation_id,run_id,user_id,day,reserved_micros,billed_micros) VALUES(${identity.conversationId},${runId},${identity.userId}::uuid,${day},${spend.reservationMicros},${spend.reservationMicros})`,
      )
    await tx.execute(
      sql`INSERT INTO chat_daily_usage(user_id,day,turns) VALUES(${identity.userId},${day},1),('__global',${day},1) ON CONFLICT(user_id,day) DO UPDATE SET turns=chat_daily_usage.turns+1`,
    )
    if (scheduled)
      await tx.execute(
        sql`INSERT INTO chat_scheduled_daily_usage(user_id,day,turns) VALUES(${identity.userId}::uuid,${day},1) ON CONFLICT(user_id,day) DO UPDATE SET turns=chat_scheduled_daily_usage.turns+1`,
      )
    return { status: 'reserved' as const, day }
  })
}

export async function fundedSpendReport(
  userId: string,
  day = new Date().toISOString().slice(0, 10),
) {
  const [row] = await db.execute<{
    user_micros: number
    global_micros: number
    unknown_runs: number
  }>(sql`SELECT
    COALESCE((SELECT SUM(billed_micros) FROM chat_funded_spend WHERE day=${day} AND user_id=${userId}::uuid),0)::double precision AS user_micros,
    COALESCE((SELECT SUM(billed_micros) FROM chat_funded_spend WHERE day=${day}),0)::double precision AS global_micros,
    COALESCE((SELECT COUNT(*) FROM chat_funded_spend WHERE day=${day} AND user_id=${userId}::uuid AND unknown),0)::double precision AS unknown_runs`)
  return row ?? { user_micros: 0, global_micros: 0, unknown_runs: 0 }
}

/** Reconcile an entire run, including retries and continuations. Unpriced work
 * retains its reservation. Repeated settlement may raise the bill, never erase it. */
export async function settleFundedSpend(
  conversationId: string,
  runId: string,
  estimatedUsd: number,
  unknown: boolean,
) {
  if (!Number.isFinite(estimatedUsd) || estimatedUsd < 0)
    throw new Error('Invalid funded usage estimate.')
  const micros = Math.ceil(estimatedUsd * 1_000_000)
  await db.transaction(async (tx) => {
    const [receipt] = await tx.execute<{ day: string }>(
      sql`SELECT day FROM chat_funded_spend WHERE conversation_id=${conversationId} AND run_id=${runId}`,
    )
    if (!receipt) return
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${'chat-run-usage:' + receipt.day},0))`,
    )
    await tx.execute(sql`UPDATE chat_funded_spend SET
      billed_micros=GREATEST(observed_micros,${micros},CASE WHEN unknown OR ${unknown} THEN reserved_micros ELSE 0 END),
      observed_micros=GREATEST(observed_micros,${micros}),unknown=unknown OR ${unknown}
      WHERE conversation_id=${conversationId} AND run_id=${runId}`)
  })
}
