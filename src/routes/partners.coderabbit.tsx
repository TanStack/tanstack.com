import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Brain,
  Check,
  Code2,
  GitPullRequest,
  ListChecks,
  Plus,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wand2,
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

const CODERABBIT_HREF =
  'https://coderabbit.link/tanstack?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page&via=tanstack'
const CODERABBIT_DOCS_HREF =
  'https://docs.coderabbit.ai/?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'
const CODERABBIT_HOME_HREF =
  'https://www.coderabbit.ai/?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'
const CODERABBIT_PRICING_HREF =
  'https://www.coderabbit.ai/pricing?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'
const CODERABBIT_IDE_HREF =
  'https://www.coderabbit.ai/ide?utm_medium=sponsor&utm_source=tanstack&utm_campaign=partner-page'

const CONFIG_SNIPPET = `# .coderabbit.yaml
language: en
reviews:
  profile: chill
  high_level_summary: true
  auto_review:
    enabled: true
    drafts: false
  path_instructions:
    - path: "src/**/*.tsx"
      instructions: "Flag unstable references passed to TanStack hooks."
`

const COMMANDS_SNIPPET = `# Chat with CodeRabbit in any pull request comment
@coderabbitai review
@coderabbitai generate unit tests
@coderabbitai resolve
`

type FeatureIcon = React.ComponentType<{ className?: string }>

const features: Array<{ Icon: FeatureIcon; title: string; desc: string }> = [
  {
    Icon: GitPullRequest,
    title: 'Line-by-line PR reviews',
    desc: 'Every pull request gets context-aware, file-by-file feedback within minutes — not just a linter dump, but real reasoning about your changes.',
  },
  {
    Icon: Code2,
    title: 'Free reviews in your IDE',
    desc: 'The VS Code, Cursor, and Windsurf extension reviews committed and uncommitted changes in your editor — no subscription required.',
  },
  {
    Icon: Wand2,
    title: 'One-click fixes',
    desc: 'Turn a review comment into a committed change with a "Fix with AI" button, or hand it to Copilot, Claude Code, or Cline.',
  },
  {
    Icon: Brain,
    title: 'Learns from your team',
    desc: 'Teach CodeRabbit in plain English. It remembers your conventions across repos so the same nit never comes back twice.',
  },
  {
    Icon: ShieldCheck,
    title: '40+ linters & SAST built in',
    desc: 'CodeRabbit runs ast-grep, Semgrep, and dozens of scanners for you, then explains findings in the context of the diff.',
  },
  {
    Icon: ScrollText,
    title: 'Summaries & diagrams',
    desc: 'A TL;DR walkthrough and sequence diagrams for every PR make big TanStack changes reviewable at a glance.',
  },
  {
    Icon: ListChecks,
    title: 'Custom pre-merge checks',
    desc: 'Describe the standards a PR must meet in natural language, and gate merges on them — no rules engine to maintain.',
  },
  {
    Icon: Terminal,
    title: 'CLI for CI/CD',
    desc: 'Run the same review from the command line with agent-optimized output, so automated checks run before anything merges.',
  },
]

const steps: Array<{ num: string; title: string; code: string }> = [
  {
    num: '01',
    title: 'Install the GitHub App',
    code: 'github.com/apps/coderabbitai',
  },
  {
    num: '02',
    title: 'Choose which repos it reviews',
    code: 'app.coderabbit.ai/settings',
  },
  { num: '03', title: 'Open a pull request', code: '@coderabbitai review' },
  { num: '04', title: 'Tune the rules (optional)', code: '.coderabbit.yaml' },
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
    note: 'per user · no credit card',
    features: [
      'Unlimited public & private repos',
      'PR summaries & IDE reviews',
      '14-day Pro Plus trial',
      'Free forever in VS Code',
    ],
  },
  {
    plan: 'Pro',
    price: '$24',
    note: 'per user / mo · billed annually',
    features: [
      'Full line-by-line PR reviews',
      '40+ linters & SAST',
      'Jira & Linear integrations',
      'Agentic chat & analytics',
      '5 PR reviews / dev / hour',
    ],
    highlight: true,
  },
  {
    plan: 'Pro Plus',
    price: '$48',
    note: 'per user / mo · billed annually',
    features: [
      'Everything in Pro',
      'Custom pre-merge checks',
      'Finishing touches & issue planner',
      'Higher rate & MCP limits',
    ],
  },
  {
    plan: 'Enterprise',
    price: 'Custom',
    note: 'for teams at scale',
    features: [
      'SSO, RBAC & audit logs',
      'Self-hosting & API access',
      'EU SaaS deployment',
      'SLA + dedicated CSM',
    ],
  },
]

const extras: Array<[string, string]> = [
  ['Free in your IDE', 'VS Code · Cursor · Windsurf'],
  ['Reviews on', 'GitHub · GitLab · Azure · Bitbucket'],
  ['Time to first review', 'Under 2 minutes'],
]

const testimonials: Array<{ quote: string; author: string; role: string }> = [
  {
    quote: "We're using CodeRabbit all over NVIDIA.",
    author: 'Jensen Huang',
    role: 'Founder & CEO at NVIDIA',
  },
  {
    quote:
      'Since adopting CodeRabbit, our confidence is up and our bugs are down; it catches edge cases humans skim past.',
    author: 'Brandon Romano',
    role: 'Sr. Staff Software Engineer at Clerk',
  },
  {
    quote:
      'Before CodeRabbit, quality depended on who reviewed your PR. Now, the bar is the same for everyone.',
    author: 'Abhi Aiyer',
    role: 'CTO at Mastra',
  },
  {
    quote:
      'The bottleneck was always code review. CodeRabbit solves that one problem.',
    author: 'Kiran Kanagasekar',
    role: 'Sr. Engineering Manager at TaskRabbit',
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
    desc: 'Reviews server functions, route loaders, and SSR logic in the PR — the seams where full-stack bugs actually hide.',
  },
  {
    label: 'TanStack Router',
    desc: 'Catches unstable route options, missing loader deps, and search-param mistakes before they ship to a preview.',
  },
  {
    label: 'TanStack Query',
    desc: 'Flags fragile query keys, missing invalidations, and effect-vs-query anti-patterns that are easy to miss in review.',
  },
  {
    label: 'TanStack Table & Form',
    desc: 'Reasons about the heavy generics these libraries lean on, so type regressions get caught at review time.',
  },
]

const faqs: Array<{ q: string; a: string }> = [
  {
    q: 'Do I need to add CodeRabbit code to my TanStack app?',
    a: 'No. CodeRabbit is a GitHub App, not an SDK — you install it on your repositories and it reviews pull requests externally. There is no runtime code to add. An optional .coderabbit.yaml file at the root of your repo lets you tune review behavior and add path-specific instructions.',
  },
  {
    q: 'Which platforms and editors does CodeRabbit support?',
    a: 'CodeRabbit reviews pull requests on GitHub, GitLab, Azure DevOps, and Bitbucket. It also ships a free extension for VS Code, Cursor, and Windsurf, plus a CLI you can run locally or in CI/CD pipelines.',
  },
  {
    q: 'Is there a free option?',
    a: 'Yes. The Free plan covers unlimited public and private repositories with PR summaries and IDE reviews, and every account starts with a 14-day Pro Plus trial — no credit card required. AI code reviews in VS Code, Cursor, and Windsurf are free to use.',
  },
  {
    q: 'How much does CodeRabbit cost?',
    a: 'Free is $0 per user. Pro is $24 per user per month billed annually and adds full PR reviews, 40+ linters and SAST tools, and integrations. Pro Plus is $48 per user per month and adds custom pre-merge checks and higher limits. Enterprise is custom and adds SSO, self-hosting, and API access.',
  },
  {
    q: 'Can CodeRabbit understand TanStack-specific patterns?',
    a: 'Yes. Reviews are context-aware across your whole diff, and CodeRabbit learns from your feedback in plain English so it remembers your conventions. You can also add path_instructions in .coderabbit.yaml to give it TanStack-specific guidance, such as flagging unstable references passed to Router or Query hooks.',
  },
  {
    q: 'How is this different from GitHub Copilot or a plain linter?',
    a: "CodeRabbit reviews the whole change with reasoning, not just the line under your cursor. It runs 40+ scanners for you, explains findings in context, offers one-click fixes, learns your standards, and gates merges on custom checks. As one CTO put it, the differentiator isn't generating code — it's governing it.",
  },
]

const PAGE_TITLE = 'CodeRabbit for TanStack — AI Code Review, Gold Partner'
const PAGE_DESCRIPTION =
  'CodeRabbit gives TanStack teams AI code review on every pull request, in the IDE, and in the CLI. Line-by-line reviews, 40+ built-in linters and SAST tools, one-click fixes, and custom pre-merge checks — installed as a GitHub App with no runtime code to add. Free in VS Code, Cursor, and Windsurf.'

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

export const Route = createFileRoute('/partners/coderabbit')({
  head: () => {
    const partner = getPartnerById('coderabbit')

    return {
      meta: seo({
        title: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        keywords:
          'coderabbit tanstack, ai code review, coderabbit pricing, tanstack pull request review, coderabbit github app, coderabbit gold sponsor',
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
  component: CodeRabbitPartnerPage,
})

function CheckBadge() {
  return (
    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
      <Check className="h-2.5 w-2.5" strokeWidth={3} />
    </span>
  )
}

function trackCodeRabbitClick() {
  trackEvent('partner_clicked', {
    partner_id: 'coderabbit',
    placement: 'detail',
    destination: 'external',
    destination_host: 'coderabbit.ai',
  })
}

function CodeRabbitCodeExample({
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

function CodeRabbitPartnerPage() {
  const [openFaq, setOpenFaq] = React.useState<number | null>(null)

  React.useEffect(() => {
    trackEvent('partner_viewed', {
      partner_id: 'coderabbit',
      placement: 'detail',
    })
  }, [])

  const partner = getPartnerById('coderabbit')

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-6 md:px-8">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/partners" className="transition-colors hover:text-blue-500">
            Partners
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-white">CodeRabbit</span>
        </nav>

        {/* Hero */}
        <section className="border-b border-gray-200 pb-10 pt-10 dark:border-gray-800">
          <div className="mb-5 flex items-center gap-4">
            {partner ? (
              <div className="flex h-12 w-44 items-center justify-start">
                <PartnerImage
                  config={partner.image}
                  alt="CodeRabbit"
                  className="max-h-10 w-auto"
                />
              </div>
            ) : null}
            <div>
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                Gold Sponsor · AI Code Review
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Most installed AI app on GitHub
                </span>
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-gray-950 dark:text-white md:text-5xl">
            Cut TanStack code review
            <br />
            time and bugs in half
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg">
            CodeRabbit gives TanStack teams AI code review on every pull request
            — line-by-line feedback, 40+ built-in scanners, and one-click fixes.
            It installs as a GitHub App, so there is no code to add to your app.
          </p>

          <p className="mt-3 max-w-xl text-sm italic leading-relaxed text-gray-500 dark:text-gray-400">
            "The bottleneck was always code review. CodeRabbit solves that one
            problem." — Kiran Kanagasekar, Sr. Engineering Manager at TaskRabbit
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              as="a"
              href={CODERABBIT_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackCodeRabbitClick}
              size="lg"
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Start reviewing free
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button as="a" href="#how-it-works" variant="ghost" size="lg">
              See how it works
            </Button>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            No credit card required. 14-day Pro Plus trial on every account.
          </p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-gray-200 py-7 sm:flex sm:flex-wrap sm:gap-10 dark:border-gray-800">
          {[
            ['6M+', 'Repositories reviewed'],
            ['75M+', 'Defects caught'],
            ['15,000+', 'Customers'],
            ['$0', 'Reviews in your IDE'],
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
            Why TanStack teams choose CodeRabbit
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            CodeRabbit shortens review cycles without lowering the bar. Here's
            what makes it the right fit for TanStack developers.
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
            From install to first review in 4 steps
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            CodeRabbit runs as a GitHub App on top of your repos. Install it,
            pick your repositories, and open a PR — no runtime code required.
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
            <CodeRabbitCodeExample
              code={CONFIG_SNIPPET}
              lang="yaml"
              title=".coderabbit.yaml"
            />
            <CodeRabbitCodeExample
              code={COMMANDS_SNIPPET}
              lang="bash"
              title="pull request"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as="a"
              href={CODERABBIT_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackCodeRabbitClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Install the GitHub App
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={CODERABBIT_DOCS_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackCodeRabbitClick}
              variant="ghost"
            >
              Read the docs
            </Button>
          </div>
        </section>

        {/* Library fit */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Reviews every TanStack library
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            CodeRabbit reads your whole diff, so it understands the parts of
            TanStack apps that are easiest to get wrong in review.
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
            Pricing that scales with your team
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Start free, and only pay per seat when your team is ready for full
            pull-request reviews. IDE reviews stay free.
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
            {extras.map(([key, value]) => (
              <div
                key={key}
                className="rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-900"
              >
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {key}
                </div>
                <div className="mt-1 text-sm font-semibold">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              as="a"
              href={CODERABBIT_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackCodeRabbitClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Start free
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={CODERABBIT_PRICING_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackCodeRabbitClick}
              variant="ghost"
            >
              Compare plans
            </Button>
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            What engineering teams say
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Real quotes from engineers who put CodeRabbit in front of their pull
            requests.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              href={CODERABBIT_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackCodeRabbitClick}
              className="bg-gray-950 text-white border-gray-950 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:border-white dark:hover:bg-gray-200"
            >
              Add CodeRabbit to your repos
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <Sparkles className="h-3.5 w-3.5" />
              Free in VS Code, Cursor & Windsurf
            </span>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-gray-200 py-10 dark:border-gray-800">
          <h2 className="text-2xl font-black tracking-tight md:text-3xl">
            Frequently asked questions
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 md:text-base">
            Common questions from TanStack developers evaluating CodeRabbit.
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
            Free AI reviews in your IDE and your PRs
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-white md:text-3xl">
            Ship TanStack code with confidence
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">
            No credit card required. No runtime code to add. Just install the
            GitHub App and open a pull request.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Trusted by 15,000+ teams to catch the bugs humans skim past.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              as="a"
              href={CODERABBIT_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackCodeRabbitClick}
              size="lg"
              className="bg-white text-gray-950 border-white hover:bg-gray-100"
            >
              Start reviewing free
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              as="a"
              href={CODERABBIT_IDE_HREF}
              target="_blank"
              rel="noreferrer"
              onClick={trackCodeRabbitClick}
              size="lg"
              className="bg-transparent text-white border-gray-700 hover:bg-white/5"
            >
              Get the IDE extension
            </Button>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          CodeRabbit is a Gold-tier TanStack sponsor.{' '}
          <Link
            to="/partners"
            className="underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Browse all TanStack partners
          </Link>
          .{' '}
          <a
            href={CODERABBIT_HOME_HREF}
            target="_blank"
            rel="noreferrer"
            onClick={trackCodeRabbitClick}
            className="underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-300"
          >
            coderabbit.ai
          </a>
        </p>
      </div>

      <Footer />
    </div>
  )
}
