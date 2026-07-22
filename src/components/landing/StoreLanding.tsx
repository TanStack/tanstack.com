import * as React from 'react'
import { Cpu, Fingerprint, Radio, Stack } from '@phosphor-icons/react'

import { LibraryLanding, type LibraryLandingConfig } from './LibraryLanding'

const storePrompt = [
  'Build a TanStack Store state model for a TypeScript app.',
  'Use immutable updates, derived values, scoped subscriptions, and framework adapters so components subscribe only to the state slices they need.',
  'Keep the store small and framework-agnostic, and show how it can power UI state or library internals without replacing server-state tools like TanStack Query or DB.',
].join(' ')

const config = {
  libraryId: 'store',
  headline: 'The tiny reactive core behind serious state.',
  description:
    'Store is a framework-agnostic state primitive for immutable updates, derived values, and targeted subscriptions—small enough for library internals and flexible enough for product UI.',
  distinction: 'Why Store',
  hero: {
    label: 'subscription graph',
    actionLabel: 'Update state',
    detailTitle: 'Selected state',
    detailBody:
      'Each subscriber reads only the state it needs while the core remains portable across runtimes.',
    items: [
      {
        key: 'state.filters',
        title: 'Table and search controls',
        badge: 'selected',
        activity: 82,
      },
      {
        key: 'state.selectedIds',
        title: 'Derived selection count',
        badge: 'derived',
        activity: 68,
      },
      {
        key: 'state.panel',
        title: 'Local layout state',
        badge: 'subscribed',
        activity: 54,
      },
    ],
    facts: [
      { label: 'updates', value: 'immutable' },
      { label: 'selectors', value: 'granular' },
      { label: 'core', value: 'framework-free' },
      { label: 'adapters', value: 'renderer-specific' },
    ],
  },
  features: [
    {
      icon: Cpu,
      label: 'Small core',
      title: 'Small enough to sit under other libraries.',
      body: 'Store is the tiny reactive primitive that powers framework adapters, library internals, and focused product state.',
    },
    {
      icon: Fingerprint,
      label: 'Immutable',
      title: 'Immutable updates keep changes legible.',
      body: 'State transitions stay explicit, snapshots remain predictable, and derived values avoid mutating shared objects in place.',
    },
    {
      icon: Radio,
      label: 'Subscriptions',
      title: 'Let components ask for less.',
      body: 'Components listen to exactly the state they render, so nearby changes do not repaint an entire product surface.',
    },
    {
      icon: Stack,
      label: 'Adapters',
      title: 'The framework adapter is not the store.',
      body: 'Use bindings for your renderer while the core state model stays portable across apps, packages, and UI runtimes.',
    },
  ],
  lifecycle: {
    label: 'Store lifecycle',
    title: 'Write once, derive once, subscribe precisely.',
    body: 'A good store keeps transitions visible and component subscriptions narrow without forcing a global architecture on the application.',
    steps: [
      {
        label: 'Write',
        body: 'Update state through a predictable immutable transition.',
      },
      {
        label: 'Derive',
        body: 'Compute values without creating another hand-synchronized state bucket.',
      },
      {
        label: 'Select',
        body: 'Subscribe to the exact slice needed for rendering or effects.',
      },
      {
        label: 'Adapt',
        body: 'Bridge the same core into React, Vue, Solid, Svelte, Angular, Lit, or vanilla code.',
      },
    ],
  },
  flow: {
    label: 'Reactive updates',
    title: 'One update. Only the right subscribers move.',
    body: 'Store applies the transition, recomputes derived state, and notifies only subscriptions whose selected value changed.',
    steps: [
      { label: 'Write', code: 'store.setState(next)' },
      { label: 'Derive', code: 'selectedIds.length' },
      { label: 'Select', code: 'useStore(selector)' },
      { label: 'Notify', code: 'subscriber(nextSlice)' },
    ],
  },
  prompt: storePrompt,
  promptLabel: 'Copy Store prompt',
} satisfies LibraryLandingConfig

export default function StoreLanding() {
  return <LibraryLanding config={config} />
}
