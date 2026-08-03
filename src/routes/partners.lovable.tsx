import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Blocks,
  Check,
  Cloud,
  Database,
  GitBranch,
  Globe,
  MousePointerClick,
  Plus,
  Puzzle,
  Sparkles,
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

const UTM = '?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'
const LOVABLE_HREF = `https://lovable.dev/${UTM}`
const LOVABLE_DOCS_HREF = `https://docs.lovable.dev/${UTM}`
const LOVABLE_HOME_HREF = `https://lovable.dev/${UTM}`
const LOVABLE_PRICING_HREF = `https://lovable.dev/pricing${UTM}`

const PROMPT_SNIPPET = `Build a TanStack Start app for tracking gym workouts.
Use TanStack Router for the pages and TanStack Query for
data. Add email auth and a Postgres database, then deploy
it to Lovable Cloud when it's ready.`

const GENERATED_SNIPPET = `my-app/
├─ src/
│  ├─ routes/          # TanStack Router file routes
│  ├─ router.tsx       # TanStack Start + Router setup
│  └─ server/          # server functions
├─ vite.config.ts      # tanstackStart() plugin
└─ package.json        # deploys to Lovable Cloud`

type FeatureIcon = React.ComponentType<{ className?: string }>

const features: Array<{ Icon: FeatureIcon; title: string; desc: string }> = [
  {
    Icon: Sparkles,
    title: 'Prompt to app',
    desc: 'Describe your app in plain English and Lovable generates a working TanStack Start project — routing, SSR, and UI scaffolded for you.',
  },
  {
    Icon: Blocks,
    title: 'TanStack Start foundation',
    desc: 'New Lovable projects are built on TanStack Start, so generated apps keep first-class routing, SSR, server functions, and end-to-end type safety.',
  },
  {
    Icon: Cloud,
    title: 'One-click Lovable Cloud hosting',
    desc: 'Ship the generated app to Lovable Cloud with a single click. Managed hosting with a live URL — no infrastructure to configure.',
  },
  {
    Icon: GitBranch,
    title: 'Two-way GitHub sync',
    desc: 'Lovable syncs both ways with GitHub. You own the code, can edit it locally, and keep building in Lovable — no lock-in.',
  },
  {
    Icon: MousePointerClick,
    title: 'Visual editing',
    desc: 'Tweak layout, copy, and styles visually. Lovable writes the underlying React and TanStack code for you as you go.',
  },
  {
    Icon: Database,
    title: 'Built-in backend',
    desc: "Add auth, database, and storage through Lovable Cloud's managed backend — wired into your TanStack app automatically.",
  },
  {
    Icon: Globe,
    title: 'Instant preview URLs',
    desc: 'Every project gets a live preview URL as you build. Share work-in-progress and gather feedback before you ship.',
  },
  {
    Icon: Puzzle,
    title: 'Integrations from the prompt',
    desc: 'Connect Stripe, analytics, and other services by asking for them. Lovable wires up the integration — no boilerplate glue code.',
  },
]

const steps: Array<{ num: string; title: string; code: string }> = [
  {
    num: '01',
    title: 'Describe your app',
    code: '"Build a TanStack Start dashboard with auth"',
  },
  {
    num: '02',
    title: 'Lovable generates it',
    code: 'TanStack Start + Router + Query',
  },
  {
    num: '03',
    title: 'Refine visually or in code',
    code: 'edit in Lovable or push to GitHub',
  },
  { num: '04', title: 'Deploy to Lovable Cloud', code: 'one-click publish' },
]

const pricing: Array<{
  plan: string
  price: string
  note: string
  features: Array<string>
  highlight?: boolean
}> = [
  {
    plan: 'Free',
    price: '$0',
    note: '5 build credits per day',
    features: [
      'Up to 30 credits / month',
      'Public projects',
      'Up to 5 deployment subdomains',
      'No credit card required',
    ],
  },
  {
    plan: 'Pro',
    price: '$25',
    note: '/month · 100 monthly credits',
    features: [
      'Private projects',
      'Custom domains',
      'Remove the Lovable badge',
      'Higher rate limits',
    ],
    highlight: true,
  },
  {
    plan: 'Business',
    price: '$50',
    note: '/month · per member',
    features: [
      'Everything in Pro',
      'SSO',
      'Data opt-out (no training)',
      'Centralized billing',
    ],
  },
  {
    plan: 'Enterprise',
    price: 'Custom',
    note: 'for teams at scale',
    features: [
      'Custom credit volumes',
      'Dedicated support',
      'Advanced security & compliance',
      'Onboarding & SLAs',
    ],
  },
]

const creditCosts: Array<[string, string]> = [
  ['Style change', '~0.5 credits'],
  ['New feature', '~1.2 credits'],
  ['Free tier', '5 credits / day'],
]

const libraries = [
  'Start',
  'Router',
  'Query',
  'Table',
  'Form',
  'DB',
  'Store',
  'Devtools',
]

const libDetails: Array<{ label: string; desc: string }> = [
  {
    label: 'TanStack Start',
    desc: 'Every new Lovable project is generated as a TanStack Start app, with SSR, server functions, and streaming ready out of the box.',
  },
  {
    label: 'TanStack Router',
    desc: 'Generated apps use file-based routing, so the pages Lovable creates are fully typed and easy to extend by hand.',
  },
  {
    label: 'TanStack Query',
    desc: 'Data fetching in generated apps is wired through TanStack Query, with caching and mutations already set up for you.',
  },
  {
    label: 'TanStack Form',
    desc: 'Forms Lovable builds use TanStack Form for type-safe validation and state, ready to customize.',
  },
]

const stats: Array<{ value: string; label: string }> = [
  { value: '$500M', label: 'Annual recurring revenue (2026)' },
  { value: '8M+', label: 'Builders on Lovable' },
  { value: '80%', label: 'of builders are non-technical' },
]

const faqs: Array<{ q: string; a: string }> = [
  {
    q: 'Does Lovable build apps on TanStack Start?',
    a: 'Yes. New Lovable projects are generated as TanStack Start apps, so you get file-based routing, SSR, server functions, and end-to-end type safety from the very first prompt.',
  },
  {
    q: 'Can I export the code and keep building by hand?',
    a: 'Yes. Lovable syncs two-way with GitHub. You own the generated code and can edit it locally in any editor, then keep iterating in Lovable — there is no lock-in.',
  },
  {
    q: 'How does Lovable pricing work?',
    a: 'Lovable runs on credits. The free plan gives 5 build credits per day (up to 30 a month). Pro is $25/month for 100 credits, and Business is $50/month with SSO and data opt-out. Most edits cost roughly 0.5–1.2 credits each.',
  },
  {
    q: 'Where do Lovable apps get hosted?',
    a: 'Generated apps deploy to Lovable Cloud with one click, giving you a live URL and managed hosting. You can connect a custom domain on paid plans, or take the code to your own host through GitHub.',
  },
  {
    q: 'Can I add a database and authentication?',
    a: 'Yes. Lovable Cloud provides a managed backend with auth, database, and storage that Lovable wires into your TanStack app automatically as you build — just ask for it in the prompt.',
  },
  {
    q: 'What kinds of apps can I build with Lovable?',
    a: 'Everything from internal tools and dashboards to full SaaS products and marketing sites. Because generated apps are built on TanStack Start, they scale from a prototype to production without a rewrite.',
  },
]

const PAGE_TITLE =
  'Build & Deploy TanStack Apps with Lovable — Official Gold Partner'
const PAGE_DESCRIPTION =
  'Lovable is the AI app builder that generates production TanStack Start apps from a prompt — file-based routing, SSR, and type safety included — then deploys them to Lovable Cloud with one click. Trusted by 8M+ builders.'

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

export const Route = createFileRoute('/partners/lovable')({
  head: () => {
    const partner = getPartnerById('lovable')

    return {
      meta: seo({
        title: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        keywords:
          'lovable tanstack, build tanstack app with ai, lovable ai app builder, deploy tanstack lovable cloud, tanstack start lovable, lovable gold sponsor',
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
  component: LovablePartnerPage,
})

function CheckBadge() {
  return (
    <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
      <Check className="h-2.5 w-2.5" strokeWidth={3} />
    </span>
  )
}

function trackLovableClick() {
  trackEvent('partner_clicked', {
    partner_id: 'lovable',
    placement: 'detail',
    destination: 'external',
    destination_host: 'lovable.dev',
  })
}

function LovableCodeExample({
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

function LovablePartnerPage() {
  const [openFaq, setOpenFaq] = React.useState<number | null>(null)

  React.useEffect(() => {
    trackEvent('partner_viewed', {
      partner_id: 'lovable',
      placement: 'detail',
    })
  }, [])

  const partner = getPartnerById('lovable')

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
          <span className="text-gray-900 dark:text-white">Lovable</span>
        </nav>

        {/* Hero */}
        <section className="border-b border-gray-200 pb-10 pt-10 dark:border-gray-800">
          <div className="mb-5 flex items-center gap-4">
            {partner ? (
              <div className="flex h-12 w-44 items-center justify-start">
                <PartnerImage
                  config={partner.image}
                  alt="Lovable"
                  className="max-h-10 w-auto"
                />
              </div>
            ) : null}
            <div>
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                Gold Sponsor · AI App Builder & Hosting
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-pink-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  New Lovable projects are powered by TanStack Start
                </span>
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-gray-950 dark:text-white md:text-5xl">
            Build and deploy TanStack apps
            <br />
            by chatting with Lovable
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg">
            Lovable is the AI app builder trusted by 8M+ builders. Describe your
            app and Lovable generates a production TanStack Start project — then
            deploys it to Lovable Cloud in one click.
          </p>

          <p className="mt-3 max-w-xl text-sm italic leading-relaxed text-gray-500 dark:text-gray-400">
            New Lovable projects are powered by TanStack Start, so the app you
            generate keeps first-class routing, SSR, and end-to-end type safety.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              as="a"
              href={LOVABLE_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackLovableClick}
              size="lg"
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Start building free
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button as="a" href="#how-it-works" variant="ghost" size="lg">
              See how it works
            </Button>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            No credit card required. 5 free build credits every day.
          </p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-gray-200 py-7 sm:flex sm:flex-wrap sm:gap-10 dark:border-gray-800">
          {[
            ['8M+', 'Builders on Lovable'],
            ['25M+', 'Apps built'],
            ['100k+', 'New projects / day'],
            ['$0', 'To get started'],
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
            Why TanStack teams choose Lovable
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Lovable turns an idea into a working, deployable TanStack app in
            minutes. Here's what makes it the right fit for TanStack developers.
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
            From prompt to deployed in 4 steps
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Lovable generates a TanStack Start app from your description, then
            ships it to Lovable Cloud. Refine it visually or push to GitHub and
            keep coding.
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
            <LovableCodeExample
              code={PROMPT_SNIPPET}
              lang="text"
              title="your prompt"
            />
            <LovableCodeExample
              code={GENERATED_SNIPPET}
              lang="bash"
              title="generated project"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as="a"
              href={LOVABLE_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackLovableClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Build with Lovable
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={LOVABLE_DOCS_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackLovableClick}
              variant="ghost"
            >
              Read the docs
            </Button>
          </div>
        </section>

        {/* Library fit */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Built on the TanStack you already know
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Lovable generates apps on TanStack Start, so the routing, data, and
            forms it scaffolds use the libraries your team already owns.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {libraries.map((lib) => (
              <span
                key={lib}
                className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium dark:border-gray-800 dark:bg-gray-900"
              >
                {lib}
              </span>
            ))}
          </div>

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

        {/* Pricing */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Pricing that scales with you
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Lovable runs on credits — you spend them as you build. Start free
            with 5 build credits a day, then upgrade when your project grows.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pricing.map(({ plan, price, note, features: pf, highlight }) => (
              <Card
                key={plan}
                className={twMerge(
                  'relative p-5 shadow-none',
                  highlight && 'border-2 border-pink-500 dark:border-pink-400',
                )}
              >
                {highlight ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-pink-50 px-2.5 py-1 text-[11px] font-semibold text-pink-700 dark:bg-pink-950/60 dark:text-pink-300">
                    Most popular
                  </span>
                ) : null}
                <div className="text-sm font-bold">{plan}</div>
                <div className="mt-1 text-2xl font-bold tracking-tight">
                  {price}
                </div>
                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  {note}
                </div>
                <ul className="mt-4 flex flex-col gap-2">
                  {pf.map((feat) => (
                    <li
                      key={feat}
                      className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400"
                    >
                      <CheckBadge />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {creditCosts.map(([key, value]) => (
              <div
                key={key}
                className="rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-900"
              >
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {key}
                </div>
                <div className="mt-1 font-mono text-sm font-semibold">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as="a"
              href={LOVABLE_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackLovableClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Start free with 5 daily credits
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={LOVABLE_PRICING_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackLovableClick}
              variant="ghost"
            >
              Compare plans
            </Button>
          </div>
        </section>

        {/* Social proof */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Trusted by millions of builders
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Lovable is one of the fastest-growing AI development platforms — and
            most of the people shipping on it aren't traditional engineers.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {stats.map(({ value, label }) => (
              <Card key={label} className="p-5 shadow-none">
                <div className="text-3xl font-black tracking-tight">
                  {value}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                  {label}
                </p>
              </Card>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as="a"
              href={LOVABLE_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackLovableClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Build your first app
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <Sparkles className="h-3.5 w-3.5" />
              Powered by TanStack Start · no credit card required
            </span>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Frequently asked questions
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Common questions from TanStack developers evaluating Lovable.
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
                        'h-4 w-4 flex-shrink-0 text-gray-500 transition-transform duration-200 dark:text-gray-400',
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
            New projects powered by TanStack Start
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-white md:text-3xl">
            Ready to build your next TanStack app?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">
            No credit card required. Start with 5 free build credits every day.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            From prompt to deployed app in minutes.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              as="a"
              href={LOVABLE_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackLovableClick}
              size="lg"
              className="bg-white text-gray-950 border-white hover:bg-gray-100"
            >
              Start building free
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={LOVABLE_DOCS_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackLovableClick}
              size="lg"
              className="bg-transparent text-white border-gray-700 hover:bg-white/5"
            >
              Open the docs
            </Button>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          Lovable is a Gold-tier TanStack sponsor.{' '}
          <Link
            to="/partners"
            className="underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Browse all TanStack partners
          </Link>
          .{' '}
          <a
            href={LOVABLE_HOME_HREF}
            target="_blank"
            rel="noreferrer"
            onClick={trackLovableClick}
            className="underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
          >
            lovable.dev
          </a>
        </p>
      </div>

      <Footer />
    </div>
  )
}
