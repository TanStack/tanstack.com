import { z } from 'zod'

const packageDetailSchema = z.object({
  structuredContent: z.object({
    result: z.object({
      kind: z.literal('entity'),
      type: z.literal('package'),
      detailMode: z.enum(['index', 'export', 'file']),
    }),
  }),
})

export function kodyPackageDetailMode(raw: unknown) {
  const parsed = packageDetailSchema.safeParse(raw)
  return parsed.success ? parsed.data.structuredContent.result.detailMode : null
}

const packageIdSchema = z.uuid()
const packageSelectorSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[@A-Za-z0-9._/-]+$/)
const subpathSchema = z
  .string()
  .regex(/^\.(?:\/[A-Za-z0-9._/-]+)?$/)
  .refine((value) => !value.split('/').includes('..') && !value.includes('//'))

export function parseKodyPackageRef(entity: string) {
  const match = /^package:([^#]+)#(.+)$/.exec(entity)
  if (!match) return null
  const selector = packageSelectorSchema.safeParse(match[1])
  const subpath = subpathSchema.safeParse(
    match[2] === '.' || match[2].startsWith('./') ? match[2] : `./${match[2]}`,
  )
  if (!selector.success || !subpath.success) return null
  return {
    selector: selector.data,
    packageId: packageIdSchema.safeParse(selector.data).success
      ? selector.data
      : null,
    subpath: subpath.data,
  }
}

/** Read only the named export's public contract from Kody's package metadata. */
export function kodyPackageActionCode(entity: string) {
  const ref = parseKodyPackageRef(entity)
  if (!ref) throw new Error('Use an exact Kody package export reference.')
  return `import { kody } from 'kody:runtime'
export default async function main() {
  const selector = ${JSON.stringify(ref.selector)}
  let packageId = ${JSON.stringify(ref.packageId)}
  const subpath = ${JSON.stringify(ref.subpath)}
  if (!packageId) {
    const listing = await kody.packageList({})
    if (!Array.isArray(listing.packages)) throw new Error('Unsupported Kody package index')
    const candidates = listing.packages.filter(item => item.kody_id === selector || item.name === selector)
    if (candidates.length !== 1 || typeof candidates[0].package_id !== 'string') throw new Error('Kody package is unavailable')
    packageId = candidates[0].package_id
  }
  const before = await kody.repoShowPublishNote({ package_id: packageId })
  const pkg = await kody.packageGet({ package_id: packageId })
  if (pkg.package_id !== packageId || typeof pkg.source_id !== 'string' || !Array.isArray(pkg.exports)) throw new Error('Unsupported Kody package metadata')
  if (selector !== packageId && pkg.kody_id !== selector && pkg.name !== selector) throw new Error('Kody package identity changed')
  const published = await kody.repoShowPublishNote({ package_id: packageId })
  if (before.source_id !== pkg.source_id || before.commit !== published.commit || published.source_id !== pkg.source_id || !/^[a-f0-9]{40}$/.test(published.commit)) throw new Error('Kody package changed during inspection')
  const matches = pkg.exports.filter(item => item.subpath === subpath)
  if (matches.length !== 1 || !Array.isArray(matches[0].functions)) throw new Error('Kody package export is unavailable')
  const selected = matches[0]
  return {
    format: 'gum-kody-package-action-v1',
    packageId,
    sourceId: pkg.source_id,
    publishedCommit: published.commit,
    kodyId: pkg.kody_id ?? null,
    packageName: pkg.name ?? null,
    subpath,
    title: (selected.name || selected.subpath || selected.import_specifier).slice(0, 200),
    importSpecifier: selected.import_specifier,
    functions: selected.functions.map(fn => ({
      name: fn.name,
      typeDefinition: fn.type_definition ?? null,
      description: fn.description ?? null,
    })),
  }
}`
}

const actionSchema = z.object({
  format: z.literal('gum-kody-package-action-v1'),
  packageId: packageIdSchema,
  sourceId: z.uuid(),
  publishedCommit: z.string().regex(/^[a-f0-9]{40}$/),
  kodyId: z.string().nullable(),
  packageName: z.string().nullable(),
  subpath: subpathSchema,
  title: z.string().min(1).max(200),
  importSpecifier: z.string().min(1).max(500),
  functions: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        typeDefinition: z.string().nullable(),
        description: z.string().nullable(),
      }),
    )
    .max(100),
})

function actionTitle(description: string | null, fallback: string) {
  const firstLine = description
    ?.trim()
    .replace(/^\*\s*/, '')
    .split(/\r?\n|\s+@[A-Za-z][\w-]*\b/, 1)[0]
    ?.trim()
  const firstSentence = firstLine?.match(/^.+?[.!?](?=\s|$)/)?.[0]
  const title = firstSentence || firstLine || fallback
  if (title.length <= 120) return title
  const lastSpace = title.lastIndexOf(' ', 120)
  return `${title.slice(0, lastSpace > 40 ? lastSpace : 120).trimEnd()}…`
}

export function readKodyPackageAction(raw: unknown, entity: string) {
  const ref = parseKodyPackageRef(entity)
  if (!ref) throw new Error('Use an exact Kody package export reference.')
  const envelope = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({ result: z.unknown() }),
    })
    .parse(raw)
  if (envelope.isError) throw new Error('Kody package lookup failed.')
  const action = actionSchema.parse(envelope.structuredContent.result)
  if (
    (ref.packageId
      ? action.packageId !== ref.packageId
      : action.kodyId !== ref.selector &&
        action.packageName !== ref.selector) ||
    action.subpath !== ref.subpath
  )
    throw new Error(
      'Kody package export did not match the requested reference.',
    )
  if (
    new Set(action.functions.map((fn) => fn.name)).size !==
    action.functions.length
  )
    throw new Error('Kody package export has duplicate function names.')
  return {
    kind: 'entity' as const,
    type: 'package',
    id: action.packageId,
    sourceId: action.sourceId,
    publishedCommit: action.publishedCommit,
    entityRef: entity,
    title: actionTitle(
      action.functions.length === 1 ? action.functions[0].description : null,
      action.title,
    ),
    importSpecifier: action.importSpecifier,
    functions: action.functions.map((fn) => ({
      name: fn.name,
      title: actionTitle(
        fn.description,
        fn.name === 'default' ? action.title : fn.name,
      ),
      ...(fn.typeDefinition ? { typeDefinition: fn.typeDefinition } : {}),
    })),
  }
}

export const KODY_PACKAGE_REVISION_CODE = `import { kody } from 'kody:runtime'
export default async function main(params) {
  const published = await kody.repoShowPublishNote({ package_id: params.packageId })
  return { sourceId: published.source_id, publishedCommit: published.commit }
}`

export class KodyPackageRevisionChangedError extends Error {
  constructor() {
    super(
      'This Kody package changed after its action was prepared. Inspect it again before running it. No Kody action ran.',
    )
    this.name = 'KodyPackageRevisionChangedError'
  }
}

/** Refuse an approval if Kody has published different package code. */
export function assertKodyPackageRevision(
  raw: unknown,
  expected: { sourceId: string; publishedCommit: string },
) {
  const parsed = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.object({
        result: z.object({
          sourceId: z.uuid(),
          publishedCommit: z.string().regex(/^[a-f0-9]{40}$/),
        }),
      }),
    })
    .safeParse(raw)
  if (!parsed.success || parsed.data.isError)
    throw new Error('The current Kody package revision could not be checked.')
  if (
    parsed.data.structuredContent.result.sourceId !== expected.sourceId ||
    parsed.data.structuredContent.result.publishedCommit !==
      expected.publishedCommit
  )
    throw new KodyPackageRevisionChangedError()
}
