import * as React from 'react'
import { ArrowsSplit, Clock, Gauge, Rows } from '@phosphor-icons/react'

import { LibraryLanding, type LibraryLandingConfig } from './LibraryLanding'

const pacerPrompt = [
  'Build a TanStack Pacer timing layer for a TypeScript app.',
  'Use debouncing, throttling, rate limiting, queuing, or batching where each fits the workflow, and expose cancellation, pause/resume, retry, status, and concurrency controls for async work.',
  'Keep the primitives framework-agnostic while wiring reactive state through the correct adapter for the UI runtime.',
].join(' ')

const config = {
  libraryId: 'pacer',
  headline: 'Control when work is allowed to happen.',
  description:
    'Pacer gives JavaScript apps typed primitives for debouncing, throttling, rate limiting, queuing, and batching so expensive work runs at the speed the product can afford.',
  distinction: 'Why Pacer',
  hero: {
    label: 'work scheduler',
    actionLabel: 'Queue task',
    detailTitle: 'Pressure control',
    detailBody:
      'Choose the policy that matches the work, then observe and control its execution.',
    items: [
      {
        key: 'search:router',
        title: 'Wait for search intent',
        badge: 'debounce',
        activity: 84,
      },
      {
        key: 'scroll:virtual',
        title: 'Pace rapid viewport events',
        badge: 'throttle',
        activity: 71,
      },
      {
        key: 'writes:telemetry',
        title: 'Order and collect async work',
        badge: 'queue',
        activity: 63,
      },
    ],
    facts: [
      { label: 'input', value: 'debounce' },
      { label: 'events', value: 'throttle' },
      { label: 'async', value: 'queue + limit' },
      { label: 'writes', value: 'batch' },
    ],
  },
  features: [
    {
      icon: Clock,
      label: 'Debounce',
      title: 'Wait for the work that should wait.',
      body: 'Search, validation, autosave, and expensive calculations can wait for intent instead of firing on every keystroke.',
    },
    {
      icon: Gauge,
      label: 'Throttle',
      title: 'Pace the work that should stay responsive.',
      body: 'Scroll, resize, pointer, sensor, and realtime events can move quickly without flooding the app.',
    },
    {
      icon: Rows,
      label: 'Queue',
      title: 'Order the work that cannot run at once.',
      body: 'Run async tasks with FIFO, LIFO, priority, pause, cancellation, retries, and concurrency control.',
    },
    {
      icon: ArrowsSplit,
      label: 'Batch',
      title: 'Send related work together.',
      body: 'Collect writes, logs, telemetry, or cache operations into sensible flushes instead of shipping every item alone.',
    },
  ],
  lifecycle: {
    label: 'Control lifecycle',
    title: 'Accept the work now. Run it when it makes sense.',
    body: 'Every primitive exposes state and controls, so products can show pending work, cancel stale tasks, flush intentionally, or pause a queue before it becomes chaos.',
    steps: [
      {
        label: 'Accept',
        body: 'Receive calls from UI events, async workflows, or service boundaries.',
      },
      {
        label: 'Pace',
        body: 'Apply timing, rate, concurrency, ordering, and batching rules.',
      },
      {
        label: 'Signal',
        body: 'Report idle, pending, running, queued, success, error, and cancelled state.',
      },
      {
        label: 'Flush',
        body: 'Flush, cancel, pause, resume, retry, or drain the current workload.',
      },
    ],
  },
  flow: {
    label: 'Async pressure',
    title: 'Queues should be observable, cancellable, and boring.',
    body: 'Pacer manages abort signals, retries, ordering, queue state, and concurrency without making each feature team invent a scheduler.',
    steps: [
      { label: 'Accept', code: 'queue.add(task)' },
      { label: 'Schedule', code: 'concurrency: 2' },
      { label: 'Execute', code: 'run({ signal })' },
      { label: 'Control', code: 'cancel | flush | retry' },
    ],
  },
  prompt: pacerPrompt,
  promptLabel: 'Copy Pacer prompt',
} satisfies LibraryLandingConfig

export default function PacerLanding() {
  return <LibraryLanding config={config} />
}
