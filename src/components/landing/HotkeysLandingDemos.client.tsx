import * as React from 'react'
import {
  HotkeysProvider,
  defineAppHotkeys,
  detectPlatform,
  formatForDisplay,
  useAppHotkeyList,
  useCustomHotkeys,
  useHeldKeys,
  useHotkey,
  useHotkeyHint,
  useHotkeyRecorder,
  useHotkeys,
} from '@tanstack/react-hotkeys'
import type {
  Hotkey,
  HotkeyChord,
  RecorderRejection,
} from '@tanstack/react-hotkeys'

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
      setSelected((index) => Math.min(index + 1, Math.min(items.length, 6) - 1))
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
  useHotkey(
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

const scopeIssues = [
  { id: 101, title: 'Ship Hotkeys 1.0' },
  { id: 102, title: 'Record the launch video' },
  { id: 103, title: 'Update the docs' },
  { id: 104, title: 'Write the blog post' },
]

type ScopeAction = 'next' | 'edit' | 'saveBoard' | 'saveIssue' | 'close'

// A line lights up when its hotkey runs. Lines with a boardKey are the
// board's hotkeys, which the dialog's exclusive scope suspends.
const scopeCode: Array<{
  text: string
  action?: ScopeAction
  boardKey?: string
  provider?: boolean
}> = [
  { text: 'function Board() {' },
  { text: "  useHotkey('J', nextIssue)", action: 'next', boardKey: 'J' },
  { text: "  useHotkey('E', editIssue)", action: 'edit', boardKey: 'E' },
  {
    text: "  useHotkey('Mod+S', saveBoard)",
    action: 'saveBoard',
    boardKey: 'S',
  },
  { text: '  return editing && (' },
  { text: '    <HotkeysProvider scope="dialog" exclusive>', provider: true },
  { text: '      <EditDialog />', provider: true },
  { text: '    </HotkeysProvider>', provider: true },
  { text: '  )' },
  { text: '}' },
  { text: '' },
  { text: 'function EditDialog() {' },
  { text: "  useHotkey('Mod+S', saveIssue)", action: 'saveIssue' },
  { text: "  useHotkey('Escape', close)", action: 'close' },
  { text: '  return <Dialog />' },
  { text: '}' },
]

export function ScopesLab() {
  const [platform] = React.useState(detectPlatform)
  const boardRef = React.useRef<HTMLDivElement>(null)
  const [selected, setSelected] = React.useState(1)
  const [editing, setEditing] = React.useState(false)
  const [fired, setFired] = React.useState<{
    action: ScopeAction
    count: number
  }>()
  const heldKeys = useHeldKeys()

  const fire = (action: ScopeAction) =>
    setFired((previous) => ({ action, count: (previous?.count ?? 0) + 1 }))

  React.useEffect(() => {
    if (!fired) return
    const timeout = window.setTimeout(() => setFired(undefined), 900)
    return () => window.clearTimeout(timeout)
  }, [fired])

  // Bound to the board, so they don't also drive the launch board up top.
  useHotkey(
    'J',
    () => {
      setSelected((index) => (index + 1) % scopeIssues.length)
      fire('next')
    },
    { target: boardRef, meta: { name: 'Next issue' } },
  )
  useHotkey(
    'E',
    () => {
      setEditing(true)
      fire('edit')
    },
    { target: boardRef, meta: { name: 'Edit issue' } },
  )
  useHotkey('Mod+S', () => fire('saveBoard'), {
    target: boardRef,
    meta: { name: 'Save board' },
  })

  const saveKeys = formatForDisplay('Mod+S', { platform, parts: true })
  const legend: Array<{
    action: ScopeAction
    name: string
    keys: ReadonlyArray<string>
  }> = [
    { action: 'next', name: 'Next issue', keys: ['J'] },
    { action: 'edit', name: 'Edit issue', keys: ['E'] },
    { action: 'saveBoard', name: 'Save board', keys: saveKeys },
  ]

  return (
    <LandingWindow label="hotkey scopes">
      <div className="grid lg:grid-cols-2">
        <pre className="min-w-0 overflow-x-auto border-b border-border-subtle bg-background-subtle py-4 font-ds-mono text-ds-mono-xs lg:border-b-0 lg:border-r">
          <code>
            {scopeCode.map((line, index) => {
              const isLit =
                (line.action !== undefined && line.action === fired?.action) ||
                (line.provider && editing)
              const isSuspended = editing && line.boardKey !== undefined
              const isHeld = heldKeys.includes(line.boardKey ?? '')
              return (
                <span
                  key={index}
                  className={`flex h-7 items-center justify-between gap-4 px-5 transition-colors duration-150 ${
                    isLit
                      ? 'bg-[rgb(var(--landing-glow)/0.16)] text-(--landing-accent-bright) shadow-[inset_2px_0_0_var(--landing-accent)]'
                      : isSuspended
                        ? 'text-text-primary/35'
                        : 'text-text-primary/70'
                  }`}
                >
                  {line.text}
                  {isSuspended ? (
                    <span
                      className={`rounded px-1.5 py-0.5 text-ds-mono-2xs uppercase transition-colors duration-100 ${
                        isHeld
                          ? 'bg-ds-terracotta-400 text-white'
                          : 'bg-ds-terracotta-300/15 text-ds-terracotta-400 dark:text-ds-terracotta-300'
                      }`}
                    >
                      Suspended
                    </span>
                  ) : null}
                </span>
              )
            })}
          </code>
        </pre>

        <div
          ref={boardRef}
          aria-label="Launch board. Press J for the next issue and E to edit it."
          className="group relative flex min-w-0 flex-col p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--landing-accent-bright) sm:p-5"
          // An open dialog suspends every hotkey on the page, so close it when
          // focus leaves the board.
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setEditing(false)
            }
          }}
          role="application"
          // The board takes focus so its hotkeys stay out of the demo up top.
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          <div className="flex h-7 items-center justify-between gap-3">
            <span className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/45">
              Launch board
            </span>
            {fired?.action === 'saveBoard' ? (
              <span className="rounded-full bg-(--landing-accent) px-2.5 py-0.5 text-ds-label-sm text-(--landing-accent-ink)">
                Board saved
              </span>
            ) : (
              <span className="text-ds-label-sm text-text-primary/45 group-focus:invisible">
                Click here, then press J or E
              </span>
            )}
          </div>
          <ul className="mt-3 space-y-1">
            {scopeIssues.map((issue, index) => (
              <li
                key={issue.id}
                className={`flex gap-3 rounded-lg px-3 py-2 text-ds-label-md ${
                  index === selected
                    ? 'bg-[rgb(var(--landing-glow)/0.16)] text-text-primary'
                    : 'text-text-primary/70'
                }`}
              >
                <span className="text-text-primary/45">#{issue.id}</span>
                {issue.title}
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 pt-6">
            {legend.map((row) => (
              <span key={row.action} className="flex items-center gap-2">
                <KeyCombo
                  keys={row.keys}
                  pressed={fired?.action === row.action}
                  size="sm"
                />
                <span className="text-ds-label-sm text-text-primary/70">
                  {row.name}
                </span>
              </span>
            ))}
          </div>

          {editing ? (
            <HotkeysProvider scope="dialog" exclusive>
              <ScopeDialog
                boardRef={boardRef}
                issue={scopeIssues[selected]}
                onClose={() => setEditing(false)}
                onFire={fire}
                saved={fired?.action === 'saveIssue'}
                saveKeys={saveKeys}
              />
            </HotkeysProvider>
          ) : null}
        </div>
      </div>
    </LandingWindow>
  )
}

function ScopeDialog({
  boardRef,
  issue,
  onClose,
  onFire,
  saved,
  saveKeys,
}: {
  boardRef: React.RefObject<HTMLDivElement | null>
  issue: (typeof scopeIssues)[number]
  onClose: () => void
  onFire: (action: ScopeAction) => void
  saved: boolean
  saveKeys: ReadonlyArray<string>
}) {
  useHotkey('Mod+S', () => onFire('saveIssue'), {
    target: boardRef,
    meta: { name: 'Save issue' },
  })
  useHotkey(
    'Escape',
    () => {
      onClose()
      onFire('close')
    },
    { target: boardRef, meta: { name: 'Close the dialog' } },
  )

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background-default/70 p-4 backdrop-blur-[2px]">
      <div
        aria-label={`Edit #${issue.id}`}
        className="w-full max-w-sm rounded-xl border border-[rgb(var(--landing-glow)/0.45)] bg-background-surface p-5 shadow-2xl"
        role="dialog"
      >
        <div className="flex h-7 items-center justify-between gap-3">
          <span className="text-ds-label-lg text-text-primary">
            Edit #{issue.id}
          </span>
          {saved ? (
            <span className="rounded-full bg-(--landing-accent) px-2.5 py-0.5 text-ds-label-sm text-(--landing-accent-ink)">
              Issue saved
            </span>
          ) : null}
        </div>
        <p className="mt-4 rounded-lg border border-border-default bg-background-subtle px-3 py-2 text-ds-body-sm text-text-primary">
          <span className="mr-2 text-text-primary/45">Title</span>
          {issue.title}
        </p>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
          <span className="flex items-center gap-2">
            <KeyCombo keys={saveKeys} pressed={saved} size="sm" />
            <span className="text-ds-label-sm text-text-primary/70">
              Save issue
            </span>
          </span>
          <span className="flex items-center gap-2">
            <KeyCombo keys={['Esc']} size="sm" />
            <span className="text-ds-label-sm text-text-primary/70">Close</span>
          </span>
        </div>
      </div>
    </div>
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
] as const satisfies ReadonlyArray<{ name: string; hotkey: HotkeyChord }>

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
  hotkey: HotkeyChord
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

// The labels a French AZERTY keyboard prints on these physical keys.
// Recorded shortcuts are physical too, so they relabel with the layout.
const azertyLayout = new Map([
  ['Backquote', '²'],
  ['KeyQ', 'a'],
  ['KeyA', 'q'],
  ['KeyW', 'z'],
  ['KeyZ', 'w'],
])

// Declared once. The settings rows and the cheat sheet both read this list.
const settingsHotkeys = defineAppHotkeys({
  saveAs: { hotkey: 'Alt+S', meta: { name: 'Save as' } },
  terminal: {
    hotkey: 'Control+[Backquote]',
    meta: { name: 'Toggle terminal' },
  },
  deleteLine: { hotkey: ['D', 'D'], meta: { name: 'Delete line' } },
  quickOpen: { hotkey: 'Mod+P', meta: { name: 'Quick open' } },
  cheatSheet: { hotkey: '?', meta: { name: 'Cheat sheet' } },
})

export function RebindLab() {
  return (
    <HotkeysProvider appHotkeys={settingsHotkeys}>
      <ShortcutSettings />
    </HotkeysProvider>
  )
}

function ShortcutSettings() {
  // Recording uses the real platform. The toggles only change the labels.
  const [platform] = React.useState(detectPlatform)
  const [shownPlatform, setShownPlatform] = React.useState<Platform>(platform)
  const [layout, setLayout] = React.useState<'qwerty' | 'azerty'>('qwerty')
  const cardRef = React.useRef<HTMLDivElement>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [message, setMessage] = React.useState<{
    tone: 'bad' | 'good'
    text: string
  } | null>(null)
  const [fired, setFired] = React.useState<string | null>(null)
  const appHotkeys = useAppHotkeyList()
  const { setCustomHotkey } = useCustomHotkeys()

  useHotkeys(
    Object.values(settingsHotkeys).map((appHotkey) => ({
      hotkey: appHotkey,
      callback: () =>
        appHotkey.id === 'cheatSheet'
          ? setSheetOpen((open) => !open)
          : setFired(appHotkey.id),
      options: { target: cardRef },
    })),
  )
  useHotkey('Escape', () => setSheetOpen(false), {
    target: cardRef,
    enabled: sheetOpen,
    meta: { name: 'Close the cheat sheet' },
  })

  const recorder = useHotkeyRecorder({
    platform,
    detectConflicts: {
      exclude: (registration) =>
        registration.options.meta?.name === 'Quick open',
    },
    onRecord: (hotkey) => {
      const conflict = setCustomHotkey('quickOpen', hotkey)[0]
      setMessage(
        conflict
          ? {
              tone: 'bad',
              text: `That shortcut is already used by "${conflict.meta?.name}".`,
            }
          : { tone: 'good', text: `Saved as '${hotkey}'` },
      )
    },
    onReject: (rejection) =>
      setMessage({
        tone: 'bad',
        text: describeRejection(rejection, shownPlatform),
      }),
    onCancel: () => setMessage(null),
  })

  React.useEffect(() => {
    if (!fired) return
    const timeout = window.setTimeout(() => setFired(null), 700)
    return () => window.clearTimeout(timeout)
  }, [fired])

  const display = (hotkey: Hotkey | null) => {
    if (hotkey === null) return []
    const options = {
      platform: shownPlatform,
      parts: true,
      layoutMap: layout === 'azerty' ? azertyLayout : undefined,
    } as const
    return typeof hotkey === 'string'
      ? formatForDisplay(hotkey, options)
      : formatForDisplay(hotkey, options).flat()
  }

  return (
    <LandingWindow label="shortcut settings">
      <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-5 py-4 sm:px-6">
        <Segmented
          label="Platform"
          onChange={setShownPlatform}
          options={[
            ['mac', 'macOS'],
            ['windows', 'Windows'],
            ['linux', 'Linux'],
          ]}
          value={shownPlatform}
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
      <div
        ref={cardRef}
        aria-label="Shortcut settings"
        className="relative p-5 sm:p-6"
        role="group"
      >
        <ul className="space-y-2">
          {appHotkeys
            .filter(({ appHotkey }) => appHotkey.id !== 'cheatSheet')
            .map(({ appHotkey }) => {
              const isQuickOpen = appHotkey.id === 'quickOpen'
              const isLit =
                fired === appHotkey.id || (isQuickOpen && recorder.isRecording)
              return (
                <li
                  key={appHotkey.id}
                  className={`flex flex-wrap items-center justify-between gap-4 rounded-lg px-4 py-3 ${
                    isLit
                      ? 'bg-[rgb(var(--landing-glow)/0.16)]'
                      : 'bg-background-subtle'
                  }`}
                >
                  <span className="text-ds-label-lg text-text-primary">
                    {appHotkey.meta?.name}
                  </span>
                  {isQuickOpen ? (
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
                          keys={display(appHotkey.hotkey)}
                          pressed={fired === appHotkey.id}
                        />
                      )}
                      <span className="sr-only">
                        Change the Quick open shortcut
                      </span>
                    </button>
                  ) : (
                    <KeyCombo
                      keys={display(appHotkey.hotkey)}
                      pressed={fired === appHotkey.id}
                    />
                  )}
                </li>
              )
            })}
        </ul>
        <div className="mt-5 flex min-h-10 flex-wrap items-center justify-between gap-3">
          <p
            aria-live="polite"
            className={`text-ds-label-lg ${
              message?.tone === 'bad'
                ? 'text-ds-terracotta-300'
                : 'text-(--landing-accent-bright)'
            }`}
          >
            {message?.text}
          </p>
          <button
            aria-expanded={sheetOpen}
            className="ml-auto flex items-center gap-2 rounded-lg text-ds-label-sm text-text-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-accent-bright)"
            onClick={() => setSheetOpen((open) => !open)}
            type="button"
          >
            <Keycap pressed={fired === 'cheatSheet'} size="sm">
              ?
            </Keycap>
            Cheat sheet
          </button>
        </div>

        {sheetOpen ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background-default/70 p-4 backdrop-blur-[2px]">
            <div
              aria-label="Cheat sheet"
              className="w-full max-w-sm rounded-xl border border-[rgb(var(--landing-glow)/0.45)] bg-background-surface p-5 shadow-2xl"
              role="dialog"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-ds-label-lg text-text-primary">
                  Cheat sheet
                </span>
                <span className="text-ds-label-sm text-text-primary/45">
                  Esc to close
                </span>
              </div>
              <ul className="mt-4 space-y-2">
                {appHotkeys.map(({ appHotkey, isCustom }) => (
                  <li
                    key={appHotkey.id}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-ds-label-md text-text-primary/80">
                      {appHotkey.meta?.name}
                      {isCustom ? (
                        <span className="ml-2 rounded-full bg-[rgb(var(--landing-glow)/0.16)] px-2 py-0.5 text-ds-label-sm text-(--landing-accent-bright)">
                          custom
                        </span>
                      ) : null}
                    </span>
                    <KeyCombo keys={display(appHotkey.hotkey)} size="sm" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
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
  return conflict.registration.kind === 'sequence'
    ? `${pressed} starts the "${name}" sequence.`
    : `${pressed} is already used by "${name}".`
}
