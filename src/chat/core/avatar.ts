import { z } from 'zod'

export const avatarDesignSchema = z
  .object({
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    hue: z.number().min(0).max(360),
    shape: z.number().int().min(0).max(5),
    eyes: z.number().int().min(0).max(4),
    expression: z.number().int().min(0).max(4),
    nose: z.number().int().min(0).max(3),
    mouthless: z.boolean(),
    eyeScale: z.number().min(0.8).max(1.35),
    mouthScale: z.number().min(0.7).max(1.3),
    eyeSpacing: z.number().min(5.8).max(8.2),
    image: z
      .string()
      .max(24000)
      .regex(/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/)
      .optional(),
  })
  .strict()
export type AvatarDesign = z.infer<typeof avatarDesignSchema>
export const avatarValueSchema = z
  .string()
  .max(26000)
  .refine((value) => {
    try {
      return avatarDesignSchema.safeParse(JSON.parse(value)).success
    } catch {
      return false
    }
  }, 'Invalid avatar')
  .nullable()
export function readAvatar(value?: string | null): Partial<AvatarDesign> {
  try {
    return avatarDesignSchema.parse(JSON.parse(value ?? 'null'))
  } catch {
    return {}
  }
}
