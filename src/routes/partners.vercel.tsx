import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowUUpLeftIcon,
  ArrowUpRightIcon,
  ChartLineIcon,
  CheckIcon,
  CpuIcon,
  GitPullRequestIcon,
  GlobeIcon,
  LightningIcon,
  PlusIcon,
  RocketIcon,
  ShieldCheckIcon,
  SparkleIcon,
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
import { getVercelPartnerPageModel } from '~/utils/vercel-partner'
import { SITE_URL } from '~/utils/site'
import defaultOgImage from '~/images/og.png'

const VERCEL_PAGE_MODEL = getVercelPartnerPageModel()
const {
  docsHash: TANSTACK_START_VERCEL_DOCS_HASH,
  docsResource: VERCEL_DOCS_RESOURCE,
  partner: VERCEL_PARTNER,
} = VERCEL_PAGE_MODEL
const VERCEL_HREF =
  'https://vercel.com/new?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'
const VERCEL_START_GUIDE_HREF =
  'https://vercel.com/kb/guide/deploy-a-tanstack-start-app-to-vercel?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'
const TANSTACK_START_VERCEL_DOCS_PATH = VERCEL_DOCS_RESOURCE.href
const VERCEL_CANONICAL_HREF =
  VERCEL_PARTNER.canonicalHref ?? VERCEL_PARTNER.href
const vercelHomeUrl = new URL(VERCEL_CANONICAL_HREF)
vercelHomeUrl.search = new URL(VERCEL_HREF).search
const VERCEL_HOME_HREF = vercelHomeUrl.toString()
const vercelPricingUrl = new URL('/pricing', VERCEL_CANONICAL_HREF)
vercelPricingUrl.search = vercelHomeUrl.search
const VERCEL_PRICING_HREF = vercelPricingUrl.toString()
const VERCEL_OG_IMAGE = new URL(defaultOgImage, SITE_URL).toString()
const VERCEL_TIER_LABEL = VERCEL_PARTNER.tier
  ? partnerTierLabels[VERCEL_PARTNER.tier]
  : undefined
const VERCEL_PARTNERSHIP_LABEL =
  VERCEL_PARTNER.status === 'active'
    ? 'Current TanStack partner'
    : 'Previous TanStack partner'
const VERCEL_PARTNER_TITLE_LABEL =
  VERCEL_PARTNER.status === 'active'
    ? `${partnerTierLabels[VERCEL_PARTNER.tier]} TanStack Partner`
    : 'Previous TanStack Partner'
const VERCEL_PARTNER_BADGE_LABEL =
  VERCEL_PARTNER.status === 'active'
    ? `${partnerTierLabels[VERCEL_PARTNER.tier]} Partner`
    : VERCEL_TIER_LABEL
      ? `Previous ${VERCEL_TIER_LABEL} Partner`
      : 'Previous Partner'

type FeatureIcon = React.ComponentType<{ className?: string }>

const features: Array<{ Icon: FeatureIcon; title: string; desc: string }> = [
  {
    Icon: RocketIcon,
    title: 'Zero-config framework detection',
    desc: 'Once Nitro is configured, Vercel detects TanStack Start and supplies the build command and output settings for you.',
  },
  {
    Icon: GitPullRequestIcon,
    title: 'Preview deployments',
    desc: 'Every push gets its own deployment URL, so a branch or pull request can be reviewed running in production-like conditions.',
  },
  {
    Icon: CpuIcon,
    title: 'Fluid compute',
    desc: 'The Nitro Vite plugin compiles your server code into Vercel Functions. They run on Fluid compute by default and scale automatically.',
  },
  {
    Icon: GlobeIcon,
    title: 'Global delivery',
    desc: 'Responses are served from Vercel’s global points of presence, with regions you can configure per project.',
  },
  {
    Icon: ArrowUUpLeftIcon,
    title: 'Instant rollbacks',
    desc: 'Every deployment keeps its own immutable URL. Promote an earlier deployment to production when you need to roll back.',
  },
  {
    Icon: ShieldCheckIcon,
    title: 'Web Application Firewall',
    desc: 'Managed WAF with configurable firewall rules, plus TLS/SSL encryption and HTTPS certificates on every plan.',
  },
  {
    Icon: LightningIcon,
    title: 'Skew Protection',
    desc: 'Clients keep talking to the deployment version they loaded, so in-flight sessions do not break mid-deploy. Included on Pro.',
  },
  {
    Icon: SparkleIcon,
    title: 'AI Gateway and Sandbox',
    desc: 'Route model traffic through AI Gateway and run untrusted or agent-generated code in isolated Sandbox environments.',
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
    title: 'Install the Vercel CLI',
    code: 'npm install -g vercel',
  },
  { num: '03', title: 'Authenticate', code: 'vercel login' },
  { num: '04', title: 'Deploy to production', code: 'vercel --prod' },
]

const NITRO_VITE_CONFIG = `// vite.config.ts
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [tanstackStart(), nitro(), viteReact()],
})`

const VERCEL_JSON = `{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "tanstack-start"
}`

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
    note: 'for personal, non-commercial projects',
    features: [
      '1M edge requests per month',
      '100 GB data transfer per month',
      'Up to 3 firewall rules',
      'HTTPS certificates included',
      'No credit card required',
    ],
  },
  {
    plan: 'Pro',
    price: '$20',
    note: 'per user/month, includes $20 of usage',
    features: [
      '10M edge requests per month',
      '1 TB data transfer per month',
      'Up to 40 firewall rules',
      '1 custom environment',
      'Skew Protection',
    ],
    highlight: true,
  },
  {
    plan: 'Enterprise',
    price: 'Custom',
    note: 'for teams at scale',
    features: [
      'Role-based access control',
      'Audit logs',
      'SAML SSO and Directory Sync',
      'Custom limits on metered services',
      'Platform SLAs and support',
    ],
  },
]

const meteredPricing: Array<[string, string]> = [
  ['Edge requests', '$2.00 / 1M'],
  ['Data transfer', '$0.15 / GB'],
  ['Function invocations', '$0.60 / 1M'],
]

const testimonials: Array<{ quote: string; author: string; role: string }> = [
  {
    quote:
      'We needed a quality product for a quality product. We evaluated other options, but really Vercel was a no-brainer.',
    author: 'Jonathan Lemon',
    role: 'Software Engineering Manager at Sonos',
  },
  {
    quote:
      'We try not to reinvent infrastructure we don’t have to. We’d rather spend that engineering energy on the product.',
    author: 'Sherwin Yu',
    role: 'Head of AI and Product Engineering at Gamma',
  },
  {
    quote:
      'With Vercel, I was able to quickly set up wildcard subdomains for my users and upsell them with custom domains.',
    author: 'Noah Bragg',
    role: 'Founder at Potion.so',
  },
]

const faqs: Array<{ q: string; a: string }> = [
  {
    q: 'Does Vercel support TanStack Start SSR and streaming?',
    a: 'Yes. TanStack Start runs on Vercel through Nitro. Create a Vercel-ready app with the TanStack CLI, or add the Nitro setup from the Start hosting guide to an existing app.',
  },
  {
    q: 'Do I need to configure a build command?',
    a: 'Usually not. Vercel detects TanStack Start and supplies the build command and output settings. If detection fails, add a vercel.json with "framework": "tanstack-start" to make it explicit. The TanStack CLI writes that file for you.',
  },
  {
    q: 'How does Vercel pricing actually work?',
    a: 'Hobby is $0 and covers personal, non-commercial projects with 1M edge requests and 100 GB of data transfer per month. Pro is $20 per user/month and includes $20 of monthly usage credit, with metered rates beyond it. Enterprise is custom.',
  },
  {
    q: 'What makes Vercel different from Railway or Render?',
    a: 'Vercel is strongest when preview workflows, Git-based deployment, global delivery, and serverless compute are central to how the team works. Server code deploys as Vercel Functions on Fluid compute rather than a long-running container you size yourself.',
  },
  {
    q: 'Does every pull request get a preview deployment?',
    a: 'Yes. Connect the project to Git and each push produces its own deployment with a unique URL, so a change can be reviewed running before it is promoted to production.',
  },
  {
    q: 'How do I add environment variables?',
    a: 'Add them under Settings > Environment Variables, or with vercel env add MY_KEY. Do not prefix server secrets with VITE_, since VITE_ values are inlined into browser code.',
  },
  {
    q: 'Can I migrate an existing TanStack app to Vercel?',
    a: 'Yes. Install Nitro, add the nitro() plugin to your Vite config, then import the Git repository in Vercel or run npx vercel. If routes 404 after deploying, confirm nitro() is present in the Vite config and redeploy.',
  },
]

const PAGE_TITLE = `Deploy TanStack to ${VERCEL_PARTNER.name} | ${VERCEL_PARTNER_TITLE_LABEL}`
const PAGE_DESCRIPTION =
  'Vercel runs TanStack Start through Nitro, with zero-config framework detection, a preview deployment for every push, Vercel Functions on Fluid compute, and global delivery. Hobby is free and Pro is $20 per user/month.'

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

export const Route = createFileRoute('/partners/vercel')({
  head: () => ({
    meta: seo({
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      keywords: `deploy tanstack to vercel, tanstack start vercel, tanstack router vercel, vercel hosting, tanstack deployment, vercel tanstack partner`,
      image: VERCEL_OG_IMAGE,
    }),
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(getPartnerJsonLd(VERCEL_PARTNER)),
      },
      {
        type: 'application/ld+json',
        children: JSON.stringify(getFaqJsonLd()),
      },
    ],
  }),
  component: VercelPartnerPage,
})

function CheckBadge() {
  return (
    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
      <CheckIcon className="h-2.5 w-2.5" weight="bold" />
    </span>
  )
}

function trackVercelClick() {
  trackEvent('partner_clicked', {
    partner_id: VERCEL_PARTNER.id,
    placement: 'detail',
    destination: 'external',
    destination_host: new URL(VERCEL_CANONICAL_HREF).host,
    partner_tier: VERCEL_PARTNER.tier,
  })
}

function trackTanStackDocsClick() {
  trackEvent('partner_clicked', {
    partner_id: VERCEL_PARTNER.id,
    placement: 'detail',
    destination: 'internal_resource',
    partner_tier: VERCEL_PARTNER.tier,
  })
}

function VercelCodeExample({
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

function VercelPartnerPage() {
  const [openFaq, setOpenFaq] = React.useState<number | null>(null)

  React.useEffect(() => {
    trackEvent('partner_viewed', {
      partner_id: VERCEL_PARTNER.id,
      placement: 'detail',
      partner_tier: VERCEL_PARTNER.tier,
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
            {VERCEL_PARTNER.name}
          </span>
        </nav>

        {/* Hero */}
        <section className="border-b border-gray-200 pb-10 pt-10 dark:border-gray-800">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-12 w-44 items-center justify-start">
              <PartnerImage
                config={VERCEL_PARTNER.image}
                alt={VERCEL_PARTNER.name}
                className="max-h-10 w-auto"
              />
            </div>
            <div>
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                {VERCEL_PARTNER_BADGE_LABEL} ·{' '}
                {partnerCategoryLabels[VERCEL_PARTNER.category]}
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    VERCEL_PARTNER.status === 'active'
                      ? 'bg-emerald-500'
                      : 'bg-gray-400'
                  }`}
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {VERCEL_PARTNERSHIP_LABEL}
                </span>
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-gray-950 dark:text-white md:text-5xl">
            Ship TanStack apps
            <br />
            on agentic infrastructure
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg">
            Vercel builds, deploys, and runs TanStack Start apps through Nitro.
            Push to Git and every change gets its own preview deployment, while
            server code runs as Vercel Functions on Fluid compute.
          </p>

          <p className="mt-3 max-w-xl text-sm italic leading-relaxed text-gray-500 dark:text-gray-400">
            "Vercel has just completely scaled with that usage. We've never had
            it fall over due to capacity or had to provision anything extra." -
            Andy Yoon, Lead Frontend Engineer at OpenEvidence
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              as="a"
              href={VERCEL_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackVercelClick}
              size="lg"
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Start free on Vercel
              <ArrowUpRightIcon className="h-4 w-4" />
            </Button>
            <Button as="a" href="#how-it-works" variant="ghost" size="lg">
              See how it works
            </Button>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            No credit card required. Hobby is free for personal, non-commercial
            projects.
          </p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-gray-200 py-7 sm:flex sm:flex-wrap sm:gap-10 dark:border-gray-800">
          {[
            ['Zero-config', 'TanStack Start detection'],
            ['Every push', 'Preview deployment'],
            ['Fluid compute', 'Default for functions'],
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
            Why TanStack teams choose Vercel
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Vercel is strongest when preview workflows, Git-based deployment,
            global delivery, and serverless compute are central to how your team
            ships.
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
            Create a Vercel-ready app
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            The TanStack CLI adds the Vercel deployment setup while it creates
            your app, including the <code>vercel.json</code> that makes
            framework detection explicit.
          </p>

          <div className="mt-6">
            <VercelCodeExample
              code={VERCEL_PAGE_MODEL.create.command}
              lang="bash"
              title="terminal"
            />
          </div>

          <h3 className="mt-8 text-lg font-bold">Deploy the app</h3>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            Import the Git repository in Vercel to deploy on every push, or ship
            it from the CLI.
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

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as="a"
              href={VERCEL_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackVercelClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Deploy on Vercel
              <ArrowUpRightIcon className="h-4 w-4" />
            </Button>
            <Button
              as={Link}
              to={TANSTACK_START_VERCEL_DOCS_PATH}
              hash={TANSTACK_START_VERCEL_DOCS_HASH}
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
            Add Vercel to an existing app
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Install Nitro and register its Vite plugin. Nitro compiles your
            server code into output that Vercel deploys as Vercel Functions.
          </p>

          <div className="mt-6">
            <VercelCodeExample
              code={NITRO_VITE_CONFIG}
              lang="ts"
              title="vite.config.ts"
            />
          </div>

          <p className="mt-6 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            If framework detection does not pick up TanStack Start, set it
            explicitly:
          </p>

          <div className="mt-4">
            <VercelCodeExample
              code={VERCEL_JSON}
              lang="json"
              title="vercel.json"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as={Link}
              to={TANSTACK_START_VERCEL_DOCS_PATH}
              hash={TANSTACK_START_VERCEL_DOCS_HASH}
              onClick={trackTanStackDocsClick}
              variant="ghost"
            >
              Open the Vercel hosting guide
            </Button>
            <Button
              as="a"
              href={VERCEL_START_GUIDE_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackVercelClick}
              variant="ghost"
            >
              Vercel's TanStack Start guide
              <ArrowUpRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </section>

        {/* Pricing */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Pricing that scales with you
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Hobby is free for personal, non-commercial projects. Pro is $20 per
            user/month and includes $20 of monthly usage credit, with metered
            rates beyond it.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Pro overage rates. See Vercel's pricing page for the full list of
            metered services.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as="a"
              href={VERCEL_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackVercelClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Start on the free plan
              <ArrowUpRightIcon className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={VERCEL_PRICING_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackVercelClick}
              variant="ghost"
            >
              Compare plans
            </Button>
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            What teams say about shipping on Vercel
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Quotes from engineers and founders running production workloads on
            Vercel.
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
              href={VERCEL_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackVercelClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Move your app to Vercel
              <ArrowUpRightIcon className="h-4 w-4" />
            </Button>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <ChartLineIcon className="h-3.5 w-3.5" />
              Deploy from Git, no credit card required
            </span>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Frequently asked questions
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Common questions from TanStack developers evaluating Vercel.
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
            TanStack Start runs on Vercel through Nitro
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-white md:text-3xl">
            Ready to ship your TanStack app?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">
            Import a Git repository and Vercel handles the build, the preview
            deployments, and the production rollout.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Hobby is free for personal, non-commercial projects.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              as="a"
              href={VERCEL_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackVercelClick}
              size="lg"
              className="bg-white text-gray-950 border-white hover:bg-gray-100"
            >
              Deploy your TanStack app
              <ArrowUpRightIcon className="h-4 w-4" />
            </Button>
            <Button
              as={Link}
              to={TANSTACK_START_VERCEL_DOCS_PATH}
              hash={TANSTACK_START_VERCEL_DOCS_HASH}
              onClick={trackTanStackDocsClick}
              size="lg"
              className="bg-transparent text-white border-gray-700 hover:bg-white/5"
            >
              Open the docs
            </Button>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          {VERCEL_PARTNER.status === 'active'
            ? `${VERCEL_PARTNER.name} is a ${VERCEL_TIER_LABEL} TanStack partner. `
            : `${VERCEL_PARTNER.name} is a previous TanStack partner. `}
          <Link
            to="/partners"
            className="underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Browse all TanStack partners
          </Link>
          .{' '}
          <a
            href={VERCEL_HOME_HREF}
            target="_blank"
            rel="noreferrer"
            onClick={trackVercelClick}
            className="underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
          >
            vercel.com
          </a>
        </p>
      </div>
    </div>
  )
}
