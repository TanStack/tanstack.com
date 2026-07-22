import * as React from 'react'
import {
  CheckCircle,
  ClockCounterClockwise,
  FileMagnifyingGlass,
  LockKey,
  Package,
  Robot,
  Scan,
  ShieldCheck,
} from '@phosphor-icons/react'

import {
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const intentPrompt = [
  'Ship versioned Agent Skills with a TypeScript npm package using TanStack Intent.',
  'Keep skill files beside their source documentation, validate them in CI, publish them in the package tarball, and use conservative stale checks when referenced docs change.',
  'For consumers, scan installed dependencies without executing package code, apply an explicit allowlist and exclusions, and load only the guidance needed for the current task. Treat editor hooks as convenience, not a security boundary.',
].join(' ')

const skillPackages = [
  {
    packageName: '@tanstack/react-router',
    skill: 'tanstack-router',
    task: 'Model typed search params and route loaders',
    source: 'docs/framework/react/guide/search-params.md',
  },
  {
    packageName: '@tanstack/react-query',
    skill: 'tanstack-query',
    task: 'Choose query keys and invalidation boundaries',
    source: 'docs/framework/react/guides/query-keys.md',
  },
  {
    packageName: '@tanstack/react-table',
    skill: 'tanstack-table',
    task: 'Compose row models for a data grid',
    source: 'docs/guide/row-models.md',
  },
]

export default function IntentLanding() {
  return (
    <LibraryLandingShell
      libraryId="intent"
      headline="Your dependency can ship the knowledge required to use it."
      description="TanStack Intent gives maintainers a versioned path from source docs to Agent Skills, then gives consumers a controlled way to discover that guidance from installed packages."
      hero={<SkillDiscoveryHero />}
      prompt={intentPrompt}
      promptLabel="Copy Intent prompt"
    >
      <LandingSection tone="accent">
        <LandingSectionIntro
          centered
          eyebrow="Consumer trust model"
          icon={<ShieldCheck aria-hidden="true" size={15} />}
          title="Discovery can scan the workspace. Trust is still explicit."
          body="Intent can inspect workspace dependencies for static skill files without executing package code. An allowlist and exclusions decide which packages may contribute guidance, and the agent loads a skill only when the task calls for it."
        />
        <TrustPath />
      </LandingSection>

      <LandingSection tone="raised">
        <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
          <FreshnessWorkbench />
          <LandingSectionIntro
            eyebrow="Conservative freshness"
            icon={<ClockCounterClockwise aria-hidden="true" size={15} />}
            title="A changed source is a review signal, not proof of bad guidance."
            body="Skills declare the documentation they depend on. intent stale can flag a skill when those sources move, but it does not pretend to understand whether the semantic advice is wrong. Maintainers make that call."
          />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid gap-12 lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:gap-16">
          <LandingSectionIntro
            eyebrow="Maintainer loop"
            icon={<Package aria-hidden="true" size={15} />}
            title="The skill releases with the code it explains."
            body="Generate or author guidance near the package, validate its structure and source references in CI, then include it in the npm tarball. The package version becomes the skill version; the public registry makes that history browsable after indexing."
          />
          <PublicationTimeline />
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}

function SkillDiscoveryHero() {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [allowed, setAllowed] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  const activePackage = skillPackages[activeIndex] ?? skillPackages[0]

  return (
    <LandingWindow label="workspace skill discovery">
      <div className="grid min-h-[24rem] md:grid-cols-[0.94fr_1.06fr]">
        <div className="border-border-subtle p-4 md:border-r">
          <div className="flex items-center justify-between gap-3">
            <p className="font-ds-mono text-[9px] uppercase tracking-[0.16em] text-text-primary/30">
              installed dependencies
            </p>
            <span className="font-ds-mono text-[9px] text-text-primary/25">
              lockfile
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {skillPackages.map((item, index) => (
              <button
                key={item.packageName}
                type="button"
                aria-pressed={index === activeIndex}
                className="block w-full rounded-lg border border-border-subtle bg-background-subtle p-3 text-left hover:border-border-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.12)]"
                onClick={() => {
                  setActiveIndex(index)
                  setAllowed(false)
                  setLoaded(false)
                }}
              >
                <span className="block truncate font-ds-mono text-[11px] text-text-primary/65">
                  {item.packageName}
                </span>
                <span className="mt-1 block font-ds-mono text-[9px] text-[var(--landing-accent-bright)]">
                  skills/{item.skill}/SKILL.md
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-border-subtle bg-background-subtle p-3">
            <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-text-primary/25">
              scan mode
            </p>
            <p className="mt-2 font-ds-mono text-[10px] text-text-primary/55">
              static files · no package code executed
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col p-5" aria-live="polite">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-text-primary/25">
                discovered skill
              </p>
              <p className="mt-2 truncate text-ds-heading-4 text-text-primary">
                {activePackage.skill}
              </p>
            </div>
            <span className="rounded bg-[color:rgb(var(--landing-glow)/0.18)] px-2 py-1 font-ds-mono text-[9px] text-[var(--landing-accent-bright)]">
              package version
            </span>
          </div>

          <div className="mt-5 rounded-lg border border-border-subtle bg-background-subtle p-4">
            <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-text-primary/25">
              useful for
            </p>
            <p className="mt-2 text-ds-body-sm text-text-primary/55">
              {activePackage.task}
            </p>
            <p className="mt-4 truncate font-ds-mono text-[9px] text-text-primary/25">
              source: {activePackage.source}
            </p>
          </div>

          <div className="mt-auto grid gap-2 pt-5 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={allowed}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--landing-accent)] px-3 py-2 text-ds-label-sm text-[var(--landing-accent-bright)] hover:bg-[color:rgb(var(--landing-glow)/0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
              onClick={() => {
                setAllowed((current) => !current)
                setLoaded(false)
              }}
            >
              <LockKey aria-hidden="true" size={16} />
              {allowed ? 'Allowed' : 'Allow package'}
            </button>
            <button
              type="button"
              disabled={!allowed}
              aria-pressed={loaded}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--landing-accent)] px-3 py-2 text-ds-label-sm text-[var(--landing-accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] disabled:cursor-not-allowed disabled:opacity-25"
              onClick={() => setLoaded((current) => !current)}
            >
              {loaded ? (
                <CheckCircle aria-hidden="true" size={16} />
              ) : (
                <Robot aria-hidden="true" size={16} />
              )}
              {loaded ? 'Guidance loaded' : 'Load for task'}
            </button>
          </div>
        </div>
      </div>
    </LandingWindow>
  )
}

function TrustPath() {
  const steps = [
    {
      icon: Scan,
      label: 'Scan',
      detail: 'Read package metadata and static skill files.',
    },
    {
      icon: LockKey,
      label: 'Allow',
      detail: 'Match package names against your allowlist and exclusions.',
    },
    {
      icon: FileMagnifyingGlass,
      label: 'Inspect',
      detail: 'Keep source references and skill content visible.',
    },
    {
      icon: Robot,
      label: 'Load',
      detail: 'Give only relevant guidance to the active agent task.',
    },
  ]

  return (
    <div className="relative mx-auto mt-14 max-w-[74rem]">
      <div
        aria-hidden="true"
        className="absolute top-10 right-[11%] left-[11%] hidden h-px bg-[color:rgb(var(--landing-glow)/0.5)] md:block"
      />
      <ol className="relative grid gap-4 md:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon
          return (
            <li
              key={step.label}
              className="rounded-xl border border-border-default bg-background-surface p-5"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-[var(--landing-accent)] text-[var(--landing-accent-ink)]">
                <Icon aria-hidden="true" size={19} />
              </span>
              <p className="mt-6 font-ds-mono text-[9px] text-text-primary/20">
                0{index + 1}
              </p>
              <h3 className="mt-2 text-ds-heading-4">{step.label}</h3>
              <p className="mt-3 text-ds-body-xs text-text-primary/35">
                {step.detail}
              </p>
            </li>
          )
        })}
      </ol>
      <p className="mt-5 text-center text-ds-body-xs text-text-primary/30">
        Editor and install hooks may streamline discovery. They are not a
        security boundary.
      </p>
    </div>
  )
}

function FreshnessWorkbench() {
  const [changedSource, setChangedSource] = React.useState('search-params.md')
  const matches =
    changedSource === 'search-params.md'
      ? ['tanstack-router', 'router-migrations']
      : ['tanstack-query']

  return (
    <LandingWindow label="intent stale">
      <div className="p-5 sm:p-6">
        <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-text-primary/25">
          documentation changed
        </p>
        <div className="mt-3 flex gap-2">
          {['search-params.md', 'query-keys.md'].map((source) => (
            <button
              key={source}
              type="button"
              aria-pressed={source === changedSource}
              className="min-w-0 flex-1 truncate rounded-lg border border-border-default px-3 py-2 font-ds-mono text-[10px] text-text-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-bright)]"
              onClick={() => setChangedSource(source)}
            >
              {source}
            </button>
          ))}
        </div>
        <div className="mt-5 overflow-x-auto rounded-lg bg-ds-neutral-500 p-4 font-ds-mono text-[11px] text-white/55">
          <span className="text-[var(--landing-accent-dark)]">$</span> intent
          stale
        </div>
        <div className="mt-3 space-y-2" aria-live="polite">
          {matches.map((skill) => (
            <div
              key={skill}
              className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-background-subtle px-4 py-3"
            >
              <span className="truncate font-ds-mono text-[11px] text-text-primary/60">
                {skill}
              </span>
              <span className="shrink-0 rounded bg-amber-300 px-2 py-1 font-ds-mono text-[9px] font-semibold text-amber-950">
                review
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-ds-body-xs text-text-primary/30">
          The source relationship changed. A maintainer decides whether the
          skill needs an edit.
        </p>
      </div>
    </LandingWindow>
  )
}

function PublicationTimeline() {
  const releases = [
    ['Author', 'SKILL.md + source refs'],
    ['Validate', 'structure checked in CI'],
    ['Publish', 'included in npm files'],
    ['Discover', 'indexed package history'],
  ]

  return (
    <LandingWindow label="versioned skill history">
      <div className="p-5 sm:p-6">
        <ol className="space-y-3">
          {releases.map(([label, detail], index) => (
            <li
              key={label}
              className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-lg border border-border-subtle bg-background-subtle p-3"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-[color:rgb(var(--landing-glow)/0.18)] font-ds-mono text-[10px] text-[var(--landing-accent-bright)]">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-ds-label-sm text-text-primary">{label}</p>
                <p className="mt-1 truncate font-ds-mono text-[9px] text-text-primary/25">
                  {detail}
                </p>
              </div>
              <CheckCircle
                aria-hidden="true"
                className="text-emerald-400"
                size={17}
              />
            </li>
          ))}
        </ol>
        <div className="mt-4 rounded-lg border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.1)] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-ds-mono text-[10px] text-[var(--landing-accent-bright)]">
                @tanstack/react-router
              </p>
              <p className="mt-1 text-ds-body-xs text-text-primary/35">
                code + docs + skills share one release
              </p>
            </div>
            <span className="font-ds-mono text-[9px] text-text-primary/25">
              npm version
            </span>
          </div>
        </div>
      </div>
    </LandingWindow>
  )
}
