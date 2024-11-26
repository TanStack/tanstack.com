import { Library } from '.'

export const virtualProject = {
  id: 'virtual',
  name: 'TanStack Virtual',
  cardStyles: `shadow-xl shadow-purple-700/20 dark:shadow-lg dark:shadow-purple-500/30 text-purple-500 border-2 border-transparent hover:border-current`,
  to: '/virtual',
  tagline: `Headless UI for Virtualizing Large Element Lists`,
  description: `Virtualize only the visible content for massive scrollable DOM nodes at 60FPS in TS/JS, React, Vue, Solid, Svelte, Lit & Angular while retaining 100% control over markup and styles.`,
  ogImage: 'https://github.com/tanstack/query/raw/main/media/header.png',
  badge: undefined,
  bgStyle: 'bg-purple-500',
  textStyle: 'text-purple-500',
  repo: 'tanstack/virtual',
  latestBranch: 'main',
  latestVersion: 'v3',
  availableVersions: ['v3'],
  colorFrom: 'from-purple-500',
  colorTo: 'to-violet-600',
  textColor: 'text-purple-600',
  frameworks: ['react', 'solid', 'vue', 'svelte', 'lit', 'angular'],
  defaultDocs: 'introduction',
  scarfId: '32372eb1-91e0-48e7-8df1-4808a7be6b94',
} satisfies Library
