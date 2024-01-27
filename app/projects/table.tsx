import reactLogo from '~/images/react-logo.svg'
import solidLogo from '~/images/solid-logo.svg'
import vueLogo from '~/images/vue-logo.svg'
import svelteLogo from '~/images/svelte-logo.svg'

export const repo = 'tanstack/table'

export const latestBranch = 'main'
export const latestVersion = 'v8'
export const availableVersions = ['v8']

export const colorFrom = 'from-teal-500'
export const colorTo = 'to-blue-600'
export const textColor = 'text-blue-600'

export const frameworks = {
  react: { label: 'React', logo: reactLogo, value: 'react' },
  solid: { label: 'Solid', logo: solidLogo, value: 'solid' },
  svelte: { label: 'Svelte', logo: svelteLogo, value: 'svelte' },
  vue: { label: 'Vue', logo: vueLogo, value: 'vue' },
} as const

export type Framework = keyof typeof frameworks

export function getBranch(argVersion?: string) {
  const version = argVersion || latestVersion

  return ['latest', latestVersion].includes(version) ? latestBranch : version
}
