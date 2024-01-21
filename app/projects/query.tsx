export const gradientText =
  'inline-block text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500'

export const repo = 'tanstack/query'

const latestBranch = 'main'

export const latestVersion = 'v5'

export const availableVersions = [
  {
    name: 'v5',
    branch: latestBranch,
  },
  {
    name: 'v4',
    branch: 'v4',
  },
  {
    name: 'v3',
    branch: 'v3',
  },
] as const

export function getBranch(argVersion?: string) {
  const version = argVersion || latestVersion

  if (version === 'latest') {
    return latestBranch
  }

  return (
    availableVersions.find((v) => v.name === version)?.branch ?? latestBranch
  )
}

export type Framework = 'angular' | 'react' | 'svelte' | 'vue' | 'solid'
