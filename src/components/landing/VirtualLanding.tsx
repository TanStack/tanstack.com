import { Cursor, Eye, Ruler, Sparkle } from '@phosphor-icons/react'

import { LibraryLanding, type LibraryLandingConfig } from './LibraryLanding'

const virtualLanding = {
  libraryId: 'virtual',
  headline: 'Render what the user can see. Nothing more.',
  description:
    'Virtual is a headless virtualizer for large lists and grids. It calculates the visible range, measures dynamic items, and preserves smooth scrolling while your product owns the container, markup, and styles.',
  distinction: 'A huge dataset does not need a huge DOM.',
  hero: {
    label: 'virtual window',
    actionLabel: 'Cycle mode',
    detailTitle: 'Small DOM. Full scroll range.',
    detailBody:
      'Virtual items describe where visible content belongs while padding preserves the geometry of the entire dataset.',
    items: [
      {
        key: 'vertical list',
        title: 'Feeds, logs, timelines, results',
        badge: '14 mounted',
        activity: 89,
      },
      {
        key: 'horizontal lane',
        title: 'Calendars, kanban, image strips',
        badge: '9 mounted',
        activity: 67,
      },
      {
        key: 'dynamic grid',
        title: 'Measured rows and columns',
        badge: '24 mounted',
        activity: 52,
      },
    ],
    facts: [
      { label: 'items', value: '10,000' },
      { label: 'mounted', value: '14' },
      { label: 'overscan', value: '4' },
      { label: 'sizing', value: 'dynamic' },
    ],
  },
  features: [
    {
      icon: Eye,
      label: 'Windowing',
      title: 'The DOM stays small while the list stays huge.',
      body: 'Virtual calculates the visible range, pads the scroll space, and lets you render only the items the user can actually see.',
    },
    {
      icon: Ruler,
      label: 'Measurement',
      title: 'Real content can have real dimensions.',
      body: 'Use fixed sizes when possible, measure dynamic content when it varies, and overscan enough to keep fast scrolling smooth.',
    },
    {
      icon: Cursor,
      label: 'Headless scroll',
      title: 'The scroll container belongs to the product.',
      body: 'Window scrolling, element scrolling, grids, lanes, sticky UI, and custom markup remain your responsibility and freedom.',
    },
    {
      icon: Sparkle,
      label: 'Composition',
      title: 'Use it beneath the rest of the stack.',
      body: 'Pair Virtual with Table for giant grids, Query for paged data, Router for URL state, or a completely custom renderer.',
    },
  ],
  lifecycle: {
    label: 'Virtualization lifecycle',
    title: 'Turn one count into a measured viewport.',
    body: 'A stable estimate creates the scroll range immediately, then live measurements refine only the items that enter the window.',
    steps: [
      {
        label: 'Count',
        body: 'Tell the virtualizer how many items exist, even when most are unmounted.',
      },
      {
        label: 'Estimate',
        body: 'Provide a stable initial size so the full scroll range is available.',
      },
      {
        label: 'Measure',
        body: 'Dynamic items report their actual dimensions as content changes.',
      },
      {
        label: 'Render',
        body: 'Map virtual items into your own positioned rows, cells, or cards.',
      },
    ],
  },
  flow: {
    label: 'Scroll control',
    title: 'Move through thousands of items with one small window.',
    body: 'Programmatic scrolling, live measurements, and stable anchors share the same virtual coordinate system.',
    steps: [
      { label: 'target', code: 'virtualizer.scrollToIndex(180)' },
      { label: 'measure', code: 'virtualizer.measureElement(row)' },
      { label: 'render', code: 'virtualizer.getVirtualItems()' },
      { label: 'end anchor', code: "anchorTo: 'end'" },
    ],
  },
  prompt:
    'Build a TanStack Virtual experience for a TypeScript app. Use a headless virtualizer for a large list or grid, render only visible items plus overscan, support dynamic measurement, and keep the scroll container and markup owned by the product UI. Include programmatic scrolling and stable empty and loading states.',
  promptLabel: 'Copy Virtual prompt',
} satisfies LibraryLandingConfig

export default function VirtualLanding() {
  return <LibraryLanding config={virtualLanding} />
}
