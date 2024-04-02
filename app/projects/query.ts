import { Library } from '.'

export const queryProject: Library = {
  name: 'TanStack Query',
  cardStyles: `shadow-xl shadow-red-700/20 dark:shadow-lg dark:shadow-red-500/30 text-red-500 border-2 border-transparent hover:border-current`,
  to: '/query',
  tagline: `Powerful asynchronous state management, server-state utilities and data fetching`,
  description: `Fetch, cache, update, and wrangle all forms of async data in your TS/JS, React, Vue, Solid, Svelte & Angular applications all without touching any "global state".`,
  bgStyle: 'bg-red-500',
  textStyle: 'text-red-500',
  repo: 'tanstack/query',
  latestBranch: 'main',
  latestVersion: 'v5',
  availableVersions: ['v5', 'v4', 'v3'],
  colorFrom: 'from-red-500',
  colorTo: 'to-amber-500',
  textColor: 'text-amber-500',
  frameworks: ['react', 'solid', 'vue', 'svelte', 'angular'],
}
