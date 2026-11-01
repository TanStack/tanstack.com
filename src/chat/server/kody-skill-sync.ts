import { sql } from 'drizzle-orm'
import { db } from '~/db/client'
import { parseSkillMarkdown } from '../core/skills'
import { hash, stableOperationId } from './crypto'
import { KodyConnectionError, kodyCall, type KodyEnvironment } from './kody'
import { SkillError, type SkillScope } from './skills'
import { collectKodySkills } from './kody-skill-source'
import { kodySkillAccount } from './kody-skill-account'
const freshness = 5 * 60_000
const syncTimeout = 90_000
const leaseDuration = syncTimeout + 10_000
const stageChunkBytes = 500_000
export async function syncKodySkills(
  env: KodyEnvironment,
  scope: SkillScope,
  before: { fingerprint: string },
  call: typeof kodyCall,
) {
  const startedAt = Date.now()
  const [reservation] = await db.execute<{ revision: number }>(sql`
    INSERT INTO chat_kody_skill_sync(user_id,account_fingerprint,fetched_at,revision,lease_until)
    VALUES(${scope.userId},${before.fingerprint},0,1,${startedAt + leaseDuration})
    ON CONFLICT(user_id) DO UPDATE SET revision=chat_kody_skill_sync.revision+1,lease_until=excluded.lease_until
    WHERE chat_kody_skill_sync.account_fingerprint<>excluded.account_fingerprint
      OR (chat_kody_skill_sync.lease_until<=${startedAt} AND (chat_kody_skill_sync.fetched_at<=0 OR chat_kody_skill_sync.fetched_at<=${startedAt - freshness}))
    RETURNING revision`)
  if (!reservation) return false
  let committed = false
  try {
    let skills: Awaited<ReturnType<typeof collectKodySkills>>
    try {
      skills = await collectKodySkills(
        env,
        scope,
        call,
        AbortSignal.timeout(syncTimeout),
      )
    } catch (error) {
      if (error instanceof SkillError) throw error
      if (error instanceof KodyConnectionError)
        throw new SkillError(error.message, 401)
      throw new SkillError(
        'Kody skills could not be synchronized. Try again.',
        502,
      )
    }
    const current = await kodySkillAccount(env, scope)
    if (!current || current.fingerprint !== before.fingerprint)
      throw new SkillError('Kody connection or access changed. Try again.', 409)
    const now = Date.now()
    const rows = await Promise.all(
      skills.map(async (skill) => {
        const file = skill.files.find((item) => item.path === 'SKILL.md')
        if (!file)
          throw new SkillError(`Kody skill ${skill.name} has no SKILL.md.`, 502)
        let document
        try {
          document = parseSkillMarkdown(file.content)
        } catch {
          throw new SkillError(
            `Kody skill ${skill.name} uses an unsupported SKILL.md format.`,
            502,
          )
        }
        const id = `kody:${await stableOperationId(['kody-skill', skill.packageId, skill.id])}`
        const digest = await hash(JSON.stringify([document, skill.files]))
        const raw = Uint8Array.from(
          atob(digest.replaceAll('-', '+').replaceAll('_', '/')),
          (c) => c.charCodeAt(0),
        )
        const version =
          raw.slice(0, 6).reduce((value, byte) => value * 256 + byte, 0) + 1
        return {
          id,
          version,
          packageId: skill.packageId,
          sourceSkillId: skill.id,
          name: document.name,
          description: document.description,
          document: JSON.stringify(document),
          files: JSON.stringify(skill.files),
          updatedAt: Date.parse(skill.updated_at) || now,
        }
      }),
    )
    if (new Set(rows.map((row) => row.id)).size !== rows.length)
      throw new SkillError('Kody returned duplicate skill identities.', 502)
    let chunk: typeof rows = []
    let chunkBytes = 2
    const writeChunk = async () => {
      if (!chunk.length) return
      await db.execute(sql`
        INSERT INTO chat_kody_skill_sync_stage(user_id,revision,id,payload)
        SELECT ${scope.userId},${reservation.revision},value->>'id',value FROM jsonb_array_elements(${JSON.stringify(chunk)}::jsonb)
        WHERE EXISTS(SELECT 1 FROM chat_kody_skill_sync WHERE user_id=${scope.userId} AND revision=${reservation.revision})`)
      chunk = []
      chunkBytes = 2
    }
    for (const row of rows) {
      const size = new TextEncoder().encode(JSON.stringify(row)).byteLength
      if (chunk.length && chunkBytes + size + 1 > stageChunkBytes)
        await writeChunk()
      chunk.push(row)
      chunkBytes += size + 1
      if (chunkBytes >= stageChunkBytes) await writeChunk()
    }
    await writeChunk()
    const [staged] = await db.execute<{ count: number }>(
      sql`SELECT count(*)::integer AS count FROM chat_kody_skill_sync_stage WHERE user_id=${scope.userId} AND revision=${reservation.revision}`,
    )
    if (staged?.count !== rows.length)
      throw new SkillError('Kody changed during skill sync. Try again.', 409)
    const afterStage = await kodySkillAccount(env, scope)
    if (!afterStage || afterStage.fingerprint !== before.fingerprint)
      throw new SkillError('Kody connection or access changed. Try again.', 409)
    await db.transaction(async (tx) => {
      const [owner] = await tx.execute(
        sql`SELECT revision FROM chat_kody_skill_sync WHERE user_id=${scope.userId} AND revision=${reservation.revision} FOR UPDATE`,
      )
      if (!owner)
        throw new SkillError('Kody changed during skill sync. Try again.', 409)
      await tx.execute(
        sql`UPDATE chat_kody_skill_versions SET current=false WHERE user_id=${scope.userId}`,
      )
      await tx.execute(sql`
        INSERT INTO chat_kody_skill_versions(user_id,id,version,package_id,source_skill_id,name,description,document,files,updated_at,current)
        SELECT user_id,payload->>'id',(payload->>'version')::bigint,(payload->>'packageId')::uuid,
          payload->>'sourceSkillId',payload->>'name',payload->>'description',
          (payload->>'document')::jsonb,(payload->>'files')::jsonb,(payload->>'updatedAt')::bigint,true
        FROM chat_kody_skill_sync_stage WHERE user_id=${scope.userId} AND revision=${reservation.revision}
        ON CONFLICT(user_id,id,version) DO UPDATE SET current=true`)
      await tx.execute(
        sql`UPDATE chat_kody_skill_sync SET account_fingerprint=${before.fingerprint},fetched_at=${now},lease_until=0 WHERE user_id=${scope.userId} AND revision=${reservation.revision}`,
      )
      await tx.execute(
        sql`DELETE FROM chat_kody_skill_sync_stage WHERE user_id=${scope.userId} AND revision=${reservation.revision}`,
      )
    })
    committed = true
    return true
  } finally {
    if (!committed) {
      try {
        await db.execute(
          sql`DELETE FROM chat_kody_skill_sync_stage WHERE user_id=${scope.userId} AND revision=${reservation.revision}`,
        )
      } finally {
        await db.execute(
          sql`UPDATE chat_kody_skill_sync SET lease_until=0 WHERE user_id=${scope.userId} AND revision=${reservation.revision}`,
        )
      }
    }
  }
}
