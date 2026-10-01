import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { db } from '~/db/client'
import {
  skillSummarySchema,
  skillVersionSchema,
  type SkillSummary,
  type SkillVersion,
} from '../core/skills'
import { kodyCall, type KodyEnvironment } from './kody'
import { SkillError, type SkillScope } from './skills'
import { kodySkillAccount } from './kody-skill-account'
import { syncKodySkills } from './kody-skill-sync'
const freshness = 5 * 60_000
const leaseDuration = 100_000
const waitInterval = 500
const fileSchema = z.object({
  path: z.string().min(1).max(512),
  content: z.string().max(32768),
})
type Row = {
  id: string
  version: number
  package_id: string
  source_skill_id: string
  name: string
  description: string
  document: string
  files: string
  updated_at: number
}
async function syncState(userId: string) {
  const [row] = await db.execute<{
    account_fingerprint: string
    fetched_at: number
    revision: number
  }>(
    sql`SELECT account_fingerprint,fetched_at::double precision AS fetched_at,revision::double precision AS revision FROM chat_kody_skill_sync WHERE user_id=${userId}`,
  )
  return row
}
export type KodySkillSuggestion = Pick<
  SkillSummary,
  'id' | 'version' | 'name' | 'description'
>

const ignoredSearchWords = new Set(
  'a an and are at be can called do find for from have i in is it kody me my of on or please skill skills that the this to use what with you your'.split(
    ' ',
  ),
)

function searchWords(value: string) {
  return new Set(
    (value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter((word) => word.length > 2 && !ignoredSearchWords.has(word))
      .map((word) =>
        word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word,
      ),
  )
}

/** Suggest cached skill identities, never their instruction content. */
export function rankKodySkillSuggestions(
  skills: readonly KodySkillSuggestion[],
  request: string,
  limit = 3,
): KodySkillSuggestion[] {
  if (skills.length <= limit)
    return [...skills].sort((a, b) => a.id.localeCompare(b.id))
  return matchingKodySkills(skills, request, limit)
}

/** Search the complete synced index with ordinary request words, not exact phrasing. */
export function searchKodySkillSuggestions(
  skills: readonly KodySkillSuggestion[],
  request: string,
  limit = 20,
): KodySkillSuggestion[] {
  if (!request.trim())
    return [...skills]
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .slice(0, limit)
  return matchingKodySkills(skills, request, limit)
}

function matchingKodySkills(
  skills: readonly KodySkillSuggestion[],
  request: string,
  limit: number,
): KodySkillSuggestion[] {
  const query = [...searchWords(request)]
  if (!query.length) return []
  const lowered = request.toLocaleLowerCase()
  return skills
    .map((skill) => {
      const name = searchWords(skill.name)
      const description = searchWords(skill.description)
      const exact = lowered.includes(skill.name.toLocaleLowerCase())
      const nameMatches = query.filter((word) => name.has(word)).length
      const descriptionMatches = query.filter((word) =>
        description.has(word),
      ).length
      const matches = query.filter(
        (word) => name.has(word) || description.has(word),
      ).length
      return {
        skill,
        exact,
        nameMatches,
        matches,
        score: (exact ? 100 : 0) + nameMatches * 4 + descriptionMatches,
      }
    })
    .filter((item) => item.exact || item.matches > 0)
    .sort((a, b) => b.score - a.score || a.skill.id.localeCompare(b.skill.id))
    .slice(0, limit)
    .map(({ skill }) => skill)
}
export async function suggestKodySkills(
  env: KodyEnvironment,
  scope: SkillScope,
  request: string,
): Promise<KodySkillSuggestion[]> {
  const current = await kodySkillAccount(env, scope)
  if (!current) return []
  const saved = await syncState(scope.userId)
  if (
    !saved ||
    saved.account_fingerprint !== current.fingerprint ||
    saved.fetched_at <= 0
  )
    return []
  const skills: KodySkillSuggestion[] = []
  let lastId = ''
  while (true) {
    const rows = {
      results: await db.execute<KodySkillSuggestion>(
        sql`SELECT id,version::double precision AS version,name,description FROM chat_kody_skill_versions WHERE user_id=${scope.userId} AND current=true AND id>${lastId} ORDER BY id LIMIT 200`,
      ),
    }
    skills.push(...rows.results)
    if (rows.results.length < 200) break
    lastId = rows.results.at(-1)!.id
  }
  const after = await kodySkillAccount(env, scope)
  if (!after || after.fingerprint !== current.fingerprint) return []
  return rankKodySkillSuggestions(skills, request)
}
export class KodySkillCatalog {
  constructor(
    private env: KodyEnvironment,
    private scope: SkillScope,
    private call: typeof kodyCall = kodyCall,
  ) {}

  private async ready() {
    const current = await kodySkillAccount(this.env, this.scope)
    if (!current) return false
    const deadline = Date.now() + leaseDuration + 5_000
    while (true) {
      const saved = await syncState(this.scope.userId)
      if (
        saved &&
        saved.account_fingerprint === current.fingerprint &&
        saved.fetched_at > 0 &&
        Date.now() - saved.fetched_at < freshness
      )
        break
      if (Date.now() >= deadline)
        throw new SkillError('Kody skills are still syncing. Try again.', 503)
      if (await syncKodySkills(this.env, this.scope, current, this.call))
        continue
      await new Promise((resolve) => setTimeout(resolve, waitInterval))
    }
    const after = await kodySkillAccount(this.env, this.scope)
    if (!after || after.fingerprint !== current.fingerprint)
      throw new SkillError('Kody connection or access changed. Try again.', 409)
    return true
  }

  async list(query = ''): Promise<SkillSummary[]> {
    if (!(await this.ready())) return []
    return this.listRows(query)
  }

  /** Inspect only a complete, account-bound cache before deciding what to refresh. */
  async cached(): Promise<{
    status: 'ready' | 'stale' | 'missing'
    items: SkillSummary[]
  }> {
    const current = await kodySkillAccount(this.env, this.scope)
    if (!current) return { status: 'missing', items: [] }
    const saved = await syncState(this.scope.userId)
    if (
      !saved ||
      saved.account_fingerprint !== current.fingerprint ||
      saved.fetched_at <= 0
    )
      return { status: 'missing', items: [] }
    const items = await this.listRows()
    const latest = await syncState(this.scope.userId)
    const after = await kodySkillAccount(this.env, this.scope)
    if (
      !after ||
      after.fingerprint !== current.fingerprint ||
      !latest ||
      latest.account_fingerprint !== saved.account_fingerprint ||
      latest.fetched_at !== saved.fetched_at ||
      latest.revision !== saved.revision
    )
      return { status: 'missing', items: [] }
    return {
      status: Date.now() - saved.fetched_at < freshness ? 'ready' : 'stale',
      items,
    }
  }

  private async listRows(query = ''): Promise<SkillSummary[]> {
    const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean)
    const found: SkillSummary[] = []
    let offset = 0
    while (true) {
      const rows = {
        results: await db.execute<Row>(
          sql`SELECT id,version::double precision AS version,package_id,source_skill_id,name,description,updated_at::double precision AS updated_at FROM chat_kody_skill_versions WHERE user_id=${this.scope.userId} AND current=true ORDER BY lower(name),id LIMIT 200 OFFSET ${offset}`,
        ),
      }
      found.push(
        ...rows.results
          .filter((row) =>
            words.every((word) =>
              `${row.name} ${row.description}`
                .toLocaleLowerCase()
                .includes(word),
            ),
          )
          .map((row) => this.summary(row)),
      )
      if (rows.results.length < 200) return found
      offset += rows.results.length
    }
  }

  private summary(row: Row): SkillSummary {
    return skillSummarySchema.parse({
      id: row.id,
      name: row.name,
      description: row.description,
      version: row.version,
      revision: row.version,
      enabled: true,
      archived: false,
      createdAt: row.updated_at,
      updatedAt: row.updated_at,
      kodyOrigin: { packageId: row.package_id, skillId: row.source_skill_id },
    })
  }

  async inspect(id: string, version?: number): Promise<SkillVersion> {
    if (!(await this.ready()))
      throw new SkillError('Connect Kody to use this skill.', 409)
    const [current] = await db.execute(
      sql`SELECT 1 FROM chat_kody_skill_versions WHERE user_id=${this.scope.userId} AND id=${id} AND current=true`,
    )
    if (!current)
      throw new SkillError('This Kody skill is no longer available.', 404)
    const [row] = await db.execute<Row>(
      sql`SELECT id,version::double precision AS version,package_id,source_skill_id,name,description,document::text AS document,files::text AS files,updated_at::double precision AS updated_at FROM chat_kody_skill_versions WHERE user_id=${this.scope.userId} AND id=${id} AND version=COALESCE(${version ?? null}::bigint,(SELECT version FROM chat_kody_skill_versions WHERE user_id=${this.scope.userId} AND id=${id} AND current=true))`,
    )
    if (!row)
      throw new SkillError('This Kody skill version is unavailable.', 404)
    return skillVersionSchema.parse({
      ...this.summary(row),
      document: JSON.parse(row.document),
    })
  }

  async readFile(id: string, version: number, path: string) {
    await this.inspect(id, version)
    const [row] = await db.execute<{ files: string }>(
      sql`SELECT files::text AS files FROM chat_kody_skill_versions WHERE user_id=${this.scope.userId} AND id=${id} AND version=${version}`,
    )
    const files = z.array(fileSchema).parse(JSON.parse(row!.files))
    const file = files.find((file) => file.path === path)
    if (!file) throw new SkillError('This Kody skill file is unavailable.', 404)
    return file
  }
}
