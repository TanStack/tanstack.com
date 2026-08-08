import * as React from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRightIcon,
  CubeIcon,
  BracketsCurlyIcon,
  CheckIcon,
  GaugeIcon,
  StackIcon,
  PaletteIcon,
  ScanIcon,
  LightningIcon,
} from '@phosphor-icons/react'

import { LibraryWordmark } from '~/components/LibraryWordmark'
import { getLibrary } from '~/libraries'

import {
  LandingSection,
  LandingSectionIntro,
  LibraryLandingShell,
} from './LibraryLanding'

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
  const [isLightTheme, setIsLightTheme] = React.useState(false)

  return (
    <LibraryLandingShell
      libraryId="highlight"
      headline="Highlighting built for the web."
      description="Register the languages your docs use, highlight synchronously, and ship one compact semantic HTML tree that every theme can share."
      hero={
        <CodeLab
          isLightTheme={isLightTheme}
          setIsLightTheme={setIsLightTheme}
        />
      }
      prompt={highlightPrompt}
      promptLabel="Copy Highlight prompt"
    >
      <LandingSection tone="accent">
        <div className="grid items-center gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Selective assembly"
            icon={<CubeIcon aria-hidden="true" size={15} />}
            title="The registry is the bundle plan."
            body="The core knows no languages. Direct imports make the site’s language set explicit and let the bundler discard everything else."
          />
          <BundleDial />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid items-center gap-12 lg:grid-cols-[0.76fr_1.24fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Semantic output"
            icon={<PaletteIcon aria-hidden="true" size={15} />}
            title="Change the palette. Keep the markup."
            body="Tokens carry stable semantic classes instead of theme colors. CSS variables recolor the same tree without a second highlighting pass."
          />
          <ThemeContract />
        </div>
        <div className="mt-12 grid items-center gap-12 border-t border-border-subtle pt-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Context-aware scanners"
            icon={<StackIcon aria-hidden="true" size={15} />}
            title="Web languages rarely stay in their lane."
            body="HTML, Vue, Svelte, EJS, Markdown, and JavaScript templates delegate embedded regions only when the nested language is registered."
          />
          <div>
            <EmbeddedLanguageMap />
            <div className="mt-8 grid gap-5 border-t border-border-subtle pt-8 sm:grid-cols-2 lg:grid-cols-4">
              {languageGroups.map(([group, languages]) => (
                <div key={group}>
                  <p className="font-ds-mono text-ds-mono-caps uppercase text-[var(--landing-accent-bright)]">
                    {group}
                  </p>
                  <p className="mt-2 text-ds-body-xs text-text-primary/55">
                    {languages}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
          <AnnotationPanel />
          <LandingSectionIntro
            eyebrow="Presentation metadata"
            icon={<ScanIcon aria-hidden="true" size={15} />}
            title="Annotate the lesson, not the token stream."
            body="Highlight lines, exact character ranges, insertions, deletions, focus, errors, and warnings without changing the source or tokenizer."
          />
        </div>
        <div className="mt-12 grid items-center gap-12 border-t border-border-subtle pt-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Corpus, not toys"
            icon={<GaugeIcon aria-hidden="true" size={15} />}
            title="Tuned against the docs it will render."
            body="The committed corpus samples 333 fixtures from 2,940 TanStack documentation files. Release checks cover fidelity, deterministic HTML, bundle profiles, and runtime throughput."
          />
          <BenchmarkTape />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid items-start gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Choose by job"
            icon={<LightningIcon aria-hidden="true" size={15} />}
            title="A docs highlighter is not an editor highlighter."
            body="Highlight is optimized for known web languages and compact page output, not TextMate completeness, automatic detection, or incremental editor state."
          />
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-background-surface">
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
        <div className="mt-12 grid items-center gap-12 border-t border-border-subtle pt-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Explicit integrations"
            icon={<BracketsCurlyIcon aria-hidden="true" size={15} />}
            title="Drop it into Markdown without hiding the language set."
            body="Every renderer and adapter receives the highlighter you assembled; none imports every language behind your back."
          />
          <Link
            to="/$libraryId"
            params={{ libraryId: markdownLibrary.id }}
            className="group rounded-xl border border-border-subtle bg-background-surface p-6 transition-colors hover:border-border-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
          >
            <p className="font-ds-mono text-ds-mono-caps uppercase text-[var(--landing-accent-bright)]">
              Natural companion
            </p>
            <div className="mt-4 text-ds-heading-4">
              <LibraryWordmark library={markdownLibrary} />
            </div>
            <p className="mt-3 text-ds-body-sm text-text-primary/55">
              A serializable document model that keeps highlighting at an
              explicit boundary.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-ds-label-md">
              Explore Markdown
              <ArrowRightIcon
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1"
                size={16}
              />
            </span>
          </Link>
        </div>
      </LandingSection>
    </LibraryLandingShell>
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
    <div className="library-landing-graphic min-w-0 overflow-hidden rounded-xl border border-[color:rgb(var(--landing-glow)/0.45)] bg-[#11151b] shadow-[0_24px_70px_-28px_rgb(var(--landing-glow)/0.45)]">
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
            className={`px-3 py-1.5 transition-colors ${isLightTheme ? 'bg-ds-neutral-200 text-ds-neutral-500' : 'text-zinc-500 hover:text-white'}`}
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
        ? 'bg-[color:rgb(var(--landing-glow)/0.18)] -mx-2 px-2'
        : 'bg-[color:rgb(var(--landing-glow)/0.13)] -mx-2 px-2'
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

function BundleDial() {
  return (
    <div className="rounded-xl border border-border-subtle bg-background-surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4 border-b border-border-subtle pb-3 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/45">
        <span>gzip profile</span>
        <span>add only what is used →</span>
      </div>
      <div className="mt-5 space-y-5">
        {bundleProfiles.map((profile) => (
          <div key={profile.name}>
            <div className="mb-2 grid grid-cols-[4rem_1fr_auto] items-center gap-3 font-mono text-xs">
              <span className="font-black text-[var(--landing-accent-bright)]">
                {profile.name}
              </span>
              <span className="text-text-primary/45">{profile.detail}</span>
              <span className="font-black">{profile.size}</span>
            </div>
            <div className="h-2 rounded-full bg-text-primary/10">
              <div
                className={`h-full rounded-full bg-[var(--landing-accent)] ${profile.width}`}
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
    <div className="grid overflow-hidden rounded-xl border border-border-subtle bg-background-surface font-ds-mono text-ds-mono-xs md:grid-cols-2">
      <div className="border-b border-border-subtle p-5 md:border-b-0 md:border-r">
        <div className="text-zinc-500">output.html</div>
        <div className="mt-4 leading-7 text-zinc-700 dark:text-zinc-300">
          <span className="text-zinc-500">&lt;span class=</span>
          <span className="text-emerald-700 dark:text-emerald-300">
            &quot;th-keyword&quot;
          </span>
          <span className="text-zinc-500">&gt;</span>
          <br />
          {'  '}const
          <br />
          <span className="text-zinc-500">&lt;/span&gt;</span>
        </div>
        <div className="mt-6 border-t border-border-subtle pt-3 text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
          emitted once
        </div>
      </div>
      <div className="bg-background-subtle p-5">
        <div className="text-zinc-500">themes.css</div>
        <div className="mt-4 space-y-4 leading-6">
          <div>
            <span className="text-cyan-700 dark:text-cyan-300">
              [data-theme=light]
            </span>
            <br />
            <span className="text-zinc-500">--th-keyword:</span>{' '}
            <span className="text-fuchsia-700 dark:text-fuchsia-300">
              #a21caf
            </span>
          </div>
          <div>
            <span className="text-cyan-700 dark:text-cyan-300">
              [data-theme=dark]
            </span>
            <br />
            <span className="text-zinc-500">--th-keyword:</span>{' '}
            <span className="text-fuchsia-700 dark:text-fuchsia-300">
              #f0abfc
            </span>
          </div>
        </div>
        <div className="mt-6 border-t border-border-subtle pt-3 text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
          recolored by CSS
        </div>
      </div>
    </div>
  )
}

function EmbeddedLanguageMap() {
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-[#11151b] p-4 font-ds-mono text-ds-mono-xs text-zinc-300 sm:p-5">
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
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-[#11151b] font-ds-mono text-ds-mono-xs leading-7 sm:text-ds-mono-sm">
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
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-background-surface">
      <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border-subtle px-4 py-3 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/45">
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
      <div className="grid gap-3 border-t border-border-subtle bg-background-subtle px-4 py-4 font-ds-mono text-ds-mono-xs text-text-primary/55 sm:grid-cols-3">
        <span>
          <strong className="text-text-primary">2,940</strong> docs files
          scanned
        </span>
        <span>
          <strong className="text-text-primary">333</strong> committed fixtures
        </span>
        <span>
          <strong className="text-text-primary">10,000+</strong> blocks per gate
        </span>
      </div>
      <p className="border-t border-border-subtle px-4 py-3 text-ds-body-xs text-text-primary/45">
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
      className={`grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border-subtle px-4 py-4 font-ds-mono text-ds-mono-xs last:border-b-0 ${emphasis ? 'bg-[color:rgb(var(--landing-glow)/0.1)]' : ''}`}
    >
      <span
        className={
          emphasis
            ? 'font-black text-[var(--landing-accent-bright)]'
            : 'text-text-primary/55'
        }
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
    <div className="grid gap-2 border-b border-border-subtle px-5 py-5 last:border-b-0 sm:grid-cols-[12rem_1fr] sm:gap-5">
      <div className="inline-flex items-center gap-2 font-black">
        <CheckIcon
          size={15}
          aria-hidden="true"
          className="text-[var(--landing-accent-bright)]"
        />{' '}
        {name}
      </div>
      <p className="text-ds-body-sm text-text-primary/55">{useWhen}</p>
    </div>
  )
}
