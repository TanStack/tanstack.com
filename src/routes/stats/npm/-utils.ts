import * as v from 'valibot'
import { MAX_NPM_STATS_GROUPS } from '~/utils/npm-stats-limits'

// Re-export shared types from chart utils
export {
  binTypeSchema,
  type BinType,
  binningOptions,
  getBinFunction,
} from '~/utils/chart'

// NPM-specific schemas (extends shared with additional time ranges)
export const transformModeSchema = v.picklist(['none', 'normalize-y'])
export const showDataModeSchema = v.picklist(['all', 'complete'])

export type TransformMode = v.InferOutput<typeof transformModeSchema>
export type ShowDataMode = v.InferOutput<typeof showDataModeSchema>

// NPM stats has additional time ranges (730 days, 1825 days) beyond shared chart utils
export const timeRangeSchema = v.picklist([
  '7-days',
  '30-days',
  '90-days',
  '180-days',
  '365-days',
  '730-days',
  '1825-days',
  'all-time',
])

export type TimeRange = v.InferOutput<typeof timeRangeSchema>

// URL encoding/decoding for package names
// @tanstack/react-query -> @tanstack~1react-query
export function encodePackageName(packageName: string): string {
  return packageName.replace(/~/g, '~0').replace(/\//g, '~1')
}

// @tanstack~1react-query -> @tanstack/react-query
export function decodePackageName(urlName: string): string {
  try {
    const decoded = decodeURIComponent(urlName)
    if (
      decoded.startsWith('@') &&
      decoded.includes('__') &&
      !decoded.includes('/')
    ) {
      return decoded.replace('__', '/')
    }
    return decoded.replace(/~1/g, '/').replace(/~0/g, '~')
  } catch {
    return ''
  }
}

// Parse packages from URL like "react-vs-vue" or "@tanstack__react-query-vs-swr"
export function parsePackagesFromUrl(packagesParam: string): string[] {
  const parts = packagesParam.split('-vs-').slice(0, MAX_NPM_STATS_GROUPS)
  return parts
    .map(decodePackageName)
    .filter((packageName) =>
      /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(packageName),
    )
}

// Generate a comparison URL from package names
export function generateComparisonUrl(packages: string[]): string {
  return packages.map(encodePackageName).join('-vs-')
}

// Generate the full path for a comparison
export function getComparisonPath(packages: string[]): string {
  return `/stats/npm/${generateComparisonUrl(packages)}`
}
