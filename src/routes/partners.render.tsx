import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowUpRightIcon,
  ArrowUUpLeftIcon,
  CheckIcon,
  CurrencyDollarIcon,
  DatabaseIcon,
  FileCodeIcon,
  GitPullRequestIcon,
  NetworkIcon,
  PlusIcon,
  RocketIcon,
  ShieldCheckIcon,
  TrendUpIcon,
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
import { getRenderPartnerPageModel } from '~/utils/render-partner'
import { SITE_URL } from '~/utils/site'
import defaultOgImage from '~/images/og.png'

const RENDER_PAGE_MODEL = getRenderPartnerPageModel()
const {
  docsHash: TANSTACK_START_RENDER_DOCS_HASH,
  docsResource: RENDER_DOCS_RESOURCE,
  partner: RENDER_PARTNER,
} = RENDER_PAGE_MODEL
const RENDER_UTM_SEARCH =
  'utm_source=tanstack&utm_medium=referral&utm_campaign=gold-launch&utm_content=partner_page'
const RENDER_HREF = `https://dashboard.render.com/register?${RENDER_UTM_SEARCH}`
const RENDER_BLUEPRINT_HREF = `https://dashboard.render.com/select-repo?type=blueprint&${RENDER_UTM_SEARCH}`
const TANSTACK_START_RENDER_DOCS_PATH = RENDER_DOCS_RESOURCE.href
const RENDER_CANONICAL_HREF =
  RENDER_PARTNER.canonicalHref ?? RENDER_PARTNER.href
const renderHomeUrl = new URL(RENDER_CANONICAL_HREF)
renderHomeUrl.search = new URL(RENDER_PARTNER.href).search
const RENDER_HOME_HREF = renderHomeUrl.toString()
const renderPricingUrl = new URL('/pricing', RENDER_CANONICAL_HREF)
renderPricingUrl.search = renderHomeUrl.search
const RENDER_PRICING_HREF = renderPricingUrl.toString()
const RENDER_OG_IMAGE = new URL(defaultOgImage, SITE_URL).toString()
const RENDER_TIER_LABEL = RENDER_PARTNER.tier
  ? partnerTierLabels[RENDER_PARTNER.tier]
  : undefined
const RENDER_PARTNERSHIP_LABEL =
  RENDER_PARTNER.status === 'active'
    ? 'Current TanStack partner'
    : 'Previous TanStack partner'
const RENDER_PARTNER_TITLE_LABEL =
  RENDER_PARTNER.status === 'active'
    ? `${partnerTierLabels[RENDER_PARTNER.tier]} TanStack Partner`
    : 'Previous TanStack Partner'
const RENDER_PARTNER_BADGE_LABEL =
  RENDER_PARTNER.status === 'active'
    ? `${partnerTierLabels[RENDER_PARTNER.tier]} Partner`
    : RENDER_TIER_LABEL
      ? `Previous ${RENDER_TIER_LABEL} Partner`
      : 'Previous Partner'

type FeatureIcon = React.ComponentType<{ className?: string }>

const features: Array<{ Icon: FeatureIcon; title: string; desc: string }> = [
  {
    Icon: RocketIcon,
    title: 'Node web service deploys',
    desc: 'TanStack Start builds a Node server through Nitro. Render runs it as a standard web service with the render-com preset.',
  },
  {
    Icon: GitPullRequestIcon,
    title: 'Pull request previews',
    desc: 'Single-service previews are included on every plan. Pro and above add full-stack previews of your whole architecture.',
  },
  {
    Icon: DatabaseIcon,
    title: 'Managed Postgres and Key Value',
    desc: 'Run fully managed Postgres with point-in-time recovery, plus Redis-compatible Key Value, in the same workspace as your app.',
  },
  {
    Icon: NetworkIcon,
    title: 'Automatic private networking',
    desc: 'Services reach each other over a private network with no VPC to configure. WebSockets and managed TLS are handled for you.',
  },
  {
    Icon: ArrowUUpLeftIcon,
    title: 'Zero-downtime deploys and rollbacks',
    desc: 'Merges ship without dropping traffic, and you can roll back instantly to a retained build when a deploy goes wrong.',
  },
  {
    Icon: TrendUpIcon,
    title: 'Load-based autoscaling',
    desc: 'Horizontal autoscaling on Pro and above keeps services responsive through launch days and traffic spikes.',
  },
  {
    Icon: FileCodeIcon,
    title: 'Blueprints as infrastructure as code',
    desc: 'Describe your whole architecture in one render.yaml and version it with your app. The TanStack CLI writes the first one.',
  },
  {
    Icon: ShieldCheckIcon,
    title: 'Protection built in',
    desc: 'Every service gets a firewall and automatic DDoS mitigation. SOC 2 Type II, ISO 27001, and a GDPR DPA cover all plans.',
  },
]

const steps: Array<{ num: string; title: string; code: string }> = [
  { num: '01', title: 'Enter your app', code: 'cd my-tanstack-app' },
  {
    num: '02',
    title: 'Commit the Blueprint',
    code: 'git add render.yaml && git commit -m "Add Render Blueprint"',
  },
  {
    num: '03',
    title: 'Push to your Git provider',
    code: 'git push origin main',
  },
  {
    num: '04',
    title: 'Create the Blueprint on Render',
    code: 'Dashboard > New > Blueprint',
  },
]

const pricing: Array<{
  plan: string
  price: string
  note: string
  features: Array<string>
  highlight?: boolean
}> = [
  {
    plan: 'Hobby',
    price: '$0',
    note: 'month, plus compute',
    features: [
      'Up to 25 services',
      '5 GB bandwidth included',
      'Single-service previews',
      'Global regions and CDN',
      'Chat support',
    ],
  },
  {
    plan: 'Pro',
    price: '$25',
    note: 'month, plus compute',
    features: [
      'Unlimited seats and services',
      '25 GB bandwidth included',
      'Full-stack previews',
      'Horizontal autoscaling',
      'Workspace audit logs',
    ],
    highlight: true,
  },
  {
    plan: 'Scale',
    price: '$499',
    note: 'month, plus compute',
    features: [
      'Multiple workspaces',
      '1 TB bandwidth included',
      'HIPAA-compliant workspaces',
      'SAML SSO and SCIM',
      'Advanced RBAC roles',
    ],
  },
  {
    plan: 'Enterprise',
    price: 'Custom',
    note: 'for teams at scale',
    features: [
      'Contractual uptime SLAs',
      'Technical account manager',
      'Support Slack channel',
      'Support response SLAs',
    ],
  },
]

const meteredPricing: Array<[string, string]> = [
  ['Smallest paid instance', '$7 / month'],
  ['Bandwidth', '$0.15 / GB'],
  ['Persistent disks', '$0.25 / GB-month'],
]

const testimonials: Array<{ quote: string; author: string; role: string }> = [
  {
    quote:
      "It's been refreshing. We're saving money, shipping faster, and actually enjoying the way we work.",
    author: 'Brayden Sterrett',
    role: 'Head of Technology at Hodinkee',
  },
  {
    quote:
      "There are fewer knobs to turn, and fewer things you're expected to be aware of.",
    author: 'Ryan Park',
    role: 'Infrastructure Engineer at ReadMe',
  },
  {
    quote:
      'Render has enabled us to deliver AI features much faster with a very lean engineering team.',
    author: 'Maor Shlomo',
    role: 'Founder of Base44',
  },
]

const faqs: Array<{ q: string; a: string }> = [
  {
    q: 'Does Render support TanStack Start SSR and streaming?',
    a: 'Yes. TanStack Start builds a Node server through Nitro, and Render runs it as a web service. Create a Render-ready app with the TanStack CLI, or add the Nitro setup from the Start hosting guide to an existing app.',
  },
  {
    q: 'Can I run a database alongside my TanStack app?',
    a: 'Yes. Render Postgres and Render Key Value run in the same workspace as your app and reach it over automatic private networking, with no VPC to configure. Paid Postgres instances include point-in-time recovery.',
  },
  {
    q: 'How does Render pricing actually work?',
    a: 'Render bills three things: a flat workspace plan, compute for each service prorated to the second, and metered usage such as bandwidth. Hobby workspaces are $0/month plus compute, and free compute plans are available while you build.',
  },
  {
    q: 'What makes Render different from Vercel or Railway?',
    a: 'Render runs the whole backend rather than the frontend alone: web services, private services, background workers, cron jobs, durable workflows, Postgres, and Key Value in one workspace. Compute is a fixed instance size prorated by the second, so the bill stays predictable as traffic grows.',
  },
  {
    q: 'Does Render have pull request previews?',
    a: 'Yes. Every plan includes single-service previews for pull requests. Pro workspaces and above add full-stack preview environments that spin up your entire architecture for each change.',
  },
  {
    q: 'Can I migrate an existing TanStack app to Render?',
    a: 'Yes. If your app builds to a Node server or ships a Dockerfile, Render deploys it from GitHub, GitLab, or Bitbucket. Add a render.yaml Blueprint to describe the service, and set NITRO_PRESET to render-com so Nitro builds the output Render runs.',
  },
]

const PAGE_TITLE = `Deploy TanStack to ${RENDER_PARTNER.name} | ${RENDER_PARTNER_TITLE_LABEL}`
const PAGE_DESCRIPTION =
  'Render gives TanStack teams intuitive cloud infrastructure for app services, Postgres, Key Value, cron jobs, and workers in one workspace. Nitro-powered TanStack Start deploys from a render.yaml Blueprint, with pull request previews, automatic private networking, and compute prorated by the second.'

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

export const Route = createFileRoute('/partners/render')({
  head: () => ({
    meta: seo({
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      keywords: `deploy tanstack to render, tanstack start render, tanstack router render, render hosting, render.com tanstack, tanstack deployment, render tanstack partner`,
      image: RENDER_OG_IMAGE,
    }),
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(getPartnerJsonLd(RENDER_PARTNER)),
      },
      {
        type: 'application/ld+json',
        children: JSON.stringify(getFaqJsonLd()),
      },
    ],
  }),
  component: RenderPartnerPage,
})

function CheckBadge() {
  return (
    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
      <CheckIcon className="h-2.5 w-2.5" weight="bold" />
    </span>
  )
}

function trackRenderClick() {
  trackEvent('partner_clicked', {
    partner_id: RENDER_PARTNER.id,
    placement: 'detail',
    destination: 'external',
    destination_host: new URL(RENDER_CANONICAL_HREF).host,
    partner_tier: RENDER_PARTNER.tier,
  })
}

function trackTanStackDocsClick() {
  trackEvent('partner_clicked', {
    partner_id: RENDER_PARTNER.id,
    placement: 'detail',
    destination: 'internal_resource',
    partner_tier: RENDER_PARTNER.tier,
  })
}

function RenderCodeExample({
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

function RenderPartnerPage() {
  const [openFaq, setOpenFaq] = React.useState<number | null>(null)

  React.useEffect(() => {
    trackEvent('partner_viewed', {
      partner_id: RENDER_PARTNER.id,
      placement: 'detail',
      partner_tier: RENDER_PARTNER.tier,
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
            {RENDER_PARTNER.name}
          </span>
        </nav>

        {/* Hero */}
        <section className="border-b border-gray-200 pb-10 pt-10 dark:border-gray-800">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-12 w-44 items-center justify-start">
              <PartnerImage
                config={RENDER_PARTNER.image}
                alt={RENDER_PARTNER.name}
                className="max-h-10 w-auto"
              />
            </div>
            <div>
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                {RENDER_PARTNER_BADGE_LABEL} ·{' '}
                {partnerCategoryLabels[RENDER_PARTNER.category]}
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    RENDER_PARTNER.status === 'active'
                      ? 'bg-emerald-500'
                      : 'bg-gray-400'
                  }`}
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {RENDER_PARTNERSHIP_LABEL}
                </span>
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-gray-950 dark:text-white md:text-5xl">
            Ship TanStack apps
            <br />
            with zero ops on Render
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg">
            Render runs your TanStack Start server, Postgres, Key Value store,
            cron jobs, and background workers on one intuitive cloud. Push to
            Git and Render builds, deploys, and scales the Node service for you.
          </p>

          <p className="mt-3 max-w-xl text-sm italic leading-relaxed text-gray-500 dark:text-gray-400">
            "Render has enabled us to deliver AI features much faster with a
            very lean engineering team." - Maor Shlomo, Founder of Base44
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              as="a"
              href={RENDER_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackRenderClick}
              size="lg"
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Start free on Render
              <ArrowUpRightIcon className="h-4 w-4" />
            </Button>
            <Button as="a" href="#how-it-works" variant="ghost" size="lg">
              See how it works
            </Button>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            No credit card required. Free compute plans cover web services,
            Postgres, and Key Value.
          </p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-gray-200 py-7 sm:flex sm:flex-wrap sm:gap-10 dark:border-gray-800">
          {[
            ['7M+', 'Builders on Render'],
            ['Per-second', 'Compute proration'],
            ['5 GB', 'Bandwidth included monthly'],
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
            Why TanStack teams choose Render
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Render keeps the whole application, not just the frontend, on one
            platform. Here's what makes it the right fit for TanStack
            developers.
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
            Create a Render-ready app
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            The TanStack CLI adds the Nitro setup, the Node start script, and a
            render.yaml Blueprint while it creates your app.
          </p>

          <div className="mt-6">
            <RenderCodeExample
              code={RENDER_PAGE_MODEL.create.command}
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
              href={RENDER_BLUEPRINT_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackRenderClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Deploy on Render
              <ArrowUpRightIcon className="h-4 w-4" />
            </Button>
            <Button
              as={Link}
              to={TANSTACK_START_RENDER_DOCS_PATH}
              hash={TANSTACK_START_RENDER_DOCS_HASH}
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
            Add Render to an existing app
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Follow the TanStack Start hosting guide to install Nitro, configure
            Vite, add the Node start script, and commit the render.yaml
            Blueprint Render reads.
          </p>

          <div className="mt-5">
            <Button
              as={Link}
              to={TANSTACK_START_RENDER_DOCS_PATH}
              hash={TANSTACK_START_RENDER_DOCS_HASH}
              onClick={trackTanStackDocsClick}
              variant="ghost"
            >
              Open the Render hosting guide
            </Button>
          </div>
        </section>

        {/* Pricing */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Pricing that scales with you
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Render charges a flat workspace plan plus compute for each service,
            prorated to the second. Free compute plans cover web services,
            Postgres, and Key Value while you are still building.
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
              href={RENDER_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackRenderClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Start on the free plan
              <ArrowUpRightIcon className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={RENDER_PRICING_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackRenderClick}
              variant="ghost"
            >
              See compute pricing
            </Button>
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            What teams say after switching
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Real teams, real migrations. These are quotes from engineers who
            moved their production workloads onto Render.
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
              href={RENDER_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackRenderClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Move your app to Render
              <ArrowUpRightIcon className="h-4 w-4" />
            </Button>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <CurrencyDollarIcon className="h-3.5 w-3.5" />
              Compute prorated by the second, no credit card required
            </span>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Frequently asked questions
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Common questions from TanStack developers evaluating Render.
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
            Up to $10K in migration credits
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-white md:text-3xl">
            Ready to ship TanStack with zero ops?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">
            No credit card required to start. Free compute plans cover web
            services, Postgres, and Key Value while you build.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Moving production infrastructure? Render offers migration credits of
            up to $10K.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              as="a"
              href={RENDER_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackRenderClick}
              size="lg"
              className="bg-white text-gray-950 border-white hover:bg-gray-100"
            >
              Deploy your TanStack app
              <ArrowUpRightIcon className="h-4 w-4" />
            </Button>
            <Button
              as={Link}
              to={TANSTACK_START_RENDER_DOCS_PATH}
              hash={TANSTACK_START_RENDER_DOCS_HASH}
              onClick={trackTanStackDocsClick}
              size="lg"
              className="bg-transparent text-white border-gray-700 hover:bg-white/5"
            >
              Open the docs
            </Button>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          {RENDER_PARTNER.status === 'active'
            ? `${RENDER_PARTNER.name} is a ${RENDER_TIER_LABEL} TanStack partner. `
            : `${RENDER_PARTNER.name} is a previous TanStack partner. `}
          <Link
            to="/partners"
            className="underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Browse all TanStack partners
          </Link>
          .{' '}
          <a
            href={RENDER_HOME_HREF}
            target="_blank"
            rel="noreferrer"
            onClick={trackRenderClick}
            className="underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
          >
            render.com
          </a>
        </p>
      </div>
    </div>
  )
}
