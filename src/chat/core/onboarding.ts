import { z } from 'zod'

const revision = z.number().int().safe().nonnegative()
const workspaceName = z.string().trim().min(1).max(80)
const useCase = z.enum(['everyday', 'work', 'building']).nullable()

export const onboardingSchema = z
  .object({
    revision,
    status: z.enum(['pending', 'completed', 'skipped']),
    workspaceId: z.string().min(1),
    // Existing workspace names predate this form. Preserve them exactly on read
    // and Skip; the bounded trimmed name applies only to an explicit Save.
    workspaceName: z.string(),
    useCase,
    completedAt: z.number().int().safe().nonnegative().nullable(),
  })
  .strict()
  .refine(
    (value) =>
      (value.status !== 'pending' || value.completedAt === null) &&
      (value.status !== 'completed' || value.completedAt !== null),
    'Check the onboarding status and completion time.',
  )

export const onboardingInputSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('save'),
      commandId: z.string().uuid(),
      revision,
      workspaceName,
      useCase,
    })
    .strict(),
  z
    .object({
      action: z.literal('skip'),
      commandId: z.string().uuid(),
      revision,
    })
    .strict(),
])

export type Onboarding = z.infer<typeof onboardingSchema>
export type OnboardingInput = z.infer<typeof onboardingInputSchema>
