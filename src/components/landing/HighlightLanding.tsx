import * as React from 'react'
import { Link, useParams } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Braces,
  Check,
  CircleGauge,
  Highlighter,
  Layers3,
  Palette,
  ScanText,
  Zap,
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

const library = getLibrary('highlight')
const markdownLibrary = getLibrary('markdown')

const highlightPrompt = [
  'Add web-first syntax highlighting with TanStack Highlight.',
  'Register only the languages the site uses, share the synchronous highlighter between SSR and the browser, and theme its stable semantic classes with CSS.',
  'Use code-fence metadata, line decorations, or exact character ranges where useful, and preserve one compact markup tree across themes.',
].join(' ')

const bundleProfiles = [
  {
    name: 'core',
    detail: 'no languages',
    size: '1.74 KB',
    width: 'w-[22%]',
  },
  {
    name: 'tsx',
    detail: 'core + TSX',
    size: '3.86 KB',
    width: 'w-[48%]',
  },
  {
    name: 'docs',
    detail: '9 languages',
    size: '5.83 KB',
    width: 'w-[73%]',
  },
  {
    name: 'all',
    detail: '25 languages',
    size: '7.96 KB',
    width: 'w-full',
  },
]

const languageGroups = [
  ['Web', 'TS · TSX · JS · JSX · CSS · HTML'],
  ['Content', 'Markdown · MDX · JSON · YAML'],
  ['Shell', 'Bash · Shell · PowerShell'],
  ['Frameworks', 'Vue · Svelte · Astro · EJS'],
]

export default function HighlightLanding() {
  const { version } = useParams({ strict: false })
  const resolvedVersion = version ?? library.latestVersion
  const [isLightTheme, setIsLightTheme] = React.useState(false)

  return (
    <div className="w-full min-w-0 overflow-x-hidden bg-[#090b0e] text-zinc-100">
      <section className="relative overflow-hidden border-b border-amber-300/15 bg-[#0b0e12]">
        <SpectrumGrid />
        <div className="relative mx-auto grid w-full gap-9 px-4 py-10 lg:max-w-[80rem] lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:py-14 xl:max-w-[92rem]">
          <div className="max-w-3xl">
            <LabLabel>
              <Highlighter size={14} aria-hidden="true" /> Web-first syntax
              highlighting
            </LabLabel>

            <div className="mt-5 flex flex-wrap items-start gap-3">
              <h1 className="text-5xl font-black leading-[0.93] sm:text-6xl lg:text-7xl">
                <LibraryWordmark library={library} />
              </h1>
              {library.badge ? (
                <span className="rounded-sm bg-amber-300 px-2 py-1 text-xs font-black uppercase text-zinc-950">
                  {library.badge}
                </span>
              ) : null}
            </div>

            <p className="mt-6 max-w-2xl text-2xl font-black leading-tight text-white sm:text-3xl">
              Highlighting that knows it is going into a webpage.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
              Register the languages your docs use, highlight synchronously, and
              ship one compact semantic HTML tree that every theme can share. No
              editor engine or initialization phase required.
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
                className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-300 px-4 py-2.5 text-sm font-black text-zinc-950 transition-colors hover:bg-amber-200"
              >
                <BookOpen size={16} aria-hidden="true" /> Build a highlighter
              </Link>
              <LandingCopyPromptButton
                prompt={highlightPrompt}
                label="Copy Highlight Prompt"
              />
            </div>

            <div className="mt-8 grid grid-cols-3 border-y border-white/10 py-4 font-mono">
              <HeroStat value="1.74 KB" label="empty core" />
              <HeroStat value="25" label="languages" />
              <HeroStat value="1 tree" label="every theme" />
            </div>
          </div>

          <CodeLab
            isLightTheme={isLightTheme}
            setIsLightTheme={setIsLightTheme}
          />
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-[#f4f1e8] text-zinc-950">
        <div className="mx-auto grid w-full gap-10 px-4 py-14 lg:max-w-[80rem] lg:grid-cols-[0.7fr_1.3fr] xl:max-w-[92rem]">
          <div className="max-w-xl">
            <LightLabel>
              <Boxes size={14} aria-hidden="true" /> Selective assembly
            </LightLabel>
            <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
              The registry is the bundle plan.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700">
              The core knows no languages. Direct imports make the site’s
              language set explicit, keep missing languages visible, and let the
              bundler discard everything else.
            </p>
            <div className="mt-6 font-mono text-xs leading-6 text-zinc-500">
              <div>createHighlighter({'{'}</div>
              <div className="pl-5 text-amber-800">
                languages: [tsx, css, markdown]
              </div>
              <div>{'}'})</div>
            </div>
          </div>

          <BundleDial />
        </div>
      </section>

      <section className="border-b border-amber-300/15 bg-[#10141a]">
        <div className="mx-auto grid w-full gap-10 px-4 py-14 lg:max-w-[80rem] lg:grid-cols-[0.76fr_1.24fr] lg:items-center xl:max-w-[92rem]">
          <div className="max-w-xl">
            <LabLabel>
              <Palette size={14} aria-hidden="true" /> Semantic output
            </LabLabel>
            <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
              Change the palette. Keep the markup.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-400">
              Tokens carry stable <code className="text-amber-300">th-*</code>{' '}
              classes instead of theme colors. CSS variables recolor the same
              tree, so dark mode does not require a second highlighting pass or
              a second copy of the HTML.
            </p>
          </div>

          <ThemeContract />
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-white text-zinc-950">
        <div className="mx-auto w-full px-4 py-14 lg:max-w-[80rem] xl:max-w-[92rem]">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
            <div className="max-w-xl">
              <LightLabel>
                <Layers3 size={14} aria-hidden="true" /> Context-aware scanners
              </LightLabel>
              <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
                Web languages rarely stay in their lane.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-700">
                HTML, Vue, Svelte, EJS, Markdown, and JavaScript templates embed
                other languages. Highlight delegates those regions only when the
                nested language is registered, while preserving every source
                character around them.
              </p>
            </div>

            <EmbeddedLanguageMap />
          </div>

          <div className="mt-12 grid gap-3 border-t border-zinc-200 pt-8 sm:grid-cols-2 lg:grid-cols-4">
            {languageGroups.map(([group, languages]) => (
              <div key={group}>
                <div className="font-mono text-xs font-black uppercase tracking-widest text-amber-700">
                  {group}
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {languages}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-amber-300/15 bg-[#0b0e12]">
        <div className="mx-auto grid w-full gap-10 px-4 py-14 lg:max-w-[80rem] lg:grid-cols-[1.2fr_0.8fr] lg:items-center xl:max-w-[92rem]">
          <AnnotationPanel />
          <div className="max-w-xl">
            <LabLabel>
              <ScanText size={14} aria-hidden="true" /> Presentation metadata
            </LabLabel>
            <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
              Annotate the lesson, not the token stream.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-400">
              Highlight lines, exact character ranges, insertions, deletions,
              focus, errors, and warnings. Decorations split token boundaries
              cleanly without changing the underlying source or tokenizer.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 font-mono text-xs">
              {['{2,4-6}', 'ins', 'del', 'focus', 'warning', 'title'].map(
                (annotation) => (
                  <span
                    key={annotation}
                    className="border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-amber-200"
                  >
                    {annotation}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-[#f4f1e8] text-zinc-950">
        <div className="mx-auto w-full px-4 py-14 lg:max-w-[80rem] xl:max-w-[92rem]">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
            <div className="max-w-xl">
              <LightLabel>
                <CircleGauge size={14} aria-hidden="true" /> Corpus, not toys
              </LightLabel>
              <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
                Tuned against the docs it will actually render.
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-700">
                The committed corpus samples 333 fixtures from 2,940 TanStack
                documentation files. Release checks cover token fidelity,
                deterministic HTML, bundle profiles, and at least 10,000 blocks
                per runtime run.
              </p>
            </div>

            <BenchmarkTape />
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-white text-zinc-950">
        <div className="mx-auto grid w-full gap-10 px-4 py-14 lg:max-w-[80rem] lg:grid-cols-[0.72fr_1.28fr] xl:max-w-[92rem]">
          <div className="max-w-xl">
            <LightLabel>
              <Zap size={14} aria-hidden="true" /> Choose by job
            </LightLabel>
            <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
              A docs highlighter is not an editor highlighter.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700">
              Highlight is optimized for known web languages and compact page
              output. It deliberately does not chase TextMate completeness,
              automatic detection, hundreds of languages, or incremental editor
              state.
            </p>
          </div>

          <div className="divide-y divide-zinc-200 border-y border-zinc-300">
            <ChoiceRow
              name="TanStack Highlight"
              useWhen="Known docs languages, compact HTML, CSS themes, and annotations matter most."
            />
            <ChoiceRow
              name="Shiki"
              useWhen="TextMate and VS Code fidelity, broad language coverage, and editor-grade themes are the job."
            />
            <ChoiceRow
              name="Sugar High"
              useWhen="The smallest straightforward JavaScript and TypeScript path is enough."
            />
          </div>
        </div>
      </section>

      <section className="border-b border-amber-300/15 bg-[#10141a]">
        <div className="mx-auto grid w-full gap-10 px-4 py-14 lg:max-w-[80rem] lg:grid-cols-[1.08fr_0.92fr] lg:items-center xl:max-w-[92rem]">
          <div>
            <LabLabel>
              <Braces size={14} aria-hidden="true" /> Explicit integrations
            </LabLabel>
            <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
              Drop it into Markdown without hiding the language set.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
              Use the direct renderer, a structured remark adapter, an
              idempotent rehype adapter, or the Octane MDX path. Every adapter
              receives the highlighter you assembled; none imports every
              language behind your back.
            </p>
          </div>

          <Link
            to="/$libraryId"
            params={{ libraryId: markdownLibrary.id }}
            className="group border border-amber-300/20 bg-amber-300/5 p-6 transition-colors hover:bg-amber-300/10"
          >
            <div className="font-mono text-xs font-bold uppercase tracking-widest text-amber-300">
              Natural companion
            </div>
            <div className="mt-4 text-2xl font-black">
              <LibraryWordmark library={markdownLibrary} />
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              A serializable document model that keeps code highlighting at an
              explicit boundary.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-black text-white">
              Explore Markdown
              <ArrowRight
                size={16}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1"
              />
            </div>
          </Link>
        </div>
      </section>

      <section className="bg-[#0b0e12] py-14">
        <div className="mx-auto w-full max-w-[80rem] px-4 xl:max-w-[92rem]">
          <LabLabel>
            <GithubIcon className="h-3.5 w-3.5" /> Open source, measured in
            public
          </LabLabel>
          <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
            Every byte and every fixture has a job.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
            Language scanners, embedded delegation, renderer output, adapters,
            and bundle profiles are checked against the same committed corpus.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-14">
          <LandingCommunitySection libraryId="highlight" />
          <SponsorSection
            title="GitHub Sponsors"
            aspectRatio="1/1"
            packMaxWidth="900px"
            showCTA
          />
        </div>
      </section>

      <LandingPageGad />
      <section className="border-y border-zinc-200 bg-amber-300 px-4 py-14 text-center text-zinc-950">
        <p className="font-mono text-xs font-black uppercase tracking-widest">
          Register. Highlight. Ship.
        </p>
        <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-black sm:text-4xl">
          Put the code on the page, not an editor in the bundle.
        </h2>
        <Link
          to="/$libraryId/$version/docs"
          params={{ libraryId: library.id, version: resolvedVersion }}
          className="mt-7 inline-flex items-center gap-2 rounded-md bg-zinc-950 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-zinc-800"
        >
          Build your language set <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
      <Footer />
    </div>
  )
}

function SpectrumGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-70">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(251,191,36,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(251,191,36,0.055)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <div className="absolute -right-24 top-12 h-px w-[70%] rotate-[-8deg] bg-linear-to-r from-transparent via-fuchsia-400 to-transparent shadow-[0_0_24px_rgba(232,121,249,0.65)]" />
      <div className="absolute -right-24 top-32 h-px w-[65%] rotate-[-4deg] bg-linear-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_24px_rgba(103,232,249,0.65)]" />
      <div className="absolute -right-24 top-52 h-px w-[60%] bg-linear-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_24px_rgba(252,211,77,0.65)]" />
    </div>
  )
}

function CodeLab({
  isLightTheme,
  setIsLightTheme,
}: {
  isLightTheme: boolean
  setIsLightTheme: React.Dispatch<React.SetStateAction<boolean>>
}) {
  return (
    <div className="min-w-0 overflow-hidden border border-white/15 bg-[#11151b] shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-zinc-500">
          <span className="h-2 w-2 rounded-full bg-fuchsia-400" /> live output
        </div>
        <div className="flex border border-white/10 p-0.5 font-mono text-[10px] font-bold uppercase">
          <button
            type="button"
            onClick={() => setIsLightTheme(false)}
            className={`px-3 py-1.5 transition-colors ${isLightTheme ? 'text-zinc-500 hover:text-white' : 'bg-zinc-700 text-white'}`}
            aria-pressed={!isLightTheme}
          >
            carbon
          </button>
          <button
            type="button"
            onClick={() => setIsLightTheme(true)}
            className={`px-3 py-1.5 transition-colors ${isLightTheme ? 'bg-amber-200 text-zinc-950' : 'text-zinc-500 hover:text-white'}`}
            aria-pressed={isLightTheme}
          >
            paper
          </button>
        </div>
      </div>

      <div
        className={`min-h-[390px] overflow-x-auto p-5 font-mono text-xs leading-7 transition-colors sm:p-6 sm:text-sm ${isLightTheme ? 'bg-[#fff8e8] text-zinc-800' : 'bg-[#0d1015] text-zinc-300'}`}
      >
        <div className="opacity-45">01</div>
        <CodeLine number="02" isLightTheme={isLightTheme} state="normal">
          <Token color="fuchsia" isLightTheme={isLightTheme}>
            import
          </Token>{' '}
          {'{ createHighlighter }'}{' '}
          <Token color="fuchsia" isLightTheme={isLightTheme}>
            from
          </Token>{' '}
          <Token color="green" isLightTheme={isLightTheme}>
            '@tanstack/highlight/core'
          </Token>
        </CodeLine>
        <CodeLine number="03" isLightTheme={isLightTheme} state="normal">
          <Token color="fuchsia" isLightTheme={isLightTheme}>
            import
          </Token>{' '}
          {'{ tsx, css }'}{' '}
          <Token color="fuchsia" isLightTheme={isLightTheme}>
            from
          </Token>{' '}
          <Token color="green" isLightTheme={isLightTheme}>
            './languages'
          </Token>
        </CodeLine>
        <div className="opacity-45">04</div>
        <CodeLine number="05" isLightTheme={isLightTheme} state="focus">
          <Token color="blue" isLightTheme={isLightTheme}>
            const
          </Token>{' '}
          <Token color="amber" isLightTheme={isLightTheme}>
            highlight
          </Token>{' '}
          ={' '}
          <Token color="cyan" isLightTheme={isLightTheme}>
            createHighlighter
          </Token>
          ({'{ languages: [tsx, css] }'})
        </CodeLine>
        <div className="opacity-45">06</div>
        <CodeLine number="07" isLightTheme={isLightTheme} state="insert">
          <Token color="blue" isLightTheme={isLightTheme}>
            const
          </Token>{' '}
          html ={' '}
          <Token color="amber" isLightTheme={isLightTheme}>
            highlight
          </Token>
          (code, {'{'}
        </CodeLine>
        <CodeLine number="08" isLightTheme={isLightTheme} state="insert">
          {'  '}lang:{' '}
          <Token color="green" isLightTheme={isLightTheme}>
            'tsx'
          </Token>
          ,
        </CodeLine>
        <CodeLine number="09" isLightTheme={isLightTheme} state="insert">
          {'  '}highlight: [2, 4, 5],
        </CodeLine>
        <CodeLine number="10" isLightTheme={isLightTheme} state="insert">
          {'}'})
        </CodeLine>
      </div>

      <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 font-mono text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        <div className="p-3">sync</div>
        <div className="p-3">semantic classes</div>
        <div className="p-3">escaped HTML</div>
      </div>
    </div>
  )
}

function CodeLine({
  children,
  isLightTheme,
  number,
  state,
}: {
  children: React.ReactNode
  isLightTheme: boolean
  number: string
  state: 'normal' | 'focus' | 'insert'
}) {
  const stateClass =
    state === 'focus'
      ? isLightTheme
        ? 'bg-amber-200/70 -mx-2 px-2'
        : 'bg-amber-300/10 -mx-2 px-2'
      : state === 'insert'
        ? isLightTheme
          ? 'bg-emerald-100 -mx-2 border-l-2 border-emerald-500 px-2'
          : 'bg-emerald-400/10 -mx-2 border-l-2 border-emerald-400 px-2'
        : ''

  return (
    <div className={stateClass}>
      <span className="mr-4 inline-block w-4 select-none opacity-35">
        {number}
      </span>
      {children}
    </div>
  )
}

function Token({
  children,
  color,
  isLightTheme,
}: {
  children: React.ReactNode
  color: 'amber' | 'blue' | 'cyan' | 'fuchsia' | 'green'
  isLightTheme: boolean
}) {
  const colorClass = isLightTheme
    ? color === 'fuchsia'
      ? 'text-fuchsia-700'
      : color === 'green'
        ? 'text-emerald-700'
        : color === 'blue'
          ? 'text-blue-700'
          : color === 'cyan'
            ? 'text-cyan-700'
            : 'text-amber-800'
    : color === 'fuchsia'
      ? 'text-fuchsia-300'
      : color === 'green'
        ? 'text-emerald-300'
        : color === 'blue'
          ? 'text-sky-300'
          : color === 'cyan'
            ? 'text-cyan-300'
            : 'text-amber-200'

  return <span className={colorClass}>{children}</span>
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-white/10 px-3 first:pl-0 last:border-r-0">
      <div className="text-sm font-black text-amber-300 sm:text-base">
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
    </div>
  )
}

function BundleDial() {
  return (
    <div className="border border-zinc-300 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-3 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        <span>gzip profile</span>
        <span>add only what is used →</span>
      </div>
      <div className="mt-5 space-y-5">
        {bundleProfiles.map((profile) => (
          <div key={profile.name}>
            <div className="mb-2 grid grid-cols-[4rem_1fr_auto] items-center gap-3 font-mono text-xs">
              <span className="font-black text-amber-800">{profile.name}</span>
              <span className="text-zinc-500">{profile.detail}</span>
              <span className="font-black">{profile.size}</span>
            </div>
            <div className="h-2 bg-zinc-100">
              <div
                className={`h-full bg-linear-to-r from-amber-400 via-orange-400 to-fuchsia-500 ${profile.width}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ThemeContract() {
  return (
    <div className="grid overflow-hidden border border-white/15 font-mono text-xs md:grid-cols-2">
      <div className="border-b border-white/10 bg-[#0b0e12] p-5 md:border-b-0 md:border-r">
        <div className="text-zinc-500">output.html</div>
        <div className="mt-4 leading-7 text-zinc-300">
          <span className="text-zinc-500">&lt;span class=</span>
          <span className="text-emerald-300">&quot;th-keyword&quot;</span>
          <span className="text-zinc-500">&gt;</span>
          <br />
          {'  '}const
          <br />
          <span className="text-zinc-500">&lt;/span&gt;</span>
        </div>
        <div className="mt-6 border-t border-white/10 pt-3 text-[10px] uppercase tracking-widest text-amber-300">
          emitted once
        </div>
      </div>
      <div className="bg-[#151a22] p-5">
        <div className="text-zinc-500">themes.css</div>
        <div className="mt-4 space-y-4 leading-6">
          <div>
            <span className="text-cyan-300">[data-theme=light]</span>
            <br />
            <span className="text-zinc-500">--th-keyword:</span>{' '}
            <span className="text-fuchsia-300">#a21caf</span>
          </div>
          <div>
            <span className="text-cyan-300">[data-theme=dark]</span>
            <br />
            <span className="text-zinc-500">--th-keyword:</span>{' '}
            <span className="text-fuchsia-300">#f0abfc</span>
          </div>
        </div>
        <div className="mt-6 border-t border-white/10 pt-3 text-[10px] uppercase tracking-widest text-amber-300">
          recolored by CSS
        </div>
      </div>
    </div>
  )
}

function EmbeddedLanguageMap() {
  return (
    <div className="overflow-hidden border border-zinc-300 bg-[#11151b] p-4 font-mono text-xs text-zinc-300 shadow-sm sm:p-5">
      <div className="flex items-center justify-between border-b border-white/10 pb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        <span>component.vue</span>
        <span>registered: html · ts · css</span>
      </div>
      <div className="mt-4 space-y-2">
        <LanguageBand
          label="HTML scanner"
          color="border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
        >
          &lt;section class=&quot;result&quot;&gt;
        </LanguageBand>
        <LanguageBand
          label="Vue expression → TS"
          color="border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-200"
        >
          {'  {{ score.toFixed(2) }}'}
        </LanguageBand>
        <LanguageBand
          label="HTML scanner"
          color="border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
        >
          &lt;/section&gt;
        </LanguageBand>
        <LanguageBand
          label="script → TS"
          color="border-amber-400/50 bg-amber-400/10 text-amber-200"
        >
          &lt;script setup lang=&quot;ts&quot;&gt;
          <br />
          {'  '}const score: number = 0.98
          <br />
          &lt;/script&gt;
        </LanguageBand>
        <LanguageBand
          label="style → CSS"
          color="border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
        >
          &lt;style&gt;.result {'{ color: var(--accent) }'}&lt;/style&gt;
        </LanguageBand>
      </div>
    </div>
  )
}

function LanguageBand({
  children,
  color,
  label,
}: {
  children: React.ReactNode
  color: string
  label: string
}) {
  return (
    <div className={`border-l-2 px-3 py-2 ${color}`}>
      <div className="mb-1 text-[9px] font-black uppercase tracking-widest opacity-60">
        {label}
      </div>
      {children}
    </div>
  )
}

function AnnotationPanel() {
  return (
    <div className="overflow-hidden border border-white/15 bg-[#11151b] font-mono text-xs leading-7 shadow-[0_20px_60px_rgba(0,0,0,0.25)] sm:text-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        <span>cache.ts</span>
        <span>{'{2,4-5} ins=5'}</span>
      </div>
      <div className="overflow-x-auto py-4 text-zinc-300">
        <AnnotatedLine number="1">const cache = new Map()</AnnotatedLine>
        <AnnotatedLine number="2" state="focus">
          const value = cache.get(key)
        </AnnotatedLine>
        <AnnotatedLine number="3">if (value) return value</AnnotatedLine>
        <AnnotatedLine number="4" state="focus">
          const next = await load(key)
        </AnnotatedLine>
        <AnnotatedLine number="5" state="insert">
          cache.set(key, next)
        </AnnotatedLine>
        <AnnotatedLine number="6">return next</AnnotatedLine>
      </div>
    </div>
  )
}

function AnnotatedLine({
  children,
  number,
  state = 'normal',
}: {
  children: React.ReactNode
  number: string
  state?: 'focus' | 'insert' | 'normal'
}) {
  return (
    <div
      className={`grid grid-cols-[2.5rem_1fr] border-l-2 px-4 ${
        state === 'insert'
          ? 'border-emerald-400 bg-emerald-400/10 text-emerald-100'
          : state === 'focus'
            ? 'border-amber-300 bg-amber-300/10 text-amber-100'
            : 'border-transparent'
      }`}
    >
      <span className="select-none text-zinc-600">{number}</span>
      <span>{children}</span>
    </div>
  )
}

function BenchmarkTape() {
  return (
    <div className="border border-zinc-300 bg-white shadow-sm">
      <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-zinc-200 px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        <span>TanStack docs corpus</span>
        <span>time</span>
        <span>HTML</span>
      </div>
      <BenchmarkRow
        name="TanStack Highlight"
        time="20 ms"
        output="364 KiB"
        emphasis
      />
      <BenchmarkRow
        name="Shiki"
        time="~1.2 s"
        output="1,252 KiB"
        emphasis={false}
      />
      <div className="grid gap-3 border-t border-zinc-200 bg-zinc-50 px-4 py-4 font-mono text-[11px] text-zinc-600 sm:grid-cols-3">
        <span>
          <strong className="text-zinc-950">2,940</strong> docs files scanned
        </span>
        <span>
          <strong className="text-zinc-950">333</strong> committed fixtures
        </span>
        <span>
          <strong className="text-zinc-950">10,000+</strong> blocks per gate
        </span>
      </div>
      <p className="border-t border-zinc-200 px-4 py-3 text-xs leading-5 text-zinc-500">
        Project benchmark report. This measures the tested corpus and output
        shape, not equivalent grammar accuracy; Shiki targets deeper TextMate
        fidelity.
      </p>
    </div>
  )
}

function BenchmarkRow({
  emphasis,
  name,
  output,
  time,
}: {
  emphasis: boolean
  name: string
  output: string
  time: string
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto] gap-4 border-b border-zinc-200 px-4 py-4 font-mono text-xs last:border-b-0 ${emphasis ? 'bg-amber-50' : ''}`}
    >
      <span
        className={emphasis ? 'font-black text-amber-900' : 'text-zinc-600'}
      >
        {name}
      </span>
      <span className="font-black">{time}</span>
      <span className="w-20 text-right font-black">{output}</span>
    </div>
  )
}

function ChoiceRow({ name, useWhen }: { name: string; useWhen: string }) {
  return (
    <div className="grid gap-2 py-5 sm:grid-cols-[12rem_1fr] sm:gap-5">
      <div className="inline-flex items-center gap-2 font-black">
        <Check size={15} aria-hidden="true" className="text-amber-600" /> {name}
      </div>
      <p className="text-sm leading-6 text-zinc-600">{useWhen}</p>
    </div>
  )
}

function LabLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 font-mono text-xs font-black uppercase tracking-widest text-amber-300">
      {children}
    </div>
  )
}

function LightLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 font-mono text-xs font-black uppercase tracking-widest text-amber-700">
      {children}
    </div>
  )
}
