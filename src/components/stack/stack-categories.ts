import { librariesByGroup, librariesGroupNamesMap } from '~/libraries'
import type { LibrarySlim } from '~/libraries'

export type GroupId = keyof typeof librariesByGroup

export type CategorySlug = 'state' | 'ui' | 'performance' | 'tooling'

export const slugToGroup: Record<CategorySlug, GroupId> = {
  state: 'state',
  ui: 'headlessUI',
  performance: 'performance',
  tooling: 'tooling',
}

export const groupToSlug: Record<GroupId, CategorySlug> = {
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
  editorsPickId: string
  criteria: Array<{ title: string; detail: string }>
  /** Accent gradient classes for the hero / numbered chips. */
  accent: { from: string; to: string; text: string }
}

export const categoryMeta: Record<CategorySlug, CategoryMeta> = {
  state: {
    slug: 'state',
    groupId: 'state',
    name: librariesGroupNamesMap.state,
    shortName: 'Data & State',
    headline: 'The best of TanStack — for data & state',
    intro:
      'Routing, server state, async data, reactive stores. The libraries you reach for when an app needs to remember things, fetch things, and stay coherent across the screen.',
    editorsPickId: 'start',
    criteria: [
      {
        title: 'Type-safe end to end',
        detail:
          'Search params, loaders, mutations and store shapes that the compiler can actually check.',
      },
      {
        title: 'Framework agnostic core',
        detail:
          'A pure JS core with adapters for React, Solid, Vue, Svelte and Angular — so the same patterns work everywhere.',
      },
      {
        title: 'Sensible defaults',
        detail:
          'Caching, retries, dedup, optimistic UI — all opinionated where it matters and overridable where it doesn’t.',
      },
    ],
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
    headline: 'The best of TanStack — for UI & UX',
    intro:
      'Headless primitives for the surfaces users actually touch. Tables, forms, keyboard shortcuts — owned by you, styled by you, validated by the compiler.',
    editorsPickId: 'table',
    criteria: [
      {
        title: 'Headless by default',
        detail:
          'No baked-in markup. You bring the design system; TanStack brings the behavior.',
      },
      {
        title: 'Performance under real loads',
        detail:
          'Sortable, filterable, virtualised — at row counts that break most off-the-shelf grids.',
      },
      {
        title: 'Accessibility kept honest',
        detail:
          'Keyboard, focus and ARIA built in — not bolted on after launch.',
      },
    ],
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
    headline: 'The best of TanStack — for performance',
    intro:
      'Keep large lists buttery, throttle the noisy events, and stop writing the same debounce-and-pray code in every project.',
    editorsPickId: 'virtual',
    criteria: [
      {
        title: 'Built for the long list',
        detail:
          'Virtualisation that scales to hundreds of thousands of rows without dropping frames.',
      },
      {
        title: 'Rate-limiting that survives review',
        detail:
          'Debounce, throttle, queue, batch — primitives that compose instead of one-off hooks.',
      },
      {
        title: 'Drops into existing apps',
        detail:
          'No re-architecture required. Add where the bottleneck is, leave the rest alone.',
      },
    ],
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
    headline: 'The best of TanStack — for tooling',
    intro:
      'Devtools, scaffolds, and packaging defaults that take the boring decisions off your plate, so the interesting work stays interesting.',
    editorsPickId: 'devtools',
    criteria: [
      {
        title: 'Visibility into the runtime',
        detail:
          'Unified devtools panel for the whole TanStack stack — and your own debug surfaces alongside.',
      },
      {
        title: 'Opinionated where it matters',
        detail:
          'Lint, build, version, publish — the same pipeline TanStack itself uses for 20+ packages.',
      },
      {
        title: 'Agent-aware',
        detail:
          'CLI, MCP server, and Agent Skills designed so humans and AI tools share the same surface area.',
      },
    ],
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

export function getOtherCategories(slug: CategorySlug): CategoryMeta[] {
  return categorySlugs.filter((s) => s !== slug).map((s) => categoryMeta[s])
}
