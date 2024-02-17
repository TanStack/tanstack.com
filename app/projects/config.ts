import type { AvailableOptions } from '~/components/Select'

export const repo = 'tanstack/config'

export const latestBranch = 'main'
export const latestVersion = 'v0'
export const availableVersions = ['v0']

export const colorFrom = 'from-gray-500'
export const colorTo = 'to-gray-700'
export const textColor = 'text-gray-700'

export const frameworks: AvailableOptions = []

export type Framework = keyof typeof frameworks

export function getBranch(argVersion?: string) {
  const version = argVersion || latestVersion

  return ['latest', latestVersion].includes(version) ? latestBranch : version
}
