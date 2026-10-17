import * as React from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'

import {
  LandingSection,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

// Live demos register real shortcuts, so their module only loads in the browser.
const loadDemos = createIsomorphicFn()
  .client(() => import('./HotkeysLandingDemos.client'))
  .server(async () => {
    throw new Error('Hotkeys landing demos only load in the browser.')
  })
const ShortcutLab = React.lazy(() =>
  loadDemos().then((m) => ({ default: m.ShortcutLab })),
)
const FormatLab = React.lazy(() =>
  loadDemos().then((m) => ({ default: m.FormatLab })),
)
const DefaultsLab = React.lazy(() =>
  loadDemos().then((m) => ({ default: m.DefaultsLab })),
)
const RebindLab = React.lazy(() =>
  loadDemos().then((m) => ({ default: m.RebindLab })),
)

const hotkeysPrompt =
  'Add keyboard shortcuts with TanStack Hotkeys. Register commands with useHotkey using Mod bindings so they work on macOS, Windows, and Linux, and use physical [Code] bindings only where key position matters. Pass an array of keys such as G G to useHotkey for a sequence. Show platform-correct labels with formatForDisplay and reveal hints with useHotkeyHint while modifiers are held. Declare app hotkeys with defineAppHotkeys and pass them to HotkeysProvider as appHotkeys, with customHotkeys and onCustomHotkeysChange to persist user rebinding. Use useHotkeyRecorder with detectConflicts and onReject to record new bindings.'

const edgeCases = [
  {
    title: 'Text fields',
    tag: 'j in a textarea',
    body: "Pressing J in a comment box types a J. It doesn't jump to the next item.",
  },
  {
    title: 'Browser defaults',
    tag: '⌘S',
    body: '⌘S saves your doc, not the web page.',
  },
  {
    title: 'macOS, Windows, and Linux',
    tag: 'Mod+S',
    body: 'Write Mod once. Mac users get ⌘, everyone else gets Ctrl.',
  },
  {
    title: 'Sequences',
    tag: 'G then I',
    body: "G then I for the inbox. The Konami code, if you're feeling it.",
  },
  {
    title: 'Conflicts',
    tag: '⌘K twice',
    body: 'Two features grab the same key? You decide who wins.',
  },
  {
    title: 'Cleanup',
    tag: 'unmount',
    body: 'Shortcuts go away with the component that added them.',
  },
  {
    title: 'Keyboard layouts',
    tag: '⌥S → "ß"',
    body: 'German, French, Russian, Dvorak. Your shortcuts still work.',
  },
  {
    title: 'Input methods',
    tag: 'IME',
    body: "People typing Japanese or Chinese won't trigger shortcuts by accident.",
  },
] as const

// Real completions from the Hotkey type for 'Mod+Alt+K.
const completions = [
  ['Mod+Alt+K', ''],
  ['Mod+Alt+K', 'anaMode'],
  ['Mod+Alt+K', 'atakana'],
  ['Mod+Alt+[K', 'anaMode]'],
  ['Mod+Alt+[K', 'atakana]'],
  ['Mod+Alt+[K', 'eyA]'],
] as const

export default function HotkeysLanding() {
  return (
    <LibraryLandingShell
      description="Type-safe keyboard shortcuts for any framework. They stay out of the way while people type, show the right keys on every platform, and let users pick their own."
      headline="Great defaults for everyone. Superpowers for your power users."
      hero={
        <LiveDemo fallbackHeight="min-h-[27rem]" label="launch board">
          <ShortcutLab />
        </LiveDemo>
      }
      libraryId="hotkeys"
      prompt={hotkeysPrompt}
      promptLabel="Copy Hotkeys prompt"
    >
      <LandingSection tone="raised">
        <SectionHeader
          body="A keydown listener takes five minutes. Then someone types in a text box, or opens your app on Windows, or uses a German keyboard."
          title="What a keydown listener misses"
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {edgeCases.map((item) => (
            <li
              key={item.title}
              className="rounded-xl border border-border-subtle bg-background-surface p-5"
            >
              <code className="inline-block rounded-md bg-[rgb(var(--landing-glow)/0.12)] px-2 py-1 font-ds-mono text-ds-mono-xs text-(--landing-accent-bright)">
                {item.tag}
              </code>
              <h3 className="mt-5 text-ds-heading-5 text-text-primary">
                {item.title}
              </h3>
              <p className="mt-2 text-ds-body-sm text-text-primary/60">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </LandingSection>

      <LandingSection>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <SectionHeader
            body="Your editor autocompletes every shortcut. Typos and impossible combos fail before you ship them."
            title="Typed shortcut strings"
          />
          <TypeSafetyEditor />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <SectionHeader
            body="Mac users see ⌥⇧⌘S. Windows users see Ctrl+Alt+Shift+S. Same shortcut, and nobody has to translate."
            title="Labels for each platform"
          />
          <LiveDemo fallbackHeight="min-h-[22rem]" label="formatForDisplay">
            <FormatLab />
          </LiveDemo>
        </div>
      </LandingSection>

      <LandingSection>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <SectionHeader
            body="Hold ⌘ or ⌥ and the buttons show their shortcuts. People learn them without opening a help page."
            title="Hints while a modifier is held"
          />
          <LiveDemo fallbackHeight="min-h-[18rem]" label="discoverable">
            <DefaultsLab />
          </LiveDemo>
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <SectionHeader
              body="List your shortcuts once and get a cheat sheet and a settings page out of it. Users press the keys they want, and Hotkeys tells them when something else already has them."
              title="Shortcuts users can change"
            />
          </div>
          <LiveDemo fallbackHeight="min-h-[20rem]" label="shortcut settings">
            <RebindLab />
          </LiveDemo>
        </div>
      </LandingSection>

      <LandingSection>
        <SectionHeader
          body="See every registered shortcut and watch what fires as you press keys. Much better than console.log."
          title="Awesome Devtools"
        />
      </LandingSection>
    </LibraryLandingShell>
  )
}

function SectionHeader({
  body,
  title,
}: {
  body: React.ReactNode
  title: string
}) {
  return (
    <div className="max-w-180">
      <h2 className="font-ds-display text-ds-heading-1 md:text-ds-display-sm">
        {title}
      </h2>
      <p className="mt-6 border-l-2 border-(--landing-accent) pl-5 text-ds-body-sm text-text-secondary sm:text-ds-body-md">
        {body}
      </p>
    </div>
  )
}

function LiveDemo({
  children,
  fallbackHeight,
  label,
}: {
  children: React.ReactNode
  fallbackHeight: string
  label: string
}) {
  const fallback = (
    <LandingWindow label={label}>
      <div className={fallbackHeight} />
    </LandingWindow>
  )
  return (
    <ClientOnly fallback={fallback}>
      <React.Suspense fallback={fallback}>{children}</React.Suspense>
    </ClientOnly>
  )
}

function TypeSafetyEditor() {
  return (
    <LandingWindow label="Editor.tsx">
      <div className="overflow-x-auto p-5 font-ds-mono text-ds-mono-sm leading-8 sm:p-6">
        <p className="text-text-primary/70">
          <span className="text-ds-blue-300">useHotkeys</span>([
        </p>
        <p className="pl-6 text-text-primary/70">
          {'{ hotkey: '}
          <span className="text-(--landing-accent-bright)">'Mod+Alt+K</span>
          <span className="inline-block h-5 w-0.5 translate-y-1 bg-(--landing-accent-bright)" />
        </p>
        <div className="ml-6 mt-1 w-fit min-w-72 rounded-lg border border-border-default bg-background-subtle p-1.5 shadow-lg">
          {completions.map(([match, rest], index) => (
            <p
              key={`${match}${rest}`}
              className={`rounded px-3 leading-8 ${
                index === 0 ? 'bg-[rgb(var(--landing-glow)/0.16)]' : ''
              }`}
            >
              <span className="text-(--landing-accent-bright)">{match}</span>
              <span className="text-text-primary/70">{rest}</span>
            </p>
          ))}
        </div>
        <p className="mt-3 pl-6 text-text-primary/70">
          {'{ hotkey: '}
          <span className="text-(--landing-accent-bright) underline decoration-ds-terracotta-300 decoration-wavy underline-offset-4">
            'Mod+Control+S'
          </span>
          {' },'}
        </p>
        <p className="ml-6 mt-2 max-w-xl rounded-lg border border-border-default bg-background-subtle px-4 py-3 font-sans text-ds-body-sm leading-6 text-text-primary/75">
          <span className="font-bold text-ds-terracotta-300">Type error: </span>
          Type '"Mod+Control+S"' is not assignable to type 'RegisterableHotkey'.
          Did you mean '"Control+S"'?
        </p>
        <p className="mt-3 text-text-primary/70">])</p>
      </div>
    </LandingWindow>
  )
}
