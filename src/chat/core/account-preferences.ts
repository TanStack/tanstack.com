import { z } from 'zod'
import { appearanceSchema } from './appearance'
import { scheduleEpochSchema, scheduleTimezoneSchema } from './schedules'

// Language preferences are tags, not freeform instructions. Modern registered
// language subtags use ISO 639's two or three letters. Intl validates the rest
// of the BCP 47 tag and canonicalizes aliases/case without choosing a language.
const responseLanguageSchema = z
  .string()
  .min(2)
  .max(100)
  .regex(/^[a-z]{2,3}(?:-[a-z0-9]{1,8})*$/i)
  .transform((language, context) => {
    try {
      const canonical = Intl.getCanonicalLocales(language)
      if (canonical.length === 1 && canonical[0].length <= 100)
        return canonical[0]
    } catch {}
    context.addIssue({
      code: 'custom',
      message: 'Choose a valid language tag.',
    })
    return z.NEVER
  })

export const responsePreferencesSchema = z
  .object({
    language: responseLanguageSchema.nullable(),
    tone: z.enum(['default', 'warm', 'direct', 'formal']),
    detail: z.enum(['default', 'brief', 'thorough']),
  })
  .strict()

export type ResponsePreferences = z.infer<typeof responsePreferencesSchema>
export const defaultResponsePreferences: ResponsePreferences = Object.freeze({
  language: null,
  tone: 'default',
  detail: 'default',
})

export const responseLanguages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'nl', label: 'Dutch' },
  { value: 'pl', label: 'Polish' },
  { value: 'ru', label: 'Russian' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'tr', label: 'Turkish' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'id', label: 'Indonesian' },
  { value: 'sv', label: 'Swedish' },
] as const satisfies readonly { value: string; label: string }[]

const revisionSchema = z.number().int().safe().nonnegative()
export const responsePreferencesSnapshotSchema = z
  .object({ revision: revisionSchema, response: responsePreferencesSchema })
  .strict()
export type ResponsePreferencesSnapshot = z.infer<
  typeof responsePreferencesSnapshotSchema
>

export const accountPreferencesInputSchema = z
  .object({
    timezone: scheduleTimezoneSchema.nullable().optional(),
    response: responsePreferencesSchema.optional(),
    appearance: appearanceSchema.optional(),
    revision: revisionSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.timezone !== undefined ||
      value.response !== undefined ||
      value.appearance !== undefined,
    'Choose an account preference to save.',
  )

export const accountPreferencesSchema = z
  .object({
    timezone: scheduleTimezoneSchema.nullable(),
    revision: revisionSchema,
    timezoneConfirmedAt: scheduleEpochSchema.nullable(),
    response: responsePreferencesSchema,
    appearance: appearanceSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      (value.timezone === null) === (value.timezoneConfirmedAt === null),
    'A saved timezone must have its confirmation time.',
  )

export type AccountPreferencesInput = z.infer<
  typeof accountPreferencesInputSchema
>
export type AccountPreferences = z.infer<typeof accountPreferencesSchema>
