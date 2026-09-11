import { z } from 'zod'

export const columnId = z.enum([
  'id',
  'pickup',
  'day',
  'borough',
  'zone',
  'minutes',
  'miles',
  'fareCents',
])
export const gridRequestSchema = z.object({
  query: z.string().max(200).catch(''),
  filters: z
    .array(
      z
        .object({
          id: columnId,
          value: z.union([
            z.string().max(200),
            z
              .tuple([
                z
                  .number()
                  .finite()
                  .nullish()
                  .transform((value) => value ?? null),
                z
                  .number()
                  .finite()
                  .nullish()
                  .transform((value) => value ?? null),
              ])
              .transform(([min, max]): [number | null, number | null] =>
                min !== null && max !== null && min > max
                  ? [max, min]
                  : [min, max],
              ),
          ]),
        })
        .refine((filter) =>
          ['pickup', 'borough', 'zone'].includes(filter.id)
            ? typeof filter.value === 'string'
            : Array.isArray(filter.value),
        ),
    )
    .max(9)
    .catch([]),
  sorting: z
    .array(z.object({ id: columnId, desc: z.boolean() }))
    .max(9)
    .catch([{ id: 'pickup', desc: false }]),
  group: z.enum(['', 'borough', 'zone', 'day']).catch(''),
  page: z.number().int().min(0).max(100000).catch(0),
  size: z
    .union([z.literal(25), z.literal(50), z.literal(100), z.literal(250)])
    .catch(50),
})
export type GridRequest = z.infer<typeof gridRequestSchema>
export const selectionSchema = z.object({
  all: z.boolean().default(false),
  ids: z.array(z.number().int().positive()).max(10000).default([]),
})
export type GridSelection = z.infer<typeof selectionSchema>
export const serverRequestSchema = z.object({
  day: z.number().int().min(0).max(7),
  zone: z.number().int().nonnegative(),
  borough: z.string().max(30),
  grid: gridRequestSchema,
  selection: selectionSchema,
  selected: z.number().int().nonnegative(),
})
export type ServerRequest = z.infer<typeof serverRequestSchema>

// The optional local mode follows the same filter contract as the SQL queries.
export function matchesGrid(
  row: {
    id: number
    pickup: string
    day: number
    borough: string
    zone: string
    minutes: number
    miles: number
    fareCents: number
  },
  grid: GridRequest,
) {
  const values = {
    id: row.id,
    pickup: row.pickup.replace('T', ' '),
    day: row.day,
    borough: row.borough,
    zone: row.zone,
    minutes: row.minutes,
    miles: row.miles,
    fareCents: row.fareCents / 100,
  }
  if (
    grid.query &&
    !Object.values(values).some((value) =>
      String(value).toLowerCase().includes(grid.query.toLowerCase()),
    )
  )
    return false
  return grid.filters.every((filter) => {
    const value = values[filter.id]
    if (typeof filter.value === 'string')
      return filter.id === 'borough'
        ? value === filter.value
        : String(value).toLowerCase().includes(filter.value.toLowerCase())
    const [min, max] = filter.value
    return (
      typeof value === 'number' &&
      (min === null || value >= min) &&
      (max === null || value <= max)
    )
  })
}
