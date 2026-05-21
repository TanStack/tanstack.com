import { librariesByGroup, librariesGroupNamesMap } from '~/libraries'
import type { LibrarySlim } from '~/libraries'

export type GroupId = keyof typeof librariesByGroup

export type CategorySlug =
  | 'framework'
  | 'state'
  | 'ui'
  | 'performance'
  | 'tooling'

export const slugToGroup: Record<CategorySlug, GroupId> = {
  framework: 'framework',
  state: 'state',
  ui: 'headlessUI',
  performance: 'performance',
  tooling: 'tooling',
}

export const groupToSlug: Record<GroupId, CategorySlug> = {
  framework: 'framework',
  state: 'state',
  headlessUI: 'ui',
  performance: 'performance',
  tooling: 'tooling',
}

export const categorySlugs = Object.keys(slugToGroup) as CategorySlug[]

export type CategoryMeta = {
  slug: CategorySlug
  groupId: GroupId
  name: string
  shortName: string
  headline: string
  intro: string
  topPickId: string
  /** Accent gradient classes for the hero / numbered chips. */
  accent: { from: string; to: string; text: string }
}

export const categoryMeta: Record<CategorySlug, CategoryMeta> = {
  framework: {
    slug: 'framework',
    groupId: 'framework',
    name: librariesGroupNamesMap.framework,
    shortName: 'Framework',
    headline: 'The TanStack framework layer',
    intro:
      'Type-safe routing and a full-stack framework built on top of it. Start small with Router, or go end-to-end with Start.',
    topPickId: 'start',
    accent: {
      from: 'from-teal-500',
      to: 'to-cyan-500',
      text: 'text-cyan-600 dark:text-cyan-400',
    },
  },
  state: {
    slug: 'state',
    groupId: 'state',
    name: librariesGroupNamesMap.state,
    shortName: 'Data & State',
    headline: 'Data and state — without the ceremony',
    intro:
      'Server state, async data, reactive stores, and an AI-aware layer on top. The libraries you reach for when an app needs to remember things, fetch things, and stay coherent across the screen.',
    topPickId: 'query',
    accent: {
      from: 'from-cyan-500',
      to: 'to-emerald-500',
      text: 'text-cyan-600 dark:text-cyan-400',
    },
  },
  ui: {
    slug: 'ui',
    groupId: 'headlessUI',
    name: librariesGroupNamesMap.headlessUI,
    shortName: 'UI & UX',
    headline: 'Headless primitives for the surfaces users touch',
    intro:
      'Tables, forms, keyboard shortcuts — owned by you, styled by you, validated by the compiler.',
    topPickId: 'table',
    accent: {
      from: 'from-blue-500',
      to: 'to-yellow-500',
      text: 'text-blue-600 dark:text-blue-400',
    },
  },
  performance: {
    slug: 'performance',
    groupId: 'performance',
    name: librariesGroupNamesMap.performance,
    shortName: 'Performance',
    headline: 'Keep the long lists buttery, the noisy events tame',
    intro:
      'Virtualisation, debouncing, throttling, batching — primitives that compose instead of one-off hooks.',
    topPickId: 'virtual',
    accent: {
      from: 'from-purple-500',
      to: 'to-lime-500',
      text: 'text-purple-600 dark:text-purple-400',
    },
  },
  tooling: {
    slug: 'tooling',
    groupId: 'tooling',
    name: librariesGroupNamesMap.tooling,
    shortName: 'Tooling',
    headline: 'Devtools, scaffolds, and packaging defaults',
    intro:
      'Take the boring decisions off your plate, so the interesting work stays interesting.',
    topPickId: 'devtools',
    accent: {
      from: 'from-indigo-500',
      to: 'to-orange-500',
      text: 'text-indigo-600 dark:text-indigo-400',
    },
  },
}

export function getCategoryLibraries(slug: CategorySlug): LibrarySlim[] {
  return [...librariesByGroup[slugToGroup[slug]]]
}
