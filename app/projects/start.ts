import { Library } from '.'

export const startProject: Library = {
  name: 'TanStack Start',
  cardStyles: `shadow-xl shadow-cyan-500/20 dark:shadow-lg dark:shadow-cyan-500/30 text-cyan-500 dark:text-white-400 border-2 border-transparent hover:border-current`,
  to: '/start',
  tagline: `Full-stack React Framework powered by TanStack Router`,
  description: `Full-document SSR, Streaming, Server Functions, bundling and more, powered by TanStack Router, Vinxi, and Nitro and ready to deploy to your favorite hosting provider.`,
  bgStyle: 'bg-cyan-500',
  textStyle: 'text-cyan-500',
  badge: 'soon',
  repo: 'tanstack/start',
  latestBranch: 'main',
  latestVersion: 'v0',
  availableVersions: ['v0'],
  colorFrom: 'from-cyan-500',
  colorTo: 'to-cyan-600',
  textColor: 'text-cyan-600',
  frameworks: ['react'],
}
