import {
  ClipboardText,
  Package,
  ShieldCheck,
  Terminal,
} from '@phosphor-icons/react'
import * as React from 'react'

import { LibraryLanding, type LibraryLandingConfig } from './LibraryLanding'

const configPrompt = [
  'Set up TanStack Config for a TypeScript package.',
  'Use the opinionated ESLint, Vite package build, CI/CD, package structure, and publish defaults while keeping project-specific configuration minimal and explicit.',
  'Show how the package should produce publint-friendly output, Changesets-backed releases, and repeatable local and CI workflows.',
].join(' ')

const config = {
  libraryId: 'config',
  headline: 'Make package publishing boring in the best way.',
  description:
    'Config is the opinionated toolchain TanStack uses to keep JavaScript packages linted, built, tested in CI, versioned with Changesets, and published with minimal per-package ceremony.',
  distinction: 'Why Config',
  hero: {
    label: 'release pipeline',
    actionLabel: 'Run check',
    detailTitle: 'Release candidate',
    detailBody:
      'Review the same package boundary locally and in CI before anything reaches npm.',
    items: [
      {
        key: 'typecheck',
        title: 'Source and declarations agree',
        badge: 'passed',
        activity: 100,
      },
      {
        key: 'package-exports',
        title: 'Modules, types, and metadata resolve',
        badge: 'verified',
        activity: 94,
      },
      {
        key: 'changesets',
        title: 'Version and release notes are ready',
        badge: 'ready',
        activity: 86,
      },
    ],
    facts: [
      { label: 'build', value: 'Vite-powered' },
      { label: 'lint', value: 'ESLint' },
      { label: 'package', value: 'publint checked' },
      { label: 'publish', value: 'npm + GitHub' },
    ],
  },
  features: [
    {
      icon: ClipboardText,
      label: 'Defaults',
      title: 'Opinionated where packages are repetitive.',
      body: 'Linting, package builds, CI tasks, publishing, and release hygiene should not become bespoke work in every package repo.',
    },
    {
      icon: Terminal,
      label: 'Builds',
      title: 'Use Vite without a hand-built pipeline.',
      body: 'Get modern build primitives and package output conventions without rebuilding the same configuration stack for every library.',
    },
    {
      icon: Package,
      label: 'Publishing',
      title: 'Keep publishing rules visible.',
      body: 'Exports, package metadata, release branches, and npm publish behavior stay reviewable as part of one workflow.',
    },
    {
      icon: ShieldCheck,
      label: 'Escape hatches',
      title: 'Minimal configuration. Consistent results.',
      body: 'The goal is a small surface where deviations are intentional, explicit, and easy to audit.',
    },
  ],
  lifecycle: {
    label: 'Release pipeline',
    title: 'Local and CI should agree about what shipping means.',
    body: 'Config gives package repositories a shared path from source code to published artifact, so maintainers spend less time debugging release machinery.',
    steps: [
      {
        label: 'Author',
        body: 'Write library code while shared defaults handle the routine surrounding work.',
      },
      {
        label: 'Build',
        body: 'Generate modules, declarations, and exports with consistent expectations.',
      },
      {
        label: 'Verify',
        body: 'Run type, lint, test, package, and publication checks before release.',
      },
      {
        label: 'Publish',
        body: 'Version, tag, and publish through a repeatable release path.',
      },
    ],
  },
  flow: {
    label: 'Package audit',
    title: 'The artifact matters as much as the source.',
    body: 'Consumers see the package boundary: exports, module formats, types, metadata, and version. Config keeps that boundary inside the workflow.',
    steps: [
      { label: 'Source', code: 'src/index.ts' },
      { label: 'Build', code: 'dist/index.js + .d.ts' },
      { label: 'Verify', code: 'publint && test' },
      { label: 'Release', code: 'changeset publish' },
    ],
  },
  prompt: configPrompt,
  promptLabel: 'Copy Config prompt',
} satisfies LibraryLandingConfig

export default function ConfigLanding() {
  return <LibraryLanding config={config} />
}
