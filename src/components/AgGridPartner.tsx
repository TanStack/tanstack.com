import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { CodeBlock } from '~/components/markdown/CodeBlock'
import { trackEvent } from '~/utils/analytics'

/**
 * Shared building blocks for the AG Grid partner page and its subpages
 * (`/partners/ag-grid/*`). Keeping links, tracking, and small UI helpers in one
 * place keeps every page consistent and the sponsor UTM tags in sync.
 */

const UTM = 'utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'

export const AG_GRID_LINKS = {
  home: `https://www.ag-grid.com/?${UTM}`,
  reactGrid: `https://www.ag-grid.com/react-data-grid/?${UTM}`,
  docs: `https://www.ag-grid.com/react-data-grid/getting-started/?${UTM}`,
  rowGrouping: `https://www.ag-grid.com/react-data-grid/grouping/?${UTM}`,
  pivoting: `https://www.ag-grid.com/react-data-grid/pivoting/?${UTM}`,
  serverSide: `https://www.ag-grid.com/react-data-grid/server-side-model/?${UTM}`,
  integratedCharts: `https://www.ag-grid.com/react-data-grid/integrated-charts/?${UTM}`,
  agCharts: `https://www.ag-grid.com/charts/?${UTM}`,
  pricing: `https://www.ag-grid.com/license-pricing/?${UTM}`,
  studio: `https://www.ag-grid.com/studio/?${UTM}`,
  studioTrial: `https://www.ag-grid.com/studio/license-pricing/?tab=trial&${UTM}`,
  studioDemos: `https://www.ag-grid.com/studio/example/?${UTM}`,
  studioQuickStart: `https://www.ag-grid.com/studio/react/quick-start/?${UTM}`,
} as const

export function trackAgGridClick(destinationHost = 'ag-grid.com') {
  trackEvent('partner_clicked', {
    partner_id: 'ag-grid',
    placement: 'detail',
    destination: 'external',
    destination_host: destinationHost,
  })
}

export function CheckBadge() {
  return (
    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
      <Check className="h-2.5 w-2.5" strokeWidth={3} />
    </span>
  )
}

export function AgGridCodeExample({
  code,
  lang,
  title,
}: {
  code: string
  lang: string
  title: string
}) {
  return (
    <CodeBlock dataCodeTitle={title}>
      <code className={`language-${lang}`}>{code}</code>
    </CodeBlock>
  )
}

type SubpageLinkTo =
  | '/partners/ag-grid'
  | '/partners/ag-grid/studio'
  | '/partners/ag-grid/vs-tanstack-table'
  | '/partners/ag-grid/enterprise'
  | '/partners/ag-grid/getting-started'

const SUBPAGES: Array<{ to: SubpageLinkTo; label: string; desc: string }> = [
  {
    to: '/partners/ag-grid',
    label: 'Overview',
    desc: 'AG Grid + TanStack Table, at a glance',
  },
  {
    to: '/partners/ag-grid/getting-started',
    label: 'React quickstart',
    desc: 'Add AG Grid to a TanStack app in minutes',
  },
  {
    to: '/partners/ag-grid/vs-tanstack-table',
    label: 'vs TanStack Table',
    desc: 'When to choose which grid',
  },
  {
    to: '/partners/ag-grid/enterprise',
    label: 'Enterprise features',
    desc: 'Pivoting, grouping, and the server-side row model',
  },
  {
    to: '/partners/ag-grid/studio',
    label: 'AG Grid Studio',
    desc: 'Embedded analytics dashboards',
  },
]

/** Card grid linking to the sibling AG Grid pages. Skips the current page. */
export function AgGridSubpageNav({ current }: { current: SubpageLinkTo }) {
  const items = SUBPAGES.filter((page) => page.to !== current)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((page) => (
        <Link
          key={page.to}
          to={page.to}
          className="group rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-400 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-500"
        >
          <div className="text-sm font-semibold group-hover:text-blue-500">
            {page.label}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
            {page.desc}
          </p>
        </Link>
      ))}
    </div>
  )
}

/** Shared breadcrumb: Partners / AG Grid / <current page>. */
export function AgGridBreadcrumb({ current }: { current?: string }) {
  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
      <Link to="/partners" className="transition-colors hover:text-blue-500">
        Partners
      </Link>
      <span>/</span>
      {current ? (
        <>
          <Link
            to="/partners/ag-grid"
            className="transition-colors hover:text-blue-500"
          >
            AG Grid
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white">{current}</span>
        </>
      ) : (
        <span className="text-gray-900 dark:text-white">AG Grid</span>
      )}
    </nav>
  )
}

/** Section heading + intro shared across subpages. */
export function AgGridSectionIntro({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <>
      <h2 className="text-2xl font-black tracking-tight md:text-3xl">
        {title}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
        {children}
      </p>
    </>
  )
}
