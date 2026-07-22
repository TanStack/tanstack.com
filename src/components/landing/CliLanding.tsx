import * as React from 'react'
import {
  FileCode,
  GitDiff,
  Package,
  PuzzlePiece,
  Robot,
  Stack,
} from '@phosphor-icons/react'

import {
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const cliPrompt = [
  'Use TanStack CLI to create or extend a TanStack project.',
  'Start from the current TanStack docs and CLI metadata, choose the app shape, add-ons, and deployment explicitly, inspect the generated files, dependencies, environment requirements, and hooks, and keep the resulting .cta.json with the project.',
  'Use JSON output when an agent needs to inspect the TanStack library or ecosystem catalog.',
].join(' ')

type AddonId = 'drizzle'

type Addon = {
  files: string[]
  id: AddonId
  label: string
}

const addOns: Addon[] = [
  {
    id: 'drizzle',
    label: 'Drizzle',
    files: ['src/db/index.ts', 'drizzle.config.ts'],
  },
]

const catalogQueries = [
  {
    id: 'docs',
    command: 'search-docs "route loaders" --library router --json',
    output: [
      '8 current results',
      'router · framework/react',
      'source URLs included',
    ],
  },
  {
    id: 'libraries',
    command: 'libraries --json',
    output: ['Router · stable', 'Start · release candidate', 'Query · stable'],
  },
  {
    id: 'ecosystem',
    command: 'ecosystem --category database --json',
    output: ['Drizzle', 'Prisma', 'Convex'],
  },
]

export default function CliLanding() {
  return (
    <LibraryLandingShell
      libraryId="cli"
      headline="Compose a TanStack app, then keep every choice inspectable."
      description="TanStack CLI turns the current library catalog, docs, templates, and add-on metadata into project files developers and agents can both understand."
      hero={<BuilderHero />}
      prompt={cliPrompt}
      promptLabel="Copy CLI prompt"
    >
      <LandingSection tone="ink">
        <LandingSectionIntro
          centered
          eyebrow="Add-on contract"
          icon={<PuzzlePiece aria-hidden="true" size={15} />}
          title="An integration is more than a dependency."
          body="Add-ons can declare files, packages, environment variables, options, ordering hooks, dependencies, and conflicts. The CLI has enough structure to compose them deliberately instead of pasting setup snippets in sequence."
        />
        <AddonAnatomy />
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
          <CatalogTerminal />
          <LandingSectionIntro
            eyebrow="Machine-readable context"
            icon={<Robot aria-hidden="true" size={15} />}
            title="The same catalog works for humans and agents."
            body="Search documentation or inspect TanStack libraries, add-ons, and ecosystem entries from the terminal. JSON output preserves names, versions, categories, and source links without asking an agent to scrape a website."
          />
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-16">
          <LandingSectionIntro
            eyebrow="Open composition"
            icon={<Stack aria-hidden="true" size={15} />}
            title="Start from TanStack’s catalog—or publish your own."
            body="A template owns the project baseline. Add-ons layer focused capabilities on top. Both stay inspectable, so teams can host private building blocks or contribute integrations without turning project generation into a black box."
          />
          <TemplateVsAddon />
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}

function BuilderHero() {
  const [appKind, setAppKind] = React.useState<'router' | 'start'>('start')
  const [selectedAddons, setSelectedAddons] = React.useState<Array<AddonId>>([
    'drizzle',
  ])
  const [deployment, setDeployment] = React.useState<'cloudflare' | null>(null)
  const selected = addOns.filter((addOn) => selectedAddons.includes(addOn.id))
  const command = `npx @tanstack/cli create acme-app${
    appKind === 'router' ? ' --router-only' : ''
  }${
    selected.length
      ? ` --add-ons ${selected.map((addOn) => addOn.id).join(',')}`
      : ''
  }${deployment ? ` --deployment ${deployment}` : ''}`
  const files = [
    'package.json',
    appKind === 'start' ? 'src/routes/__root.tsx' : 'src/main.tsx',
    'src/styles.css',
    'vite.config.ts',
    ...selected.flatMap((addOn) => addOn.files),
    ...(deployment ? ['wrangler.jsonc'] : []),
    '.cta.json',
  ]

  return (
    <LandingWindow label="TanStack Builder">
      <div className="grid min-h-[24rem] md:grid-cols-[0.86fr_1.14fr]">
        <div className="border-white/5 p-4 md:border-r">
          <p className="font-ds-mono text-[9px] uppercase tracking-[0.16em] text-white/30">
            application
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { id: 'start', label: 'Start' },
              { id: 'router', label: 'Router only' },
            ].map((kind) => (
              <button
                key={kind.id}
                type="button"
                aria-pressed={appKind === kind.id}
                className="rounded-lg border border-white/10 px-3 py-2 text-ds-label-sm text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.14)] aria-pressed:text-[var(--landing-accent-bright)]"
                onClick={() => {
                  const nextKind = kind.id === 'start' ? 'start' : 'router'
                  setAppKind(nextKind)
                  if (nextKind === 'router') {
                    setSelectedAddons([])
                    setDeployment(null)
                  }
                }}
              >
                {kind.label}
              </button>
            ))}
          </div>

          <p className="mt-6 font-ds-mono text-[9px] uppercase tracking-[0.16em] text-white/30">
            add-ons
          </p>
          <div className="mt-3 space-y-2">
            {addOns.map((addOn) => {
              const isSelected = selectedAddons.includes(addOn.id)
              return (
                <button
                  key={addOn.id}
                  type="button"
                  disabled={appKind === 'router'}
                  aria-pressed={isSelected}
                  className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-[#141414] px-3 py-2.5 text-left text-ds-label-sm text-white/40 hover:border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  onClick={() =>
                    setSelectedAddons((current) =>
                      current.includes(addOn.id)
                        ? current.filter((id) => id !== addOn.id)
                        : [...current, addOn.id],
                    )
                  }
                >
                  {addOn.label}
                  <span
                    className={
                      isSelected
                        ? 'text-[var(--landing-accent-bright)]'
                        : 'text-white/15'
                    }
                  >
                    {appKind === 'router'
                      ? 'Start only'
                      : isSelected
                        ? 'included'
                        : 'add'}
                  </span>
                </button>
              )
            })}
          </div>

          <p className="mt-6 font-ds-mono text-[9px] uppercase tracking-[0.16em] text-white/30">
            deployment
          </p>
          <button
            type="button"
            disabled={appKind === 'router'}
            aria-pressed={deployment === 'cloudflare'}
            className="mt-3 flex w-full items-center justify-between rounded-lg border border-white/5 bg-[#141414] px-3 py-2.5 text-left text-ds-label-sm text-white/40 hover:border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:text-white disabled:cursor-not-allowed disabled:opacity-30"
            onClick={() =>
              setDeployment((current) =>
                current === 'cloudflare' ? null : 'cloudflare',
              )
            }
          >
            Cloudflare
            <span
              className={
                deployment === 'cloudflare'
                  ? 'text-[var(--landing-accent-bright)]'
                  : 'text-white/15'
              }
            >
              {appKind === 'router'
                ? 'Start only'
                : deployment === 'cloudflare'
                  ? 'selected'
                  : 'choose'}
            </span>
          </button>
        </div>

        <div className="flex min-w-0 flex-col p-4" aria-live="polite">
          <div className="rounded-lg bg-black p-3 font-ds-mono text-[10px] leading-5 text-white/60">
            <span className="text-[var(--landing-accent-bright)]">$</span>{' '}
            {command}
          </div>
          <div className="mt-4 min-h-0 flex-1 rounded-lg border border-white/5 bg-[#121212] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-white/25">
                generated plan
              </p>
              <span className="font-ds-mono text-[9px] text-emerald-400">
                {files.length} files
              </span>
            </div>
            <div className="mt-3 grid gap-x-3 gap-y-2 sm:grid-cols-2">
              {files.map((file) => (
                <p
                  key={file}
                  className="truncate font-ds-mono text-[10px] text-white/55"
                >
                  <span className="mr-2 text-[var(--landing-accent)]">+</span>
                  {file}
                </p>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.12)] p-3">
            <FileCode
              aria-hidden="true"
              className="shrink-0 text-[var(--landing-accent-bright)]"
              size={18}
            />
            <div className="min-w-0">
              <p className="font-ds-mono text-[11px] text-white">.cta.json</p>
              <p className="mt-1 truncate text-ds-body-xs text-white/30">
                app shape, add-ons, and deployment
              </p>
            </div>
          </div>
        </div>
      </div>
    </LandingWindow>
  )
}

function AddonAnatomy() {
  const anatomy = [
    ['files', 'Create and patch owned project files'],
    ['dependencies', 'Install runtime and development packages'],
    ['environment', 'Declare required keys and example values'],
    ['options', 'Ask only the questions this integration needs'],
    ['hooks', 'Run composition work at explicit phases'],
    ['relationships', 'Express dependencies and conflicts'],
  ]

  return (
    <div className="mx-auto mt-14 max-w-[72rem] overflow-hidden rounded-xl border border-white/10 bg-[#101010]">
      <div className="grid md:grid-cols-[0.76fr_1.24fr]">
        <div className="border-white/5 p-6 md:border-r md:p-8">
          <PuzzlePiece
            aria-hidden="true"
            className="text-[var(--landing-accent-bright)]"
            size={32}
            weight="light"
          />
          <p className="mt-6 text-ds-heading-3">database / drizzle</p>
          <p className="mt-3 text-ds-body-sm text-white/35">
            A composable unit with enough metadata to participate in the whole
            project plan.
          </p>
        </div>
        <dl className="grid sm:grid-cols-2">
          {anatomy.map(([label, detail]) => (
            <div
              key={label}
              className="border-b border-white/5 p-5 sm:border-l"
            >
              <dt className="font-ds-mono text-[10px] uppercase tracking-[0.14em] text-[var(--landing-accent-bright)]">
                {label}
              </dt>
              <dd className="mt-3 text-ds-body-xs text-white/35">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function CatalogTerminal() {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const query = catalogQueries[activeIndex] ?? catalogQueries[0]

  return (
    <LandingWindow label="catalog inspector">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {catalogQueries.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={index === activeIndex}
              className="rounded-lg border border-white/10 px-3 py-2 font-ds-mono text-[10px] text-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-bright)]"
              onClick={() => setActiveIndex(index)}
            >
              {item.id}
            </button>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg bg-black p-4 font-ds-mono text-[11px] text-white/60">
          <span className="text-[var(--landing-accent-bright)]">$</span> npx
          @tanstack/cli {query.command}
        </div>
        <div
          className="mt-3 rounded-lg border border-white/5 bg-[#121212] p-4"
          aria-live="polite"
        >
          <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-white/25">
            JSON
          </p>
          <ul className="mt-3 space-y-2">
            {query.output.map((line) => (
              <li
                key={line}
                className="flex items-center gap-3 font-ds-mono text-[11px] text-white/55"
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-[var(--landing-accent)]"
                />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </LandingWindow>
  )
}

function TemplateVsAddon() {
  return (
    <LandingWindow label="composition model">
      <div className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
          <div className="rounded-xl border border-white/10 bg-[#151515] p-5">
            <Package
              aria-hidden="true"
              className="text-[var(--landing-accent-bright)]"
              size={24}
            />
            <p className="mt-5 text-ds-heading-4">Template</p>
            <p className="mt-3 text-ds-body-xs text-white/35">
              Owns the starting application, package manager, file layout, and
              default conventions.
            </p>
          </div>
          <div className="hidden items-center sm:flex">
            <span
              aria-hidden="true"
              className="w-8 border-t border-dashed border-[var(--landing-accent)]"
            />
          </div>
          <div className="rounded-xl border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.12)] p-5">
            <PuzzlePiece
              aria-hidden="true"
              className="text-[var(--landing-accent-bright)]"
              size={24}
            />
            <p className="mt-5 text-ds-heading-4">Add-on</p>
            <p className="mt-3 text-ds-body-xs text-white/35">
              Adds one capability through declared files, packages, options, and
              composition rules.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-black p-4">
          <GitDiff
            aria-hidden="true"
            className="shrink-0 text-[var(--landing-accent-bright)]"
            size={18}
          />
          <p className="font-ds-mono text-[11px] text-white/55">
            preview files → review plan → generate source
          </p>
        </div>
      </div>
    </LandingWindow>
  )
}
