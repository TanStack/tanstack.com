import reactLogo from '~/images/react-logo.svg'

export const repo = 'tanstack/router'

export const latestBranch = 'main'
export const latestVersion = 'v1'
export const availableVersions = ['v1']

export const colorFrom = 'from-lime-500'
export const colorTo = 'to-emerald-500'
export const textColor = 'text-emerald-500'

export const frameworks = {
  react: { label: 'React', logo: reactLogo, value: 'react' },
} as const

export type Framework = keyof typeof frameworks

export function getBranch(argVersion?: string) {
  const version = argVersion || latestVersion

  return ['latest', latestVersion].includes(version) ? latestBranch : version
}
