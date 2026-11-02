import { z } from 'zod'
import { themeTokenClasses } from '@tanstack/highlight/theme'
import { languageOptions } from './snippets'
import { themePresets } from './tokenGroups'

const color = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
const draftSchema = z.object({
  lang: z.enum(languageOptions.map((option) => option.value)),
  presetId: z
    .string()
    .refine((id) => themePresets.some((preset) => preset.id === id)),
  theme: z.object({
    name: z.string(),
    type: z.enum(['light', 'dark']),
    background: color,
    foreground: color,
    tokens: z.record(z.enum(themeTokenClasses), color),
  }),
})

export type Draft = z.infer<typeof draftSchema>

export const defaultDraft: Draft = {
  lang: 'ts',
  presetId: themePresets[0].id,
  theme: themePresets[0].theme,
}

export function restoreDraft(value: unknown): Draft {
  const result = draftSchema.safeParse(value)
  return result.success ? result.data : defaultDraft
}
