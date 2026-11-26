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
const ScopesLab = React.lazy(() =>
  loadDemos().then((m) => ({ default: m.ScopesLab })),
)
const DefaultsLab = React.lazy(() =>
  loadDemos().then((m) => ({ default: m.DefaultsLab })),
)
const RebindLab = React.lazy(() =>
  loadDemos().then((m) => ({ default: m.RebindLab })),
)

const hotkeysPrompt =
  'Add keyboard shortcuts with TanStack Hotkeys. Register commands with useHotkey using Mod bindings so they work on macOS, Windows, and Linux, and use physical [Code] bindings only where key position matters. Pass an array of keys such as G G to useHotkey for a sequence. Wrap dialogs and other overlays in a HotkeysProvider with a scope and exclusive so their hotkeys suspend the rest of the page while they are open. Show platform-correct labels with formatForDisplay and reveal hints with useHotkeyHint while modifiers are held. Declare app hotkeys with defineAppHotkeys, list them in a cheat sheet with useAppHotkeyList, and pass them to HotkeysProvider as appHotkeys, with customHotkeys and onCustomHotkeysChange to persist user rebinding. Use useHotkeyRecorder with detectConflicts and onReject to record new bindings.'

// A hand-written save shortcut after a few bug reports. Each card points at
// the line that patches it, and most of those patches have holes.
const listenerCode = [
  "document.addEventListener('keydown', (e) => {",
  '  const el = document.activeElement',
  "  if (el?.closest('input, textarea')) return",
  "  if (el?.closest('button')) return",
  '  if (dialogOpen) return',
  '  if (e.isComposing) return',
  '  const mod = isMac ? e.metaKey : e.ctrlKey',
  "  if (mod && (e.key === 's' || e.code === 'KeyS')) {",
  '    e.preventDefault()',
  '    save()',
  '  }',
  '  // TODO: update the cheat sheet',
  '})',
]

const edgeCases: Array<{
  tag: string
  title: string
  body: string
  lines: Array<number>
}> = [
  {
    tag: '⌘S',
    title: 'Browser shortcuts',
    body: '⌘S saves your doc, not the web page.',
    lines: [8],
  },
  {
    tag: 'Mod+S',
    title: 'Mac and Windows modifiers',
    body: 'Write Mod once. Mac users get ⌘, everyone else gets Ctrl.',
    lines: [6],
  },
  {
    tag: 'J in a textarea',
    title: 'Typing in a field',
    body: 'Letter shortcuts wait while someone types. ⌘S and Esc still work from the field.',
    lines: [2],
  },
  {
    tag: 'Esc',
    title: 'Dialogs over the page',
    body: 'Put the dialog in a scope, and Esc closes it, not the page behind it too.',
    lines: [4],
  },
  {
    tag: 'Enter on a button',
    title: 'Focused buttons and menus',
    body: 'Buttons keep Enter and Space, and menus keep their arrow keys.',
    lines: [3],
  },
  {
    tag: 'Dvorak · AZERTY · Русский',
    title: 'Other keyboard layouts',
    body: 'Shortcuts match the letter people press, and still work on non-Latin layouts.',
    lines: [7],
  },
  {
    tag: 'AltGr+Q → @',
    title: 'AltGr and input methods',
    body: "Typing @ on a German keyboard won't fire Ctrl+Alt+Q, and composing Japanese won't fire letter shortcuts.",
    lines: [5, 6],
  },
  {
    tag: '?',
    title: 'Out-of-date cheat sheets',
    body: 'Declare shortcuts once, and the cheat sheet and settings page read the same list.',
    lines: [11],
  },
]

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
      description="A type-safe library for keyboard shortcuts in web apps. One framework-agnostic core, plus adapters for React, Vue, Solid, Svelte, Angular, and more."
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
          body="A keydown listener takes five minutes. Then someone types in a text box, opens your app on Windows, or uses a German keyboard, and the patches pile up."
          title="What a keydown listener misses"
        />
        <KeydownMisses />
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
        <SectionHeader
          body="Wrap a dialog in an exclusive scope and it owns the keyboard. ⌘S saves the issue, not the board behind it, and the board's other shortcuts wait until it closes. Nothing else has to know the dialog is open."
          title="Hotkey scopes"
        />
        <div className="mt-12">
          <LiveDemo fallbackHeight="min-h-[30rem]" label="hotkey scopes">
            <ScopesLab />
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
              body="List your shortcuts once and get a cheat sheet and a settings page out of it. Users press the keys they want, and Hotkeys tells them when something else already has them. Labels match each platform and keyboard layout, so ⌘P on a Mac is Ctrl+P on Windows."
              title="Shortcuts users can change"
            />
          </div>
          <LiveDemo fallbackHeight="min-h-[26rem]" label="shortcut settings">
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

function KeydownMisses() {
  const [active, setActive] = React.useState<number | null>(null)
  const litLines = active === null ? [] : edgeCases[active].lines

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <div className="lg:sticky lg:top-24">
        <LandingWindow label="keydown.ts">
          <pre className="overflow-x-auto py-4 font-ds-mono text-ds-mono-xs">
            <code>
              {listenerCode.map((line, index) => (
                <span
                  key={index}
                  className={`block h-7 whitespace-pre px-5 leading-7 transition-colors duration-150 ${
                    litLines.includes(index)
                      ? 'bg-[rgb(var(--landing-glow)/0.16)] text-(--landing-accent-bright) shadow-[inset_2px_0_0_var(--landing-accent)]'
                      : active === null
                        ? 'text-text-primary/70'
                        : 'text-text-primary/35'
                  }`}
                >
                  {line}
                </span>
              ))}
            </code>
          </pre>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-subtle px-5 py-4">
            <span className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/45">
              The same shortcut with Hotkeys
            </span>
            <code className="font-ds-mono text-ds-mono-sm text-(--landing-accent-bright)">
              useHotkey('Mod+S', save)
            </code>
          </div>
        </LandingWindow>
        <p className="mt-3 hidden text-ds-label-sm text-text-primary/45 lg:block">
          Hover a card to find its patch.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {edgeCases.map((item, index) => (
          <li
            key={item.title}
            className={`rounded-xl border bg-background-surface p-5 transition-colors duration-150 ${
              active === index
                ? 'border-(--landing-accent)'
                : 'border-border-subtle'
            }`}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
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
