import {
  createFileRoute,
  notFound,
  redirect,
  stripSearchParams,
} from '@tanstack/react-router'
import * as v from 'valibot'
import {
  parsePackagesFromUrl,
  transformModeSchema,
  binTypeSchema,
  chartTypeSchema,
  barOrientationSchema,
  latestBarSortSchema,
  defaultPlaybackIntervalMs,
  playbackIntervalMsSchema,
  showDataModeSchema,
  timeRangeSchema,
  viewModeSchema,
} from './-utils'
import { chartHeightSchema, chartWidthSchema } from '~/utils/schemas'

const timelineZoomTimeSchema = v.pipe(v.number(), v.integer(), v.minValue(0))

export const comparisonSearchSchema = v.object({
  range: v.fallback(v.optional(timeRangeSchema, '365-days'), '365-days'),
  transform: v.fallback(v.optional(transformModeSchema, 'none'), 'none'),
  binType: v.fallback(v.optional(binTypeSchema, 'weekly'), 'weekly'),
  viewMode: v.fallback(v.optional(viewModeSchema, 'history'), 'history'),
  chartType: v.fallback(v.optional(chartTypeSchema, 'line'), 'line'),
  barOrientation: v.fallback(v.optional(barOrientationSchema), undefined),
  barSort: v.fallback(v.optional(latestBarSortSchema, 'value'), 'value'),
  bucketOffset: v.fallback(
    v.optional(
      v.pipe(v.number(), v.integer(), v.minValue(-5000), v.maxValue(0)),
      0,
    ),
    0,
  ),
  playbackIntervalMs: v.fallback(
    v.optional(playbackIntervalMsSchema, defaultPlaybackIntervalMs),
    defaultPlaybackIntervalMs,
  ),
  playbackLoop: v.fallback(v.optional(v.boolean(), false), false),
  playbackPlaying: v.fallback(v.optional(v.boolean(), false), false),
  showDataMode: v.fallback(v.optional(showDataModeSchema, 'all'), 'all'),
  showLegend: v.fallback(v.optional(v.boolean(), false), false),
  height: v.fallback(v.optional(chartHeightSchema, 400), 400),
  width: v.fallback(v.optional(chartWidthSchema), undefined),
  timelineStart: v.fallback(v.optional(timelineZoomTimeSchema), undefined),
  timelineEnd: v.fallback(v.optional(timelineZoomTimeSchema), undefined),
})

export const Route = createFileRoute('/stats/npm/$packages')({
  validateSearch: comparisonSearchSchema,
  search: {
    middlewares: [stripSearchParams(v.parse(comparisonSearchSchema, {}))],
  },
  beforeLoad: redirectNpmComparison,
})

export function redirectNpmComparison({
  params,
  search,
}: {
  params: { packages: string }
  search: v.InferOutput<typeof comparisonSearchSchema>
}) {
  const packages = parsePackagesFromUrl(params.packages)
  if (
    !packages.length ||
    packages.length !== params.packages.split('-vs-').length
  ) {
    throw notFound()
  }
  throw redirect({
    to: '/stats/npm',
    search: {
      ...search,
      packageGroups: packages.map((name) => ({ packages: [{ name }] })),
    },
    replace: true,
  })
}
