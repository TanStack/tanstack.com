import { maxSelectedSkills, skillIdentifierSchema } from './skill-identifiers'
export { maxSelectedSkills, skillIdentifierSchema } from './skill-identifiers'
import { z } from 'zod'
import { parseDocument, stringify } from 'yaml'

export const maxSkillImportBytes = 32768
export const maxSkillContextChars = 65536
const bytes = (value: string) => new TextEncoder().encode(value).byteLength
const identifier = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase())
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const skillName = z
  .string()
  .transform((value) => value.normalize('NFKC'))
  .refine(
    (value) =>
      [...value].length >= 1 &&
      [...value].length <= 64 &&
      value === value.toLowerCase() &&
      /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(value),
    'Use up to 64 lowercase letters or numbers, with single hyphens between words.',
  )
const text = (limit: number) =>
  z
    .string()
    .max(limit)
    .refine(
      (value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value),
      'Remove unsupported control characters.',
    )
    .refine(
      (value) => !/[\uD800-\uDFFF]/u.test(value),
      'Use valid Unicode text.',
    )
const documentFields = {
  name: skillName,
  description: text(1024).refine(
    (value) => !!value.trim(),
    'Add a description.',
  ),
  instructions: text(12000).refine(
    (value) => !!value.trim(),
    'Add instructions.',
  ),
  license: text(1024).optional(),
  compatibility: text(500)
    .refine((value) => !!value.trim(), 'Remove an empty compatibility field.')
    .optional(),
  // Zod deliberately omits __proto__ keys while constructing records. Reject
  // this unsupported key before conversion instead of silently losing it.
  metadata: z
    .unknown()
    .superRefine((value, context) => {
      if (
        value &&
        typeof value === 'object' &&
        Object.hasOwn(value, '__proto__')
      )
        context.addIssue({
          code: 'custom',
          message: 'The metadata key __proto__ is not supported.',
        })
    })
    .pipe(z.record(text(128).min(1), text(1024)))
    .refine(
      (value) => Object.keys(value).length <= 32,
      'Use up to 32 metadata entries.',
    )
    .optional(),
  allowedTools: text(2000).optional(),
}
function markdown(document: z.infer<z.ZodObject<typeof documentFields>>) {
  const { instructions, allowedTools, ...metadata } = document
  return `---\n${stringify({ ...metadata, ...(allowedTools === undefined ? {} : { 'allowed-tools': allowedTools }) }, { lineWidth: 0 })}---\n${instructions}`
}
export const skillDocumentSchema = z
  .object(documentFields)
  .strict()
  .refine(
    (value) =>
      bytes(JSON.stringify(value)) <= maxSkillImportBytes &&
      bytes(markdown(value)) <= maxSkillImportBytes,
    'Keep the skill under 32 KiB, including its metadata.',
  )
export type SkillDocument = z.infer<typeof skillDocumentSchema>
export const skillOriginSchema = z
  .object({
    installationId: z.string().uuid(),
    installationName: z.string().min(1).max(128),
    installedVersion: version,
    packageVersion: z.string().optional(),
    path: z.string().min(1).max(512),
    digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  })
  .strict()
export const skillSummarySchema = z
  .object({
    id: skillIdentifierSchema,
    name: skillName,
    description: text(1024),
    version,
    revision: version,
    enabled: z.boolean(),
    archived: z.boolean(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    origin: skillOriginSchema.optional(),
    kodyOrigin: z
      .object({
        packageId: z.string().uuid(),
        skillId: z.string().min(1).max(200),
      })
      .strict()
      .optional(),
  })
  .strict()
export type SkillSummary = z.infer<typeof skillSummarySchema>
export const skillVersionSchema = skillSummarySchema.extend({
  document: skillDocumentSchema,
})
export type SkillVersion = z.infer<typeof skillVersionSchema>

/** Bound the exact payload used by the instruction builder, after JSON escaping.
 * Call with the deduplicated union of explicitly selected and loaded skills.
 */
export function validateSkillContext(skills: readonly SkillVersion[]): void {
  if (skills.length > maxSelectedSkills)
    throw Error(
      'Use up to 3 skills per task. Choose fewer skills before continuing.',
    )
  const parsed = skills.map((skill) => skillVersionSchema.parse(skill))
  if (new Set(parsed.map((skill) => skill.id)).size !== parsed.length)
    throw Error('Use one version of each skill per task.')
  const payload = JSON.stringify(
    parsed.map(({ id, version, document, origin, kodyOrigin }) => ({
      id,
      version,
      ...document,
      ...(origin ? { origin } : {}),
      ...(kodyOrigin ? { kodyOrigin } : {}),
    })),
  ).replace(
    /[<>&\u2028\u2029]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
  if (payload.length > maxSkillContextChars)
    throw Error(
      'These skills are too long together. Choose fewer skills or shorter instructions before continuing.',
    )
}
const command = { id: identifier, commandId: identifier }
const existing = { ...command, expectedRevision: version }
export const skillCommandSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('create'),
      ...command,
      document: skillDocumentSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('update'),
      ...existing,
      document: skillDocumentSchema,
    })
    .strict(),
  z
    .object({ type: z.literal('enabled'), ...existing, enabled: z.boolean() })
    .strict(),
  z.object({ type: z.literal('archive'), ...existing }).strict(),
  z.object({ type: z.literal('restore'), ...existing }).strict(),
])
export type SkillCommand = z.infer<typeof skillCommandSchema>

/** Single-file Agent Skills subset. Parsing never loads referenced files or code. */
export function parseSkillMarkdown(source: string): SkillDocument {
  if (bytes(source) > maxSkillImportBytes)
    throw Error('Choose a SKILL.md file up to 32 KiB.')
  const text = source.replace(/^\uFEFF/u, '').replace(/\r\n/g, '\n')
  const match = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/u.exec(text)
  if (!match)
    throw Error(
      'SKILL.md needs YAML metadata between --- lines, followed by instructions.',
    )
  const parsed = parseDocument(match[1], {
    strict: true,
    uniqueKeys: true,
    prettyErrors: false,
  })
  if (parsed.errors.length || parsed.warnings.length)
    throw Error('The skill metadata is invalid YAML or uses unsupported tags.')
  let header: unknown
  try {
    header = parsed.toJS({ maxAliasCount: 0 })
  } catch {
    throw Error('Skill metadata cannot use YAML aliases.')
  }
  if (!header || typeof header !== 'object' || Array.isArray(header))
    throw Error('Skill metadata must be a YAML mapping.')
  const known = new Set([
    'name',
    'description',
    'license',
    'compatibility',
    'metadata',
    'allowed-tools',
  ])
  const extra = Object.keys(header).filter((key) => !known.has(key))
  if (extra.length)
    throw Error(
      `Unsupported skill metadata: ${extra.join(', ')}. TanChat does not interpret host-specific fields.`,
    )
  const { 'allowed-tools': allowedTools, ...fields } = header as Record<
    string,
    unknown
  >
  const result = skillDocumentSchema.safeParse({
    ...fields,
    ...(allowedTools === undefined ? {} : { allowedTools }),
    instructions: text.slice(match[0].length),
  })
  if (!result.success)
    throw Error(
      result.error.issues[0]?.message ??
        'Check the skill metadata and instructions.',
    )
  return result.data
}
export function serializeSkillMarkdown(document: SkillDocument) {
  return markdown(skillDocumentSchema.parse(document))
}
