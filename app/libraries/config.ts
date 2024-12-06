import { Library } from '.'

export const configProject = {
  id: 'config',
  name: 'TanStack Config',
  cardStyles: `shadow-xl shadow-slate-700/20 dark:shadow-lg dark:shadow-slate-500/30 text-slate-500 border-2 border-transparent hover:border-current`,
  to: '/config',
  tagline: `Configuration and tools for publishing and maintaining high-quality JavaScript packages`,
  description: `The build and publish utilities used by all of our projects. Use it if you dare!`,
  ogImage: 'https://github.com/tanstack/config/raw/main/media/repo-header.png',
  badge: undefined,
  bgStyle: 'bg-slate-500',
  textStyle: 'text-slate-500',
  repo: 'tanstack/config',
  latestBranch: 'main',
  latestVersion: 'v0',
  availableVersions: ['v0'],
  colorFrom: 'from-gray-500',
  colorTo: 'to-gray-700',
  textColor: 'text-gray-700',
  frameworks: [],
} satisfies Library
