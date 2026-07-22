import { Keyboard, ListNumbers, Monitor, Radio } from '@phosphor-icons/react'
import * as React from 'react'

import { LibraryLanding, type LibraryLandingConfig } from './LibraryLanding'

const hotkeysPrompt = [
  'Build a keyboard shortcut system with TanStack Hotkeys.',
  'Use type-safe hotkey strings, cross-platform Mod handling, scoping, input filtering, key state tracking, sequences, recording, display formatting, and framework adapters.',
  'Include a visible shortcut help surface and avoid global shortcuts firing inside text inputs unless explicitly intended.',
].join(' ')

const config = {
  libraryId: 'hotkeys',
  headline: 'Keyboard shortcuts that know where they can fire.',
  description:
    'Hotkeys gives apps type-safe shortcut strings, cross-platform Mod handling, scopes, sequences, recording, key-state tracking, and framework adapters for serious keyboard interactions.',
  distinction: 'Why Hotkeys',
  hero: {
    label: 'shortcut registry',
    actionLabel: 'Record key',
    detailTitle: 'Active command',
    detailBody:
      'Every shortcut carries its platform mapping, scope, input policy, and visible label.',
    items: [
      {
        key: 'Mod+K',
        title: 'Open command search',
        badge: 'global',
        activity: 92,
      },
      {
        key: 'G then D',
        title: 'Go to dashboard',
        badge: 'sequence',
        activity: 72,
      },
      {
        key: 'Shift+?',
        title: 'Show shortcut help',
        badge: 'scoped',
        activity: 58,
      },
    ],
    facts: [
      { label: 'strings', value: 'type-safe' },
      { label: 'modifier', value: 'Cmd or Ctrl' },
      { label: 'context', value: 'scope-aware' },
      { label: 'inputs', value: 'filtered' },
    ],
  },
  features: [
    {
      icon: Keyboard,
      label: 'Typed strings',
      title: 'Shortcut strings belong in the type system.',
      body: 'Define combinations with a typed Hotkey string so invalid modifiers and keys are caught before users find them.',
    },
    {
      icon: Monitor,
      label: 'Cross-platform',
      title: 'Mod means the right thing on every platform.',
      body: 'Use one definition while macOS gets Cmd and other platforms get Ctrl, without hand-written platform checks.',
    },
    {
      icon: ListNumbers,
      label: 'Sequences',
      title: 'Sequences and holds unlock richer UI.',
      body: 'Support Vim-style sequences, multi-step commands, key holds, and contextual command flows.',
    },
    {
      icon: Radio,
      label: 'Recording',
      title: 'Shortcut recording belongs in the product.',
      body: 'Let users capture and customize shortcuts with recorder utilities instead of rebuilding keyboard parsing.',
    },
  ],
  lifecycle: {
    label: 'Shortcut lifecycle',
    title: 'Define, scope, filter, handle.',
    body: 'Hotkeys keeps the full lifecycle explicit, so shortcuts feel immediate without surprising people while they type or work inside a focused panel.',
    steps: [
      {
        label: 'Define',
        body: 'Write a type-safe shortcut string with platform-aware modifiers.',
      },
      {
        label: 'Scope',
        body: 'Attach it globally, to a document, or to a specific element or ref.',
      },
      {
        label: 'Filter',
        body: 'Prevent accidental firing in text inputs or conflicting UI regions.',
      },
      {
        label: 'Handle',
        body: 'Run the command, track key state, record input, or render help text.',
      },
    ],
  },
  flow: {
    label: 'Command routing',
    title: 'A keystroke becomes a command only in the right context.',
    body: 'Normalize the platform chord, check the active scope, then route the match to product logic.',
    steps: [
      { label: 'Press', code: 'Mod+K' },
      { label: 'Normalize', code: 'Cmd | Ctrl' },
      { label: 'Scope', code: '!isInput && enabled' },
      { label: 'Handle', code: 'openCommandMenu()' },
    ],
  },
  prompt: hotkeysPrompt,
  promptLabel: 'Copy Hotkeys prompt',
} satisfies LibraryLandingConfig

export default function HotkeysLanding() {
  return <LibraryLanding config={config} />
}
