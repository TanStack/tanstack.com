import {
  FileMagnifyingGlass,
  Package,
  Robot,
  Scan,
} from '@phosphor-icons/react'

import {
  LibraryLanding,
  type LibraryLandingConfig,
} from '~/components/landing/LibraryLanding'

const intentLandingConfig = {
  libraryId: 'intent',
  headline: 'Package the knowledge agents need with the library itself.',
  description:
    'Intent lets maintainers generate, validate, publish, and track Agent Skills alongside npm packages, so agents discover current procedural knowledge from installed code instead of stale model memory.',
  distinction: 'Versioned agent knowledge in npm',
  hero: {
    label: 'package contents',
    actionLabel: 'Validate',
    detailTitle: 'Knowledge ships beside the code',
    detailBody:
      'Skills, package metadata, and source references travel together so agents can retrieve guidance for the version they installed.',
    items: [
      {
        key: 'package.json',
        title: 'Keywords and files entries',
        badge: 'npm',
        activity: 100,
      },
      {
        key: 'skills/router/SKILL.md',
        title: 'Procedural agent knowledge',
        badge: 'skill',
        activity: 94,
      },
      {
        key: 'docs/routing.md',
        title: 'Source reference',
        badge: 'source',
        activity: 82,
      },
    ],
    facts: [
      { label: 'package', value: '@tanstack/router' },
      { label: 'version', value: 'npm release' },
      { label: 'discovery', value: 'node_modules' },
      { label: 'freshness', value: 'source checked' },
    ],
  },
  features: [
    {
      icon: Package,
      label: 'Versioning',
      title: 'Skills travel with library versions.',
      body: 'Agent guidance updates through npm releases instead of waiting for model training data or copied prompt files to catch up.',
    },
    {
      icon: Robot,
      label: 'Discovery',
      title: 'Discovery happens from node_modules.',
      body: 'Install the package and compatible agents can find the skill metadata where the code already lives.',
    },
    {
      icon: FileMagnifyingGlass,
      label: 'Sources',
      title: 'Source docs keep skills accountable.',
      body: 'Skills declare the docs they depend on, so stale checks can flag them when the source material changes.',
    },
    {
      icon: Scan,
      label: 'Registry',
      title: 'The registry makes the ecosystem visible.',
      body: 'Packages, skills, versions, download signals, and history become browsable instead of hidden inside package tarballs.',
    },
  ],
  lifecycle: {
    label: 'Skill lifecycle',
    title: 'Author, validate, publish, discover.',
    body: 'Skills become part of the library release process. They are written near the source, validated like package artifacts, and discovered by agents from installed dependencies.',
    steps: [
      {
        label: 'Author',
        body: 'Write procedural knowledge close to the library and its source docs.',
      },
      {
        label: 'Validate',
        body: 'Check metadata, source references, and skill structure before release.',
      },
      {
        label: 'Publish',
        body: 'Ship the skill with the npm package version that contains the code.',
      },
      {
        label: 'Discover',
        body: 'Agents load versioned skills from installed packages on demand.',
      },
    ],
  },
  flow: {
    label: 'Staleness checks',
    title: 'If the docs drift, the skill should know.',
    body: 'Intent compares skill source references against documentation changes, making skill freshness a release signal instead of a guess.',
    steps: [
      { label: 'Skill', code: 'SKILL.md' },
      { label: 'Sources', code: 'docs/routing.md' },
      { label: 'Check', code: 'intent stale' },
      { label: 'Signal', code: 'review required' },
    ],
  },
  prompt: [
    'Ship Agent Skills with a TypeScript npm package using TanStack Intent.',
    'Generate, validate, and publish versioned skills that agents can discover from node_modules, include source-doc references, and run stale checks in CI when documentation changes.',
    'Show the package registry, skill history, versioned updates, and how skills travel with npm releases instead of depending on model training cutoffs.',
  ].join(' '),
  promptLabel: 'Copy Intent prompt',
} satisfies LibraryLandingConfig

export default function IntentLanding() {
  return <LibraryLanding config={intentLandingConfig} />
}
