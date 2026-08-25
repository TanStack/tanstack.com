import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowUpRightIcon,
  ArrowUUpLeftIcon,
  ChartLineIcon,
  CheckIcon,
  CurrencyDollarIcon,
  GitPullRequestIcon,
  GlobeIcon,
  InfinityIcon,
  NetworkIcon,
  PlusIcon,
  RocketIcon,
  ShieldCheckIcon,
} from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import { Card } from '~/components/Card'
import { Button } from '~/ui'
import { Panel, PanelContent, PanelTrigger } from '~/components/Panel'
import { CodeBlock } from '~/components/markdown/CodeBlock'
import { seo } from '~/utils/seo'
import {
  PartnerImage,
  partnerCategoryLabels,
  partnerTierLabels,
} from '~/utils/partners'
import { getPartnerJsonLd } from '~/utils/partner-pages'
import { trackEvent } from '~/utils/analytics'
import { getRailwayPartnerPageModel } from '~/utils/railway-partner'
import { SITE_URL } from '~/utils/site'
import defaultOgImage from '~/images/og.png'

const RAILWAY_PAGE_MODEL = getRailwayPartnerPageModel()
const {
  docsHash: TANSTACK_START_RAILWAY_DOCS_HASH,
  docsResource: RAILWAY_DOCS_RESOURCE,
  partner: RAILWAY_PARTNER,
} = RAILWAY_PAGE_MODEL
const RAILWAY_HREF =
  'https://railway.com/new?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'
const TANSTACK_START_RAILWAY_DOCS_PATH = RAILWAY_DOCS_RESOURCE.href
const RAILWAY_CANONICAL_HREF =
  RAILWAY_PARTNER.canonicalHref ?? RAILWAY_PARTNER.href
const railwayHomeUrl = new URL(RAILWAY_CANONICAL_HREF)
railwayHomeUrl.search = new URL(RAILWAY_PARTNER.href).search
const RAILWAY_HOME_HREF = railwayHomeUrl.toString()
const railwayPricingUrl = new URL('/pricing', RAILWAY_CANONICAL_HREF)
railwayPricingUrl.search = railwayHomeUrl.search
const RAILWAY_PRICING_HREF = railwayPricingUrl.toString()
const RAILWAY_OG_IMAGE = new URL(defaultOgImage, SITE_URL).toString()
const RAILWAY_TIER_LABEL = RAILWAY_PARTNER.tier
  ? partnerTierLabels[RAILWAY_PARTNER.tier]
  : undefined
const RAILWAY_PARTNERSHIP_LABEL =
  RAILWAY_PARTNER.status === 'active'
    ? 'Current TanStack partner'
    : 'Previous TanStack partner'
const RAILWAY_PARTNER_TITLE_LABEL =
  RAILWAY_PARTNER.status === 'active'
    ? `${partnerTierLabels[RAILWAY_PARTNER.tier]} TanStack Partner`
    : 'Previous TanStack Partner'
const RAILWAY_PARTNER_BADGE_LABEL =
  RAILWAY_PARTNER.status === 'active'
    ? `${partnerTierLabels[RAILWAY_PARTNER.tier]} Partner`
    : RAILWAY_TIER_LABEL
      ? `Previous ${RAILWAY_TIER_LABEL} Partner`
      : 'Previous Partner'

type FeatureIcon = React.ComponentType<{ className?: string }>

const features: Array<{ Icon: FeatureIcon; title: string; desc: string }> = [
  {
    Icon: RocketIcon,
    title: 'Node service deploys',
    desc: 'TanStack Start builds a Node server for SSR, server functions, and static assets. Railway deploys it as a standard Node service.',
  },
  {
    Icon: GitPullRequestIcon,
    title: 'Live PR previews',
    desc: 'Enable PR Environments on a GitHub-connected project to spin up isolated previews for eligible pull requests.',
  },
  {
    Icon: ChartLineIcon,
    title: 'Logs, metrics, and alerts',
    desc: 'Logs and metrics are built in. Pro workspaces can configure Monitors that notify Slack, Discord, or email.',
  },
  {
    Icon: NetworkIcon,
    title: 'Up to 100 Gbps private networking',
    desc: 'Services in a project talk over private IPs at up to 100 Gbps. HTTP, TCP, gRPC, and WebSockets handled for you.',
  },
  {
    Icon: ArrowUUpLeftIcon,
    title: 'Retained deployment versions',
    desc: 'Redeploy an earlier version while its image is retained. Retention ranges from 24 hours to 360 hours by plan.',
  },
  {
    Icon: ShieldCheckIcon,
    title: 'Hard spending limits',
    desc: 'Set a hard limit for workspace compute usage. Railway sends alerts as you approach it and stops workloads at the limit.',
  },
  {
    Icon: GlobeIcon,
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
    title: 'Enter your app',
    code: 'cd my-tanstack-app',
  },
  {
    num: '02',
    title: 'Install the Railway CLI',
    code: 'npm install -g @railway/cli',
  },
  { num: '03', title: 'Authenticate', code: 'railway login' },
  { num: '04', title: 'Deploy', code: 'railway init && railway up' },
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
    note: '30-day trial, then $1 monthly credit',
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
    note: 'month, includes $5 of usage',
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
    note: 'min/month, includes $20 credits',
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
  ['Memory', '$0.00000386 / GB-sec'],
  ['CPU', '$0.00000772 / vCPU-sec'],
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
      "I've moved $4.5k per month from AWS and $1k per month from Heroku […] and my railway bill is like $300 per month.",
    author: 'John Nunemaker',
    role: 'Founder at BoxOutSports',
  },
  {
    quote: 'We went from a $1,600 Heroku bill to a $300 Railway bill.',
    author: 'Brandon Gell',
    role: 'Head of Consulting at Every',
  },
]

const faqs: Array<{ q: string; a: string }> = [
  {
    q: 'Does Railway support TanStack Start SSR and streaming?',
    a: 'Yes. Create a Railway-ready TanStack Start app with the TanStack CLI, or add the Nitro setup from the Start hosting guide to an existing app.',
  },
  {
    q: 'Can I run a database alongside my TanStack app?',
    a: "Absolutely. Railway lets you provision Postgres, MySQL, Redis, or MongoDB in the same project as your app. They communicate over Railway's private network at up to 100 Gbps, with no VPC setup needed.",
  },
  {
    q: 'How does Railway pricing actually work?',
    a: 'Railway bills resource usage by the second. After the 30-day trial, the Free plan costs $0 and includes $1 of monthly resource credit. Hobby costs $5/month and includes $5 of monthly usage; you pay the difference if usage exceeds $5.',
  },
  {
    q: 'What makes Railway different from Vercel or Render?',
    a: 'Railway is a full-stack cloud. You can run your TanStack app server, managed databases, background workers, cron jobs, and private networking in one project. Configurable usage alerts and hard limits help keep resource spending under control.',
  },
  {
    q: 'Does Railway have PR preview environments?',
    a: 'Yes. Connect the project to GitHub and enable PR Environments in project settings. Railway then creates an isolated preview for eligible pull requests and removes it after the pull request is merged or closed.',
  },
  {
    q: 'Can I migrate an existing TanStack app to Railway?',
    a: 'Yes. If your app already builds to a Node server or has a Dockerfile, Railway can deploy it from GitHub. For TanStack Start, make sure the Nitro Vite setup and Node start script are in place.',
  },
]

const PAGE_TITLE = `Deploy TanStack to ${RAILWAY_PARTNER.name} | ${RAILWAY_PARTNER_TITLE_LABEL}`
const PAGE_DESCRIPTION =
  'Railway gives TanStack teams a single place to run app services, databases, and supporting infrastructure. Nitro-powered TanStack Start deploys, optional PR preview environments, up to 100 Gbps private networking, and hard spending limits. Resource usage is billed by the second.'

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
  head: () => ({
    meta: seo({
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      keywords: `deploy tanstack to railway, tanstack start railway, tanstack router railway, railway hosting, tanstack deployment, railway tanstack partner`,
      image: RAILWAY_OG_IMAGE,
    }),
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(getPartnerJsonLd(RAILWAY_PARTNER)),
      },
      {
        type: 'application/ld+json',
        children: JSON.stringify(getFaqJsonLd()),
      },
    ],
  }),
  component: RailwayPartnerPage,
})

function CheckBadge() {
  return (
    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
      <CheckIcon className="h-2.5 w-2.5" weight="bold" />
    </span>
  )
}

function trackRailwayClick() {
  trackEvent('partner_clicked', {
    partner_id: RAILWAY_PARTNER.id,
    placement: 'detail',
    destination: 'external',
    destination_host: new URL(RAILWAY_CANONICAL_HREF).host,
    partner_tier: RAILWAY_PARTNER.tier,
  })
}

function trackTanStackDocsClick() {
  trackEvent('partner_clicked', {
    partner_id: RAILWAY_PARTNER.id,
    placement: 'detail',
    destination: 'internal_resource',
    partner_tier: RAILWAY_PARTNER.tier,
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
      partner_id: RAILWAY_PARTNER.id,
      placement: 'detail',
      partner_tier: RAILWAY_PARTNER.tier,
    })
  }, [])

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
          <span className="text-gray-900 dark:text-white">
            {RAILWAY_PARTNER.name}
          </span>
        </nav>

        {/* Hero */}
        <section className="border-b border-gray-200 pb-10 pt-10 dark:border-gray-800">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-12 w-44 items-center justify-start">
              <PartnerImage
                config={RAILWAY_PARTNER.image}
                alt={RAILWAY_PARTNER.name}
                className="max-h-10 w-auto"
              />
            </div>
            <div>
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                {RAILWAY_PARTNER_BADGE_LABEL} ·{' '}
                {partnerCategoryLabels[RAILWAY_PARTNER.category]}
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    RAILWAY_PARTNER.status === 'active'
                      ? 'bg-emerald-500'
                      : 'bg-gray-400'
                  }`}
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {RAILWAY_PARTNERSHIP_LABEL}
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
            app from GitHub or the CLI, with resource usage billed by the
            second.
          </p>

          <p className="mt-3 max-w-xl text-sm italic leading-relaxed text-gray-500 dark:text-gray-400">
            "Services that took 1 week to configure elsewhere take 1 day to spin
            up in Railway." - Daniel Lobaton, CTO at G2X
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
              Start free on Railway
              <ArrowUpRightIcon className="h-4 w-4" />
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
            ['Per-second', 'Resource billing'],
            ['100 Gbps', 'Private network maximum'],
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
            Create a Railway-ready app
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            The TanStack CLI adds the Railway deployment setup while it creates
            your app.
          </p>

          <div className="mt-6">
            <RailwayCodeExample
              code={RAILWAY_PAGE_MODEL.create.command}
              lang="bash"
              title="terminal"
            />
          </div>

          <h3 className="mt-8 text-lg font-bold">Deploy the app</h3>
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

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as="a"
              href={RAILWAY_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackRailwayClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Deploy on Railway
              <ArrowUpRightIcon className="h-4 w-4" />
            </Button>
            <Button
              as={Link}
              to={TANSTACK_START_RAILWAY_DOCS_PATH}
              hash={TANSTACK_START_RAILWAY_DOCS_HASH}
              onClick={trackTanStackDocsClick}
              variant="ghost"
            >
              Read the deployment guide
            </Button>
          </div>
        </section>

        {/* Existing TanStack Start apps */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Add Railway to an existing app
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Follow the TanStack Start hosting guide to install Nitro, configure
            Vite, and add the Node start command Railway needs.
          </p>

          <div className="mt-5">
            <Button
              as={Link}
              to={TANSTACK_START_RAILWAY_DOCS_PATH}
              hash={TANSTACK_START_RAILWAY_DOCS_HASH}
              onClick={trackTanStackDocsClick}
              variant="ghost"
            >
              Open the Railway hosting guide
            </Button>
          </div>
        </section>

        {/* Pricing */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Pricing that scales with you
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Railway bills resource usage by the second. After the trial, Free
            includes $1 of monthly resource credit. Hobby costs $5/month and
            includes $5 of monthly usage.
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
              <ArrowUpRightIcon className="h-4 w-4" />
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
            Real teams, real bills. These are quotes from founders and engineers
            who moved their production workloads onto Railway.
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
              <ArrowUpRightIcon className="h-4 w-4" />
            </Button>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <CurrencyDollarIcon className="h-3.5 w-3.5" />
              Per-second billing, no credit card required
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
                <Panel
                  key={q}
                  open={isOpen}
                  onOpenChange={(next) => setOpenFaq(next ? i : null)}
                  className="border-b border-gray-200 dark:border-gray-800"
                >
                  <PanelTrigger className="flex w-full items-center justify-between gap-4 py-4 text-left">
                    <span className="text-sm font-medium md:text-[15px]">
                      {q}
                    </span>
                    <PlusIcon
                      className={twMerge(
                        'h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 dark:text-gray-400',
                        isOpen && 'rotate-45',
                      )}
                    />
                  </PanelTrigger>
                  <PanelContent>
                    <p className="max-w-2xl pb-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                      {a}
                    </p>
                  </PanelContent>
                </Panel>
              )
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-6 rounded-2xl bg-gray-950 px-6 py-10 text-center md:px-10 md:py-12 dark:bg-gray-900">
          <div className="inline-block rounded-full bg-white/5 px-3 py-1 text-[11px] text-gray-400">
            Railway V3 is faster and cheaper
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-white md:text-3xl">
            Ready to ship TanStack peacefully?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">
            No credit card required to start. Set a hard usage limit to keep
            resource spending under control.
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
              <ArrowUpRightIcon className="h-4 w-4" />
            </Button>
            <Button
              as={Link}
              to={TANSTACK_START_RAILWAY_DOCS_PATH}
              hash={TANSTACK_START_RAILWAY_DOCS_HASH}
              onClick={trackTanStackDocsClick}
              size="lg"
              className="bg-transparent text-white border-gray-700 hover:bg-white/5"
            >
              Open the docs
            </Button>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          {RAILWAY_PARTNER.status === 'active'
            ? `${RAILWAY_PARTNER.name} is a ${RAILWAY_TIER_LABEL} TanStack partner. `
            : `${RAILWAY_PARTNER.name} is a previous TanStack partner. `}
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
    </div>
  )
}
