import { z } from 'zod'
import type { KodyEnvironment } from './kody'
import { kodyCall } from './kody'
import {
  collectKodyInventory,
  KODY_INVENTORY_CODE,
  readKodyInventory,
} from './discovery-integrations/kody-inventory'
import { kodyInternalReadArgs } from './kody-internal-read'
import { SkillError, type SkillScope } from './skills'
const sourcePageSize = 20
const sourcePageBytes = 700_000
const importSpecifier = /^kody:[@a-z0-9][a-z0-9@/._-]{0,199}$/u
const registryItem = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  description: z.string().max(1024),
  files: z.array(z.string().min(1).max(512)).max(32),
  updated_at: z.string(),
})
const fileSchema = z.object({
  path: z.string().min(1).max(512),
  content: z.string().max(32768),
})
const sourceSkill = registryItem.extend({
  files: z.array(fileSchema).max(32),
  packageId: z.string().uuid(),
})
const sourceEnvelope = z.object({
  skills: z.array(sourceSkill).max(sourcePageSize),
  page: z.object({
    offset: z.number().int().nonnegative(),
    next: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  }),
  errors: z.array(z.string()).max(10),
})
function result(raw: unknown): unknown {
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({ result: z.unknown() }),
    })
    .parse(raw)
  if (envelope.isError) throw new Error('Kody returned an error.')
  return envelope.structuredContent.result
}

export async function collectKodySkills(
  env: KodyEnvironment,
  scope: SkillScope,
  call: typeof kodyCall,
  signal: AbortSignal,
) {
  const inventory = readKodyInventory(
    await collectKodyInventory(
      (page, cursor) =>
        call(
          env,
          scope.userId,
          'execute',
          kodyInternalReadArgs({
            code: KODY_INVENTORY_CODE,
            ...(page ? { params: { page, cursor } } : {}),
            responseLimit: 1000000,
          }),
          signal,
        ),
      signal,
    ),
  )
  if (!inventory.complete)
    throw new SkillError('Kody returned an incomplete package inventory.', 502)
  const groups = new Map<string, { list?: string; get?: string }>()
  for (const entry of inventory.inventory.exports) {
    if (
      !entry.packageId ||
      entry.exportName !== 'default' ||
      !importSpecifier.test(entry.importSpecifier)
    )
      continue
    const group = groups.get(entry.packageId) ?? {}
    if (entry.subpath === './skill-list') group.list = entry.importSpecifier
    if (entry.subpath === './skill-get') group.get = entry.importSpecifier
    groups.set(entry.packageId, group)
  }
  const registries = [...groups].filter(([, pair]) => pair.list && pair.get)
  if (!registries.length) return []
  // Import paths come only from Kody's validated package inventory. The adapter
  // recognizes a list/get contract and never invokes package mutation exports.
  const readRegistry = async ([
    packageId,
    pair,
  ]: (typeof registries)[number]) => {
    const skills: z.infer<typeof sourceSkill>[] = []
    const code = `import listSkills from ${JSON.stringify(pair.list)}
import getSkill from ${JSON.stringify(pair.get)}
export default async function main(params) {
  const listed = await listSkills()
  if (!Array.isArray(listed)) throw new Error('Unsupported skill index')
  const items = [...listed].sort((a, b) => String(a?.id).localeCompare(String(b?.id)))
  if (items.some(item => !item || typeof item.id !== 'string')) throw new Error('Unsupported skill identity')
  const index = JSON.stringify(items.map(item => [item.id, item.name, item.description, item.updated_at, item.files]))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(index))
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const offset = params?.offset ?? 0
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > items.length) throw new Error('Unsupported skill page')
  const skills = []
  let bytes = 0
  let next = offset
  for (; next < Math.min(items.length, offset + ${sourcePageSize}); next++) {
    const item = items[next]
    const skill = await getSkill({ id: item.id })
    const entry = { ...item, ...skill, packageId: ${JSON.stringify(packageId)} }
    const size = new TextEncoder().encode(JSON.stringify(entry)).byteLength
    if (bytes + size > ${sourcePageBytes}) {
      if (!skills.length) throw new Error('Skill document is too large')
      break
    }
    bytes += size
    skills.push(entry)
  }
  return { skills, page: { offset, next, total: items.length, fingerprint }, errors: [] }
}`
    let offset = 0
    let expected: { total: number; fingerprint: string } | undefined
    do {
      const parsed = sourceEnvelope.parse(
        result(
          await call(
            env,
            scope.userId,
            'execute',
            kodyInternalReadArgs({
              code,
              params: { offset },
              responseLimit: 1000000,
            }),
            signal,
          ),
        ),
      )
      const { page } = parsed
      if (
        parsed.errors.length ||
        page.offset !== offset ||
        page.next > page.total ||
        page.next - page.offset !== parsed.skills.length ||
        parsed.skills.some((skill) => skill.packageId !== packageId) ||
        (page.next === offset && page.total > offset) ||
        (expected &&
          (page.total !== expected.total ||
            page.fingerprint !== expected.fingerprint))
      )
        throw new SkillError('Kody skill index changed during sync.', 409)
      expected ??= { total: page.total, fingerprint: page.fingerprint }
      skills.push(...parsed.skills)
      offset = page.next
    } while (offset < expected.total)
    return skills
  }
  const skills: z.infer<typeof sourceSkill>[] = []
  for (let start = 0; start < registries.length; start += 3) {
    const group = await Promise.all(
      registries.slice(start, start + 3).map(readRegistry),
    )
    skills.push(...group.flat())
  }
  return skills
}
