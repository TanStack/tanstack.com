import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowUpRight,
  BarChart3,
  Check,
  FileSpreadsheet,
  FolderTree,
  Grid3x3,
  Layers,
  LayoutDashboard,
  Palette,
  Plus,
  Rows3,
  Server,
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
import { CodeBlock } from '~/components/markdown/CodeBlock'
import { seo } from '~/utils/seo'
import { getPartnerById, PartnerImage } from '~/utils/partners'
import { getPartnerJsonLd } from '~/utils/partner-pages'
import { trackEvent } from '~/utils/analytics'
import { AgGridSubpageNav } from '~/components/AgGridPartner'

const UTM = 'utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'
const AG_GRID_HREF = `https://www.ag-grid.com/react-data-grid/?${UTM}`
const AG_GRID_DOCS_HREF = `https://www.ag-grid.com/react-data-grid/getting-started/?${UTM}`
const AG_GRID_PRICING_HREF = `https://www.ag-grid.com/license-pricing/?${UTM}`
const AG_STUDIO_HREF = `https://www.ag-grid.com/studio/?${UTM}`
const AG_STUDIO_TRIAL_HREF = `https://www.ag-grid.com/studio/license-pricing/?tab=trial&${UTM}`

const INSTALL_SNIPPET = `# Community edition — free and MIT-licensed
npm install ag-grid-react ag-grid-community
`

const GRID_SNIPPET = `import { useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'

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

  // A container height is required — the grid virtualizes rows.
  return (
    <div style={{ height: 400 }}>
      <AgGridReact rowData={rowData} columnDefs={columnDefs} />
    </div>
  )
}
`

type FeatureIcon = React.ComponentType<{ className?: string }>

const features: Array<{ Icon: FeatureIcon; title: string; desc: string }> = [
  {
    Icon: Layers,
    title: 'Row grouping & aggregation',
    desc: 'Group rows by any column and roll up totals, averages, and custom aggregations across millions of records.',
  },
  {
    Icon: Grid3x3,
    title: 'Pivoting',
    desc: 'Pivot rows into columns on the fly, just like a spreadsheet, without reshaping your data on the server.',
  },
  {
    Icon: Server,
    title: 'Server-side row model',
    desc: 'Stream, sort, filter, and group huge datasets straight from your backend — the grid only fetches what it renders.',
  },
  {
    Icon: FileSpreadsheet,
    title: 'Excel export',
    desc: 'Export styled, multi-sheet Excel files directly from the grid, including grouping and formatting.',
  },
  {
    Icon: BarChart3,
    title: 'Integrated charts',
    desc: 'Turn any selection into an interactive chart powered by AG Charts, without leaving the grid.',
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
    Icon: Palette,
    title: 'Theming engine',
    desc: 'A modern theming API with design tokens, shared with AG Grid Studio so grids and dashboards match.',
  },
]

const steps: Array<{ num: string; title: string; code: string }> = [
  {
    num: '01',
    title: 'Install the Community packages',
    code: 'npm install ag-grid-react ag-grid-community',
  },
  {
    num: '02',
    title: 'Register the Community modules',
    code: 'ModuleRegistry.registerModules([AllCommunityModule])',
  },
  {
    num: '03',
    title: 'Render a grid with columns and row data',
    code: '<AgGridReact rowData={rows} columnDefs={cols} />',
  },
  {
    num: '04',
    title: 'Unlock Enterprise when you need it',
    code: 'npm install ag-grid-enterprise',
  },
]

// Instead of Railway-style customer testimonials, AG Grid's most useful
// section is the honest "when to choose which" guidance — the founding goal
// of the TanStack Table + AG Grid partnership.
const chooseTanStackTable: Array<string> = [
  'You want a headless grid you style and compose yourself',
  'You need a tiny bundle and full control over the DOM',
  'You are building a bespoke table UI with your own design system',
  'You want the same core across React, Vue, Solid, Svelte, Qwik, and Angular',
]

const chooseAgGrid: Array<string> = [
  'You need enterprise features like pivoting or a server-side row model out of the box',
  'You are handling hundreds of thousands to millions of rows',
  'You want Excel export, integrated charts, and range selection without building them',
  'You need a batteries-included grid your team can ship this week',
]

const libDetails: Array<{ label: string; desc: string }> = [
  {
    label: 'TanStack Table',
    desc: 'AG Grid is the official open-source partner of TanStack Table. Reach for Table when you want a headless grid, and AG Grid when you need a batteries-included one.',
  },
  {
    label: 'TanStack Query',
    desc: "Feed AG Grid's server-side row model from a Query-backed API. Query owns fetching and caching; the grid owns sorting, filtering, and grouping at scale.",
  },
  {
    label: 'TanStack Start',
    desc: 'AG Grid renders on the client after hydration inside a TanStack Start app — drop it into any route with a container height and column definitions.',
  },
  {
    label: 'TanStack Virtual',
    desc: 'AG Grid ships its own row and column virtualization. Use TanStack Virtual for custom virtualized surfaces outside of a grid.',
  },
]

const studioFeatures: Array<{ title: string; desc: string }> = [
  {
    title: 'Drag & drop dashboards',
    desc: 'Rearrange and resize charts, grids, and KPI tiles in real time — no rebuild required.',
  },
  {
    title: 'Widget gallery',
    desc: 'Pre-built bar, line, area, pie, and scatter charts, plus grids and KPI tiles ready to drop in.',
  },
  {
    title: 'AI assistant',
    desc: 'Ask questions of your data in natural language and generate dashboards on the fly.',
  },
  {
    title: 'Edit and view modes',
    desc: 'Configure in edit mode, then hand a clean, read-only reporting view to stakeholders.',
  },
]

const faqs: Array<{ q: string; a: string }> = [
  {
    q: 'Is AG Grid free?',
    a: 'AG Grid Community is free and MIT-licensed for commercial use, and covers sorting, filtering, editing, virtualization, and custom cell rendering. AG Grid Enterprise and AG Grid Studio require a commercial license and add features like pivoting, the server-side row model, integrated charts, and embedded dashboards.',
  },
  {
    q: 'What is the difference between AG Grid and TanStack Table?',
    a: 'TanStack Table is a headless library: it gives you the state and logic for a table and you bring the markup and styles. AG Grid is a full, batteries-included data grid with its own rendering and enterprise features. They are complementary — that is why AG Grid is the official open-source partner of TanStack Table.',
  },
  {
    q: 'What is AG Grid Studio?',
    a: 'AG Grid Studio is an embedded analytics toolkit for building drag-and-drop dashboards on top of AG Grid and AG Charts. It handles data processing over hundreds of thousands of rows, ships a widget gallery, and includes an AI assistant. It offers a 45-day free trial with full features and no watermarks.',
  },
  {
    q: 'Does AG Grid work with TanStack Start?',
    a: 'Yes. AG Grid is a client-side React component, so it renders inside any TanStack Start route after hydration. Install ag-grid-react and ag-grid-community, register the Community modules, and give the grid a container with an explicit height.',
  },
  {
    q: 'Can I use AG Grid with TanStack Query?',
    a: "Yes. A common pattern is to let TanStack Query own data fetching and caching while AG Grid's server-side row model requests only the rows it needs to display. Query handles the network; the grid handles sorting, filtering, and grouping at scale.",
  },
  {
    q: 'How many rows can AG Grid handle?',
    a: 'AG Grid virtualizes both rows and columns, so it renders only what is on screen. With the client-side row model it comfortably handles tens of thousands of rows, and with the Enterprise server-side row model it streams millions of rows straight from your backend.',
  },
]

const PAGE_TITLE = 'AG Grid for TanStack — Official Table Partner'
const PAGE_DESCRIPTION =
  'AG Grid is the official open-source partner of TanStack Table: a batteries-included enterprise data grid with row grouping, pivoting, a server-side row model, Excel export, and integrated charts. Plus AG Grid Studio for embedded analytics dashboards. Learn when to choose AG Grid vs TanStack Table.'

function getFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  }
}

export const Route = createFileRoute('/partners/ag-grid/')({
  head: () => {
    const partner = getPartnerById('ag-grid')

    return {
      meta: seo({
        title: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        keywords:
          'ag grid tanstack, ag grid vs tanstack table, ag grid react, enterprise data grid, ag grid studio, ag grid partner, tanstack table alternative',
        image: 'https://tanstack.com/og.png',
      }),
      scripts: [
        ...(partner
          ? [
              {
                type: 'application/ld+json',
                children: JSON.stringify(getPartnerJsonLd(partner)),
              },
            ]
          : []),
        {
          type: 'application/ld+json',
          children: JSON.stringify(getFaqJsonLd()),
        },
      ],
    }
  },
  component: AgGridPartnerPage,
})

function CheckBadge() {
  return (
    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
      <Check className="h-2.5 w-2.5" strokeWidth={3} />
    </span>
  )
}

function trackAgGridClick(destinationHost = 'ag-grid.com') {
  trackEvent('partner_clicked', {
    partner_id: 'ag-grid',
    placement: 'detail',
    destination: 'external',
    destination_host: destinationHost,
  })
}

function AgGridCodeExample({
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

function AgGridPartnerPage() {
  const [openFaq, setOpenFaq] = React.useState<number | null>(null)

  React.useEffect(() => {
    trackEvent('partner_viewed', {
      partner_id: 'ag-grid',
      placement: 'detail',
    })
  }, [])

  const partner = getPartnerById('ag-grid')

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-6 md:px-8">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link
            to="/partners"
            className="transition-colors hover:text-blue-500"
          >
            Partners
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white">AG Grid</span>
        </nav>

        {/* Hero */}
        <section className="border-b border-gray-200 pb-10 pt-10 dark:border-gray-800">
          <div className="mb-5 flex items-center gap-4">
            {partner ? (
              <div className="flex h-12 w-44 items-center justify-start">
                <PartnerImage
                  config={partner.image}
                  alt="AG Grid"
                  className="max-h-10 w-auto"
                />
              </div>
            ) : null}
            <div>
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                Official Table Partner · Data Grid
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Community edition is free & MIT-licensed
                </span>
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-gray-950 dark:text-white md:text-5xl">
            The enterprise data grid,
            <br />
            alongside TanStack Table
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg">
            AG Grid is the official open-source partner of TanStack Table. When
            a headless table needs to become a full data grid — pivoting,
            grouping, a server-side row model for millions of rows — AG Grid
            picks up where Table leaves off, across React, Angular, Vue, and
            vanilla JavaScript.
          </p>

          <p className="mt-3 max-w-xl text-sm italic leading-relaxed text-gray-500 dark:text-gray-400">
            "Together we strive to educate the ecosystem about the differences
            between the two libraries and when to choose which." — the TanStack
            Table &amp; AG Grid partnership
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              as="a"
              href={AG_GRID_DOCS_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              size="lg"
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Get started free
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button as="a" href="#how-it-works" variant="ghost" size="lg">
              See how it works
            </Button>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Community is free forever. No credit card required.
          </p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-gray-200 py-7 sm:flex sm:flex-wrap sm:gap-10 dark:border-gray-800">
          {[
            ['MIT', 'Community license'],
            ['4', 'Frameworks supported'],
            ['1M+', 'Rows with server-side model'],
            ['45-day', 'AG Grid Studio trial'],
          ].map(([value, label]) => (
            <div key={label}>
              <div className="text-2xl font-bold tracking-tight">{value}</div>
              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {label}
              </div>
            </div>
          ))}
        </section>

        {/* Features */}
        <section className="py-10">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            What AG Grid brings to the table
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Everything in Community is free and MIT-licensed. Enterprise adds
            the heavy-duty features teams reach for when a basic table UI is no
            longer enough.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
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
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="border-t border-gray-200 py-10 dark:border-gray-800"
        >
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            From install to grid in 4 steps
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            AG Grid is a client-side React component. Install Community,
            register the modules, and render a grid — then reach for Enterprise
            when you need it.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {steps.map(({ num, title, code }) => (
              <Card
                key={num}
                className="flex items-start gap-5 p-4 shadow-none md:p-5"
              >
                <div className="min-w-[28px] pt-0.5 font-mono text-xs font-bold text-gray-400 dark:text-gray-500">
                  {num}
                </div>
                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <code className="mt-2 inline-block rounded-md bg-gray-100 px-2.5 py-1 font-mono text-xs dark:bg-gray-800">
                    {code}
                  </code>
                </div>
              </Card>
            ))}
          </div>

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

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as="a"
              href={AG_GRID_DOCS_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Read the React quickstart
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={AG_GRID_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              variant="ghost"
            >
              Explore the docs
            </Button>
          </div>
        </section>

        {/* When to choose which */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            TanStack Table vs AG Grid — when to choose which
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            The two libraries share a problem space but take opposite
            approaches. This is the honest guidance at the heart of the
            partnership.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Card className="p-5 shadow-none">
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
            <Card className="p-5 shadow-none">
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

        {/* Library fit */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Fits into your TanStack stack
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            AG Grid slots alongside the TanStack libraries you already use —
            from Table to Query to Start.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {libDetails.map(({ label, desc }) => (
              <Card key={label} className="p-4 shadow-none">
                <div className="flex items-start gap-2">
                  <CheckBadge />
                  <span className="text-sm font-semibold">{label}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                  {desc}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* AG Grid Studio spotlight */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <div className="mb-2 flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-orange-500" />
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-orange-600 dark:text-orange-400">
              AG Grid Studio
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Embedded analytics. Built to perform.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            AG Grid Studio adds drag-and-drop dashboards, charts, grids, and
            filters to your app without building analytics from scratch. It
            shares a theming engine with AG Grid, so everything matches out of
            the box.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {studioFeatures.map(({ title, desc }) => (
              <Card key={title} className="p-4 shadow-none">
                <div className="text-sm font-semibold">{title}</div>
                <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                  {desc}
                </p>
              </Card>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as="a"
              href={AG_STUDIO_TRIAL_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Start a 45-day free trial
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={AG_STUDIO_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              variant="ghost"
            >
              Explore AG Grid Studio
            </Button>
          </div>
        </section>

        {/* Explore subpages */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Go deeper
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Detailed guides for getting started, comparing grids, and unlocking
            Enterprise and Studio.
          </p>
          <div className="mt-6">
            <AgGridSubpageNav current="/partners/ag-grid" />
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Frequently asked questions
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Common questions from TanStack developers evaluating AG Grid.
          </p>

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

        {/* CTA */}
        <section className="mt-6 rounded-2xl bg-gray-950 px-6 py-10 text-center md:px-10 md:py-12 dark:bg-gray-900">
          <div className="inline-block rounded-full bg-white/5 px-3 py-1 text-[11px] text-gray-400">
            Official TanStack Table open-source partner
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-white md:text-3xl">
            Ready to build with AG Grid?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">
            Start free with Community, unlock Enterprise when you need it, and
            add embedded dashboards with AG Grid Studio.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              as="a"
              href={AG_GRID_DOCS_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              size="lg"
              className="bg-white text-gray-950 border-white hover:bg-gray-100"
            >
              Get started free
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={AG_GRID_PRICING_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              size="lg"
              className="bg-transparent text-white border-gray-700 hover:bg-white/5"
            >
              See pricing
            </Button>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          AG Grid is the official open-source partner of TanStack Table.{' '}
          <Link
            to="/partners"
            className="underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Browse all TanStack partners
          </Link>
          .{' '}
          <a
            href={AG_GRID_HREF}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackAgGridClick()}
            className="underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ag-grid.com
          </a>
        </p>
      </div>

      <Footer />
    </div>
  )
}
