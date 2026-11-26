import { z } from 'zod'

export const maxSelectedSkills = 3
export const skillIdentifierSchema = z.union([
  z.string().uuid(),
  z
    .string()
    .regex(
      /^(?:plugin|kody):[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    ),
])
