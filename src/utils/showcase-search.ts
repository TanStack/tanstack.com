import * as v from 'valibot'
import {
  libraryIdSchema,
  showcaseUseCaseSchema,
  pageNumberSchema,
  pageSizeSchema,
} from '~/utils/schemas'

export const showcaseSearchSchema = v.object({
  page: v.optional(pageNumberSchema, 1),
  pageSize: v.optional(pageSizeSchema, 24),
  libraryIds: v.optional(v.pipe(v.array(libraryIdSchema), v.maxLength(16))),
  useCases: v.optional(v.pipe(v.array(showcaseUseCaseSchema), v.maxLength(12))),
  hasSourceCode: v.optional(v.boolean()),
  q: v.optional(v.pipe(v.string(), v.maxLength(120))),
})

export const defaultShowcaseSearch = v.parse(showcaseSearchSchema, {})
