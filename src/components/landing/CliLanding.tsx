import { PuzzlePiece, Robot, Stack, Terminal } from '@phosphor-icons/react'

import {
  LibraryLanding,
  type LibraryLandingConfig,
} from '~/components/landing/LibraryLanding'

const cliLandingConfig = {
  libraryId: 'cli',
  headline: 'Turn TanStack knowledge into project changes.',
  description:
    'CLI brings together project commands, docs search, modular integrations, and the Builder so TanStack Start apps can be scaffolded and customized with current TanStack context.',
  distinction: 'Project setup with current context',
  hero: {
    label: 'tanstack cli',
    actionLabel: 'Run',
    detailTitle: 'Inspect before applying',
    detailBody:
      'Commands start from current docs and integration metadata, then leave behind project changes your team can understand.',
    items: [
      {
        key: 'search-docs',
        title: '"router loaders" --library router',
        badge: 'docs',
        activity: 93,
      },
      {
        key: 'create',
        title: 'my-app --add-ons clerk,drizzle',
        badge: 'write',
        activity: 78,
      },
      {
        key: 'ecosystem',
        title: '--category database --json',
        badge: 'json',
        activity: 64,
      },
    ],
    facts: [
      { label: 'libraries', value: 'Start, Router, Query' },
      { label: 'partners', value: 'Clerk, Drizzle' },
      { label: 'target', value: 'Cloudflare' },
      { label: 'config', value: '.tanstack.json' },
    ],
  },
  features: [
    {
      icon: Terminal,
      label: 'Context',
      title: 'A CLI that knows TanStack instead of guessing.',
      body: 'Commands can start from TanStack docs, packages, examples, and integration metadata rather than generic project templates.',
    },
    {
      icon: Robot,
      label: 'Introspection',
      title: 'CLI introspection turns docs into agent context.',
      body: 'Use JSON commands for docs, libraries, add-ons, and ecosystem data so generated work can reference current TanStack conventions.',
    },
    {
      icon: PuzzlePiece,
      label: 'Integrations',
      title: 'Integrations become selectable building blocks.',
      body: 'Auth, databases, styling, deployment, and more can be composed into a Start-ready app without burying every choice in hand-written setup.',
    },
    {
      icon: Stack,
      label: 'Builder',
      title: 'The Builder makes the stack visible.',
      body: 'Use the web UI to select libraries and partners, preview generated choices, and export a plan the CLI or agent can execute.',
    },
  ],
  lifecycle: {
    label: 'Project workflow',
    title: 'Discover, choose, generate, review.',
    body: 'CLI helps a team move from product intent to project files without hiding important decisions behind a magic template.',
    steps: [
      {
        label: 'Discover',
        body: 'Search docs, examples, packages, and integrations through direct CLI commands.',
      },
      {
        label: 'Choose',
        body: 'Select libraries, partners, deployment targets, and app shape.',
      },
      {
        label: 'Generate',
        body: 'Create or modify files with TanStack-specific conventions in mind.',
      },
      {
        label: 'Review',
        body: 'Inspect the generated plan and project changes before shipping.',
      },
    ],
  },
  flow: {
    label: 'Builder output',
    title: 'Make the stack visible before files change.',
    body: 'The Builder turns app intent into a readable stack brief: libraries, partner integrations, deployment target, generated files, and CLI-ready configuration.',
    steps: [
      { label: 'Libraries', code: 'Start + Router' },
      { label: 'Integrations', code: 'Clerk + Drizzle' },
      { label: 'Target', code: 'Cloudflare' },
      { label: 'Export', code: '.tanstack.json' },
    ],
  },
  prompt: [
    'Use TanStack CLI for a TanStack project workflow.',
    'Show how the CLI, Builder, docs search, and modular integrations can scaffold or modify a TanStack Start app with auth, database, styling, deployment, and package-specific best practices.',
    'Keep generated changes inspectable and grounded in TanStack docs instead of relying on generic framework assumptions.',
  ].join(' '),
  promptLabel: 'Copy CLI prompt',
} satisfies LibraryLandingConfig

export default function CliLanding() {
  return <LibraryLanding config={cliLandingConfig} />
}
