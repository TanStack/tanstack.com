import { Link, useParams } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpen,
  Braces,
  CodeXml,
  FileCode2,
  FileText,
  Gauge,
  Highlighter,
  Layers3,
  Palette,
  ScanText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { BottomCTA } from '~/components/BottomCTA'
import { Footer } from '~/components/Footer'
import { LandingCommunitySection } from '~/components/LandingCommunitySection'
import LandingPageGad from '~/components/LandingPageGad'
import { LibraryDownloadsMicro } from '~/components/LibraryDownloadsMicro'
import { LibraryWordmark } from '~/components/LibraryWordmark'
import { SponsorSection } from '~/components/SponsorSection'
import { GithubIcon } from '~/components/icons/GithubIcon'
import { getLibrary } from '~/libraries'
import type { LibraryId } from '~/libraries'

import { LandingCopyPromptButton } from './LandingCopyPromptButton'

type ContentLibraryId = Extract<LibraryId, 'highlight' | 'markdown'>
const markdownCompanionId: ContentLibraryId = 'highlight'
const highlightCompanionId: ContentLibraryId = 'markdown'

const content = {
  markdown: {
    kicker: 'Markdown for technical content',
    headline: 'Turn Markdown into a small, predictable document model.',
    description:
      'Parse once, keep the AST serializable, and render matching HTML or React without pulling a content-processing framework into every page.',
    proof: [
      ['4.6 KB', 'gzip parser'],
      ['0', 'runtime dependencies'],
      ['1 AST', 'HTML + React parity'],
    ],
    features: [
      {
        title: 'A document model you can inspect.',
        body: 'The parser produces a serializable AST instead of hiding content behind an opaque render pipeline.',
        icon: <Braces size={18} />,
      },
      {
        title: 'Safe defaults at the boundary.',
        body: 'Raw HTML and executable URLs are handled deliberately, with malformed input tested as a normal case.',
        icon: <ShieldCheck size={18} />,
      },
      {
        title: 'HTML and React stay in agreement.',
        body: 'Render the same syntax profile on the server or in components without maintaining two interpretations.',
        icon: <Layers3 size={18} />,
      },
      {
        title: 'Docs features are opt-in.',
        body: 'Add callouts, tabs, headings, comments, and framework-aware content through focused extensions.',
        icon: <FileText size={18} />,
      },
    ],
    steps: [
      {
        label: 'Source',
        body: 'Controlled Markdown for a blog, docs page, or changelog.',
      },
      {
        label: 'Parse',
        body: 'A deterministic, serializable tree with stable node shapes.',
      },
      {
        label: 'Extend',
        body: 'Only the docs conventions the product actually needs.',
      },
      {
        label: 'Render',
        body: 'Matching HTML or React output with safe defaults.',
      },
    ],
    companionId: markdownCompanionId,
    companionTitle: 'Bring your own highlighter. Keep the boundary explicit.',
    companionBody:
      'TanStack Markdown accepts external syntax highlighting instead of bundling a grammar engine. TanStack Highlight is the small, synchronous companion built for that job.',
    prompt: [
      'Build a technical content renderer with TanStack Markdown.',
      'Use the serializable AST, safe defaults, HTML or React renderer, and only the extensions required by the content.',
      'Keep syntax highlighting as an explicit external integration and preserve deterministic server and client output.',
    ].join(' '),
    theme: {
      page: 'bg-[#f8f4ff] text-zinc-950 dark:bg-[#130b1b] dark:text-white',
      hero: 'border-violet-950/10 bg-[#efe7ff] dark:border-violet-300/10 dark:bg-[#1c1028]',
      soft: 'border-violet-950/10 bg-[#fbf9ff] dark:border-violet-300/10 dark:bg-[#180e22]',
      kicker:
        'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200',
      button:
        'border-violet-700 bg-violet-700 text-white hover:bg-violet-800 dark:border-violet-400 dark:bg-violet-400 dark:text-violet-950 dark:hover:bg-violet-300',
      panel:
        'border-violet-300 bg-[#18121f] shadow-lg shadow-violet-950/10 dark:border-violet-800 dark:shadow-black/20',
      accent: 'text-violet-700 dark:text-violet-300',
      chip: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200',
      cta: 'border-violet-700 bg-violet-700 text-white hover:bg-violet-800',
    },
  },
  highlight: {
    kicker: 'Syntax highlighting for docs',
    headline: 'Highlight code without shipping an editor engine.',
    description:
      'Register only the languages you use, run synchronously on either side of hydration, and emit one compact class-based HTML tree for every theme.',
    proof: [
      ['3.9 KB', 'core + TSX gzip'],
      ['25', 'shipped languages'],
      ['1 tree', 'every color theme'],
    ],
    features: [
      {
        title: 'Pay for registered languages.',
        body: 'Import TSX, CSS, HTML, or the exact grammar set your docs need instead of an all-language bundle.',
        icon: <Gauge size={18} />,
      },
      {
        title: 'Synchronous on server and client.',
        body: 'The same registration produces identical markup during SSR and hydration with no initialization phase.',
        icon: <CodeXml size={18} />,
      },
      {
        title: 'Themes are CSS, not duplicated markup.',
        body: 'Stable semantic token classes let light and dark themes switch without highlighting the source twice.',
        icon: <Palette size={18} />,
      },
      {
        title: 'Annotations without a transformer stack.',
        body: 'Titles, line numbers, highlights, insertions, deletions, focus, warnings, and exact ranges are built in.',
        icon: <ScanText size={18} />,
      },
    ],
    steps: [
      {
        label: 'Register',
        body: 'Import only the language definitions used by the site.',
      },
      {
        label: 'Highlight',
        body: 'Tokenize synchronously with deterministic output.',
      },
      {
        label: 'Decorate',
        body: 'Add titles, line numbers, and exact line or range states.',
      },
      {
        label: 'Theme',
        body: 'Apply light and dark palettes to one semantic HTML tree.',
      },
    ],
    companionId: highlightCompanionId,
    companionTitle: 'A clean fit for Markdown and existing pipelines.',
    companionBody:
      'Use the direct API with TanStack Markdown, or plug the same highlighter into remark and rehype. Adapters take an explicit highlighter so they never smuggle in every language.',
    prompt: [
      'Add syntax highlighting with TanStack Highlight.',
      'Register only the required languages, share one synchronous highlighter between SSR and the browser, and use class-based light and dark themes.',
      'Include code-fence metadata and annotations where useful without adding a transformer framework.',
    ].join(' '),
    theme: {
      page: 'bg-[#fff8e8] text-zinc-950 dark:bg-[#160e05] dark:text-white',
      hero: 'border-amber-950/10 bg-[#ffedbd] dark:border-amber-300/10 dark:bg-[#211406]',
      soft: 'border-amber-950/10 bg-[#fffaf0] dark:border-amber-300/10 dark:bg-[#1b1106]',
      kicker:
        'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
      button:
        'border-amber-600 bg-amber-500 text-zinc-950 hover:bg-amber-400 dark:border-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300',
      panel:
        'border-amber-300 bg-[#17130c] shadow-lg shadow-amber-950/10 dark:border-amber-800 dark:shadow-black/20',
      accent: 'text-amber-700 dark:text-amber-300',
      chip: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
      cta: 'border-amber-500 bg-amber-500 text-zinc-950 hover:bg-amber-400',
    },
  },
}

export function ContentToolsLanding({
  libraryId,
}: {
  libraryId: ContentLibraryId
}) {
  const library = getLibrary(libraryId)
  const companion = getLibrary(content[libraryId].companionId)
  const page = content[libraryId]
  const { version } = useParams({ strict: false })
  const resolvedVersion = version ?? library.latestVersion

  return (
    <div className={`w-full min-w-0 overflow-x-hidden ${page.theme.page}`}>
      <section className={`overflow-hidden border-b ${page.theme.hero}`}>
        <div className="mx-auto grid w-full gap-9 px-4 py-10 lg:max-w-[80rem] lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-14 xl:max-w-[92rem]">
          <div className="min-w-0 max-w-3xl">
            <SectionKicker className={page.theme.kicker}>
              {libraryId === 'markdown' ? (
                <FileText size={14} />
              ) : (
                <Highlighter size={14} />
              )}
              {page.kicker}
            </SectionKicker>

            <div className="mt-5 flex flex-wrap items-start gap-3">
              <h1 className="text-5xl font-black leading-[0.94] sm:text-6xl lg:text-7xl">
                <LibraryWordmark library={library} />
              </h1>
              <span className="rounded-md bg-zinc-950 px-2 py-1 text-xs font-black uppercase text-white dark:bg-white dark:text-zinc-950">
                {library.badge}
              </span>
            </div>

            <p className="mt-6 max-w-2xl text-xl font-black leading-8 sm:text-2xl">
              {page.headline}
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-300 sm:text-lg">
              {page.description}
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
              <PrimaryLink
                className={page.theme.button}
                to="/$libraryId/$version/docs"
                params={{ libraryId, version: resolvedVersion }}
              >
                <BookOpen size={16} />
                Read the docs
              </PrimaryLink>
              <LandingCopyPromptButton
                prompt={page.prompt}
                label={`Copy ${library.name.replace('TanStack ', '')} Prompt`}
              />
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {page.proof.map(([value, label]) => (
                <div
                  key={label}
                  className={`rounded-lg border px-3 py-3 ${page.theme.chip}`}
                >
                  <div className="text-lg font-black">{value}</div>
                  <div className="mt-0.5 text-xs font-bold uppercase tracking-wide opacity-75">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ProductDemo
            libraryId={libraryId}
            panelClassName={page.theme.panel}
          />
        </div>
      </section>

      <section className={`border-b ${page.theme.soft}`}>
        <div className="mx-auto grid w-full gap-8 px-4 py-12 lg:max-w-[80rem] lg:grid-cols-[0.7fr_1.3fr] xl:max-w-[92rem]">
          <div>
            <SectionLabel className={page.theme.accent}>
              <Sparkles size={15} /> Why {library.name.replace('TanStack ', '')}
            </SectionLabel>
            <h2 className="mt-3 max-w-xl text-3xl font-black leading-tight sm:text-4xl">
              Small enough to understand. Specific enough to trust.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {page.features.map((feature) => (
              <article
                key={feature.title}
                className="border-t-2 border-zinc-950 pt-4 dark:border-white"
              >
                <div className={`mb-3 ${page.theme.accent}`}>
                  {feature.icon}
                </div>
                <h3 className="font-black">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {feature.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto grid w-full gap-8 px-4 py-12 lg:max-w-[80rem] lg:grid-cols-[1.15fr_0.85fr] lg:items-center xl:max-w-[92rem]">
          <Pipeline steps={page.steps} accentClassName={page.theme.accent} />
          <div>
            <SectionLabel className={page.theme.accent}>
              <FileCode2 size={15} /> Content pipeline
            </SectionLabel>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              Every transformation stays visible.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
              A short pipeline is easier to reason about, easier to test, and
              easier to run identically during SSR and in the browser.
            </p>
          </div>
        </div>
      </section>

      <section className={`border-b ${page.theme.soft}`}>
        <div className="mx-auto grid w-full gap-8 px-4 py-12 lg:max-w-[80rem] lg:grid-cols-[0.9fr_1.1fr] lg:items-center xl:max-w-[92rem]">
          <div>
            <SectionLabel className={page.theme.accent}>
              <Layers3 size={15} /> Built to compose
            </SectionLabel>
            <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">
              {page.companionTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
              {page.companionBody}
            </p>
          </div>

          <Link
            to="/$libraryId"
            params={{ libraryId: companion.id }}
            className="group border-l-4 border-zinc-950 bg-white p-6 shadow-sm transition-transform hover:-translate-y-1 dark:border-white dark:bg-zinc-900"
          >
            <div className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Companion library
            </div>
            <div className="mt-3 text-2xl font-black">
              <LibraryWordmark library={companion} />
            </div>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-black">
              Explore {companion.name.replace('TanStack ', '')}
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </div>
          </Link>
        </div>
      </section>

      <section className="bg-white py-12 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-[80rem] px-4 xl:max-w-[92rem]">
          <SectionLabel className={page.theme.accent}>
            <GithubIcon className="h-4 w-4" /> Open source ecosystem
          </SectionLabel>
          <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
            Tiny infrastructure still deserves serious maintenance.
          </h2>
        </div>

        <div className="mt-10 flex flex-col gap-14">
          <LandingCommunitySection libraryId={library.id} />
          <SponsorSection
            title="GitHub Sponsors"
            aspectRatio="1/1"
            packMaxWidth="900px"
            showCTA
          />
        </div>
      </section>

      <LandingPageGad />
      <BottomCTA
        linkProps={{
          to: '/$libraryId/$version/docs',
          params: { libraryId: library.id, version: resolvedVersion },
        }}
        label="Get Started!"
        className={page.theme.cta}
      />
      <Footer />
    </div>
  )
}

function ProductDemo({
  libraryId,
  panelClassName,
}: {
  libraryId: ContentLibraryId
  panelClassName: string
}) {
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-xl border ${panelClassName}`}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs font-bold text-zinc-400">
        <span>{libraryId === 'markdown' ? 'article.md' : 'highlight.ts'}</span>
        <span>deterministic output</span>
      </div>
      {libraryId === 'markdown' ? <MarkdownDemo /> : <HighlightDemo />}
    </div>
  )
}

function MarkdownDemo() {
  return (
    <div className="grid min-h-[350px] md:grid-cols-2">
      <pre className="overflow-x-auto border-b border-white/10 p-5 font-mono text-sm leading-7 text-zinc-200 md:border-r md:border-b-0">
        <code>{`# Ship the docs

One source, two renderers.

- serializable AST
- safe URLs
- React or HTML

\`\`\`tsx
<Markdown>{source}</Markdown>
\`\`\``}</code>
      </pre>
      <div className="p-5 font-mono text-xs leading-6 text-zinc-400">
        <div className="text-fuchsia-300">root</div>
        <div className="pl-4 text-violet-200">heading · depth 1</div>
        <div className="pl-8 text-zinc-300">“Ship the docs”</div>
        <div className="mt-3 pl-4 text-violet-200">paragraph</div>
        <div className="pl-8 text-zinc-300">text · 26 chars</div>
        <div className="mt-3 pl-4 text-violet-200">list · unordered</div>
        <div className="pl-8 text-zinc-300">3 listItem nodes</div>
        <div className="mt-3 pl-4 text-violet-200">code · tsx</div>
        <div className="pl-8 text-emerald-300">safe: true</div>
        <div className="mt-6 border-t border-white/10 pt-4 text-zinc-500">
          parse → extend → render
        </div>
      </div>
    </div>
  )
}

function HighlightDemo() {
  return (
    <div className="min-h-[350px] p-5 font-mono text-sm leading-7 text-zinc-300">
      <div>
        <span className="text-fuchsia-300">import</span>{' '}
        <span className="text-zinc-200">{'{ createHighlighter }'}</span>{' '}
        <span className="text-fuchsia-300">from</span>{' '}
        <span className="text-emerald-300">'@tanstack/highlight/core'</span>
      </div>
      <div>
        <span className="text-fuchsia-300">import</span>{' '}
        <span className="text-zinc-200">{'{ tsx }'}</span>{' '}
        <span className="text-fuchsia-300">from</span>{' '}
        <span className="text-emerald-300">
          '@tanstack/highlight/languages/tsx'
        </span>
      </div>
      <div className="mt-5">
        <span className="text-sky-300">const</span>{' '}
        <span className="text-amber-200">highlighter</span>{' '}
        <span className="text-zinc-400">=</span>{' '}
        <span className="text-blue-300">createHighlighter</span>
        <span className="text-zinc-200">({'{ languages: [tsx] }'})</span>
      </div>
      <div className="mt-5">
        <span className="text-sky-300">const</span>{' '}
        <span className="text-amber-200">result</span>{' '}
        <span className="text-zinc-400">=</span>{' '}
        <span className="text-amber-200">highlighter</span>
        <span className="text-zinc-400">.</span>
        <span className="text-blue-300">highlight</span>
        <span className="text-zinc-200">(code, {'{'}</span>
      </div>
      <div className="pl-5 text-zinc-200">
        lang: <span className="text-emerald-300">'tsx'</span>,
      </div>
      <div className="pl-5 text-zinc-200">lineNumbers: true,</div>
      <div className="pl-5 text-zinc-200">
        highlight: <span className="text-orange-300">[2, 4, 5]</span>,
      </div>
      <div className="text-zinc-200">{`})`}</div>
      <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-4 text-xs">
        {['tsx', 'css', 'html', 'markdown'].map((language) => (
          <span
            key={language}
            className="rounded border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-amber-200"
          >
            {language}
          </span>
        ))}
      </div>
    </div>
  )
}

function Pipeline({
  accentClassName,
  steps,
}: {
  accentClassName: string
  steps: ReadonlyArray<{ label: string; body: string }>
}) {
  return (
    <ol className="grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-2">
      {steps.map((step, index) => (
        <li key={step.label} className="bg-white p-5 dark:bg-zinc-950">
          <div className={`font-mono text-xs font-black ${accentClassName}`}>
            0{index + 1} / {step.label}
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  )
}

function PrimaryLink({
  children,
  className,
  params,
  to,
}: {
  children: ReactNode
  className: string
  params: { libraryId: ContentLibraryId; version: string }
  to: '/$libraryId/$version/docs'
}) {
  return (
    <Link
      to={to}
      params={params}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-black transition-colors ${className}`}
    >
      {children}
    </Link>
  )
}

function SectionKicker({
  children,
  className,
}: {
  children: ReactNode
  className: string
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wider ${className}`}
    >
      {children}
    </div>
  )
}

function SectionLabel({
  children,
  className,
}: {
  children: ReactNode
  className: string
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest ${className}`}
    >
      {children}
    </div>
  )
}
