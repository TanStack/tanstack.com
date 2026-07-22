import {
  ArrowsSplit,
  CircleNotch,
  FileText,
  Fingerprint,
} from '@phosphor-icons/react'

import { LibraryLanding, type LibraryLandingConfig } from './LibraryLanding'

const formLanding = {
  libraryId: 'form',
  headline: 'Forms that stay typed after the first field.',
  description:
    'Form gives complex, interactive forms a headless state model: typed fields, granular subscriptions, validation events, async checks, nested values, and framework adapters without forcing a UI wrapper onto your design system.',
  distinction: 'The hard part of a form is everything around the input.',
  hero: {
    label: 'form state',
    actionLabel: 'Cycle field',
    detailTitle: 'Every field keeps its contract.',
    detailBody:
      'Values, validation, metadata, and submit payloads remain connected as the form grows and the schema changes.',
    items: [
      {
        key: 'profile.email',
        title: 'Schema and async availability',
        badge: 'valid',
        activity: 93,
      },
      {
        key: 'company.plan',
        title: 'Recalculates billing preview',
        badge: 'dirty',
        activity: 71,
      },
      {
        key: 'members[2].role',
        title: 'Debounced permission check',
        badge: 'pending',
        activity: 46,
      },
    ],
    facts: [
      { label: 'values', value: 'fully inferred' },
      { label: 'dirty', value: '2 fields' },
      { label: 'validating', value: '1 async' },
      { label: 'can submit', value: 'true' },
    ],
  },
  features: [
    {
      icon: Fingerprint,
      label: 'TypeScript',
      title: 'Types are part of the form model.',
      body: 'Field names, values, validators, errors, and submit handlers stay connected, so refactors travel through the entire form.',
    },
    {
      icon: FileText,
      label: 'Headless',
      title: 'Composition keeps forms honest.',
      body: 'Keep the real controls in your product UI. Labels, hints, validation states, layout, and accessibility remain yours.',
    },
    {
      icon: ArrowsSplit,
      label: 'Subscriptions',
      title: 'Big forms can update like small ones.',
      body: 'Checkout, onboarding, and admin surfaces subscribe to narrow field and form state instead of repainting on every keystroke.',
    },
    {
      icon: CircleNotch,
      label: 'Async rules',
      title: 'Validation can run at the speed of the user.',
      body: 'Debounced checks, validation events, and pending states keep the form responsive while slow business rules run in the background.',
    },
  ],
  lifecycle: {
    label: 'Validation lifecycle',
    title: 'Make every state visible and intentional.',
    body: 'Choose when each rule runs, subscribe to the result, and preserve a typed path from the field event to the submitted value.',
    steps: [
      {
        label: 'Change',
        body: 'Field state updates immediately and only relevant subscribers render.',
      },
      {
        label: 'Validate',
        body: 'Synchronous rules run close to the field while async work can debounce.',
      },
      {
        label: 'Derive',
        body: 'Errors, touched, dirty, canSubmit, and pending metadata stay typed.',
      },
      {
        label: 'Submit',
        body: 'The handler receives the inferred value shape instead of an assembled payload.',
      },
    ],
  },
  flow: {
    label: 'Granular reactivity',
    title: 'Update only the UI that depends on the field.',
    body: 'Narrow subscriptions keep field feedback, summaries, and submit controls synchronized without rerendering the entire form.',
    steps: [
      { label: 'field event', code: "field.handleChange('team')" },
      { label: 'validation', code: 'validators.onChange(value)' },
      { label: 'subscription', code: 'selector: state => state.canSubmit' },
      { label: 'async branch', code: 'onChangeAsyncDebounceMs: 500' },
    ],
  },
  prompt:
    'Build a TanStack Form experience for a TypeScript app. Use typed form and field APIs, synchronous and debounced async validators, deeply nested object and array fields, and granular subscriptions so only relevant UI updates. Keep it headless and render accessible, product-specific controls.',
  promptLabel: 'Copy Form prompt',
} satisfies LibraryLandingConfig

export default function FormLanding() {
  return <LibraryLanding config={formLanding} />
}
