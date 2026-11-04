import { readFile } from 'node:fs/promises'
import { isDeepStrictEqual, parseArgs } from 'node:util'
import postgres from 'postgres'
import * as v from 'valibot'

const { values } = parseArgs({
  options: {
    plan: {
      type: 'string',
      default: 'docs/showcase-review/placement-plan.json',
    },
    apply: { type: 'boolean', default: false },
    'actor-id': { type: 'string' },
  },
})
const decisionSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  name: v.string(),
  url: v.string(),
  previousStatus: v.picklist(['pending', 'approved', 'denied']),
  placement: v.picklist(['showcase', 'community', 'private']),
  reviewedAt: v.pipe(
    v.string(),
    v.check(
      (value) => Number.isFinite(Date.parse(value)),
      'Invalid review date',
    ),
  ),
  reason: v.pipe(v.string(), v.trim(), v.minLength(1)),
  notes: v.string(),
  holdReason: v.nullable(v.string()),
})
const plan = v.parse(
  v.array(decisionSchema),
  JSON.parse(await readFile(values.plan, 'utf8')),
)
if (new Set(plan.map((item) => item.id)).size !== plan.length)
  throw new Error('Duplicate submission IDs in plan')
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const actorId = values.apply
  ? v.parse(v.pipe(v.string(), v.uuid()), values['actor-id'])
  : null
const sql = postgres(process.env.DATABASE_URL, { max: 1 })
try {
  await sql.begin(async (tx) => {
    if (actorId) {
      const [rawActor] = await tx.unsafe(
        `SELECT EXISTS (
        SELECT 1 FROM users WHERE id = $1 AND (
          capabilities::text::capability[] && ARRAY['admin', 'moderate-showcases']::capability[] OR
          EXISTS (SELECT 1 FROM role_assignments a JOIN roles r ON r.id = a.role_id
            WHERE a.user_id = users.id AND r.capabilities::text::capability[] && ARRAY['admin', 'moderate-showcases']::capability[])
        )) AS allowed`,
        [actorId],
      )
      const actor = v.parse(v.object({ allowed: v.boolean() }), rawActor)
      if (!actor.allowed)
        throw new Error('The actor must have showcase moderation permission')
    }
    let ready = 0
    let unchanged = 0
    const blocked: { id: string; name: string; reason: string }[] = []
    for (const item of plan) {
      if (item.holdReason) {
        blocked.push({ id: item.id, name: item.name, reason: item.holdReason })
        continue
      }
      const [raw] = await tx.unsafe(
        'SELECT * FROM showcases WHERE id = $1 FOR UPDATE',
        [item.id],
      )
      if (!raw) {
        blocked.push({
          id: item.id,
          name: item.name,
          reason: 'Submission is missing',
        })
        continue
      }
      const row = v.parse(
        v.object({
          name: v.string(),
          url: v.string(),
          status: v.string(),
          placement: v.string(),
          review_reason: v.nullable(v.string()),
          updated_at: v.date(),
        }),
        raw,
      )
      const status =
        item.placement === 'private'
          ? item.previousStatus === 'approved'
            ? 'approved'
            : 'denied'
          : 'approved'
      if (
        row.name === item.name &&
        new URL(row.url).href === new URL(item.url).href &&
        row.placement === item.placement &&
        row.status === status &&
        row.review_reason === item.reason
      ) {
        // A prior apply updates updated_at. Only treat that newer row as an
        // idempotent replay when it still matches the persisted audit snapshot.
        const [audit] = await tx.unsafe(
          `SELECT details->'after' AS after FROM audit_logs
           WHERE target_type = 'showcase' AND target_id = $1
             AND details->>'source' = 'showcase-review-migration'
           ORDER BY created_at DESC LIMIT 1`,
          [item.id],
        )
        if (
          row.updated_at <= new Date(item.reviewedAt) ||
          isDeepStrictEqual(audit?.after, JSON.parse(JSON.stringify(raw)))
        ) {
          unchanged++
          continue
        }
      }
      if (
        row.name !== item.name ||
        new URL(row.url).href !== new URL(item.url).href ||
        row.status !== item.previousStatus ||
        row.updated_at > new Date(item.reviewedAt)
      ) {
        blocked.push({
          id: item.id,
          name: item.name,
          reason:
            'Submission changed since review, review the current version first',
        })
        continue
      }
      ready++
      if (actorId) {
        const [after] = await tx.unsafe(
          `UPDATE showcases SET
          status = $1, placement = $2::showcase_placement, review_reason = $3,
          moderation_note = $4, moderated_at = $5, moderated_by = $6,
          is_featured = CASE WHEN $2::showcase_placement = 'showcase' THEN is_featured ELSE false END,
          updated_at = now() WHERE id = $7 RETURNING *`,
          [
            status,
            item.placement,
            item.reason,
            item.notes,
            item.reviewedAt,
            actorId,
            item.id,
          ],
        )
        await tx.unsafe(
          `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details)
          VALUES ($1, 'showcase.moderate', 'showcase', $2, $3::text::jsonb)`,
          [
            actorId,
            item.id,
            JSON.stringify({
              source: 'showcase-review-migration',
              before: raw,
              after,
            }),
          ],
        )
      }
    }
    console.log(
      JSON.stringify(
        { mode: values.apply ? 'apply' : 'preview', ready, unchanged, blocked },
        null,
        2,
      ),
    )
    // Any stale record aborts the entire apply, so a partial batch cannot go unnoticed.
    if (values.apply && blocked.length)
      throw new Error(
        'Nothing applied. Resolve held or changed entries, or supply an explicitly narrowed plan.',
      )
  })
} finally {
  await sql.end()
}
