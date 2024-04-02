import { Library } from '.'

export const storeProject: Library = {
  name: 'TanStack Store',
  cardStyles: `shadow-xl shadow-stone-700/20 dark:shadow-lg dark:shadow-stone-500/20 text-stone-500 dark:text-stone-400 border-2 border-transparent hover:border-current`,
  to: '/store',
  tagline: `Framework agnostic data store with reactive framework adapters`,
  description: `The core data store that powers TanStack libraries and their framework adapters. Use it if you dare.`,
  badge: 'new',
  bgStyle: 'bg-stone-700',
  textStyle: 'text-stone-500',
  repo: 'tanstack/store',
  latestBranch: 'main',
  latestVersion: 'v0',
  availableVersions: ['v0'],
  colorFrom: 'from-stone-500',
  colorTo: 'to-stone-700',
  textColor: 'text-stone-700',
  frameworks: ['react', 'solid', 'vue', 'angular'],
}
