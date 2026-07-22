import { Funnel, Resize, Sparkle, Stack } from '@phosphor-icons/react'

import { LibraryLanding, type LibraryLandingConfig } from './LibraryLanding'

const tableLanding = {
  libraryId: 'table',
  headline: 'Build the table you actually designed.',
  description:
    'Table is the headless engine for rows, columns, sorting, filtering, grouping, pagination, selection, and controlled state. It solves the hard parts of a data grid without taking over the markup.',
  distinction: 'A data engine should not become your design system.',
  hero: {
    label: 'table state',
    actionLabel: 'Cycle column',
    detailTitle: 'Every feature is composable state.',
    detailBody:
      'Column definitions and row models provide the behavior. Your components decide how the result looks and works.',
    items: [
      {
        key: 'project',
        title: 'Accessor, header, and custom cell',
        badge: 'text',
        activity: 87,
      },
      {
        key: 'status',
        title: 'Faceted filter and badge renderer',
        badge: 'facet',
        activity: 64,
      },
      {
        key: 'score',
        title: 'Numeric sort and server filter',
        badge: 'number',
        activity: 48,
      },
    ],
    facts: [
      { label: 'rows', value: '10,000' },
      { label: 'visible columns', value: '4 of 7' },
      { label: 'selected', value: '2 rows' },
      { label: 'page size', value: '25' },
    ],
  },
  features: [
    {
      icon: Sparkle,
      label: 'Headless',
      title: 'The designer still wins.',
      body: 'Table gives you the math and state. Your app keeps the elements, classes, interactions, density, empty states, and brand-specific details.',
    },
    {
      icon: Stack,
      label: 'Row models',
      title: 'Feature power without a grid tax.',
      body: 'Sorting, filtering, faceting, grouping, aggregation, expansion, selection, sizing, pinning, visibility, ordering, and pagination stay opt-in.',
    },
    {
      icon: Funnel,
      label: 'Server data',
      title: 'Remote data is not an afterthought.',
      body: 'Pagination, sorting, and filters can be local, controlled, URL-driven, or backed by an API. Table never assumes where the rows live.',
    },
    {
      icon: Resize,
      label: 'Virtualization',
      title: 'Windowing stays your choice.',
      body: 'Pair with TanStack Virtual for huge rows or columns without turning the table engine into a scroll-container framework.',
    },
  ],
  lifecycle: {
    label: 'Table pipeline',
    title: 'Data enters. Your markup comes out.',
    body: 'Column definitions, row models, and controlled state compose into the exact surface the product needs.',
    steps: [
      {
        label: 'Columns',
        body: 'Describe accessors, headers, cells, metadata, and feature behavior.',
      },
      {
        label: 'Rows',
        body: 'Compose core, filtered, sorted, grouped, expanded, and paginated models.',
      },
      {
        label: 'State',
        body: 'Control only the sorting, filters, selection, or visibility the app owns.',
      },
      {
        label: 'Markup',
        body: 'Render semantic tables, cards, virtual panes, or spreadsheet-like layouts.',
      },
    ],
  },
  flow: {
    label: 'Controlled state',
    title: 'Keep table state wherever the product needs it.',
    body: 'Start managed, then lift individual state into component, URL, or server ownership without replacing the table engine.',
    steps: [
      { label: 'user event', code: 'column.toggleSorting()' },
      { label: 'state update', code: 'onSortingChange(setSorting)' },
      { label: 'row model', code: 'getSortedRowModel()' },
      { label: 'external sync', code: 'navigate({ search: { sort } })' },
    ],
  },
  prompt:
    'Build a TanStack Table data grid for a TypeScript app. Keep it headless: define column definitions, row models, sorting, filtering, pagination, selection, visibility, and controlled state without prescribing markup. Render accessible table elements and synchronize table state to the URL or server only where the product needs it.',
  promptLabel: 'Copy Table prompt',
} satisfies LibraryLandingConfig

export default function TableLanding() {
  return <LibraryLanding config={tableLanding} />
}
