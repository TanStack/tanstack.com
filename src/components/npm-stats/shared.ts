import * as v from 'valibot'

import { packageGroupSchema } from '~/routes/stats/npm/-comparisons'
import { defaultColors } from '~/utils/npm-packages'

export type PackageGroup = v.InferOutput<typeof packageGroupSchema>

export const binTypeSchema = v.picklist([
  'yearly',
  'monthly',
  'weekly',
  'daily',
])
export type BinType = v.InferOutput<typeof binTypeSchema>

export const transformModeSchema = v.picklist(['none', 'normalize-y'])
export type TransformMode = v.InferOutput<typeof transformModeSchema>

export const showDataModeSchema = v.picklist(['all', 'complete'])
export type ShowDataMode = v.InferOutput<typeof showDataModeSchema>

export type TimeRange =
  | '7-days'
  | '30-days'
  | '90-days'
  | '180-days'
  | '365-days'
  | '730-days'
  | '1825-days'
  | 'all-time'

export type FacetValue = 'name'

export type NpmQueryData = Array<{
  packages: Array<{
    name?: string
    hidden?: boolean
    downloads: Array<{ day: string; downloads: number }>
  }>
  start: string
  end: string
  error?: string
  actualStartDate?: Date
}>

export const binningOptions = [
  {
    label: 'Yearly',
    value: 'yearly',
    single: 'year',
  },
  {
    label: 'Monthly',
    value: 'monthly',
    single: 'month',
  },
  {
    label: 'Weekly',
    value: 'weekly',
    single: 'week',
  },
  {
    label: 'Daily',
    value: 'daily',
    single: 'day',
  },
] as const

export const timeRanges = [
  { value: '7-days', label: '7 Days' },
  { value: '30-days', label: '30 Days' },
  { value: '90-days', label: '90 Days' },
  { value: '180-days', label: '6 Months' },
  { value: '365-days', label: '1 Year' },
  { value: '730-days', label: '2 Years' },
  { value: '1825-days', label: '5 Years' },
  { value: 'all-time', label: 'All Time' },
] as const

export const defaultRangeBinTypes: Record<TimeRange, BinType> = {
  '7-days': 'daily',
  '30-days': 'daily',
  '90-days': 'weekly',
  '180-days': 'weekly',
  '365-days': 'weekly',
  '730-days': 'monthly',
  '1825-days': 'monthly',
  'all-time': 'monthly',
}

export function getPackageColor(
  packageName: string,
  packages: PackageGroup[],
): string {
  const packageInfo = packages.find((pkg) =>
    pkg.packages.some((p) => p.name === packageName),
  )

  if (packageInfo?.color) {
    return packageInfo.color
  }

  const packageIndex = packages.findIndex((pkg) =>
    pkg.packages.some((p) => p.name === packageName),
  )

  return defaultColors[packageIndex % defaultColors.length]
}

export const formatNumber = (num: number) => {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}k`
  }
  return num.toString()
}

export function isBinningOptionValidForRange(
  range: TimeRange,
  binType: BinType,
): boolean {
  switch (range) {
    case '7-days':
    case '30-days':
      return binType === 'daily'
    case '90-days':
    case '180-days':
    case '365-days':
      return (
        binType === 'daily' || binType === 'weekly' || binType === 'monthly'
      )
    case '730-days':
    case '1825-days':
    case 'all-time':
      return true
  }
}
