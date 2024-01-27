import reactLogo from '~/images/react-logo.svg'
import solidLogo from '~/images/solid-logo.svg'
import vueLogo from '~/images/vue-logo.svg'
import svelteLogo from '~/images/svelte-logo.svg'

export const repo = 'tanstack/virtual'

export const latestBranch = 'main'
export const latestVersion = 'v3'
export const availableVersions = ['v3']

export const colorFrom = 'from-rose-500'
export const colorTo = 'to-violet-600'
export const textColor = 'text-violet-600'

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
