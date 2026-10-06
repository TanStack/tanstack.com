import { z } from 'zod'
import { avatarValueSchema } from './avatar'
import type { WorkspaceBot, BotSection } from './bot-workspace'

export type WorkspaceIndex = {
  workspaceId: string
  userId: string
  bots: WorkspaceBot[]
  sections: BotSection[]
}

const version = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
const position = z.number().finite().min(-1e12).max(1e12)
export const botPatchSchema = z
  .object({
    version,
    name: z.string().trim().min(1).max(60).optional(),
    purpose: z.string().max(2000).optional(),
    avatar: avatarValueSchema.optional(),
    parentId: z.string().min(1).max(200).nullable().optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, 'No changes provided.')
export const botOrganizationSchema = z
  .object({
    pinned: z.boolean().optional(),
    sectionId: z.string().min(1).max(200).nullable().optional(),
    position: position.optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'No changes provided.')
export const botSectionSchema = z
  .object({ name: z.string().trim().min(1).max(60) })
  .strict()
export const botSectionAssignmentsSchema = z
  .array(
    z
      .object({
        id: z.string().min(1).max(200),
        sectionId: z.string().min(1).max(200).nullable(),
      })
      .strict(),
  )
  .min(1)
  .max(50)
  .refine(
    (assignments) =>
      new Set(assignments.map((assignment) => assignment.id)).size ===
      assignments.length,
    'Select each conversation only once.',
  )
export const botSectionPatchSchema = botSectionSchema
  .partial()
  .extend({
    version,
    position: position.optional(),
    sortOverride: z
      .enum(['position', 'name', 'created', 'activity', 'unread'])
      .nullable()
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, 'No changes provided.')

export const botMoveSchema = z
  .object({
    version,
    parentId: z.string().min(1).max(200).nullable(),
    sectionId: z.string().min(1).max(200).nullable(),
    pinned: z.boolean(),
    position: z.number().int().min(0).max(10000),
    layout: z.string().max(200000),
  })
  .strict()

export const botGroupMoveSchema = botMoveSchema
  .omit({ version: true })
  .extend({
    bots: z
      .array(z.object({ id: z.string().min(1).max(200), version }).strict())
      .min(1)
      .max(50)
      .refine(
        (bots) => new Set(bots.map((bot) => bot.id)).size === bots.length,
        'Select each conversation only once.',
      ),
  })
  .strict()
