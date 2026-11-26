import { queryOptions } from '@tanstack/react-query'
import {
  getIntentStats,
  getIntentDirectory,
  getIntentPackageDetail,
  getIntentVersionSkills,
  diffIntentVersions,
  searchIntentSkills,
  getIntentSkillHistory,
  getIntentPackageChangelog,
  getIntentSingleSkillHistory,
  getIntentSkillContentDiff,
} from '~/utils/intent.functions'

export const intentQueries = {
  all: () => ['intent'],
  stats: () =>
    queryOptions({
      queryKey: [...intentQueries.all(), 'stats'],
      queryFn: () => getIntentStats(),
      staleTime: 5 * 60 * 1000,
    }),
  directory: (params: {
    search?: string
    framework?: string
    sort?: 'downloads' | 'name' | 'skills' | 'newest'
    page?: number
    pageSize?: number
  }) =>
    queryOptions({
      queryKey: [...intentQueries.all(), 'directory', params],
      queryFn: () => getIntentDirectory({ data: params }),
      staleTime: 5 * 60 * 1000,
    }),
  packageDetail: (name: string) =>
    queryOptions({
      queryKey: [...intentQueries.all(), 'package', name],
      queryFn: () => getIntentPackageDetail({ data: { name } }),
      staleTime: 10 * 60 * 1000,
    }),
  versionSkills: (params: { packageName: string; version: string }) =>
    queryOptions({
      queryKey: [
        ...intentQueries.all(),
        'skills',
        params.packageName,
        params.version,
      ],
      queryFn: () => getIntentVersionSkills({ data: params }),
      staleTime: 30 * 60 * 1000,
    }),
  skillSearch: (query: string) =>
    queryOptions({
      queryKey: [...intentQueries.all(), 'skill-search', query],
      queryFn: () => searchIntentSkills({ data: { query } }),
      staleTime: 2 * 60 * 1000,
      enabled: query.trim().length > 0,
    }),
  versionDiff: (params: {
    packageName: string
    fromVersion: string
    toVersion: string
  }) =>
    queryOptions({
      queryKey: [...intentQueries.all(), 'diff', params],
      queryFn: () => diffIntentVersions({ data: params }),
      staleTime: 30 * 60 * 1000,
    }),
  skillHistory: (packageNames: Array<string>) =>
    queryOptions({
      queryKey: [...intentQueries.all(), 'skill-history', packageNames],
      queryFn: () => getIntentSkillHistory({ data: { packageNames } }),
      staleTime: 10 * 60 * 1000,
      enabled: packageNames.length > 0,
    }),
  packageChangelog: (packageName: string) =>
    queryOptions({
      queryKey: [...intentQueries.all(), 'changelog', packageName],
      queryFn: () => getIntentPackageChangelog({ data: { packageName } }),
      staleTime: 10 * 60 * 1000,
    }),
  singleSkillHistory: (params: { packageName: string; skillName: string }) =>
    queryOptions({
      queryKey: [...intentQueries.all(), 'single-skill-history', params],
      queryFn: () => getIntentSingleSkillHistory({ data: params }),
      staleTime: 10 * 60 * 1000,
    }),
  skillContentDiff: (params: {
    packageName: string
    skillName: string
    fromVersion: string
    toVersion: string
  }) =>
    queryOptions({
      queryKey: [...intentQueries.all(), 'skill-content-diff', params],
      queryFn: () => getIntentSkillContentDiff({ data: params }),
      staleTime: 30 * 60 * 1000,
    }),
}
