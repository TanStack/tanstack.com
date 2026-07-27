import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowUpRight, Plus } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { Footer } from '~/components/Footer'
import { Card } from '~/components/Card'
import { Button } from '~/ui'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/Collapsible'
import { seo } from '~/utils/seo'
import { trackEvent } from '~/utils/analytics'
import {
  AG_GRID_LINKS,
  AgGridBreadcrumb,
  AgGridSubpageNav,
  CheckBadge,
  trackAgGridClick,
} from '~/components/AgGridPartner'

const chooseTanStackTable: Array<string> = [
  'You want a headless grid — you own the markup, styles, and design system',
  'Bundle size and full DOM control matter more than built-in features',
  'You are composing a bespoke table UI, not shipping a spreadsheet replacement',
  'You want the same core across React, Vue, Solid, Svelte, Qwik, Angular, and Lit',
  'Your dataset fits comfortably in the client-side model (tens of thousands of rows)',
  'You are happy to wire up sorting, grouping, and virtualization yourself',
]

const chooseAgGrid: Array<string> = [
  'You need enterprise features like pivoting or a server-side row model out of the box',
  'You are handling hundreds of thousands to millions of rows',
  'You want Excel export, integrated charts, and range selection without building them',
  'Master/detail, tree data, and clipboard support are requirements, not nice-to-haves',
  'You want a batteries-included grid your whole team can ship this week',
  'You need commercial support behind the grid at the center of your product',
]

type Row = { feature: string; table: string; agGrid: string }

const comparison: Array<Row> = [
  {
    feature: 'Architecture',
    table: 'Headless (bring your own UI)',
    agGrid: 'Full component with built-in UI',
  },
  {
    feature: 'License',
    table: 'MIT (free)',
    agGrid: 'Community MIT · Enterprise commercial',
  },
  {
    feature: 'Styling',
    table: 'Your CSS / design system',
    agGrid: 'Theming engine with design tokens',
  },
  {
    feature: 'Row virtualization',
    table: 'Pair with TanStack Virtual',
    agGrid: 'Built in (rows and columns)',
  },
  {
    feature: 'Row grouping & pivoting',
    table: 'Build it yourself',
    agGrid: 'Enterprise, built in',
  },
  {
    feature: 'Server-side row model',
    table: 'Build it yourself',
    agGrid: 'Enterprise, built in',
  },
  {
    feature: 'Excel export & charts',
    table: 'Bring your own',
    agGrid: 'Enterprise, built in',
  },
  {
    feature: 'Best for',
    table: 'Custom, lightweight tables',
    agGrid: 'Large-scale enterprise data grids',
  },
]

const faqs: Array<{ q: string; a: string }> = [
  {
    q: 'Are AG Grid and TanStack Table competitors?',
    a: 'No — they are partners. AG Grid is the official open-source partner of TanStack Table. They solve the same broad problem with opposite philosophies: TanStack Table is headless and composable, AG Grid is full-featured and batteries-included. Many teams use both in the same product.',
  },
  {
    q: 'Can I migrate from TanStack Table to AG Grid?',
    a: 'Yes. Because both are column-and-row driven, your column definitions and row data map over cleanly. TanStack Table column defs become AG Grid columnDefs, and your data array becomes rowData. The main shift is that AG Grid renders the UI for you instead of you rendering it.',
  },
  {
    q: 'Which one is faster?',
    a: 'It depends on the workload. TanStack Table is a thin logic layer, so raw overhead is minimal, but you supply the rendering and virtualization. AG Grid ships heavily optimized rendering, virtualization, and a server-side row model designed for very large datasets out of the box.',
  },
  {
    q: 'Can I use both in the same app?',
    a: 'Absolutely. A common pattern is TanStack Table for lightweight, custom-styled tables and AG Grid for the heavy data-grid surfaces that need pivoting, grouping, or millions of rows.',
  },
]

const PAGE_TITLE = 'AG Grid vs TanStack Table — When to Choose Which'
const PAGE_DESCRIPTION =
  'AG Grid and TanStack Table are partners, not rivals. TanStack Table is a headless, composable grid; AG Grid is a batteries-included enterprise data grid. Compare architecture, features, licensing, and scale to choose the right one — or use both.'

function getFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  }
}

export const Route = createFileRoute('/partners/ag-grid/vs-tanstack-table')({
  head: () => ({
    meta: seo({
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      keywords:
        'ag grid vs tanstack table, tanstack table vs ag grid, react data grid comparison, headless table, enterprise data grid, react-table alternative',
      image: 'https://tanstack.com/og.png',
    }),
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(getFaqJsonLd()),
      },
    ],
  }),
  component: AgGridVsTablePage,
})

function AgGridVsTablePage() {
  const [openFaq, setOpenFaq] = React.useState<number | null>(null)

  React.useEffect(() => {
    trackEvent('partner_viewed', {
      partner_id: 'ag-grid',
      placement: 'detail',
    })
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-6 md:px-8">
        <AgGridBreadcrumb current="vs TanStack Table" />

        {/* Hero */}
        <section className="border-b border-gray-200 pb-10 pt-8 dark:border-gray-800">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
            Partners, not rivals
          </span>
          <h1 className="mt-3 text-4xl font-black leading-[1.1] tracking-tight text-gray-950 dark:text-white md:text-5xl">
            AG Grid vs TanStack Table
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg">
            Both libraries live in the same problem space but take opposite
            approaches. TanStack Table is headless and composable; AG Grid is
            full-featured and batteries-included. AG Grid is the official
            open-source partner of TanStack Table — here is how to pick the
            right one, or use both together.
          </p>
        </section>

        {/* When to choose which */}
        <section className="py-10">
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="p-5 shadow-none md:p-6">
              <div className="text-sm font-semibold">
                Reach for TanStack Table when…
              </div>
              <ul className="mt-4 flex flex-col gap-2.5">
                {chooseTanStackTable.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400"
                  >
                    <CheckBadge />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-5 shadow-none md:p-6">
              <div className="text-sm font-semibold">
                Reach for AG Grid when…
              </div>
              <ul className="mt-4 flex flex-col gap-2.5">
                {chooseAgGrid.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400"
                  >
                    <CheckBadge />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        {/* Side-by-side table */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Side by side
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            A quick reference across the dimensions teams weigh most.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="py-3 pr-4 font-semibold" />
                  <th className="py-3 pr-4 font-semibold">TanStack Table</th>
                  <th className="py-3 font-semibold">AG Grid</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map(({ feature, table, agGrid }) => (
                  <tr
                    key={feature}
                    className="border-b border-gray-100 dark:border-gray-900"
                  >
                    <td className="py-3 pr-4 font-medium text-gray-900 dark:text-gray-200">
                      {feature}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                      {table}
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">
                      {agGrid}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as="a"
              href={AG_GRID_LINKS.reactGrid}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Try AG Grid
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button as="a" href="/table" variant="ghost">
              Explore TanStack Table
            </Button>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Common questions
          </h2>
          <div className="mt-5 flex flex-col">
            {faqs.map(({ q, a }, i) => {
              const isOpen = openFaq === i
              return (
                <Collapsible
                  key={q}
                  open={isOpen}
                  onOpenChange={(next) => setOpenFaq(next ? i : null)}
                  className="border-b border-gray-200 dark:border-gray-800"
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 py-4 text-left">
                    <span className="text-sm font-medium md:text-[15px]">
                      {q}
                    </span>
                    <Plus
                      className={twMerge(
                        'h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 dark:text-gray-400',
                        isOpen && 'rotate-45',
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <p className="max-w-2xl pb-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                      {a}
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        </section>

        {/* Explore more */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Explore more
          </h2>
          <div className="mt-6">
            <AgGridSubpageNav current="/partners/ag-grid/vs-tanstack-table" />
          </div>
        </section>
      </div>

      <Footer />
    </div>
  )
}
