import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Check,
  DollarSign,
  GitPullRequest,
  Globe,
  Infinity as InfinityIcon,
  LineChart,
  Network,
  Plus,
  Rocket,
  ShieldCheck,
  Undo2,
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

const RAILWAY_HREF =
  'https://railway.com/new?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'
const RAILWAY_DOCS_HREF =
  'https://docs.railway.com/?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'
const RAILWAY_HOME_HREF =
  'https://railway.com/?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'
const RAILWAY_PRICING_HREF =
  'https://railway.com/pricing?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'

const CONFIG_SNIPPET = `import { defineConfig } from '@tanstack/start/config'

export default defineConfig({
  server: {
    preset: 'railway', // one line
  },
})
`

const DEPLOY_SNIPPET = `# Deploy in 3 commands
git init && git add . && git commit -m "init"
railway login
railway up
`

type FeatureIcon = React.ComponentType<{ className?: string }>

const features: Array<{ Icon: FeatureIcon; title: string; desc: string }> = [
  {
    Icon: Rocket,
    title: 'Auto-detected config',
    desc: 'Railway reads your TanStack code and picks the right build and run settings. No YAML to maintain.',
  },
  {
    Icon: GitPullRequest,
    title: 'Live PR previews',
    desc: 'Every pull request spins up its own environment. Test routing, data, and server logic before merging.',
  },
  {
    Icon: LineChart,
    title: 'Logs, metrics, and alerts',
    desc: 'Observability is built in. Pipe custom alerts to Slack, Discord, or email without a third-party agent.',
  },
  {
    Icon: Network,
    title: '100 Gbps private networking',
    desc: 'Services in a project talk over private IPs at 100 Gbps. HTTP, TCP, gRPC, and WebSockets handled for you.',
  },
  {
    Icon: Undo2,
    title: 'One-click rollbacks',
    desc: 'Every deploy is versioned. Roll back to a previous deployment instantly when something breaks.',
  },
  {
    Icon: ShieldCheck,
    title: 'Hard spending limits',
    desc: 'Set a hard cap on what a project can spend. Billing is per-second, so you only pay for actual compute.',
  },
  {
    Icon: Globe,
    title: 'Global regions',
    desc: 'Run your app close to your users. Pro and above can deploy to multiple regions concurrently.',
  },
  {
    Icon: InfinityIcon,
    title: 'Unlimited environments',
    desc: 'Spin up as many staging, preview, or branch environments as your team needs. No per-env fees.',
  },
]

const steps: Array<{ num: string; title: string; code: string }> = [
  {
    num: '01',
    title: 'Create your TanStack app',
    code: 'npx create-tsrouter-app my-app',
  },
  { num: '02', title: 'Add the Railway preset', code: "preset: 'railway'" },
  { num: '03', title: 'Deploy', code: 'railway up' },
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
    note: '30-day trial with $5 credits',
    features: [
      'Up to 1 vCPU / 0.5 GB RAM',
      '0.5 GB volume storage',
      'Community support',
      'No credit card required',
    ],
  },
  {
    plan: 'Hobby',
    price: '$5',
    note: 'min/month · includes $5 credits',
    features: [
      'Up to 48 vCPU / 48 GB RAM',
      'Up to 5 GB storage',
      '7-day log history',
      'Global regions',
    ],
  },
  {
    plan: 'Pro',
    price: '$20',
    note: 'min/month · includes $20 credits',
    features: [
      'Up to 1,000 vCPU / 1 TB RAM',
      'Up to 1 TB storage',
      '30-day log history',
      'Unlimited workspace seats',
      'Concurrent global regions',
    ],
    highlight: true,
  },
  {
    plan: 'Enterprise',
    price: 'Custom',
    note: 'for teams at scale',
    features: [
      'Up to 2,400 vCPU / 2.4 TB RAM',
      '90-day log history',
      'SSO + RBAC + HIPAA BAA',
      'Dedicated VMs',
      'Bring your own cloud',
    ],
  },
]

const meteredPricing: Array<[string, string]> = [
  ['Memory', '$0.000004 / GB·sec'],
  ['CPU', '$0.000008 / vCPU·sec'],
  ['Egress', '$0.05 / GB'],
]

const testimonials: Array<{ quote: string; author: string; role: string }> = [
  {
    quote: 'We cut our hosting costs by 75% migrating from Heroku to Railway.',
    author: 'Dillon Chen',
    role: 'Founder at Common',
  },
  {
    quote:
      "I've moved $4.5k/month from AWS and $1k/month from Heroku. My Railway bill is about $300/month.",
    author: 'John Nunemaker',
    role: 'Founder at BoxOutSports',
  },
  {
    quote: 'We went from a $1,600 Heroku bill to a $300 Railway bill.',
    author: 'Brandon Gell',
    role: 'Head of Consulting at Every',
  },
]

const libraries = [
  'Start',
  'Router',
  'Query',
  'Table',
  'Form',
  'DB',
  'AI',
  'Virtual',
  'Pacer',
  'Store',
  'Devtools',
  'CLI',
]

const libDetails: Array<{ label: string; desc: string }> = [
  {
    label: 'TanStack Start',
    desc: 'Full SSR and streaming support with the Railway preset. Auto-configured Node runtime, zero extra config.',
  },
  {
    label: 'TanStack Router',
    desc: 'File-based routing apps deploy in SSR and SPA modes. PR previews mean every route change gets a live test environment.',
  },
  {
    label: 'TanStack Query',
    desc: "Pair with Railway-managed Postgres or Redis. Private networking keeps your server queries inside Railway's infrastructure.",
  },
  {
    label: 'TanStack DB',
    desc: "Railway's managed databases integrate with TanStack DB's sync engine via 100 Gbps private networking.",
  },
]

const faqs: Array<{ q: string; a: string }> = [
  {
    q: 'Does Railway support TanStack Start SSR and streaming?',
    a: "Yes — Railway supports server-side rendering and React streaming out of the box. TanStack Start's SSR and streaming modes work without any special configuration when using the Railway preset.",
  },
  {
    q: 'Can I run a database alongside my TanStack app?',
    a: "Absolutely. Railway lets you provision Postgres, MySQL, Redis, or MongoDB in the same project as your app. They communicate over Railway's 100 Gbps private network — no VPC setup needed.",
  },
  {
    q: 'How does Railway pricing actually work?',
    a: 'Railway charges by the second based on actual CPU and memory usage — not provisioned box sizes. The Hobby plan starts at $5/month (which includes $5 of credits). Most hobby TanStack projects run for free or under $5/month.',
  },
  {
    q: 'What makes Railway different from Vercel or Render?',
    a: 'Railway is a full-stack cloud — not just a frontend host. You can run your TanStack app server, managed databases, background workers, cron jobs, and private networking all in one project. Railway also has hard spending limits, which no other major cloud provider offers.',
  },
  {
    q: 'Does Railway have PR preview environments?',
    a: 'Yes — every pull request automatically gets its own live preview environment. For TanStack teams, this means you can test routing changes, data fetching behavior, and server logic before merging.',
  },
  {
    q: 'Can I migrate an existing TanStack app to Railway?',
    a: 'Yes — if your app runs in Node or Docker, Railway deploys it directly from GitHub with no changes required. Railway V3 is faster and cheaper than previous versions, so now is a great time to switch.',
  },
]

const PAGE_TITLE = 'Deploy TanStack to Railway — Official Gold Partner'
const PAGE_DESCRIPTION =
  'Railway gives TanStack teams a single place to run app services, databases, and supporting infrastructure. One-line Railway preset for TanStack Start, live PR previews, 100 Gbps private networking, and hard spending limits. Pay per second for the compute you actually use.'

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

export const Route = createFileRoute('/partners/railway')({
  head: () => {
    const partner = getPartnerById('railway')

    return {
      meta: seo({
        title: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        keywords:
          'deploy tanstack to railway, tanstack start railway, tanstack router railway, railway hosting, tanstack deployment, railway gold sponsor',
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
  component: RailwayPartnerPage,
})

function CheckBadge() {
  return (
    <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
      <Check className="h-2.5 w-2.5" strokeWidth={3} />
    </span>
  )
}

function trackRailwayClick() {
  trackEvent('partner_clicked', {
    partner_id: 'railway',
    placement: 'detail',
    destination: 'external',
    destination_host: 'railway.com',
  })
}

function RailwayCodeExample({
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

function RailwayPartnerPage() {
  const [openFaq, setOpenFaq] = React.useState<number | null>(null)

  React.useEffect(() => {
    trackEvent('partner_viewed', {
      partner_id: 'railway',
      placement: 'detail',
    })
  }, [])

  const partner = getPartnerById('railway')

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
          <span className="text-gray-900 dark:text-white">Railway</span>
        </nav>

        {/* Hero */}
        <section className="border-b border-gray-200 pb-10 pt-10 dark:border-gray-800">
          <div className="mb-5 flex items-center gap-4">
            {partner ? (
              <div className="flex h-12 w-44 items-center justify-start">
                <PartnerImage
                  config={partner.image}
                  alt="Railway"
                  className="max-h-10 w-auto"
                />
              </div>
            ) : null}
            <div>
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                Gold Sponsor · Deployment & Hosting
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Railway V3 — faster and cheaper
                </span>
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-gray-950 dark:text-white md:text-5xl">
            Ship TanStack apps
            <br />
            peacefully with Railway
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg">
            Railway gives TanStack teams a single place to run app services,
            databases, and supporting infrastructure. Deploy a TanStack Start
            app from GitHub or the CLI — and only pay per-second for the
            compute you actually use.
          </p>

          <p className="mt-3 max-w-xl text-sm italic leading-relaxed text-gray-500 dark:text-gray-400">
            "Services that took 1 week to configure elsewhere take 1 day to
            spin up in Railway." — Daniel Lobaton, CTO at G2X
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              as="a"
              href={RAILWAY_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackRailwayClick}
              size="lg"
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Deploy free in 2 minutes
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button as="a" href="#how-it-works" variant="ghost" size="lg">
              See how it works
            </Button>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            No credit card required. $5 in trial credits on signup.
          </p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-gray-200 py-7 sm:flex sm:flex-wrap sm:gap-10 dark:border-gray-800">
          {[
            ['2M+', 'Developers on Railway'],
            ['< 2 min', 'Time to first deploy'],
            ['100 Gbps', 'Private networking'],
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
            Why TanStack teams choose Railway
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Railway eliminates infrastructure complexity so your team ships
            faster. Here's what makes it the right fit for TanStack developers.
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
            From zero to deployed in 3 steps
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Railway has first-class support for TanStack Start. One config line
            is all it takes.
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
            <RailwayCodeExample
              code={CONFIG_SNIPPET}
              lang="ts"
              title="tanstack.config.ts"
            />
            <RailwayCodeExample
              code={DEPLOY_SNIPPET}
              lang="bash"
              title="terminal"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as="a"
              href={RAILWAY_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackRailwayClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Try the Railway preset
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={RAILWAY_DOCS_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackRailwayClick}
              variant="ghost"
            >
              Read the deployment guide
            </Button>
          </div>
        </section>

        {/* Library fit */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Works with every TanStack library
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            From full-stack apps with TanStack Start to lightweight React apps
            using Router and Query — Railway deploys them all.
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
            Railway charges by the second based on actual usage — not
            provisioned box sizes. Most TanStack hobby projects run free or
            under $5/month.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pricing.map(({ plan, price, note, features: pf, highlight }) => (
              <Card
                key={plan}
                className={twMerge(
                  'relative p-5 shadow-none',
                  highlight && 'border-2 border-blue-500 dark:border-blue-400',
                )}
              >
                {highlight ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
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
            {meteredPricing.map(([key, value]) => (
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
              href={RAILWAY_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackRailwayClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Start with $5 in credits
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={RAILWAY_PRICING_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackRailwayClick}
              variant="ghost"
            >
              Estimate your costs
            </Button>
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            What teams say after switching
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Real teams, real bills. These are quotes from founders and
            engineers who moved their production workloads onto Railway.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {testimonials.map(({ quote, author, role }) => (
              <Card key={author} as="figure" className="p-5 shadow-none">
                <blockquote className="text-sm leading-relaxed">
                  "{quote}"
                </blockquote>
                <figcaption className="mt-3">
                  <div className="text-xs font-semibold">{author}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {role}
                  </div>
                </figcaption>
              </Card>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as="a"
              href={RAILWAY_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackRailwayClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Move your app to Railway
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <DollarSign className="h-3.5 w-3.5" />
              Per-second billing · no credit card required
            </span>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Frequently asked questions
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Common questions from TanStack developers evaluating Railway.
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
            Railway V3 — now faster and cheaper
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-white md:text-3xl">
            Ready to ship TanStack peacefully?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">
            No credit card required. No surprise bills. Pay only for what you
            use.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Most customers save ~40% by switching to Railway.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              as="a"
              href={RAILWAY_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackRailwayClick}
              size="lg"
              className="bg-white text-gray-950 border-white hover:bg-gray-100"
            >
              Deploy your TanStack app
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={RAILWAY_DOCS_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackRailwayClick}
              size="lg"
              className="bg-transparent text-white border-gray-700 hover:bg-white/5"
            >
              Open the docs
            </Button>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          Railway is a Gold-tier TanStack sponsor.{' '}
          <Link
            to="/partners"
            className="underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Browse all TanStack partners
          </Link>
          .{' '}
          <a
            href={RAILWAY_HOME_HREF}
            target="_blank"
            rel="noreferrer"
            onClick={trackRailwayClick}
            className="underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
          >
            railway.com
          </a>
        </p>
      </div>

      <Footer />
    </div>
  )
}
