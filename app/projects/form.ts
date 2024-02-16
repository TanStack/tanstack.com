import reactLogo from '~/images/react-logo.svg'
import solidLogo from '~/images/solid-logo.svg'
import vueLogo from '~/images/vue-logo.svg'
import type { AvailableOptions } from '~/components/Select'

export const repo = 'tanstack/form'

export const latestBranch = 'main'
export const latestVersion = 'v0'
export const availableVersions = ['v0']

export const colorFrom = 'from-yellow-500'
export const colorTo = 'to-yellow-600'
export const textColor = 'text-yellow-600'

export const frameworks: AvailableOptions = [
  { label: 'React', value: 'react', logo: reactLogo },
  { label: 'Solid', value: 'solid', logo: solidLogo },
  { label: 'Vue', value: 'vue', logo: vueLogo },
]

export type Framework = keyof typeof frameworks

export function getBranch(argVersion?: string) {
  const version = argVersion || latestVersion

  return ['latest', latestVersion].includes(version) ? latestBranch : version
}
