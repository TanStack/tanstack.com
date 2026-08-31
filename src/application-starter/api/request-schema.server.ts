import * as v from 'valibot'

export const applicationStarterFrameworkSchema = v.picklist(['react', 'solid'])
export const applicationStarterPackageManagerSchema = v.picklist([
  'bun',
  'npm',
  'pnpm',
  'yarn',
])

export const applicationStarterStringSchema = v.pipe(v.string(), v.maxLength(200))
export const applicationStarterFeatureIdSchema = v.pipe(v.string(), v.maxLength(120))
export const applicationStarterFeatureListSchema = v.pipe(
  v.array(applicationStarterFeatureIdSchema),
  v.maxLength(80),
)
export const applicationStarterFeatureOptionsSchema = v.record(
  applicationStarterFeatureIdSchema,
  v.record(applicationStarterStringSchema, v.unknown()),
)
const applicationStarterFileMapSchema = v.record(
  v.pipe(v.string(), v.minLength(1), v.maxLength(260)),
  v.string(),
)

export const applicationStarterProjectDefinitionSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
  framework: v.optional(applicationStarterFrameworkSchema),
  packageManager: v.optional(applicationStarterPackageManagerSchema),
  tailwind: v.optional(v.boolean()),
  features: applicationStarterFeatureListSchema,
  featureOptions: v.optional(applicationStarterFeatureOptionsSchema),
  selectedExample: v.optional(applicationStarterFeatureIdSchema),
})

export const applicationStarterCompileBodySchema = v.object({
  definition: applicationStarterProjectDefinitionSchema,
  format: v.optional(v.picklist(['full', 'summary'])),
})

export const applicationStarterValidateBodySchema = v.object({
  definition: applicationStarterProjectDefinitionSchema,
})

export const applicationStarterSuggestBodySchema = v.object({
  description: v.optional(v.pipe(v.string(), v.maxLength(4_000))),
  current: v.optional(
    v.object({
      name: v.optional(v.pipe(v.string(), v.maxLength(120))),
      framework: v.optional(applicationStarterFrameworkSchema),
      packageManager: v.optional(applicationStarterPackageManagerSchema),
      tailwind: v.optional(v.boolean()),
      features: v.optional(applicationStarterFeatureListSchema),
      featureOptions: v.optional(applicationStarterFeatureOptionsSchema),
      selectedExample: v.optional(applicationStarterFeatureIdSchema),
    }),
  ),
  intent: v.optional(
    v.picklist(['full-stack', 'api-only', 'static', 'database', 'auth', 'deploy']),
  ),
})

export const applicationStarterFeatureArtifactsBodySchema = v.object({
  features: applicationStarterFeatureListSchema,
  projectName: v.optional(v.pipe(v.string(), v.maxLength(120))),
  framework: v.optional(applicationStarterFrameworkSchema),
  tailwind: v.optional(v.boolean()),
  featureOptions: v.optional(applicationStarterFeatureOptionsSchema),
})

export const applicationStarterRemoteLoadBodySchema = v.object({
  url: v.pipe(v.string(), v.minLength(1), v.maxLength(2_048)),
})

export const applicationStarterDeployBodySchema = v.object({
  repoName: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  isPrivate: v.boolean(),
  projectName: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
  framework: v.optional(applicationStarterFrameworkSchema),
  packageManager: v.optional(applicationStarterPackageManagerSchema),
  features: applicationStarterFeatureListSchema,
  featureOptions: v.optional(applicationStarterFeatureOptionsSchema),
  tailwind: v.boolean(),
  files: v.optional(applicationStarterFileMapSchema),
})

export type ApplicationStarterProjectDefinition = v.InferOutput<
  typeof applicationStarterProjectDefinitionSchema
>
export type ApplicationStarterCompileBody = v.InferOutput<typeof applicationStarterCompileBodySchema>
export type ApplicationStarterValidateBody = v.InferOutput<typeof applicationStarterValidateBodySchema>
export type ApplicationStarterSuggestBody = v.InferOutput<typeof applicationStarterSuggestBodySchema>
export type ApplicationStarterFeatureArtifactsBody = v.InferOutput<
  typeof applicationStarterFeatureArtifactsBodySchema
>
export type ApplicationStarterRemoteLoadBody = v.InferOutput<
  typeof applicationStarterRemoteLoadBodySchema
>
export type ApplicationStarterDeployBody = v.InferOutput<typeof applicationStarterDeployBodySchema>

export function parseApplicationStarterRequest<T>(
  schema: v.GenericSchema<unknown, T>,
  body: unknown,
) {
  return v.parse(schema, body)
}
