import { z } from 'zod'
import { providers } from './types'

/** A public model choice, never a credential or provider endpoint. */
export const runModelSchema = z
  .object({
    provider: z.enum(providers),
    model: z.string().trim().min(1).max(150),
    reasoning: z.string().trim().min(1).max(40).optional(),
  })
  .strict()

export type RunModelSelection = z.infer<typeof runModelSchema>
export interface RunModelChoice {
  selection: RunModelSelection
  label: string
  providerLabel: string
  attachments: Array<'image' | 'pdf'>
  reasoning: Array<{ value: string; label: string }>
  unavailableReason?: string
}
export interface RunModelCatalog {
  defaultSelection: RunModelSelection
  choices: RunModelChoice[]
}

export function readRunModel(message: unknown): RunModelSelection | undefined {
  if (!message || typeof message !== 'object' || !('metadata' in message))
    return
  const metadata = message.metadata
  if (!metadata || typeof metadata !== 'object' || !('gumRunModel' in metadata))
    return
  const result = runModelSchema.safeParse(metadata.gumRunModel)
  return result.success ? result.data : undefined
}

export function sameRunModel(
  left: RunModelSelection | undefined,
  right: RunModelSelection | undefined,
) {
  return (
    left?.provider === right?.provider &&
    left?.model === right?.model &&
    (left?.reasoning ?? 'default') === (right?.reasoning ?? 'default')
  )
}
