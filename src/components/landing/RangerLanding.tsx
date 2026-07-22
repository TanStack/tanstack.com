import {
  ArrowsHorizontal,
  Gauge,
  Ruler,
  SlidersHorizontal,
} from '@phosphor-icons/react'

import {
  LibraryLanding,
  type LibraryLandingConfig,
} from '~/components/landing/LibraryLanding'

const rangerLandingConfig = {
  libraryId: 'ranger',
  headline: 'Build the slider your product actually needs.',
  description:
    'Ranger provides headless primitives for range and multi-range sliders, leaving the track, thumbs, labels, ticks, and product UI completely under your control.',
  distinction: 'Range math without a slider skin',
  hero: {
    label: 'multi-range slider',
    actionLabel: 'Move',
    detailTitle: 'Values become interactive geometry',
    detailBody:
      'Ranger owns range math and thumb interaction state. Your product owns the markup, semantics, labels, and visual language.',
    items: [
      {
        key: 'price.min',
        title: 'Lower bound',
        badge: '$120',
        activity: 12,
      },
      {
        key: 'price.target',
        title: 'Preferred value',
        badge: '$310',
        activity: 31,
      },
      {
        key: 'price.max',
        title: 'Upper bound',
        badge: '$640',
        activity: 64,
      },
    ],
    facts: [
      { label: 'min', value: '0' },
      { label: 'max', value: '1,000' },
      { label: 'step', value: '10' },
      { label: 'thumbs', value: '3 constrained' },
    ],
  },
  features: [
    {
      icon: SlidersHorizontal,
      label: 'Headless',
      title: 'The slider is yours.',
      body: 'Ranger gives interaction state and range math without rendering the track, thumbs, labels, or layout for you.',
    },
    {
      icon: ArrowsHorizontal,
      label: 'Multi-range',
      title: 'Multi-range without bespoke math.',
      body: 'Build price filters, timelines, editors, split ranges, or multi-thumb controls with bounds and steps handled predictably.',
    },
    {
      icon: Ruler,
      label: 'Ticks',
      title: 'Ticks and labels can be product-specific.',
      body: 'Display percentages, dates, currency, logarithmic labels, marks, or custom annotations from the same headless primitives.',
    },
    {
      icon: Gauge,
      label: 'Control',
      title: 'Small utility, high inversion of control.',
      body: 'Ranger is useful precisely because it does not become your design system. It stays under the component you actually need.',
    },
  ],
  lifecycle: {
    label: 'Slider lifecycle',
    title: 'Values in, product-specific control out.',
    body: 'Ranger translates values into interactive geometry. Your app decides what those values mean and how the user should see them.',
    steps: [
      {
        label: 'Values',
        body: 'Start with one value, two bounds, or a set of range handles.',
      },
      {
        label: 'Track',
        body: 'Map percentages and segments into your own track UI.',
      },
      {
        label: 'Thumbs',
        body: 'Render handles with labels, tooltips, constraints, and focus state.',
      },
      {
        label: 'Commit',
        body: 'Send final values into filters, charts, editors, or forms.',
      },
    ],
  },
  flow: {
    label: 'Product integration',
    title: 'The range primitive stays below your component.',
    body: 'Keep value state, range math, interaction geometry, and product UI separate so the control can become exactly what the interface requires.',
    steps: [
      { label: 'Values', code: '[120, 310, 640]' },
      { label: 'Geometry', code: '12% · 31% · 64%' },
      { label: 'UI', code: 'custom track + thumbs' },
      { label: 'Commit', code: 'filters.price = range' },
    ],
  },
  prompt: [
    'Build a custom range or multi-range slider with TanStack Ranger.',
    'Keep the slider headless: own the markup, track, ticks, labels, thumbs, formatting, and accessibility while using Ranger for range math and thumb interaction state.',
    'Show min/max, steps, multiple thumbs, constrained movement, and product-specific styling.',
  ].join(' '),
  promptLabel: 'Copy Ranger prompt',
} satisfies LibraryLandingConfig

export default function RangerLanding() {
  return <LibraryLanding config={rangerLandingConfig} />
}
