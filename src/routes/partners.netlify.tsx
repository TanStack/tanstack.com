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
  Plus,
  Rocket,
  ShieldCheck,
  Undo2,
  Zap,
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

const NETLIFY_HREF =
  'https://app.netlify.com/signup?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'
const NETLIFY_DOCS_HREF =
  'https://docs.netlify.com/build/frameworks/framework-setup-guides/tanstack-start/?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'
const NETLIFY_HOME_HREF =
  'https://www.netlify.com/?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'
const NETLIFY_PRICING_HREF =
  'https://www.netlify.com/pricing/?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'

const CONFIG_SNIPPET = `import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'

export default defineConfig({
  plugins: [tanstackStart(), netlify()],
})
`

const DEPLOY_SNIPPET = `# From your TanStack Start app directory
npm install -g netlify-cli
netlify deploy
`

type FeatureIcon = React.ComponentType<{ className?: string }>

const features: Array<{ Icon: FeatureIcon; title: string; desc: string }> = [
  {
    Icon: Rocket,
    title: 'Zero-config builds',
    desc: 'The Netlify Vite plugin detects and configures your TanStack Start build. Add netlify() to your Vite plugins and push — no deploy config to write.',
  },
  {
    Icon: GitPullRequest,
    title: 'Unlimited Deploy Previews',
    desc: 'Every pull request gets its own live preview URL, on every plan. Test routing, data, and server logic before you merge.',
  },
  {
    Icon: Zap,
    title: 'Functions & Edge Functions',
    desc: 'TanStack Start SSR and server functions run on Netlify Functions and Edge Functions. No servers to provision or manage.',
  },
  {
    Icon: Globe,
    title: 'Global edge network',
    desc: 'Assets and functions run on Netlify’s worldwide edge, close to your users, with automatic caching and instant invalidation.',
  },
  {
    Icon: Undo2,
    title: 'Instant rollbacks',
    desc: 'Every deploy is atomic and immutable. Roll back to any previous deploy in one click when something breaks.',
  },
  {
    Icon: LineChart,
    title: 'Logs, analytics & monitoring',
    desc: 'Real-time function logs, deploy insights, and analytics are built in — no third-party agent to wire up.',
  },
  {
    Icon: ShieldCheck,
    title: 'Secure by default',
    desc: 'Automatic HTTPS, managed SSL, and smart secret detection run on every deploy so nothing ships that shouldn’t.',
  },
  {
    Icon: InfinityIcon,
    title: 'Branch deploys',
    desc: 'Ship every branch to its own URL. Unlimited staging and preview environments for the whole team.',
  },
]

const steps: Array<{ num: string; title: string; code: string }> = [
  {
    num: '01',
    title: 'Create your TanStack app',
    code: 'npx create-tsrouter-app@latest my-app',
  },
  {
    num: '02',
    title: 'Install the Netlify plugin',
    code: 'npm i -D @netlify/vite-plugin-tanstack-start',
  },
  { num: '03', title: 'Add it to Vite', code: 'netlify()' },
  { num: '04', title: 'Deploy', code: 'netlify deploy' },
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
    note: '300 credits / month',
    features: [
      'Unlimited Deploy Previews',
      'Functions & AI model access',
      'Custom domains with SSL',
      'No credit card required',
    ],
  },
  {
    plan: 'Personal',
    price: '$9',
    note: 'per month · 1,000 credits',
    features: [
      'Everything in Free',
      'Smart secret detection',
      '1-day observability',
      'Priority email support',
    ],
  },
  {
    plan: 'Pro',
    price: '$20',
    note: 'per month · 3,000 credits',
    features: [
      'Everything in Personal',
      'Unlimited team members',
      'Private org repositories',
      'Shared environment variables',
      '30-day analytics & metrics',
    ],
    highlight: true,
  },
  {
    plan: 'Enterprise',
    price: 'Custom',
    note: 'for teams at scale',
    features: [
      'Everything in Pro',
      '99.99% uptime SLA',
      'SSO + SCIM',
      'High-performance builds',
      '24/7 dedicated support',
    ],
  },
]

const platformFacts: Array<[string, string]> = [
  ['Deploy Previews', 'Unlimited, every plan'],
  ['SSL & custom domains', 'Included free'],
  ['Global edge', 'Worldwide CDN'],
]

const testimonials: Array<{ quote: string; author: string; role: string }> = [
  {
    quote:
      'Netlify empowers our engineering teams to launch websites and campaigns in minutes with no-ops, a goal that has often been a pipe dream in our industry.',
    author: 'Justin Watts',
    role: 'Head of Engineering, TunnelBear',
  },
  {
    quote:
      'Collaborative Deploy Previews are an excellent feature from Netlify. Designers give us feedback by annotating screenshots — and that ends up right in the pull request.',
    author: 'Twilio',
    role: 'Deploy Previews in production',
  },
  {
    quote:
      'As we’ve moved to a modern Jamstack approach utilizing Netlify we’ve seen impressive improvements in site performance and conversion rate, while also increasing our engineering velocity.',
    author: 'Spring',
    role: 'Ecommerce on Netlify',
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
    desc: 'SSR, streaming, and server functions run on Netlify Functions and Edge Functions. The Netlify Vite plugin wires the build and emulates the production platform locally.',
  },
  {
    label: 'TanStack Router',
    desc: 'File-based routing apps deploy in SSR and SPA modes. Every PR gets a Deploy Preview, so route changes are testable before they merge.',
  },
  {
    label: 'TanStack Query',
    desc: 'Fetch from Netlify Functions or Edge Functions on the same platform. Server data stays fast and close to your app.',
  },
  {
    label: 'TanStack DB',
    desc: 'Pair with Netlify’s managed data and blob storage, or your own backend, all served from Netlify’s global edge.',
  },
]

const faqs: Array<{ q: string; a: string }> = [
  {
    q: 'Does Netlify support TanStack Start SSR and streaming?',
    a: 'Yes. TanStack Start’s SSR, streaming, and server functions run on Netlify Functions and Edge Functions. Add the @netlify/vite-plugin-tanstack-start plugin to your Vite config and deploy — the plugin also emulates the production platform in local dev.',
  },
  {
    q: 'How do I deploy a TanStack Start app to Netlify?',
    a: 'Install @netlify/vite-plugin-tanstack-start, add netlify() to your Vite plugins, then connect the repo on Netlify or run `netlify deploy` with netlify-cli 17.31 or higher. Netlify auto-detects the build — no extra deploy config needed.',
  },
  {
    q: 'Are Deploy Previews included?',
    a: 'Yes — every pull request automatically gets its own live Deploy Preview URL on all plans, including Free. For TanStack teams that means you can test routing changes, data fetching, and server logic before merging.',
  },
  {
    q: 'How does Netlify pricing actually work?',
    a: 'Netlify uses a usage-based credit model. The Free plan includes 300 credits per month with no credit card. Personal is $9/month (1,000 credits), Pro is $20/month (3,000 credits) with unlimited team members, and Enterprise is custom. Most hobby TanStack projects fit comfortably in the Free plan.',
  },
  {
    q: 'What makes Netlify different from other hosts?',
    a: 'Netlify is the official deployment partner for TanStack Start. It pairs a global edge network with Functions and Edge Functions, unlimited Deploy Previews, atomic immutable deploys with one-click rollback, and full local emulation of the production platform through the Vite plugin.',
  },
  {
    q: 'Can I migrate an existing TanStack app to Netlify?',
    a: 'Yes. Connect your GitHub repo, add the Netlify Vite plugin, and Netlify builds and deploys on every push. Make sure you are on netlify-cli 17.31 or higher when using the TanStack Start plugin.',
  },
]

const PAGE_TITLE = 'Deploy TanStack to Netlify — Official Gold Partner'
const PAGE_DESCRIPTION =
  'Netlify is the official deployment partner for TanStack Start. Deploy from Git with zero config, unlimited Deploy Previews, Functions and Edge Functions, a global edge network, and instant rollbacks. Start free — no credit card required.'

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

export const Route = createFileRoute('/partners/netlify')({
  head: () => {
    const partner = getPartnerById('netlify')

    return {
      meta: seo({
        title: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        keywords:
          'deploy tanstack to netlify, tanstack start netlify, tanstack router netlify, netlify hosting, tanstack deployment, netlify gold sponsor',
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
  component: NetlifyPartnerPage,
})

function CheckBadge() {
  return (
    <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
      <Check className="h-2.5 w-2.5" strokeWidth={3} />
    </span>
  )
}

function trackNetlifyClick() {
  trackEvent('partner_clicked', {
    partner_id: 'netlify',
    placement: 'detail',
    destination: 'external',
    destination_host: 'netlify.com',
  })
}

function NetlifyCodeExample({
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

function NetlifyPartnerPage() {
  const [openFaq, setOpenFaq] = React.useState<number | null>(null)

  React.useEffect(() => {
    trackEvent('partner_viewed', {
      partner_id: 'netlify',
      placement: 'detail',
    })
  }, [])

  const partner = getPartnerById('netlify')

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
          <span className="text-gray-900 dark:text-white">Netlify</span>
        </nav>

        {/* Hero */}
        <section className="border-b border-gray-200 pb-10 pt-10 dark:border-gray-800">
          <div className="mb-5 flex items-center gap-4">
            {partner ? (
              <div className="flex h-12 w-44 items-center justify-start">
                <PartnerImage
                  config={partner.image}
                  alt="Netlify"
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
                  Official TanStack Start deployment partner
                </span>
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-gray-950 dark:text-white md:text-5xl">
            Deploy TanStack apps
            <br />
            in seconds with Netlify
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg">
            Netlify is the official deployment partner for TanStack Start. Push
            to Git and Netlify builds, deploys, and serves your app from a
            global edge network — with Functions, Deploy Previews, and instant
            rollbacks built in.
          </p>

          <p className="mt-3 max-w-xl text-sm italic leading-relaxed text-gray-500 dark:text-gray-400">
            "Netlify’s focus on speed, simplicity, and flexibility aligns
            perfectly with our vision for full-stack development." — Tanner
            Linsley, Creator of TanStack
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              as="a"
              href={NETLIFY_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackNetlifyClick}
              size="lg"
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Deploy free in seconds
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button as="a" href="#how-it-works" variant="ghost" size="lg">
              See how it works
            </Button>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            No credit card required. Free plan includes 300 credits per month.
          </p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-gray-200 py-7 sm:flex sm:flex-wrap sm:gap-10 dark:border-gray-800">
          {[
            ['Official', 'TanStack Start partner'],
            ['< 1 min', 'Time to first deploy'],
            ['Unlimited', 'Deploy Previews'],
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
            Why TanStack teams choose Netlify
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Netlify eliminates deployment friction so your team ships faster.
            Here's what makes it the right fit for TanStack developers.
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
            From zero to deployed in 4 steps
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Netlify runs TanStack Start through its official Vite plugin. Add it
            to your Vite config, then deploy from GitHub or the Netlify CLI.
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
            <NetlifyCodeExample
              code={CONFIG_SNIPPET}
              lang="ts"
              title="vite.config.ts"
            />
            <NetlifyCodeExample
              code={DEPLOY_SNIPPET}
              lang="bash"
              title="terminal"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as="a"
              href={NETLIFY_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackNetlifyClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Deploy on Netlify
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={NETLIFY_DOCS_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackNetlifyClick}
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
            using Router and Query — Netlify deploys them all.
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
            Netlify uses a usage-based credit model — you pay for what you build
            and serve. Most TanStack hobby projects run free on 300 credits a
            month.
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
            {platformFacts.map(([key, value]) => (
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
              href={NETLIFY_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackNetlifyClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Start free with 300 credits
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={NETLIFY_PRICING_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackNetlifyClick}
              variant="ghost"
            >
              Compare plans
            </Button>
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Teams ship faster on Netlify
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Real results from teams who moved their production workloads onto
            Netlify’s platform.
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
              href={NETLIFY_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackNetlifyClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Move your app to Netlify
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <DollarSign className="h-3.5 w-3.5" />
              Free plan · no credit card required
            </span>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Frequently asked questions
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Common questions from TanStack developers evaluating Netlify.
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
            Official TanStack Start deployment partner
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-white md:text-3xl">
            Ready to ship TanStack on Netlify?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">
            No credit card required. Push to Git and go live from a global edge
            network in seconds.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Deploy Previews, Functions, and instant rollbacks on every plan.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              as="a"
              href={NETLIFY_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackNetlifyClick}
              size="lg"
              className="bg-white text-gray-950 border-white hover:bg-gray-100"
            >
              Deploy your TanStack app
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={NETLIFY_DOCS_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackNetlifyClick}
              size="lg"
              className="bg-transparent text-white border-gray-700 hover:bg-white/5"
            >
              Open the docs
            </Button>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          Netlify is a Gold-tier TanStack sponsor.{' '}
          <Link
            to="/partners"
            className="underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Browse all TanStack partners
          </Link>
          .{' '}
          <a
            href={NETLIFY_HOME_HREF}
            target="_blank"
            rel="noreferrer"
            onClick={trackNetlifyClick}
            className="underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
          >
            netlify.com
          </a>
        </p>
      </div>

      <Footer />
    </div>
  )
}
