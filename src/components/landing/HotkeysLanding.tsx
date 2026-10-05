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
  "Add keyboard shortcuts with TanStack Hotkeys. Register commands with useHotkey using Mod bindings so they work on macOS, Windows, and Linux, and use physical [Code] bindings only where key position matters. Add a G G sequence with useHotkeySequence. Show platform-correct labels with formatForDisplay and reveal hints with useHotkeyHint while modifiers are held. Let users rebind commands with useHotkeyRecorder using detectConflicts and onReject, and store the recorded bindings as plain strings in app state."

const edgeCases = [
  {
    title: 'Text fields',
    tag: 'j in a textarea',
    body: "Single-key shortcuts don't fire while focus is in a text field. Mod shortcuts and Escape still do.",
  },
  {
    title: 'Browser defaults',
    tag: '⌘S',
    body: "Matched shortcuts call preventDefault, so ⌘S runs your save instead of the browser's.",
  },
  {
    title: 'macOS, Windows, and Linux',
    tag: 'Mod+S',
    body: 'Mod is ⌘ on macOS and Ctrl on Windows and Linux, for both matching and display.',
  },
  {
    title: 'Sequences',
    tag: 'G then I',
    body: "Multi-key sequences like G then I for the inbox, or the Konami code. Each has a timeout, and modifier presses or key repeats don't advance them.",
  },
  {
    title: 'Conflicts',
    tag: '⌘K twice',
    body: 'Choose what happens when two registrations share a key. Warn, throw, replace, or allow.',
  },
  {
    title: 'Cleanup',
    tag: 'unmount',
    body: 'Framework adapters register on mount, update when your state changes, and unregister on unmount.',
  },
  {
    title: 'Keyboard layouts',
    tag: '⌥S → "ß"',
    body: 'Option, dead keys, AltGr, and non-Latin layouts change what the browser reports. Letter shortcuts still match.',
  },
  {
    title: 'Input methods',
    tag: 'IME',
    body: "Shortcuts like / don't fire while an IME is composing Japanese or Chinese text.",
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
      description="Type-safe keyboard shortcuts and sequences for any framework. Hotkeys skips them while people type, shows the right keys on each platform, and records new bindings when users want to change them."
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
          body="A hand-written listener checks one key and one modifier. A real app also has to skip text fields, block the browser's own shortcuts, map Mod to the right key on each platform, and cope with layouts that report different characters."
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
            body="Every hotkey string autocompletes in your editor. Misspelled keys fail type checking, and so do impossible combinations like Mod+Control, which would be Ctrl+Ctrl on Windows."
            title="Typed shortcut strings"
          />
          <TypeSafetyEditor />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <SectionHeader
            body="formatForDisplay shows Mod+Alt+Shift+S as ⌥⇧⌘S on macOS and Ctrl+Alt+Shift+S on Windows. Meta becomes Win on Windows and Super on Linux. Bindings to a physical key can use the label from the user's keyboard layout."
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
            body="useHotkeyHint tells each button whether the held modifiers match its shortcut. Hold ⌥ or ⌘ to see it. The note field at the top shows the other default, single-key shortcuts skipping text fields."
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
              body="useHotkeyRecorder captures a new binding as a plain string you can store anywhere. With conflict detection on, it rejects keys already used by another shortcut or sequence on the page."
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
          body="Keyboard bugs are hard to chase with console.log. The Hotkeys panel in TanStack Devtools shows what's registered and what fired as you press keys, so you can see the problem instead of guessing at it."
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
          Type '"Mod+Control+S"' is not assignable to type
          'RegisterableHotkey'. Did you mean '"Control+S"'?
        </p>
        <p className="mt-3 text-text-primary/70">])</p>
      </div>
    </LandingWindow>
  )
}

