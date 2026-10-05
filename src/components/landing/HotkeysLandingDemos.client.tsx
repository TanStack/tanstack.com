import * as React from 'react'
import {
  detectPlatform,
  formatForDisplay,
  useHeldKeys,
  useHotkey,
  useHotkeyHint,
  useHotkeyRecorder,
  useHotkeySequence,
} from '@tanstack/react-hotkeys'
import type { Hotkey, RecorderRejection } from '@tanstack/react-hotkeys'

import { KeyCombo, Keycap } from './HotkeysKeycap'
import { LandingWindow } from './LibraryLanding'

type Platform = ReturnType<typeof detectPlatform>

const startingItems = [
  'Ship Hotkeys 1.0',
  'Write the announcement',
  'Record the launch video',
  'Update the docs',
  'Test every keyboard layout',
]

type BoardItem = { id: number; title: string; done: boolean }

const heldLabels: Record<string, Record<Platform, string>> = {
  Meta: { mac: '⌘', windows: 'Win', linux: 'Super' },
  Control: { mac: '⌃', windows: 'Ctrl', linux: 'Ctrl' },
  Alt: { mac: '⌥', windows: 'Alt', linux: 'Alt' },
  Shift: { mac: '⇧', windows: 'Shift', linux: 'Shift' },
}

// These shortcuts are registered on the whole page, so they work without
// clicking into the demo first.
export function ShortcutLab() {
  const [platform] = React.useState(detectPlatform)
  const [items, setItems] = React.useState<Array<BoardItem>>(() =>
    startingItems.map((title, id) => ({ id, title, done: id === 0 })),
  )
  const [selected, setSelected] = React.useState(2)
  const [note, setNote] = React.useState('')
  const [fired, setFired] = React.useState<{ name: string; count: number }>()
  const noteRef = React.useRef<HTMLTextAreaElement>(null)
  const heldKeys = useHeldKeys()

  const fire = (name: string) =>
    setFired((previous) => ({ name, count: (previous?.count ?? 0) + 1 }))

  React.useEffect(() => {
    if (!fired) return
    const timeout = window.setTimeout(() => setFired(undefined), 900)
    return () => window.clearTimeout(timeout)
  }, [fired])

  useHotkey(
    'J',
    () => {
      setSelected((index) => Math.min(index + 1, items.length - 1))
      fire('Next / previous')
    },
    { meta: { name: 'Next item' } },
  )
  useHotkey(
    'K',
    () => {
      setSelected((index) => Math.max(index - 1, 0))
      fire('Next / previous')
    },
    { meta: { name: 'Previous item' } },
  )
  useHotkeySequence(
    ['G', 'G'],
    () => {
      setSelected(0)
      fire('Jump to top')
    },
    { meta: { name: 'Go to top' } },
  )
  useHotkey(
    'X',
    () => {
      setItems((current) =>
        current.map((item, index) =>
          index === selected ? { ...item, done: !item.done } : item,
        ),
      )
      fire('Mark done')
    },
    { meta: { name: 'Mark done' } },
  )
  useHotkey('Mod+S', () => fire('Save'), { meta: { name: 'Save' } })
  useHotkey(
    'Mod+Enter',
    () => {
      const title = note.trim()
      if (!title) return
      setItems((current) => [
        { id: current.length + 100, title, done: false },
        ...current,
      ])
      setSelected(0)
      setNote('')
      fire('Add note')
    },
    { target: noteRef, meta: { name: 'Add note' } },
  )
  useHotkey(
    'Escape',
    () => {
      noteRef.current?.blur()
      fire('Leave the note')
    },
    { target: noteRef, meta: { name: 'Leave the note' } },
  )

  const legend = [
    { name: 'Next / previous', keys: ['J', 'K'] },
    { name: 'Jump to top', keys: ['G', 'G'] },
    { name: 'Mark done', keys: ['X'] },
    {
      name: 'Save',
      keys: formatForDisplay('Mod+S', { platform, parts: true }),
    },
    {
      name: 'Add note',
      keys: formatForDisplay('Mod+Enter', { platform, parts: true }),
    },
    { name: 'Leave the note', keys: ['Esc'] },
  ]

  return (
    <LandingWindow label="launch board">
      <div className="grid sm:grid-cols-[1.1fr_0.9fr]">
        <div className="border-b border-border-subtle p-4 sm:border-b-0 sm:border-r sm:p-5">
          <div className="flex h-7 items-center justify-end">
            {fired?.name === 'Save' ? (
              <span className="rounded-full bg-(--landing-accent) px-2.5 py-0.5 text-ds-label-sm text-(--landing-accent-ink)">
                Saved
              </span>
            ) : null}
          </div>
          <ul className="mt-3 space-y-1">
            {items.slice(0, 6).map((item, index) => (
              <li
                key={item.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-ds-label-md ${
                  index === selected
                    ? 'bg-[rgb(var(--landing-glow)/0.16)] text-text-primary'
                    : 'text-text-primary/70'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                    item.done
                      ? 'border-(--landing-accent) bg-(--landing-accent) text-(--landing-accent-ink)'
                      : 'border-border-default'
                  }`}
                >
                  {item.done ? '✓' : null}
                </span>
                <span className={item.done ? 'line-through opacity-60' : ''}>
                  {item.title}
                </span>
              </li>
            ))}
          </ul>
          <textarea
            ref={noteRef}
            aria-label="Add a note"
            className="mt-4 block h-20 w-full resize-none rounded-lg border border-border-default bg-background-subtle px-3 py-2 text-ds-body-sm text-text-primary outline-none placeholder:text-text-primary/40 focus:border-(--landing-accent)"
            onChange={(event) => setNote(event.target.value)}
            placeholder="New note"
            value={note}
          />
        </div>

        <div className="p-4 sm:p-5">
          <p className="flex h-7 items-center font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/45">
            Shortcuts
          </p>
          <ul className="mt-3 space-y-1">
            {legend.map((row) => {
              const isFired = fired?.name === row.name
              return (
                <li
                  key={row.name}
                  className={`flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 ${
                    isFired ? 'bg-[rgb(var(--landing-glow)/0.16)]' : ''
                  }`}
                >
                  <span className="text-ds-label-sm text-text-primary/80">
                    {row.name}
                  </span>
                  <KeyCombo keys={row.keys} pressed={isFired} size="sm" />
                </li>
              )
            })}
          </ul>
        </div>
      </div>
      <div className="flex min-h-12 flex-wrap items-center gap-3 border-t border-border-subtle px-4 py-2 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/45 sm:px-5">
        Held
        {heldKeys.length === 0 ? (
          <span className="text-text-primary/30">nothing</span>
        ) : (
          heldKeys.map((key) => (
            <Keycap key={key} size="sm">
              {heldLabels[key]?.[platform] ?? key.toUpperCase()}
            </Keycap>
          ))
        )}
      </div>
    </LandingWindow>
  )
}

const formatRows = [
  'Mod+S',
  'Mod+Alt+Shift+S',
  'Control+Meta+K',
  'Alt+[KeyQ]',
  '[NumpadEnter]',
] as const satisfies ReadonlyArray<Hotkey>

// The layout labels a French AZERTY keyboard prints on these physical keys.
const azertyLayout = new Map([
  ['KeyQ', 'a'],
  ['KeyA', 'q'],
  ['KeyW', 'z'],
  ['KeyZ', 'w'],
])

export function FormatLab() {
  const [platform, setPlatform] = React.useState<Platform>(detectPlatform)
  const [layout, setLayout] = React.useState<'qwerty' | 'azerty'>('qwerty')

  return (
    <LandingWindow label="formatForDisplay">
      <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-5 py-4">
        <Segmented
          label="Platform"
          onChange={setPlatform}
          options={[
            ['mac', 'macOS'],
            ['windows', 'Windows'],
            ['linux', 'Linux'],
          ]}
          value={platform}
        />
        <Segmented
          label="Keyboard layout"
          onChange={setLayout}
          options={[
            ['qwerty', 'QWERTY'],
            ['azerty', 'AZERTY'],
          ]}
          value={layout}
        />
      </div>
      <ul className="divide-y divide-border-subtle">
        {formatRows.map((hotkey) => (
          <li
            key={hotkey}
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
          >
            <code className="font-ds-mono text-ds-mono-sm text-(--landing-accent-bright)">
              '{hotkey}'
            </code>
            <KeyCombo
              keys={formatForDisplay(hotkey, {
                platform,
                parts: true,
                layoutMap: layout === 'azerty' ? azertyLayout : undefined,
              })}
            />
          </li>
        ))}
      </ul>
    </LandingWindow>
  )
}

function Segmented<TValue extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: TValue) => void
  options: ReadonlyArray<readonly [TValue, string]>
  value: TValue
}) {
  return (
    <div
      aria-label={label}
      className="flex rounded-lg border border-border-default p-0.5"
      role="group"
    >
      {options.map(([optionValue, optionLabel]) => (
        <button
          key={optionValue}
          aria-pressed={value === optionValue}
          className="rounded-md px-3 py-1.5 text-ds-label-sm text-text-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-accent-bright) aria-pressed:bg-text-primary/10 aria-pressed:text-text-primary"
          onClick={() => onChange(optionValue)}
          type="button"
        >
          {optionLabel}
        </button>
      ))}
    </div>
  )
}

const toolbar = [
  { name: 'Save', hotkey: 'Mod+S' },
  { name: 'Save as', hotkey: 'Alt+S' },
  { name: 'Duplicate', hotkey: 'Alt+D' },
] as const satisfies ReadonlyArray<{ name: string; hotkey: Hotkey }>

export function DefaultsLab() {
  const [platform] = React.useState(detectPlatform)

  return (
    <LandingWindow label="discoverable">
      <div className="p-6">
        <div className="flex flex-wrap gap-3 pt-3">
          {toolbar.map((tool) => (
            <HintButton key={tool.hotkey} platform={platform} {...tool} />
          ))}
        </div>
        <code className="mt-10 block rounded-lg bg-background-subtle px-4 py-3 font-ds-mono text-ds-mono-xs text-text-primary/70">
          const showHint = useHotkeyHint(
          <span className="text-(--landing-accent-bright)">'Alt+S'</span>)
        </code>
      </div>
    </LandingWindow>
  )
}

function HintButton({
  hotkey,
  name,
  platform,
}: {
  hotkey: Hotkey
  name: string
  platform: Platform
}) {
  const isVisible = useHotkeyHint(hotkey, { platform })
  return (
    <span className="relative rounded-lg border border-border-default bg-background-subtle px-4 py-2.5 text-ds-label-md text-text-primary">
      {name}
      {isVisible ? (
        <span className="absolute -right-3 -top-4 rounded-md bg-(--landing-accent) px-2 py-0.5 text-ds-label-sm text-(--landing-accent-ink) shadow-md">
          {formatForDisplay(hotkey, { platform })}
        </span>
      ) : null}
    </span>
  )
}

export function RebindLab() {
  const [platform] = React.useState(detectPlatform)
  const cardRef = React.useRef<HTMLDivElement>(null)
  const [quickOpen, setQuickOpen] = React.useState<Hotkey>('Mod+P')
  const [message, setMessage] = React.useState<{
    tone: 'bad' | 'good'
    text: string
  } | null>(null)
  const [fired, setFired] = React.useState<string | null>(null)

  useHotkey('Alt+S', () => setFired('Save as'), {
    target: cardRef,
    meta: { name: 'Save as' },
  })
  useHotkeySequence(['D', 'D'], () => setFired('Delete line'), {
    target: cardRef,
    meta: { name: 'Delete line' },
  })
  useHotkey(quickOpen, () => setFired('Quick open'), {
    target: cardRef,
    meta: { name: 'Quick open' },
  })

  const recorder = useHotkeyRecorder({
    platform,
    detectConflicts: {
      exclude: (registration) =>
        registration.options.meta?.name === 'Quick open',
    },
    onRecord: (hotkey) => {
      setQuickOpen(hotkey)
      setMessage({ tone: 'good', text: `Saved as '${hotkey}'` })
    },
    onReject: (rejection) =>
      setMessage({ tone: 'bad', text: describeRejection(rejection, platform) }),
    onCancel: () => setMessage(null),
  })

  React.useEffect(() => {
    if (!fired) return
    const timeout = window.setTimeout(() => setFired(null), 700)
    return () => window.clearTimeout(timeout)
  }, [fired])

  const rows = [
    {
      name: 'Save as',
      keys: formatForDisplay('Alt+S', { platform, parts: true }),
    },
    { name: 'Delete line', keys: ['D', 'D'] },
  ]

  return (
    <LandingWindow label="shortcut settings">
      <div
        ref={cardRef}
        aria-label="Shortcut settings"
        className="p-5 sm:p-6"
        role="group"
      >
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.name}
              className={`flex items-center justify-between gap-4 rounded-lg px-4 py-3 ${
                fired === row.name
                  ? 'bg-[rgb(var(--landing-glow)/0.16)]'
                  : 'bg-background-subtle'
              }`}
            >
              <span className="text-ds-label-lg text-text-primary">
                {row.name}
              </span>
              <KeyCombo keys={row.keys} pressed={fired === row.name} />
            </li>
          ))}
          <li
            className={`flex flex-wrap items-center justify-between gap-4 rounded-lg px-4 py-3 ${
              recorder.isRecording || fired === 'Quick open'
                ? 'bg-[rgb(var(--landing-glow)/0.16)]'
                : 'bg-background-subtle'
            }`}
          >
            <span className="text-ds-label-lg text-text-primary">
              Quick open
            </span>
            <button
              className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-accent-bright)"
              onClick={() => {
                setMessage(null)
                recorder.startRecording()
              }}
              type="button"
            >
              {recorder.isRecording ? (
                <span className="inline-flex h-10 items-center rounded-lg border-2 border-(--landing-accent) px-4 text-ds-label-md text-text-primary/70">
                  Press a shortcut…
                </span>
              ) : (
                <KeyCombo
                  keys={formatForDisplay(quickOpen, { platform, parts: true })}
                  pressed={fired === 'Quick open'}
                />
              )}
              <span className="sr-only">Change the Quick open shortcut</span>
            </button>
          </li>
        </ul>
        <p
          aria-live="polite"
          className={`mt-5 min-h-7 text-ds-label-lg ${
            message?.tone === 'bad'
              ? 'text-ds-terracotta-300'
              : 'text-(--landing-accent-bright)'
          }`}
        >
          {message?.text}
        </p>
      </div>
    </LandingWindow>
  )
}

function describeRejection(rejection: RecorderRejection, platform: Platform) {
  const conflict = rejection.conflicts?.[0]
  if (!conflict) return rejection.message
  const name = conflict.registration.options.meta?.name ?? 'another shortcut'
  const pressed = rejection.hotkey
    ? formatForDisplay(rejection.hotkey, { platform })
    : 'That shortcut'
  return conflict.type === 'sequence'
    ? `${pressed} starts the "${name}" sequence.`
    : `${pressed} is already used by "${name}".`
}
