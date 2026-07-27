import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowUpRight,
  BarChart3,
  Clipboard,
  FileSpreadsheet,
  FolderTree,
  Grid3x3,
  Layers,
  Plus,
  Rows3,
  Server,
  SlidersHorizontal,
} from 'lucide-react'
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
  AgGridCodeExample,
  AgGridSubpageNav,
  trackAgGridClick,
} from '~/components/AgGridPartner'

const ENTERPRISE_SNIPPET = `import { AgGridReact } from 'ag-grid-react'
import { ModuleRegistry } from 'ag-grid-community'
import {
  AllEnterpriseModule,
  LicenseManager,
} from 'ag-grid-enterprise'

// Register once, at app startup.
ModuleRegistry.registerModules([AllEnterpriseModule])
LicenseManager.setLicenseKey(process.env.AG_GRID_LICENSE_KEY!)

export function AnalyticsGrid({ rows }: { rows: Array<Trade> }) {
  return (
    <div style={{ height: 600 }}>
      <AgGridReact
        rowData={rows}
        rowGroupPanelShow="always"
        pivotMode
        columnDefs={[
          { field: 'desk', rowGroup: true },
          { field: 'region', pivot: true },
          { field: 'pnl', aggFunc: 'sum' },
        ]}
      />
    </div>
  )
}
`

type FeatureIcon = React.ComponentType<{ className?: string }>

const features: Array<{ Icon: FeatureIcon; title: string; desc: string }> = [
  {
    Icon: Layers,
    title: 'Row grouping & aggregation',
    desc: 'Group by any column and roll up sums, averages, and custom aggregations, with a drag-to-group panel for users.',
  },
  {
    Icon: Grid3x3,
    title: 'Pivoting',
    desc: 'Pivot rows into columns interactively — the spreadsheet move your analysts expect, without reshaping data server-side.',
  },
  {
    Icon: Server,
    title: 'Server-side row model',
    desc: 'Sort, filter, group, and paginate millions of rows straight from your backend. The grid only requests what it renders.',
  },
  {
    Icon: BarChart3,
    title: 'Integrated charts',
    desc: 'Let users select a range and chart it in place with AG Charts — no separate charting stack to wire up.',
  },
  {
    Icon: FileSpreadsheet,
    title: 'Excel export',
    desc: 'Export styled, multi-sheet Excel files including groups, formatting, and formulas, straight from the grid.',
  },
  {
    Icon: Rows3,
    title: 'Master / detail',
    desc: 'Expand any row into a nested detail grid for drill-down views without a separate page or modal.',
  },
  {
    Icon: FolderTree,
    title: 'Tree data',
    desc: 'Render hierarchical data — file systems, org charts, nested categories — with lazy loading built in.',
  },
  {
    Icon: Clipboard,
    title: 'Range selection & clipboard',
    desc: 'Excel-style range selection, fill handle, and clipboard interop so power users feel at home.',
  },
  {
    Icon: SlidersHorizontal,
    title: 'Tool panels & status bar',
    desc: 'Built-in columns and filters tool panels plus an aggregation status bar for rich, self-service data exploration.',
  },
]

const faqs: Array<{ q: string; a: string }> = [
  {
    q: 'What do I get with AG Grid Enterprise?',
    a: 'Enterprise adds row grouping and aggregation, pivoting, the server-side row model, integrated charts, Excel export, master/detail, tree data, range selection with a fill handle, tool panels, and a status bar — on top of everything in the free Community edition.',
  },
  {
    q: 'How is Enterprise licensed?',
    a: 'AG Grid Enterprise requires a commercial license. You install ag-grid-enterprise and call LicenseManager.setLicenseKey() once at startup. Without a key it still runs for evaluation, showing a watermark and console notice. Licenses are per-developer and cover production use.',
  },
  {
    q: 'How many rows can the server-side row model handle?',
    a: 'The server-side row model is designed for datasets that are too large to load at once. Because the grid only requests the rows, groups, and pages it needs, it comfortably drives grids over millions of rows backed by your API or database.',
  },
  {
    q: 'Can I use TanStack Query with the server-side row model?',
    a: 'Yes. A common pattern is to have your getRows datasource call a TanStack Query-backed endpoint. Query owns fetching and caching; AG Grid owns the sorting, filtering, grouping, and pagination requests it sends.',
  },
]

const PAGE_TITLE = 'AG Grid Enterprise — Features for Large-Scale Data Grids'
const PAGE_DESCRIPTION =
  'AG Grid Enterprise adds row grouping, pivoting, the server-side row model, integrated charts, Excel export, master/detail, and tree data on top of the free Community edition. Drive grids over millions of rows in your TanStack app.'

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

export const Route = createFileRoute('/partners/ag-grid/enterprise')({
  head: () => ({
    meta: seo({
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      keywords:
        'ag grid enterprise, server-side row model, ag grid pivoting, ag grid row grouping, integrated charts, ag grid excel export',
      image: 'https://tanstack.com/og.png',
    }),
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(getFaqJsonLd()),
      },
    ],
  }),
  component: AgGridEnterprisePage,
})

function AgGridEnterprisePage() {
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
        <AgGridBreadcrumb current="Enterprise" />

        {/* Hero */}
        <section className="border-b border-gray-200 pb-10 pt-8 dark:border-gray-800">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
            AG Grid Enterprise
          </span>
          <h1 className="mt-3 text-4xl font-black leading-[1.1] tracking-tight text-gray-950 dark:text-white md:text-5xl">
            When a table isn't
            <br />
            enough anymore
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg">
            Enterprise unlocks the heavy-duty features teams reach for at scale
            — pivoting, row grouping, a server-side row model for millions of
            rows, integrated charts, and Excel export — all on top of the free
            Community edition.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              as="a"
              href={AG_GRID_LINKS.pricing}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              size="lg"
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              See Enterprise pricing
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={AG_GRID_LINKS.serverSide}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              variant="ghost"
              size="lg"
            >
              Server-side row model docs
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="py-10">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            What Enterprise adds
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Everything below is opt-in and tree-shakeable through module
            registration.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ Icon, title, desc }) => (
              <Card key={title} className="p-5 shadow-none">
                <Icon className="mb-3 h-5 w-5 text-gray-500 dark:text-gray-400" />
                <div className="text-sm font-semibold">{title}</div>
                <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  {desc}
                </p>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            Integrated charts are powered by{' '}
            <a
              href={AG_GRID_LINKS.agCharts}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              className="underline decoration-dotted underline-offset-2 hover:text-blue-500"
            >
              AG Charts
            </a>{' '}
            — 30+ chart types, with free Community and Enterprise editions.
          </p>
        </section>

        {/* Setup */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Turn on Enterprise
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Install the Enterprise package, register the modules, and set your
            license key once at startup. Then features like pivoting and
            grouping are just column definitions.
          </p>
          <div className="mt-6">
            <AgGridCodeExample
              code={ENTERPRISE_SNIPPET}
              lang="tsx"
              title="AnalyticsGrid.tsx"
            />
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Enterprise FAQ
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
            <AgGridSubpageNav current="/partners/ag-grid/enterprise" />
          </div>
        </section>
      </div>

      <Footer />
    </div>
  )
}
