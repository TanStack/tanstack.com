import {
  Database,
  Link as LinkIcon,
  MagnifyingGlass,
  Stack,
} from '@phosphor-icons/react'

import { LibraryLanding, type LibraryLandingConfig } from './LibraryLanding'

const routerLanding = {
  libraryId: 'router',
  headline: 'The route tree is the application contract.',
  description:
    'Router turns routes into typed APIs for navigation, URL state, loaders, pending states, and code splitting. Keep the app client-first, then add a server with Start when the product needs one.',
  distinction: 'The file, the URL, and the component agree.',
  hero: {
    label: 'route map',
    actionLabel: 'Match route',
    detailTitle: 'Types follow every path.',
    detailBody:
      'Generated routes connect paths, params, search schemas, loaders, and links before the component renders.',
    items: [
      {
        key: 'routes/__root.tsx',
        title: 'Providers, boundary, layout',
        badge: 'root',
        activity: 88,
      },
      {
        key: 'routes/_app.invoices.$id.tsx',
        title: 'Typed params and loader data',
        badge: 'param',
        activity: 74,
      },
      {
        key: 'routes/_app.search.tsx',
        title: 'Validated filters and pagination',
        badge: 'search',
        activity: 61,
      },
    ],
    facts: [
      { label: 'paths', value: 'generated' },
      { label: 'params', value: 'inferred' },
      { label: 'search', value: 'validated' },
      { label: 'preload', value: 'on intent' },
    ],
  },
  features: [
    {
      icon: LinkIcon,
      label: 'Links',
      title: 'Navigation knows the route tree.',
      body: 'Link, redirect, and navigate calls autocomplete against generated paths, params, and search contracts instead of stringly typed guesses.',
    },
    {
      icon: MagnifyingGlass,
      label: 'Search',
      title: 'Search params behave like state.',
      body: 'Parse, validate, inherit, update, and share URL state with the same confidence you expect from a state manager.',
    },
    {
      icon: Database,
      label: 'Loaders',
      title: 'Data work starts at the route.',
      body: 'Route loaders run in parallel, preload on intent, cache results, and hand typed data to the component before render.',
    },
    {
      icon: Stack,
      label: 'Boundaries',
      title: 'Every route owns its lifecycle.',
      body: 'Pending UI, errors, not-found states, code splitting, and context live where the product route actually changes.',
    },
  ],
  lifecycle: {
    label: 'Route lifecycle',
    title: 'Know the next screen before React renders.',
    body: 'Matching the route first lets data, code, and pending UI start together instead of forming a render-time waterfall.',
    steps: [
      {
        label: 'Match',
        body: 'The next route, params, and search contract are known before rendering.',
      },
      {
        label: 'Preload',
        body: 'Hover, viewport, or intent can start route code and data early.',
      },
      {
        label: 'Cache',
        body: 'Loaders reuse fresh results and avoid repeated work by default.',
      },
      {
        label: 'Render',
        body: 'Components receive typed loader data, context, and pending state.',
      },
    ],
  },
  flow: {
    label: 'Typed navigation',
    title: 'One route contract, from link to loader.',
    body: 'Paths, params, search, and data stay connected as navigation moves through the application.',
    steps: [
      { label: 'destination', code: "to: '/invoices/$id'" },
      {
        label: 'typed inputs',
        code: "params: { id }, search: { tab: 'open' }",
      },
      { label: 'route data', code: 'loader({ params, deps })' },
      { label: 'boundary', code: 'notFound() | redirect()' },
    ],
  },
  prompt:
    'Build a TanStack Router application with a generated route tree, typed params and search schemas, route loaders, intent preloading, pending and error boundaries, and code splitting. Keep URL state in the URL and make every link and navigation call type-safe.',
  promptLabel: 'Copy Router prompt',
} satisfies LibraryLandingConfig

export default function RouterLanding() {
  return <LibraryLanding config={routerLanding} />
}
