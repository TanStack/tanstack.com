import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Boxes,
  Gauge,
  LayoutDashboard,
  Palette,
  Plus,
  Sparkles,
  SplitSquareVertical,
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
  CheckBadge,
  trackAgGridClick,
} from '~/components/AgGridPartner'

const QUICKSTART_SNIPPET = `import { AgStudio } from 'ag-studio-react'

// Each source is an id plus an array of plain row objects.
const sources = [
  {
    id: 'sales',
    data: [
      { region: 'EMEA', product: 'Grid', revenue: 128000 },
      { region: 'AMER', product: 'Charts', revenue: 96500 },
      { region: 'APAC', product: 'Studio', revenue: 71200 },
    ],
  },
]

export function Dashboard() {
  // Render inside a sized parent; "edit" mode lets users build reports.
  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <AgStudio data={{ sources }} mode="edit" />
    </div>
  )
}
`

type FeatureIcon = React.ComponentType<{ className?: string }>

const features: Array<{ Icon: FeatureIcon; title: string; desc: string }> = [
  {
    Icon: LayoutDashboard,
    title: 'Drag & drop widgets',
    desc: 'Rearrange and resize charts, grids, and KPI tiles in real time. Build a dashboard by moving pieces, not writing layout code.',
  },
  {
    Icon: SplitSquareVertical,
    title: 'Edit and view modes',
    desc: 'Configure everything in edit mode, then hand a clean, read-only reporting view to stakeholders.',
  },
  {
    Icon: Gauge,
    title: 'High-performance data',
    desc: 'Process hundreds of thousands of rows in the browser with joins, aggregations, and computed columns.',
  },
  {
    Icon: Boxes,
    title: 'Widget gallery',
    desc: 'Pre-built bar, line, area, pie, and scatter charts, plus grids and KPI tiles, ready to drop into any dashboard.',
  },
  {
    Icon: Sparkles,
    title: 'AI assistant',
    desc: 'Explore your data in natural language and generate whole dashboards from a prompt.',
  },
  {
    Icon: Palette,
    title: 'Shared theming',
    desc: 'Studio shares a theming engine with AG Grid, so your dashboards and grids look like one product out of the box.',
  },
]

const fitPoints: Array<string> = [
  'Embed dashboards inside a TanStack Start or Router app as a client-side React component',
  'Feed widgets from a TanStack Query-backed API, then let Studio handle joins and aggregations',
  'Reuse your AG Grid theme so embedded analytics match the rest of your product',
  'Give non-technical users self-service reporting without building analytics infrastructure',
]

const faqs: Array<{ q: string; a: string }> = [
  {
    q: 'How much does AG Grid Studio cost?',
    a: 'AG Grid Studio requires a commercial license for production use. You can start with a 45-day free trial that includes full features with no watermarks or restrictions, plus direct engineering support during the trial.',
  },
  {
    q: 'How is Studio different from AG Grid Enterprise?',
    a: 'AG Grid Enterprise is the data grid component with features like pivoting and the server-side row model. AG Grid Studio is a higher-level toolkit for building complete drag-and-drop analytics dashboards — charts, grids, filters, and KPI tiles — on top of AG Grid and AG Charts.',
  },
  {
    q: 'How much data can Studio handle?',
    a: 'Studio is built for performance and processes hundreds of thousands of rows in the browser, with joins, aggregations, and computed columns. For very large datasets you can pre-aggregate on your backend and feed the results into Studio.',
  },
  {
    q: 'Does Studio work with React and TanStack?',
    a: 'Yes. Studio supports React, Angular, Vue, and vanilla JavaScript, so it embeds inside a TanStack Start or Router app as a standard client-side component.',
  },
]

const PAGE_TITLE = 'AG Grid Studio — Embedded Analytics for TanStack Apps'
const PAGE_DESCRIPTION =
  'AG Grid Studio is an embedded-analytics toolkit for building drag-and-drop dashboards on top of AG Grid and AG Charts. Widget gallery, AI assistant, edit and view modes, and a shared theming engine — with a 45-day free trial. Embed it in any TanStack Start or Router app.'

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

export const Route = createFileRoute('/partners/ag-grid/studio')({
  head: () => ({
    meta: seo({
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      keywords:
        'ag grid studio, embedded analytics react, dashboard toolkit, tanstack dashboards, ag charts, self-service reporting',
      image: 'https://tanstack.com/og.png',
    }),
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(getFaqJsonLd()),
      },
    ],
  }),
  component: AgGridStudioPage,
})

function AgGridStudioPage() {
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
        <AgGridBreadcrumb current="Studio" />

        {/* Hero */}
        <section className="border-b border-gray-200 pb-10 pt-8 dark:border-gray-800">
          <div className="mb-3 flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-orange-500" />
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-orange-600 dark:text-orange-400">
              AG Grid Studio
            </span>
          </div>
          <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-gray-950 dark:text-white md:text-5xl">
            Embedded analytics.
            <br />
            Built to perform.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg">
            AG Grid Studio adds dashboards, charts, grids, and filters to your
            app without building analytics from scratch. Drag, drop, and ship
            self-service reporting your users can drive themselves.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              as="a"
              href={AG_GRID_LINKS.studioTrial}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              size="lg"
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Start a 45-day free trial
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={AG_GRID_LINKS.studioDemos}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              variant="ghost"
              size="lg"
            >
              See the demos
            </Button>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Full features during the trial. No watermarks. Engineering support
            included.
          </p>
        </section>

        {/* Features */}
        <section className="py-10">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Everything you need to build dashboards
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Studio is a complete toolkit for embedded analytics, powered by AG
            Grid and{' '}
            <a
              href={AG_GRID_LINKS.agCharts}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              className="underline decoration-dotted underline-offset-2 hover:text-blue-500"
            >
              AG Charts
            </a>{' '}
            under the hood.
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

        {/* TanStack fit */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            A natural fit for TanStack apps
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Studio is a client-side React component, so it drops into the apps
            you already build with TanStack.
          </p>
          <Card className="mt-6 p-5 shadow-none md:p-6">
            <ul className="flex flex-col gap-2.5">
              {fitPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400"
                >
                  <CheckBadge />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Quick start */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Render a dashboard in React
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Install{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.85em] dark:bg-gray-800">
              ag-studio-react
            </code>
            , hand{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.85em] dark:bg-gray-800">
              AgStudio
            </code>{' '}
            your data sources, and switch on edit mode so users can build
            reports.
          </p>
          <div className="mt-6">
            <AgGridCodeExample
              code={QUICKSTART_SNIPPET}
              lang="tsx"
              title="Dashboard.tsx"
            />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as="a"
              href={AG_GRID_LINKS.studioQuickStart}
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
              href={AG_GRID_LINKS.studioDemos}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              variant="ghost"
            >
              Browse example dashboards
            </Button>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            AG Grid Studio FAQ
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

        {/* CTA */}
        <section className="mt-6 rounded-2xl bg-gray-950 px-6 py-10 text-center md:px-10 md:py-12 dark:bg-gray-900">
          <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
            Ship analytics without the infrastructure
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">
            Try AG Grid Studio free for 45 days with full features and no
            watermarks.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              as="a"
              href={AG_GRID_LINKS.studioTrial}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              size="lg"
              className="bg-white text-gray-950 border-white hover:bg-gray-100"
            >
              Start your free trial
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={AG_GRID_LINKS.studio}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackAgGridClick()}
              size="lg"
              className="bg-transparent text-white border-gray-700 hover:bg-white/5"
            >
              Explore AG Grid Studio
            </Button>
          </div>
        </section>

        {/* Explore more */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Explore more
          </h2>
          <div className="mt-6">
            <AgGridSubpageNav current="/partners/ag-grid/studio" />
          </div>
        </section>
      </div>

      <Footer />
    </div>
  )
}
