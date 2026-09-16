import { z } from 'zod'
import { snapshotSchema, type RecordRow } from '../model'
import type { ServerRequest } from '../request'

// All identifiers come from this allowlist. User values are bound parameters.
const expressions = {
  id: 't.id',
  pickup: `replace(t.pickup, 'T', ' ')`,
  day: 't.day',
  borough: 'z.borough',
  zone: 'z.name',
  minutes: 't.minutes',
  miles: 't.miles',
  fareCents: 't."fareCents" / 100.0',
}
const from =
  'FROM dashboard.trips t JOIN dashboard.zones z ON z.id = t."zoneId"'
export const rowSchema = snapshotSchema.shape.trips.element.extend({
  zone: z.string(),
  borough: z.string(),
})
const totalSchema = z.object({
  count: z.coerce.number(),
  fareCents: z.coerce.number(),
})
const pointSchema = z.object({
  key: z.coerce.number(),
  count: z.coerce.number(),
})
export type Execute = (
  sql: string,
  values: (string | number | boolean)[],
) => Promise<unknown[]>

function conditions(
  input: ServerRequest,
  context: 'all' | 'trend' | 'zones' = 'all',
  omitColumn = '',
) {
  const values: (string | number | boolean)[] = []
  const bind = (value: string | number) => {
    values.push(value)
    return `$${values.length}`
  }
  const clauses = ['TRUE']
  if (input.borough !== 'All')
    clauses.push(`z.borough = ${bind(input.borough)}`)
  if (input.day && context !== 'trend')
    clauses.push(`t.day = ${bind(input.day)}`)
  if (input.zone && context !== 'zones')
    clauses.push(`t."zoneId" = ${bind(input.zone)}`)
  if (input.grid.query) {
    const value = bind(input.grid.query.toLowerCase())
    clauses.push(
      `(${Object.values(expressions)
        .map((expr) => `strpos(lower((${expr})::text), ${value}) > 0`)
        .join(' OR ')})`,
    )
  }
  for (const filter of input.grid.filters) {
    if (filter.id === omitColumn) continue
    const expr = expressions[filter.id]
    if (typeof filter.value === 'string') {
      if (filter.id === 'borough')
        clauses.push(`${expr} = ${bind(filter.value)}`)
      else
        clauses.push(
          `strpos(lower((${expr})::text), ${bind(filter.value.toLowerCase())}) > 0`,
        )
    } else {
      const [min, max] = filter.value
      if (min !== null) clauses.push(`${expr} >= ${bind(min)}`)
      if (max !== null) clauses.push(`${expr} <= ${bind(max)}`)
    }
  }
  return { where: clauses.join(' AND '), values }
}
function selectionCondition(
  input: ServerRequest,
  values: (string | number | boolean)[],
) {
  const placeholders = input.selection.ids.map((id) => {
    values.push(id)
    return `$${values.length}`
  })
  if (!placeholders.length) return input.selection.all ? 'TRUE' : 'FALSE'
  return `t.id ${input.selection.all ? 'NOT IN' : 'IN'} (${placeholders.join(',')})`
}
export function orderBy(input: ServerRequest) {
  return [
    ...input.grid.sorting.map(
      (sort) => `${expressions[sort.id]} ${sort.desc ? 'DESC' : 'ASC'}`,
    ),
    't.id ASC',
  ].join(', ')
}

export async function readDashboard(execute: Execute, input: ServerRequest) {
  const scope = conditions(input)
  const trend = conditions(input, 'trend')
  const zoneScope = conditions(input, 'zones')
  const base = conditions({
    ...input,
    grid: { ...input.grid, query: '', filters: [] },
  })
  const facets = conditions(input, 'all', 'borough')
  const selectedValues = [...scope.values]
  const selectedWhere = selectionCondition(input, selectedValues)
  const totalsSql = `SELECT count(*) AS count, coalesce(sum(t."fareCents"),0) AS "fareCents" ${from}`
  // One read-only repeatable-read transaction wraps these queries at the caller.
  const totals = totalSchema
    .extend({ median: z.coerce.number(), average: z.coerce.number() })
    .parse(
      (
        await execute(
          `SELECT count(*) AS count, coalesce(sum(t."fareCents"),0) AS "fareCents", coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY t.minutes),0) AS median, coalesce(avg(t.miles),0) AS average ${from} WHERE ${scope.where}`,
          scope.values,
        )
      )[0],
    )
  const parent = totalSchema.parse(
    (await execute(`${totalsSql} WHERE ${base.where}`, base.values))[0],
  )
  const selectedTotals = totalSchema.parse(
    (
      await execute(
        `${totalsSql} WHERE ${scope.where} AND ${selectedWhere}`,
        selectedValues,
      )
    )[0],
  )
  const timelinePoints = z
    .array(pointSchema)
    .parse(
      await execute(
        `SELECT (t.day-1)*24+substring(t.pickup,12,2)::int AS key, count(*) AS count ${from} WHERE ${trend.where} GROUP BY 1`,
        trend.values,
      ),
    )
  const hourPoints = z
    .array(pointSchema)
    .parse(
      await execute(
        `SELECT substring(t.pickup,12,2)::int AS key, count(*) AS count ${from} WHERE ${scope.where} GROUP BY 1`,
        scope.values,
      ),
    )
  const durationPoints = z
    .array(pointSchema)
    .parse(
      await execute(
        `SELECT CASE WHEN minutes < 10 THEN 0 WHEN minutes < 20 THEN 1 WHEN minutes < 30 THEN 2 WHEN minutes < 60 THEN 3 ELSE 4 END AS key, count(*) AS count ${from} WHERE ${scope.where} GROUP BY 1`,
        scope.values,
      ),
    )
  const zones = z
    .array(
      z.object({ id: z.number(), name: z.string(), count: z.coerce.number() }),
    )
    .parse(
      await execute(
        `SELECT z.id, z.name, count(*) AS count ${from} WHERE ${zoneScope.where} GROUP BY z.id,z.name ORDER BY count DESC,z.id`,
        zoneScope.values,
      ),
    )
  const boroughFacets = z
    .array(z.object({ value: z.string(), count: z.coerce.number() }))
    .parse(
      await execute(
        `SELECT z.borough AS value, count(*) AS count ${from} WHERE ${facets.where} GROUP BY z.borough ORDER BY z.borough`,
        facets.values,
      ),
    )
  const allZones = z
    .array(z.object({ id: z.number(), name: z.string(), borough: z.string() }))
    .parse(
      await execute(
        'SELECT id,name,borough FROM dashboard.zones ORDER BY id',
        [],
      ),
    )
  const selected = rowSchema
    .optional()
    .parse(
      (
        await execute(
          `SELECT t.*,z.name AS zone,z.borough ${from} WHERE t.id=$1`,
          [input.selected],
        )
      )[0],
    )
  const selectedMatches = selected
    ? totalSchema.parse(
        (
          await execute(
            `${totalsSql} WHERE ${scope.where} AND t.id=$${scope.values.length + 1}`,
            [...scope.values, input.selected],
          )
        )[0],
      ).count > 0
    : false
  const snapshotCount = z
    .object({ count: z.coerce.number() })
    .parse(
      (await execute('SELECT count(*) AS count FROM dashboard.trips', []))[0],
    ).count
  let rows: RecordRow[]
  let rowCount = totals.count
  let page = input.grid.page
  if (input.grid.group) {
    const expr = expressions[input.grid.group]
    rowCount = z
      .object({ count: z.coerce.number() })
      .parse(
        (
          await execute(
            `SELECT count(DISTINCT ${expr}) AS count ${from} WHERE ${scope.where}`,
            scope.values,
          )
        )[0],
      ).count
    page = Math.min(
      page,
      Math.max(0, Math.ceil(rowCount / input.grid.size) - 1),
    )
    const sort = input.grid.sorting[0]
    const aggregateOrder =
      sort?.id === 'minutes'
        ? 'avg(t.minutes)'
        : sort?.id === 'miles'
          ? 'sum(t.miles)'
          : sort?.id === 'fareCents'
            ? 'sum(t."fareCents")'
            : expr
    const groups = z
      .array(
        z.object({
          value: z.string(),
          count: z.coerce.number(),
          minutes: z.coerce.number(),
          miles: z.coerce.number(),
          fareCents: z.coerce.number(),
        }),
      )
      .parse(
        await execute(
          `SELECT (${expr})::text AS value,count(*) AS count,avg(t.minutes) AS minutes,sum(t.miles) AS miles,sum(t."fareCents") AS "fareCents" ${from} WHERE ${scope.where} GROUP BY ${expr} ORDER BY ${aggregateOrder} ${sort?.desc ? 'DESC' : 'ASC'},${expr} ASC LIMIT $${scope.values.length + 1} OFFSET $${scope.values.length + 2}`,
          [...scope.values, input.grid.size, page * input.grid.size],
        ),
      )
    rows = groups.map((group, index) => ({
      id: -(page * input.grid.size + index + 1),
      pickup: '',
      day: input.grid.group === 'day' ? Number(group.value) : 0,
      zoneId: 0,
      dropoffZoneId: 0,
      zone: input.grid.group === 'zone' ? group.value : '',
      borough: input.grid.group === 'borough' ? group.value : '',
      minutes: group.minutes,
      miles: group.miles,
      fareCents: group.fareCents,
      group: { value: group.value, count: group.count },
    }))
  } else {
    page = Math.min(
      page,
      Math.max(0, Math.ceil(rowCount / input.grid.size) - 1),
    )
    rows = z
      .array(rowSchema)
      .parse(
        await execute(
          `SELECT t.*,z.name AS zone,z.borough ${from} WHERE ${scope.where} ORDER BY ${orderBy(input)} LIMIT $${scope.values.length + 1} OFFSET $${scope.values.length + 2}`,
          [...scope.values, input.grid.size, page * input.grid.size],
        ),
      )
  }
  const timeline = Array.from({ length: 168 }, (_, index) => ({
    index,
    day: Math.floor(index / 24) + 1,
    count: timelinePoints.find((p) => p.key === index)?.count ?? 0,
  }))
  const days = Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    count: timeline
      .slice(index * 24, index * 24 + 24)
      .reduce((n, p) => n + p.count, 0),
  }))
  return {
    analysis: {
      timeline,
      days,
      hours: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: hourPoints.find((p) => p.key === hour)?.count ?? 0,
      })),
      durations: ['0–10', '10–20', '20–30', '30–60', '60–180'].map(
        (label, index) => ({
          label,
          count: durationPoints.find((p) => p.key === index)?.count ?? 0,
        }),
      ),
      zones,
      summary: { count: totals.count, fareCents: totals.fareCents },
      medianMinutes: totals.median,
      averageMiles: totals.average,
    },
    rows,
    rowCount,
    page,
    total: totals,
    parent,
    selectedTotals,
    boroughFacets,
    allZones,
    selected,
    selectedMatches,
    snapshotCount,
  }
}
export type DashboardResult = Awaited<ReturnType<typeof readDashboard>>

export function exportStatement(input: ServerRequest, onlySelected: boolean) {
  const scope = conditions(input)
  const selectedWhere = onlySelected
    ? selectionCondition(input, scope.values)
    : 'TRUE'
  return {
    sql: `SELECT t.*,z.name AS zone,z.borough ${from} WHERE ${scope.where} AND ${selectedWhere} ORDER BY ${orderBy(input)}`,
    values: scope.values,
  }
}
export async function exportDashboard(
  execute: Execute,
  input: ServerRequest,
  onlySelected: boolean,
) {
  const statement = exportStatement(input, onlySelected)
  return z
    .array(rowSchema)
    .parse(await execute(statement.sql, statement.values))
}
