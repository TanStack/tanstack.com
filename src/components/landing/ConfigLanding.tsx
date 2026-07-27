import * as React from 'react'
import {
  ClipboardText,
  CloudArrowUp,
  GitBranch,
  Package,
  ShieldCheck,
  Terminal,
} from '@phosphor-icons/react'

import {
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const configPrompt = [
  'Set up a TypeScript package repository with TanStack Config conventions.',
  'Use the maintained ESLint flat config, package build conventions, Nx affected tasks and caching, pkg-pr-new previews, Changesets, and trusted npm publishing where they fit.',
  'Keep the underlying files and commands visible. Treat TanStack Config as a collection of shared packages and conventions, not a magic audit CLI, and verify the current build guidance before choosing legacy Vite helpers or the newer tsdown path.',
].join(' ')

const maintenanceSurfaces = [
  {
    action: 'Lint',
    file: 'eslint.config.js',
    owner: '@tanstack/eslint-config',
    command: 'pnpm lint',
    result: 'flat config · shared rules',
  },
  {
    action: 'Build',
    file: 'tsdown.config.ts',
    owner: 'package build conventions',
    command: 'pnpm build',
    result: 'ES modules · declarations',
  },
  {
    action: 'Test',
    file: 'vitest.config.ts',
    owner: 'workspace task graph',
    command: 'pnpm test',
    result: 'affected packages first',
  },
  {
    action: 'Preview',
    file: 'package.json',
    owner: 'pkg-pr-new',
    command: 'publish preview from PR',
    result: 'installable package URL',
  },
  {
    action: 'Version',
    file: '.changeset/*.md',
    owner: '@changesets/cli',
    command: 'changeset version',
    result: 'versions · changelogs',
  },
  {
    action: 'Publish',
    file: '.github/workflows/publish.yml',
    owner: 'npm trusted publishing',
    command: 'release workflow',
    result: 'OIDC · provenance',
  },
]

export default function ConfigLanding() {
  return (
    <LibraryLandingShell
      libraryId="config"
      headline="The package-maintenance contract behind TanStack."
      description="TanStack Config collects the lint, build, monorepo, preview, versioning, and publishing conventions used to keep a large open-source package family moving together."
      hero={<MaintenanceConsole />}
      prompt={configPrompt}
      promptLabel="Copy Config prompt"
    >
      <LandingSection tone="accent">
        <div className="grid items-center gap-12 lg:grid-cols-[0.94fr_1.06fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Consumer boundary"
            icon={<Package aria-hidden="true" size={15} />}
            title="The tarball is the product. Source is only its input."
            body="Consumers receive exports, JavaScript, declarations, metadata, and documentation—not your repository. The conventions keep that package boundary reviewable and use package checks such as publint before a release reaches npm."
          />
          <PackageXRay />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
          <AffectedGraph />
          <LandingSectionIntro
            eyebrow="Monorepo economics"
            icon={<GitBranch aria-hidden="true" size={15} />}
            title="A pull request should pay only for what it can affect."
            body="Nx connects package dependencies to affected lint, test, and build tasks, then reuses cached work. pkg-pr-new closes the feedback loop by turning a pull request into packages maintainers can install before merging."
          />
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <LandingSectionIntro
          centered
          eyebrow="Release trust"
          icon={<ShieldCheck aria-hidden="true" size={15} />}
          title="Release intent is reviewed. Publish credentials are temporary."
          body="Changesets record package-level release intent in the pull request. The release workflow turns that intent into versions and changelogs, while npm trusted publishing can exchange GitHub’s OIDC identity for short-lived publish access with provenance."
        />
        <ReleaseTrustPath />
      </LandingSection>
    </LibraryLandingShell>
  )
}

function MaintenanceConsole() {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const surface = maintenanceSurfaces[activeIndex] ?? maintenanceSurfaces[0]

  return (
    <LandingWindow label="package maintenance">
      <div className="grid min-h-[24rem] md:grid-cols-[0.76fr_1.24fr]">
        <div className="grid grid-cols-2 gap-2 border-border-subtle p-4 md:grid-cols-1 md:border-r">
          {maintenanceSurfaces.map((item, index) => (
            <button
              key={item.action}
              type="button"
              aria-pressed={index === activeIndex}
              className="rounded-lg border border-border-subtle bg-background-subtle px-3 py-2.5 text-left text-ds-label-sm text-text-primary/35 hover:border-border-default hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.12)] aria-pressed:text-[var(--landing-accent-bright)]"
              onClick={() => setActiveIndex(index)}
            >
              {item.action}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-col p-5" aria-live="polite">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
                configuration surface
              </p>
              <p className="mt-2 truncate font-ds-mono text-ds-mono-xs text-text-primary">
                {surface.file}
              </p>
            </div>
            <span className="rounded bg-emerald-400 px-2 py-1 font-ds-mono text-ds-mono-caps-xs uppercase text-emerald-950">
              explicit
            </span>
          </div>

          <div className="mt-5 rounded-lg border border-border-subtle bg-background-subtle p-4">
            <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
              maintained by
            </p>
            <p className="mt-2 text-ds-label-md text-[var(--landing-accent-bright)]">
              {surface.owner}
            </p>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg bg-ds-neutral-500 p-4 font-ds-mono text-ds-mono-xs text-white/60">
            <span className="text-[var(--landing-accent-dark)]">$</span>{' '}
            {surface.command}
          </div>

          <div className="mt-auto pt-5">
            <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
              resulting contract
            </p>
            <p className="mt-2 font-ds-mono text-ds-mono-2xs text-text-primary/60">
              {surface.result}
            </p>
          </div>
        </div>
      </div>
    </LandingWindow>
  )
}

function PackageXRay() {
  const [view, setView] = React.useState<'repository' | 'tarball'>('repository')
  const repositoryFiles = [
    ['src/index.ts', 'source'],
    ['tests/index.test.ts', 'test only'],
    ['tsdown.config.ts', 'build only'],
    ['package.json', 'published metadata'],
    ['README.md', 'published docs'],
  ]
  const tarballFiles = [
    ['dist/index.js', 'export target'],
    ['dist/index.d.ts', 'type target'],
    ['package.json', 'exports + engines'],
    ['README.md', 'package docs'],
  ]
  const files = view === 'repository' ? repositoryFiles : tarballFiles

  return (
    <LandingWindow label="package x-ray">
      <div className="p-5 sm:p-6">
        <div
          className="flex gap-2"
          role="group"
          aria-label="Package boundary view"
        >
          {[
            { id: 'repository', label: 'Repository' },
            { id: 'tarball', label: 'npm tarball' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={view === option.id}
              className="flex-1 rounded-lg border border-border-default px-3 py-2 text-ds-label-sm text-text-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-bright)]"
              onClick={() =>
                setView(option.id === 'repository' ? 'repository' : 'tarball')
              }
            >
              {option.label}
            </button>
          ))}
        </div>
        <div
          className="mt-5 overflow-hidden rounded-lg border border-border-subtle"
          aria-live="polite"
        >
          {files.map(([file, role]) => (
            <div
              key={file}
              className="flex items-center justify-between gap-4 border-b border-border-subtle bg-background-subtle px-4 py-3 last:border-b-0"
            >
              <span className="truncate font-ds-mono text-ds-mono-2xs text-text-primary/65">
                {file}
              </span>
              <span className="shrink-0 font-ds-mono text-ds-mono-2xs text-text-primary/25">
                {role}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-lg border-l-2 border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.08)] p-4">
          <ClipboardText
            aria-hidden="true"
            className="shrink-0 text-[var(--landing-accent-bright)]"
            size={18}
          />
          <p className="text-ds-body-xs text-text-primary/40">
            {view === 'repository'
              ? 'Build inputs and release machinery stay visible to maintainers.'
              : 'Exports, types, files, and metadata are the consumer-facing API.'}
          </p>
        </div>
      </div>
    </LandingWindow>
  )
}

function AffectedGraph() {
  const [changedPackage, setChangedPackage] = React.useState('router-core')
  const affected =
    changedPackage === 'router-core'
      ? ['router-core', 'react-router', 'start']
      : ['query-core', 'react-query']

  return (
    <LandingWindow label="affected task graph">
      <div className="p-5 sm:p-6">
        <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
          changed package
        </p>
        <div className="mt-3 flex gap-2">
          {['router-core', 'query-core'].map((packageName) => (
            <button
              key={packageName}
              type="button"
              aria-pressed={changedPackage === packageName}
              className="min-w-0 flex-1 truncate rounded-lg border border-border-default px-3 py-2 font-ds-mono text-ds-mono-2xs text-text-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-bright)]"
              onClick={() => setChangedPackage(packageName)}
            >
              {packageName}
            </button>
          ))}
        </div>

        <div
          className="mt-7 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-0"
          aria-live="polite"
        >
          {affected.map((packageName, index) => (
            <React.Fragment key={packageName}>
              <div className="min-w-0 flex-1 rounded-xl border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.1)] p-4 text-center">
                <p className="truncate font-ds-mono text-ds-mono-2xs text-text-primary">
                  {packageName}
                </p>
                <p className="mt-2 font-ds-mono text-ds-mono-2xs text-text-primary/25">
                  lint · test · build
                </p>
              </div>
              {index < affected.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="mx-auto h-5 w-px bg-[var(--landing-accent)] sm:h-px sm:w-7"
                />
              ) : null}
            </React.Fragment>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-background-subtle p-4">
            <Terminal
              aria-hidden="true"
              className="text-[var(--landing-accent-bright)]"
              size={18}
            />
            <p className="mt-3 font-ds-mono text-ds-mono-2xs text-text-primary/50">
              Nx affected + task cache
            </p>
          </div>
          <div className="rounded-lg bg-background-subtle p-4">
            <Package
              aria-hidden="true"
              className="text-[var(--landing-accent-bright)]"
              size={18}
            />
            <p className="mt-3 font-ds-mono text-ds-mono-2xs text-text-primary/50">
              pkg-pr-new preview
            </p>
          </div>
        </div>
      </div>
    </LandingWindow>
  )
}

function ReleaseTrustPath() {
  const steps = [
    ['Pull request', 'changeset records intent'],
    ['Release workflow', 'versions + changelogs'],
    ['GitHub OIDC', 'job proves identity'],
    ['npm', 'short-lived access + provenance'],
  ]

  return (
    <div className="mx-auto mt-14 max-w-[72rem] overflow-hidden rounded-xl border border-border-default bg-background-surface">
      <ol className="grid md:grid-cols-4">
        {steps.map(([label, detail], index) => (
          <li
            key={label}
            className="relative border-b border-border-subtle p-6 last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0"
          >
            <span className="font-ds-display text-ds-display-md text-[var(--landing-accent-bright)]">
              {index + 1}
            </span>
            <p className="mt-5 text-ds-heading-4">{label}</p>
            <p className="mt-3 text-ds-body-xs text-text-primary/35">
              {detail}
            </p>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3 border-t border-border-subtle bg-background-subtle p-5">
        <CloudArrowUp
          aria-hidden="true"
          className="shrink-0 text-[var(--landing-accent-bright)]"
          size={20}
        />
        <p className="text-ds-body-xs text-text-primary/40">
          No long-lived npm token has to be stored in the repository.
        </p>
      </div>
    </div>
  )
}
