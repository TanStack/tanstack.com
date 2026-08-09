import * as v from 'valibot'
import type {
  ChartsCatalogIndex,
  ChartsCatalogIndexCase,
} from './charts-catalog-index'

export const chartsCatalogRepo = 'tanstack/charts'
export const chartsCatalogBasePath = '/charts/catalog/'

const chartsCatalogCaseIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const chartsCatalogCaseIdSchema = v.pipe(
  v.string(),
  v.regex(chartsCatalogCaseIdPattern, 'Invalid catalog case ID'),
)

export function isChartsCatalogCaseId(value: string) {
  return chartsCatalogCaseIdPattern.test(value)
}

export type ChartsCatalogCase = ChartsCatalogIndexCase
export type ChartsCatalogSourceKind = 'entry' | 'dependency'

export type ChartsCatalogAuthoredSource = {
  totalFiles: number
  totalLines: number
  totalBytes: number
  files: Array<{
    path: string
    source: string
    kind: ChartsCatalogSourceKind
    lines: number
    bytes: number
  }>
}

export function getChartsCatalogSitemapEntries(index: ChartsCatalogIndex) {
  return [
    { path: chartsCatalogBasePath },
    ...index.cases.map((catalogCase) => ({
      path: `${chartsCatalogBasePath}charts/${catalogCase.id}/`,
    })),
  ]
}
