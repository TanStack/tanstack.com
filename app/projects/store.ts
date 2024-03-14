import reactLogo from '~/images/react-logo.svg'
import solidLogo from '~/images/solid-logo.svg'
import vueLogo from '~/images/vue-logo.svg'
import angularLogo from '~/images/angular-logo.svg'
import type { AvailableOptions } from '~/components/Select'

export const repo = 'tanstack/store'

export const latestBranch = 'main'
export const latestVersion = 'v0'
export const availableVersions = ['v0']

export const colorFrom = 'from-stone-500'
export const colorTo = 'to-stone-700'
export const textColor = 'text-stone-700'

export const frameworks: AvailableOptions = [
  { label: 'React', value: 'react', logo: reactLogo },
  { label: 'Solid', value: 'solid', logo: solidLogo },
  { label: 'Vue', value: 'vue', logo: vueLogo },
  { label: 'Angular', value: 'angular', logo: angularLogo },
]

export type Framework = (typeof frameworks)[number]['value']

export function getBranch(argVersion?: string) {
  const version = argVersion || latestVersion

  return ['latest', latestVersion].includes(version) ? latestBranch : version
}
