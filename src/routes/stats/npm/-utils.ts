import { z } from 'zod'

// Shared schemas for npm stats routes
export const transformModeSchema = z.enum(['none', 'normalize-y'])
export const binTypeSchema = z.enum(['yearly', 'monthly', 'weekly', 'daily'])
export const showDataModeSchema = z.enum(['all', 'complete'])

export type TransformMode = z.infer<typeof transformModeSchema>
export type BinType = z.infer<typeof binTypeSchema>
export type ShowDataMode = z.infer<typeof showDataModeSchema>

export const timeRangeSchema = z.enum([
  '7-days',
  '30-days',
  '90-days',
  '180-days',
  '365-days',
  '730-days',
  '1825-days',
  'all-time',
])

export type TimeRange = z.infer<typeof timeRangeSchema>

// URL encoding/decoding for package names
// @tanstack/react-query -> @tanstack__react-query
export function encodePackageName(packageName: string): string {
  return packageName.replace(/\//g, '__')
}

// @tanstack__react-query -> @tanstack/react-query
export function decodePackageName(urlName: string): string {
  return urlName.replace(/__/g, '/')
}

// Parse packages from URL like "react-vs-vue" or "@tanstack__react-query-vs-swr"
export function parsePackagesFromUrl(packagesParam: string): string[] {
  const parts = packagesParam.split('-vs-')
  return parts.map(decodePackageName)
}

// Generate a comparison URL from package names
export function generateComparisonUrl(packages: string[]): string {
  return packages.map(encodePackageName).join('-vs-')
}

// Generate the full path for a comparison
export function getComparisonPath(packages: string[]): string {
  return `/stats/npm/${generateComparisonUrl(packages)}`
}
