import reactLogo from '~/images/react-logo.svg'
import type { AvailableOptions } from '~/components/Select'

export const repo = 'tanstack/router'

export const latestBranch = 'main'
export const latestVersion = 'v1'
export const availableVersions = ['v1']

export const colorFrom = 'from-lime-500'
export const colorTo = 'to-emerald-500'
export const textColor = 'text-emerald-500'

export const frameworks: AvailableOptions = [
  { label: 'React', value: 'react', logo: reactLogo },
]

export type Framework = keyof typeof frameworks

export function getBranch(argVersion?: string) {
  const version = argVersion || latestVersion

  return ['latest', latestVersion].includes(version) ? latestBranch : version
}
