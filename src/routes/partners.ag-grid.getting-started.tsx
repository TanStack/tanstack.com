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
  AgGridCodeExample,
  AgGridSubpageNav,
  trackAgGridClick,
} from '~/components/AgGridPartner'

const INSTALL_SNIPPET = `# Free, MIT-licensed Community edition
npm install ag-grid-react ag-grid-community
`

const GRID_SNIPPET = `import { useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'

// Register the Community modules once, at startup.
ModuleRegistry.registerModules([AllCommunityModule])

export function CarGrid() {
  const [rowData] = useState([
    { make: 'Tesla', model: 'Model Y', price: 64950 },
    { make: 'Ford', model: 'F-Series', price: 33850 },
    { make: 'Toyota', model: 'Corolla', price: 29600 },
  ])
  const [columnDefs] = useState([
    { field: 'make' },
    { field: 'model' },
    { field: 'price' },
  ])

  // A container height is required — the grid virtualizes its rows.
  return (
    <div style={{ height: 400 }}>
      <AgGridReact rowData={rowData} columnDefs={columnDefs} />
    </div>
  )
}
`

const QUERY_SNIPPET = `import { useQuery } from '@tanstack/react-query'
import { AgGridReact } from 'ag-grid-react'

export function CarsRoute() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['cars'],
    queryFn: () => fetch('/api/cars').then((r) => r.json()),
  })

  return (
    <div style={{ height: 500 }}>
      <AgGridReact
        rowData={data}
        loading={isLoading}
        columnDefs={[{ field: 'make' }, { field: 'model' }, { field: 'price' }]}
        defaultColDef={{ sortable: true, filter: true, resizable: true }}
      />
    </div>
  )
}
`

const steps: Array<{ num: string; title: string; desc: string }> = [
  {
    num: '01',
    title: 'Create a TanStack app',
    desc: 'Start from a TanStack Start or Router app — AG Grid renders on the client after hydration, so any route works.',
  },
  {
    num: '02',
    title: 'Install AG Grid',
    desc: 'Add the free Community packages: ag-grid-react and ag-grid-community.',
  },
  {
    num: '03',
    title: 'Register modules and render',
    desc: 'Register the Community modules once, then render AgGridReact with columnDefs, rowData, and a container height.',
  },
  {
    num: '04',
    title: 'Wire up data with TanStack Query',
    desc: 'Feed rowData from a Query result. Query owns fetching and caching; the grid owns sorting, filtering, and display.',
  },
]

const faqs: Array<{ q: string; a: string }> = [
  {
    q: 'Does AG Grid need a container height?',
    a: 'Yes. AG Grid virtualizes rows, so it needs a bounded height to know how many to render. Give the wrapping element an explicit height (for example height: 500px) or a flex layout that constrains it. DomLayout autoHeight is available for small, non-virtualized grids.',
  },
  {
    q: 'Does AG Grid render on the server with TanStack Start?',
    a: 'AG Grid is a client-side component and mounts after hydration. Your TanStack Start route can server-render the surrounding page and data; the grid itself initializes in the browser. Load row data with a loader or TanStack Query and pass it in as rowData.',
  },
  {
    q: 'How do I add sorting and filtering?',
    a: 'Set a defaultColDef with sortable, filter, and resizable to enable them across all columns, or configure them per column. These are part of the free Community edition.',
  },
  {
    q: 'How do I upgrade to Enterprise features?',
    a: 'Install ag-grid-enterprise, register the Enterprise modules, and call LicenseManager.setLicenseKey() once. Features like pivoting and the server-side row model then become column and grid options. See the Enterprise page for details.',
  },
]

const PAGE_TITLE = 'AG Grid + TanStack — React Quickstart'
const PAGE_DESCRIPTION =
  'Add AG Grid to a TanStack Start or Router app in minutes. Install the free Community packages, register modules, render a grid, and wire up data with TanStack Query. Copy-paste React code included.'

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

export const Route = createFileRoute('/partners/ag-grid/getting-started')({
  head: () => ({
    meta: seo({
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      keywords:
        'ag grid react tanstack, ag grid getting started, ag grid tanstack query, ag grid tanstack start, react data grid tutorial',
      image: 'https://tanstack.com/og.png',
    }),
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(getFaqJsonLd()),
      },
    ],
  }),
  component: AgGridQuickstartPage,
})

function AgGridQuickstartPage() {
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
        <AgGridBreadcrumb current="React quickstart" />

        {/* Hero */}
        <section className="border-b border-gray-200 pb-10 pt-8 dark:border-gray-800">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
            React quickstart
          </span>
          <h1 className="mt-3 text-4xl font-black leading-[1.1] tracking-tight text-gray-950 dark:text-white md:text-5xl">
            Add AG Grid to your
            <br />
            TanStack app
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg">
            AG Grid is a client-side React component, so it drops into any
            TanStack Start or Router route. Install the free Community packages,
            render a grid, and feed it with TanStack Query.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              as="a"
              href={AG_GRID_LINKS.docs}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              size="lg"
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Open the official docs
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Community is free forever and MIT-licensed. No credit card required.
          </p>
        </section>

        {/* Steps */}
        <section className="py-10">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Four steps to a working grid
          </h2>
          <div className="mt-6 flex flex-col gap-3">
            {steps.map(({ num, title, desc }) => (
              <Card
                key={num}
                className="flex items-start gap-5 p-4 shadow-none md:p-5"
              >
                <div className="min-w-[28px] pt-0.5 font-mono text-xs font-bold text-gray-400 dark:text-gray-500">
                  {num}
                </div>
                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                    {desc}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Install + render */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Install and render
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Two packages, one module registration, and a grid with columns and
            rows.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <AgGridCodeExample
              code={INSTALL_SNIPPET}
              lang="bash"
              title="terminal"
            />
            <AgGridCodeExample
              code={GRID_SNIPPET}
              lang="tsx"
              title="CarGrid.tsx"
            />
          </div>
        </section>

        {/* TanStack Query */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Wire up data with TanStack Query
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Let Query handle fetching and caching, then pass the result straight
            into the grid as rowData.
          </p>
          <div className="mt-6">
            <AgGridCodeExample
              code={QUERY_SNIPPET}
              lang="tsx"
              title="CarsRoute.tsx"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as="a"
              href={AG_GRID_LINKS.docs}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Read the full quickstart
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button as="a" href="/query" variant="ghost">
              Explore TanStack Query
            </Button>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Quickstart FAQ
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
            <AgGridSubpageNav current="/partners/ag-grid/getting-started" />
          </div>
        </section>
      </div>

      <Footer />
    </div>
  )
}
