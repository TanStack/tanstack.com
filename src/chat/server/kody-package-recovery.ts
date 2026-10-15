import { z } from 'zod'
import { parseKodyPackageRef } from './kody-package-actions'

export const kodyPackageIndexResponseSchema = z.object({
  isError: z.boolean().optional(),
  structuredContent: z.object({
    result: z.object({
      kind: z.literal('entity'),
      type: z.literal('package'),
      detailMode: z.literal('index'),
      packageId: z.uuid(),
      kodyId: z.string().nullable(),
      name: z.string(),
      readmeIntent: z.object({ path: z.string() }).nullable().optional(),
      agentsDocs: z.object({ path: z.string() }).nullable().optional(),
    }),
  }),
})
export const kodyPackageFileResponseSchema = z.object({
  isError: z.boolean().optional(),
  structuredContent: z.object({
    result: z.object({
      kind: z.literal('entity'),
      type: z.literal('package'),
      detailMode: z.literal('file'),
      packageId: z.uuid(),
      path: z.string(),
      content: z.string(),
      truncated: z.boolean().optional(),
    }),
  }),
})

export const safeKodyPackagePath = (path: string) =>
  path.length <= 200 &&
  /^[A-Za-z0-9._/-]+$/.test(path) &&
  path.split('/').every((part) => part && part !== '.' && part !== '..')

/** Read the exact package's own setup document after one of its actions fails. */
export async function readFailedKodyPackageDocumentation(
  actionEntity: string,
  search: (entity: string) => Promise<unknown>,
) {
  const action = parseKodyPackageRef(actionEntity)
  if (!action) return null
  const rawIndex = kodyPackageIndexResponseSchema.safeParse(
    await search(`package:${action.selector}`),
  )
  if (!rawIndex.success || rawIndex.data.isError) return null
  const index = rawIndex.data.structuredContent.result
  if (
    action.packageId
      ? index.packageId !== action.packageId
      : index.kodyId !== action.selector && index.name !== action.selector
  )
    return null
  const path = index.readmeIntent?.path
  if (!path || !safeKodyPackagePath(path)) return null
  const entity = `package:${index.packageId}#${path}`
  const rawFile = kodyPackageFileResponseSchema.safeParse(await search(entity))
  if (!rawFile.success || rawFile.data.isError) return null
  const file = rawFile.data.structuredContent.result
  if (file.packageId !== index.packageId || file.path !== path) return null
  return {
    entity,
    content: file.content.slice(0, 10000),
    excerpted: file.truncated === true || file.content.length > 10000,
  }
}
