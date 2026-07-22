import { Link, useParams } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  BookOpen,
  Braces,
  Check,
  FileText,
  Highlighter,
  LockKeyhole,
  PackageOpen,
  ShieldCheck,
  X,
} from 'lucide-react'

import { Footer } from '~/components/Footer'
import { LandingCommunitySection } from '~/components/LandingCommunitySection'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryDownloadsMicro } from '~/components/LibraryDownloadsMicro'
import { LibraryWordmark } from '~/components/LibraryWordmark'
import { SponsorSection } from '~/components/SponsorSection'
import { GithubIcon } from '~/components/icons/GithubIcon'
import { getLibrary } from '~/libraries'

import { LandingCopyPromptButton } from './LandingCopyPromptButton'

const library = getLibrary('markdown')
const highlightLibrary = getLibrary('highlight')

const markdownPrompt = [
  'Build a technical content renderer with TanStack Markdown.',
  'Treat its serializable AST as the durable document model, render from that tree with HTML, React, or Octane, and enable only the syntax extensions the product needs.',
  'Preserve the safe defaults and deterministic output, and keep syntax highlighting as an explicit external integration.',
].join(' ')

const supportedSyntax = [
  'Headings and emphasis',
  'Lists and task lists',
  'Tables and footnotes',
  'Fenced code with metadata',
  'Links, images, and references',
  'Frontmatter',
]

const deliberateBoundaries = [
  'Every CommonMark edge case',
  'Arbitrary async plugin chains',
  'MDX or JSX evaluation',
  'A bundled highlighter',
  'A general HTML sanitizer',
]

const bundleComparisons = [
  {
    name: 'TanStack parser',
    size: '4.6 KB',
    width: 'w-[9%]',
    emphasis: true,
  },
  { name: 'marked', size: '12.5 KB', width: 'w-[24%]', emphasis: false },
  {
    name: 'unified stack',
    size: '36.8 KB',
    width: 'w-[70%]',
    emphasis: false,
  },
  {
    name: 'markdown-it',
    size: '52.7 KB',
    width: 'w-full',
    emphasis: false,
  },
]

export default function MarkdownLanding() {
  const { version } = useParams({ strict: false })
  const resolvedVersion = version ?? library.latestVersion

  return (
    <div className="w-full min-w-0 overflow-x-hidden bg-[#f7f2f8] text-[#201725] dark:bg-[#100b12] dark:text-[#f8f2fa]">
      <section className="relative overflow-hidden border-b border-violet-950/10 bg-[#eee5f2] dark:border-violet-200/10 dark:bg-[#170f1b]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(91,33,182,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(91,33,182,0.055)_1px,transparent_1px)] bg-[size:32px_32px] dark:opacity-40" />
        <div className="relative mx-auto grid w-full gap-10 px-4 py-10 lg:max-w-[80rem] lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:py-16 xl:max-w-[92rem]">
          <div className="max-w-3xl">
            <Eyebrow>
              <FileText size={14} aria-hidden="true" /> A document engine for
              technical publishing
            </Eyebrow>

            <div className="mt-5 flex flex-wrap items-start gap-3">
              <h1 className="text-5xl font-black leading-[0.93] sm:text-6xl lg:text-7xl">
                <LibraryWordmark library={library} />
              </h1>
              {library.badge ? (
                <span className="rounded-sm bg-[#201725] px-2 py-1 text-xs font-black uppercase text-white dark:bg-white dark:text-[#201725]">
                  {library.badge}
                </span>
              ) : null}
            </div>

            <p className="mt-6 max-w-2xl text-2xl font-black leading-tight sm:text-3xl">
              Markdown with an exit strategy.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-300 sm:text-lg">
              Parse once into a plain, serializable tree. Inspect it, cache it,
              index it, or render it as HTML, React, or Octane without carrying
              a content framework through the rest of your app.
            </p>

            <LibraryDownloadsMicro
              animateIncreaseTrend
              library={library}
              className="mt-5"
              label="weekly downloads"
              period="weekly"
              showTotals
            />

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/$libraryId/$version/docs"
                params={{ libraryId: library.id, version: resolvedVersion }}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-violet-700 bg-violet-700 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-violet-800 dark:border-violet-400 dark:bg-violet-400 dark:text-violet-950 dark:hover:bg-violet-300"
              >
                <BookOpen size={16} aria-hidden="true" /> Read the syntax
                profile
              </Link>
              <LandingCopyPromptButton
                prompt={markdownPrompt}
                label="Copy Markdown Prompt"
              />
            </div>

            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 border-t border-violet-950/15 pt-4 font-mono text-xs font-bold uppercase tracking-wider text-violet-900/70 dark:border-violet-200/15 dark:text-violet-200/70">
              <span>4.6 KB parser</span>
              <span>0 runtime dependencies</span>
              <span>1 public AST</span>
            </div>
          </div>

          <ManuscriptPanel />
        </div>
      </section>

      <section className="border-b border-violet-950/10 bg-[#201725] text-white dark:border-violet-200/10 dark:bg-[#0b080d]">
        <div className="mx-auto grid w-full gap-10 px-4 py-14 lg:max-w-[80rem] lg:grid-cols-[0.66fr_1.34fr] lg:items-center xl:max-w-[92rem]">
          <div className="max-w-xl">
            <DarkEyebrow>
              <Braces size={14} aria-hidden="true" /> The durable layer
            </DarkEyebrow>
            <h2 className="mt-4 text-4xl font-black leading-[1.02] sm:text-5xl">
              The AST is the product.
            </h2>
            <p className="mt-5 text-base leading-7 text-violet-100/75 sm:text-lg">
              Parsing does not trap your content inside a renderer. The public
              tree is ordinary data, so the expensive decision can happen once
              while every downstream use stays cheap and predictable.
            </p>
          </div>

          <DocumentModel />
        </div>
      </section>

      <section className="border-b border-violet-950/10 bg-[#fffaf0] dark:border-violet-200/10 dark:bg-[#17110d]">
        <div className="mx-auto grid w-full gap-10 px-4 py-14 lg:max-w-[80rem] lg:grid-cols-[0.72fr_1.28fr] xl:max-w-[92rem]">
          <div className="max-w-xl">
            <Eyebrow>
              <FileText size={14} aria-hidden="true" /> A deliberate profile
            </Eyebrow>
            <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
              It does less Markdown on purpose.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Technical docs need a known vocabulary, not an open-ended compiler
              platform. New syntax has to justify its bytes, its ambiguity, and
              its long-term maintenance cost.
            </p>

            <div className="mt-7 border-l-4 border-violet-600 pl-5">
              <div className="font-mono text-4xl font-black text-violet-700 dark:text-violet-300">
                287 / 652
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Current CommonMark example accounting. Full conformance is
                explicitly not the goal; the supported docs profile is.
              </p>
            </div>
          </div>

          <div className="grid overflow-hidden border border-violet-950/15 bg-white shadow-sm dark:border-violet-200/10 dark:bg-[#110c13] md:grid-cols-2">
            <SyntaxList
              title="Inside the profile"
              items={supportedSyntax}
              included
            />
            <SyntaxList
              title="Outside the contract"
              items={deliberateBoundaries}
              included={false}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-violet-950/10 bg-white dark:border-violet-200/10 dark:bg-[#100b12]">
        <div className="mx-auto w-full px-4 py-14 lg:max-w-[80rem] xl:max-w-[92rem]">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div className="max-w-xl">
              <Eyebrow>
                <ShieldCheck size={14} aria-hidden="true" /> Boundary behavior
              </Eyebrow>
              <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
                Unsafe surprises are opt-in.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
                Raw HTML starts escaped, executable URL schemes are stripped,
                and text, attributes, and code are encoded at render time. The
                parser is also tested against malformed and adversarial input as
                part of its normal release gates.
              </p>
            </div>
            <SafetyLedger />
          </div>
        </div>
      </section>

      <section className="border-b border-violet-950/10 bg-[#eee5f2] dark:border-violet-200/10 dark:bg-[#170f1b]">
        <div className="mx-auto grid w-full gap-10 px-4 py-14 lg:max-w-[80rem] lg:grid-cols-[0.72fr_1.28fr] xl:max-w-[92rem]">
          <div className="max-w-xl">
            <Eyebrow>
              <PackageOpen size={14} aria-hidden="true" /> Size ledger
            </Eyebrow>
            <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
              A parser should not outweigh the page.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Split entry points keep the parser, renderers, framework adapters,
              and docs extensions independent. Import the layer the page needs.
            </p>
            <p className="mt-5 font-mono text-xs leading-5 text-zinc-500 dark:text-zinc-500">
              Gzip sizes from the project benchmark report. Package scopes and
              feature sets are not equivalent.
            </p>
          </div>
          <BundleLedger />
        </div>
      </section>

      <section className="border-b border-violet-950/10 bg-[#201725] text-white dark:border-violet-200/10 dark:bg-[#0b080d]">
        <div className="mx-auto grid w-full gap-10 px-4 py-14 lg:max-w-[80rem] lg:grid-cols-[1.1fr_0.9fr] lg:items-center xl:max-w-[92rem]">
          <div>
            <DarkEyebrow>
              <Highlighter size={14} aria-hidden="true" /> Content, then color
            </DarkEyebrow>
            <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
              Syntax highlighting stays outside the parser.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-violet-100/75">
              Code fences carry language and metadata. An explicit highlighter
              can render them later, so the core never silently imports a
              grammar engine. The same boundary works with your own highlighter
              or TanStack Highlight.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 font-mono text-xs text-violet-100/75">
              <span className="border border-violet-300/20 px-3 py-2">
                callouts · 0.4 KB
              </span>
              <span className="border border-violet-300/20 px-3 py-2">
                docs preset · 2.4 KB
              </span>
              <span className="border border-violet-300/20 px-3 py-2">
                heading collection
              </span>
            </div>
          </div>

          <Link
            to="/$libraryId"
            params={{ libraryId: highlightLibrary.id }}
            className="group border border-violet-300/20 bg-violet-300/5 p-6 transition-colors hover:bg-violet-300/10"
          >
            <div className="font-mono text-xs font-bold uppercase tracking-widest text-violet-300">
              Companion, not dependency
            </div>
            <div className="mt-4 text-2xl font-black">
              <LibraryWordmark library={highlightLibrary} />
            </div>
            <p className="mt-3 text-sm leading-6 text-violet-100/65">
              Tiny, synchronous highlighting for the code fences your document
              model already understands.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-black">
              Explore Highlight
              <ArrowRight
                size={16}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1"
              />
            </div>
          </Link>
        </div>
      </section>

      <section className="bg-white py-14 dark:bg-[#100b12]">
        <div className="mx-auto w-full max-w-[80rem] px-4 xl:max-w-[92rem]">
          <Eyebrow>
            <GithubIcon className="h-3.5 w-3.5" /> Open source, in public
          </Eyebrow>
          <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
            A small document contract deserves careful stewardship.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-300">
            Syntax fixtures, renderer parity, deterministic corpus checks, size
            budgets, and resilience limits ship with the library—not as an
            afterthought.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-14">
          <LandingCommunitySection libraryId="markdown" />
          <SponsorSection
            title="GitHub Sponsors"
            aspectRatio="1/1"
            packMaxWidth="900px"
            showCTA
          />
        </div>
      </section>

      <LandingPageGad />
      <section className="border-y border-violet-950/10 bg-[#eee5f2] px-4 py-14 text-center dark:border-violet-200/10 dark:bg-[#170f1b]">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-violet-700 dark:text-violet-300">
          Keep the source. Own the model.
        </p>
        <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-black sm:text-4xl">
          Build your document pipeline on plain data.
        </h2>
        <Link
          to="/$libraryId/$version/docs"
          params={{ libraryId: library.id, version: resolvedVersion }}
          className="mt-7 inline-flex items-center gap-2 rounded-md bg-violet-700 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-violet-800 dark:bg-violet-400 dark:text-violet-950 dark:hover:bg-violet-300"
        >
          Start with the parser <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
      <Footer />
    </div>
  )
}

function ManuscriptPanel() {
  return (
    <div className="relative min-w-0 pb-4 pr-0 sm:pr-5">
      <div className="absolute bottom-0 right-0 top-5 hidden w-[92%] border border-violet-950/10 bg-violet-200/50 sm:block dark:border-violet-200/10 dark:bg-violet-950/30" />
      <div className="relative overflow-hidden border border-violet-950/15 bg-[#fffdf8] shadow-[0_18px_50px_rgba(67,36,75,0.12)] dark:border-violet-200/15 dark:bg-[#141016] dark:shadow-black/30">
        <div className="flex items-center justify-between border-b border-violet-950/10 px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-widest text-violet-900/55 dark:border-violet-200/10 dark:text-violet-200/55">
          <span>article.md</span>
          <span>document / 017</span>
        </div>
        <div className="grid md:grid-cols-[0.9fr_1.1fr]">
          <pre className="overflow-x-auto border-b border-violet-950/10 p-5 font-mono text-xs leading-7 text-zinc-700 md:border-b-0 md:border-r dark:border-violet-200/10 dark:text-zinc-300 sm:text-sm">
            <code>{`---
title: Ship the docs
---

# One source

Parse it once. Render it
where the product needs it.

- cache the tree
- index the text
- choose a renderer`}</code>
          </pre>
          <div className="p-5 font-mono text-xs leading-6">
            <div className="text-fuchsia-700 dark:text-fuchsia-300">
              root <span className="text-zinc-400">{'{'}</span>
            </div>
            <TreeLine depth="pl-4" keyName="frontmatter" value="object" />
            <TreeLine depth="pl-4" keyName="heading" value="depth: 1" />
            <TreeLine depth="pl-8" keyName="text" value="One source" />
            <TreeLine depth="pl-4" keyName="paragraph" value="2 children" />
            <TreeLine depth="pl-4" keyName="list" value="3 items" />
            <div className="text-fuchsia-700 dark:text-fuchsia-300">{'}'}</div>
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-violet-950/10 pt-4 text-center text-[10px] font-bold uppercase tracking-wider text-violet-800 dark:border-violet-200/10 dark:text-violet-300">
              <span>HTML</span>
              <span>React</span>
              <span>Octane</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TreeLine({
  depth,
  keyName,
  value,
}: {
  depth: string
  keyName: string
  value: string
}) {
  return (
    <div className={depth}>
      <span className="text-violet-700 dark:text-violet-300">{keyName}</span>
      <span className="text-zinc-400"> · {value}</span>
    </div>
  )
}

function DocumentModel() {
  return (
    <div className="grid min-w-0 gap-3 font-mono text-xs sm:grid-cols-[0.85fr_auto_1.15fr] sm:items-center">
      <div className="border border-violet-300/20 bg-white/5 p-4">
        <div className="text-violet-300">Document</div>
        <div className="mt-3 space-y-2 text-violet-100/65">
          <div>type: root</div>
          <div>children: Node[]</div>
          <div>metadata: serializable</div>
        </div>
      </div>
      <div className="hidden h-px w-8 bg-violet-300/40 sm:block" />
      <div className="grid gap-px bg-violet-300/15 sm:grid-cols-2">
        {[
          ['HTML', 'render on the server'],
          ['React', 'render as components'],
          ['Octane', 'render in Glimmer'],
          ['JSON', 'cache, inspect, index'],
        ].map(([label, detail]) => (
          <div key={label} className="bg-[#201725] p-4 dark:bg-[#0b080d]">
            <div className="font-black text-white">{label}</div>
            <div className="mt-1 text-violet-100/50">{detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SyntaxList({
  included,
  items,
  title,
}: {
  included: boolean
  items: Array<string>
  title: string
}) {
  return (
    <div className="p-5 md:p-6 [&+&]:border-t [&+&]:border-violet-950/10 dark:[&+&]:border-violet-200/10 md:[&+&]:border-l md:[&+&]:border-t-0">
      <div className="font-mono text-xs font-black uppercase tracking-widest text-violet-700 dark:text-violet-300">
        {title}
      </div>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm font-bold">
            {included ? (
              <Check
                size={16}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-emerald-600"
              />
            ) : (
              <X
                size={16}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-zinc-400"
              />
            )}
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SafetyLedger() {
  const rows = [
    ['Raw HTML', 'escaped unless enabled'],
    ['Executable URLs', 'stripped'],
    ['Text and attributes', 'encoded'],
    ['Malformed input', 'bounded and tested'],
  ]

  return (
    <div className="border-y border-violet-950/15 font-mono text-xs dark:border-violet-200/15">
      {rows.map(([input, behavior]) => (
        <div
          key={input}
          className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-violet-950/10 py-4 last:border-b-0 dark:border-violet-200/10"
        >
          <span className="text-zinc-500 dark:text-zinc-400">{input}</span>
          <span className="inline-flex items-center gap-2 text-right font-bold text-emerald-700 dark:text-emerald-400">
            <LockKeyhole size={13} aria-hidden="true" /> {behavior}
          </span>
        </div>
      ))}
    </div>
  )
}

function BundleLedger() {
  return (
    <div className="space-y-4">
      {bundleComparisons.map((comparison) => (
        <div key={comparison.name}>
          <div className="mb-1.5 flex items-center justify-between gap-4 font-mono text-xs">
            <span
              className={
                comparison.emphasis
                  ? 'font-black text-violet-800 dark:text-violet-300'
                  : 'text-zinc-600 dark:text-zinc-400'
              }
            >
              {comparison.name}
            </span>
            <span className="font-black">{comparison.size}</span>
          </div>
          <div className="h-2 bg-violet-950/10 dark:bg-violet-200/10">
            <div
              className={`h-full ${comparison.width} ${comparison.emphasis ? 'bg-violet-600' : 'bg-violet-950/30 dark:bg-violet-200/30'}`}
            />
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-px bg-violet-950/10 pt-px font-mono text-xs dark:bg-violet-200/10 sm:grid-cols-4">
        {[
          ['6.4 KB', 'HTML renderer'],
          ['6.3 KB', 'React adapter'],
          ['6.3 KB', 'Octane adapter'],
          ['2.4 KB', 'docs preset'],
        ].map(([value, label]) => (
          <div key={label} className="bg-[#eee5f2] px-3 py-4 dark:bg-[#170f1b]">
            <div className="font-black">{value}</div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 font-mono text-xs font-black uppercase tracking-widest text-violet-700 dark:text-violet-300">
      {children}
    </div>
  )
}

function DarkEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 font-mono text-xs font-black uppercase tracking-widest text-violet-300">
      {children}
    </div>
  )
}
