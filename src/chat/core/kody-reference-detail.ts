import { z } from 'zod'

export const kodyReferenceDetailSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('account-object'),
    title: z.string().min(1).max(200),
    description: z.string().max(2000),
    fields: z
      .array(
        z.object({ label: z.string().max(100), value: z.string().max(1000) }),
      )
      .max(12),
  }),
  z.object({
    kind: z.literal('capability'),
    title: z.string().min(1).max(200),
    description: z.string().max(2000),
    readOnly: z.boolean().optional(),
    destructive: z.boolean().optional(),
    inputTypeDefinition: z.string().max(12000).optional(),
    outputTypeDefinition: z.string().max(12000).optional(),
  }),
  z.object({
    kind: z.literal('package'),
    title: z.string().min(1).max(200),
    description: z.string().max(2000),
    detailMode: z.enum(['index', 'export']),
    intent: z.string().max(4000).optional(),
    documents: z
      .object({ readme: z.boolean(), agents: z.boolean() })
      .optional(),
    importSpecifier: z.string().max(500).optional(),
    typeDefinition: z.string().max(12000).optional(),
    exports: z
      .array(
        z.object({
          subpath: z.string().max(200),
          description: z.string().max(2000),
        }),
      )
      .max(100)
      .optional(),
  }),
])

export type KodyReferenceDetail = z.infer<typeof kodyReferenceDetailSchema>
