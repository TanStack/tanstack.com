import { z } from 'zod'

export const kodyPackageDocumentKindSchema = z.enum(['readme', 'agents'])
export const kodyPackageDocumentSchema = z.object({
  path: z.string().min(1).max(200),
  content: z.string().max(20000),
  excerpted: z.boolean(),
})

export type KodyPackageDocumentKind = z.infer<
  typeof kodyPackageDocumentKindSchema
>
