import {
  Gauge,
  MagnifyingGlass,
  PuzzlePiece,
  Stack,
} from '@phosphor-icons/react'
import * as React from 'react'

import { LibraryLanding, type LibraryLandingConfig } from './LibraryLanding'

const devtoolsPrompt = [
  'Add TanStack Devtools to a TypeScript app.',
  'Use the unified devtools shell to host TanStack panels and custom product devtools while keeping the panel lightweight, framework-friendly, and development-only.',
  'Include examples for mounting built-in and product-specific panels through the plugins array.',
].join(' ')

const config = {
  libraryId: 'devtools',
  headline: 'One panel for the state your app is built on.',
  description:
    'Devtools brings TanStack inspectors and your own panels into one development surface, so caches, routes, mutations, queues, flags, and product state can be explored while the app runs.',
  distinction: 'Why Devtools',
  hero: {
    label: 'runtime inspector',
    actionLabel: 'Add panel',
    detailTitle: 'Unified inspector',
    detailBody:
      'Open library and product-specific runtime state from one quiet development shell.',
    items: [
      {
        key: 'query-cache',
        title: 'Observers, mutations, and stale state',
        badge: 'fresh',
        activity: 91,
      },
      {
        key: 'router-matches',
        title: 'Loaders, params, and pending routes',
        badge: 'active',
        activity: 76,
      },
      {
        key: 'product-jobs',
        title: 'Queues, flags, and background work',
        badge: 'custom',
        activity: 64,
      },
    ],
    facts: [
      { label: 'shell', value: 'one mount' },
      { label: 'panels', value: 'plugin-driven' },
      { label: 'state', value: 'live runtime' },
      { label: 'runtime', value: 'framework-friendly' },
    ],
  },
  features: [
    {
      icon: MagnifyingGlass,
      label: 'Runtime truth',
      title: 'Give runtime state a shared place to live.',
      body: 'TanStack apps already contain rich state. Devtools makes it inspectable without scattering one-off debug surfaces through the product.',
    },
    {
      icon: PuzzlePiece,
      label: 'Custom panels',
      title: 'Put product panels beside library panels.',
      body: 'Register feature flags, sync jobs, queues, storage, or generated clients next to Query and Router through the same plugin surface.',
    },
    {
      icon: Gauge,
      label: 'Lightweight shell',
      title: 'Keep the shell quiet until it is needed.',
      body: 'Mount a development surface without turning each TanStack package into its own windowing system.',
    },
    {
      icon: Stack,
      label: 'Adapters',
      title: 'Frameworks get adapters, not rewrites.',
      body: 'Use the shell from React, Vue, Solid, Preact, Angular, or vanilla integration points while each panel owns its state model.',
    },
  ],
  lifecycle: {
    label: 'Panel workflow',
    title: 'Mount the shell once. Let panels bring the detail.',
    body: 'Devtools should feel like infrastructure: available when needed, absent from product code, and ready for the next library or internal inspector.',
    steps: [
      {
        label: 'Mount',
        body: 'Add the unified devtools shell once near the application root.',
      },
      {
        label: 'Register',
        body: 'Provide TanStack or product-specific panels through the plugins array.',
      },
      {
        label: 'Inspect',
        body: 'Read cache, route, queue, feature, or product state while it is live.',
      },
      {
        label: 'Extend',
        body: 'Keep custom debugging tools in the same workflow as core libraries.',
      },
    ],
  },
  flow: {
    label: 'Plugin surface',
    title: 'The product can have devtools too.',
    body: 'Panels compose through a small plugin boundary, giving every runtime concern a consistent home without adding another admin route.',
    steps: [
      { label: 'Mount', code: '<TanStackDevtools />' },
      { label: 'Register', code: 'plugins={[query, router]}' },
      { label: 'Inspect', code: "openPanel('query')" },
      { label: 'Custom', code: 'plugins={[jobsPanel]}' },
    ],
  },
  prompt: devtoolsPrompt,
  promptLabel: 'Copy Devtools prompt',
} satisfies LibraryLandingConfig

export default function DevtoolsLanding() {
  return <LibraryLanding config={config} />
}
