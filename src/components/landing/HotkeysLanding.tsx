import * as React from 'react'
import {
  ArrowsLeftRight,
  Clock,
  Command,
  Crosshair,
  Keyboard,
  Stack,
  WarningCircle,
} from '@phosphor-icons/react'

import {
  LandingEyebrow,
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const hotkeysPrompt =
  'Build a command system with TanStack Hotkeys. Define typed shortcuts, portable Mod bindings, scopes, input filtering, conflict handling, sequences, held keys, recording, and platform-aware display. Keep commands separate from their bindings so users can customize them.'

const commands = [
  {
    name: 'Open search',
    binding: 'Mod+K',
    scope: 'workspace',
    inputs: 'blocked',
  },
  {
    name: 'Show shortcuts',
    binding: 'Shift+?',
    scope: 'global',
    inputs: 'allowed',
  },
  {
    name: 'Archive card',
    binding: 'E',
    scope: 'board',
    inputs: 'blocked',
  },
] as const

const scopes = [
  {
    name: 'global',
    body: 'Help, navigation, and app-wide commands',
    keys: ['Shift+?', 'Mod+K'],
  },
  {
    name: 'workspace',
    body: 'Commands that only make sense inside a project',
    keys: ['G then D', 'Mod+P'],
  },
  {
    name: 'modal',
    body: 'A temporary scope that wins while a dialog is open',
    keys: ['Enter', 'Escape'],
  },
] as const

const gestures = [
  {
    icon: Command,
    label: 'Chord',
    binding: 'Mod + Shift + P',
    body: 'Several keys resolve as one command.',
  },
  {
    icon: ArrowsLeftRight,
    label: 'Sequence',
    binding: 'G then D',
    body: 'Ordered keys create a tiny command language.',
  },
  {
    icon: Clock,
    label: 'Held key',
    binding: 'Space · 400ms',
    body: 'Press duration can become part of the gesture.',
  },
] as const

export default function HotkeysLanding() {
  return (
    <LibraryLandingShell
      description="Hotkeys turns keyboard input into a typed command system with scopes, sequences, held keys, recording, conflict detection, and platform-aware display."
      headline="Every shortcut needs more than a keydown listener."
      hero={<ShortcutStudio />}
      libraryId="hotkeys"
      prompt={hotkeysPrompt}
      promptLabel="Copy Hotkeys prompt"
    >
      <LandingSection tone="ink">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <LandingSectionIntro
            body="The same key can mean one thing globally, another thing inside an editor, and nothing while the user is typing. Scopes make that context explicit."
            eyebrow="Command scope"
            icon={<Crosshair aria-hidden="true" size={17} />}
            title="A shortcut needs an address."
          />
          <ScopeStack />
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <LandingSectionIntro
          body="A command palette chord is useful. So are Vim-like sequences, press-and-hold actions, key releases, and keys that remain active while the pointer moves."
          eyebrow="Gesture grammar"
          icon={<Keyboard aria-hidden="true" size={17} />}
          title="Chords are only the first sentence."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {gestures.map((gesture, index) => {
            const Icon = gesture.icon
            return (
              <div
                key={gesture.label}
                className="rounded-xl border border-white/8 bg-[#111] p-5"
              >
                <div className="flex items-center justify-between">
                  <Icon
                    aria-hidden="true"
                    className="text-[var(--landing-accent)]"
                    size={22}
                  />
                  <span className="font-ds-mono text-[9px] uppercase tracking-[0.16em] text-white/20">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-7 text-ds-heading-4">{gesture.label}</h3>
                <KeySequence binding={gesture.binding} className="mt-4" />
                <p className="mt-5 text-ds-body-xs text-white/40">
                  {gesture.body}
                </p>
              </div>
            )
          })}
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <LandingSectionIntro
              body="Treat bindings as user data. Record a gesture, normalize it into a portable definition, format it for the current platform, and reuse it everywhere the command appears."
              eyebrow="Custom bindings"
              icon={<ArrowsLeftRight aria-hidden="true" size={17} />}
              title="Let users own the muscle memory."
            />
            <p className="mt-7 flex items-start gap-3 text-ds-body-xs text-white/40">
              <WarningCircle
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-[var(--landing-accent)]"
                size={17}
              />
              Conflicts, reserved browser keys, and input filtering stay visible
              instead of becoming mystery behavior.
            </p>
          </div>

          <LandingWindow label="binding pipeline">
            <div className="grid gap-px bg-white/5 sm:grid-cols-4">
              {[
                ['01 / record', '⌘ ⇧ P', 'Raw keyboard event'],
                ['02 / normalize', 'Mod+Shift+P', 'Portable definition'],
                ['03 / display', '⌘⇧P', 'Platform label'],
                ['04 / publish', 'Open palette', 'Menu + cheat sheet'],
              ].map(([label, value, body]) => (
                <div key={label} className="bg-[#0c0c0c] p-5">
                  <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-[var(--landing-accent)]">
                    {label}
                  </p>
                  <p className="mt-8 font-ds-mono text-sm text-white">
                    {value}
                  </p>
                  <p className="mt-3 text-ds-body-xs text-white/30">{body}</p>
                </div>
              ))}
            </div>
          </LandingWindow>
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}

function ShortcutStudio() {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [platform, setPlatform] = React.useState<'mac' | 'windows'>('mac')
  const [recordedBinding, setRecordedBinding] = React.useState<string>()
  const [isRecording, setIsRecording] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const activeCommand = commands[activeIndex]
  const binding = recordedBinding ?? activeCommand.binding

  function beginRecording() {
    setIsRecording(true)
    inputRef.current?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Tab') return
    event.preventDefault()
    if (['Alt', 'Control', 'Meta', 'Shift'].includes(event.key)) return

    const parts = [
      event.metaKey || event.ctrlKey ? 'Mod' : '',
      event.altKey ? 'Alt' : '',
      event.shiftKey ? 'Shift' : '',
      normalizeKey(event.key),
    ].filter(Boolean)
    setRecordedBinding(parts.join('+'))
    setIsRecording(false)
    triggerRef.current?.focus()
  }

  return (
    <LandingWindow label="shortcut settings">
      <div className="grid min-h-[23rem] md:grid-cols-[0.92fr_1.08fr]">
        <div className="border-white/5 p-4 md:border-r">
          <LandingEyebrow icon={<Stack aria-hidden="true" size={14} />}>
            commands
          </LandingEyebrow>
          <div className="mt-4 space-y-2">
            {commands.map((command, index) => (
              <button
                key={command.name}
                aria-pressed={activeIndex === index}
                className="flex w-full items-center justify-between gap-4 rounded-lg border border-transparent bg-white/[0.025] px-3 py-3 text-left hover:border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] aria-pressed:border-[color:rgb(var(--landing-glow)/0.45)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.1)]"
                onClick={() => {
                  setActiveIndex(index)
                  setRecordedBinding(undefined)
                }}
                type="button"
              >
                <span className="text-ds-label-sm text-white/70">
                  {command.name}
                </span>
                <span className="font-ds-mono text-[10px] text-white/35">
                  {formatBinding(command.binding, platform)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col p-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-ds-label-md text-white">{activeCommand.name}</p>
            <div className="flex rounded-md border border-white/8 p-0.5">
              {(['mac', 'windows'] as const).map((item) => (
                <button
                  key={item}
                  aria-pressed={platform === item}
                  className="rounded px-2 py-1 font-ds-mono text-[9px] uppercase text-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] aria-pressed:bg-white/10 aria-pressed:text-white"
                  onClick={() => setPlatform(item)}
                  type="button"
                >
                  {item === 'mac' ? 'macOS' : 'Win'}
                </button>
              ))}
            </div>
          </div>

          <p className="sr-only" id="hotkeys-recorder-instructions">
            Activate the recorder, then press the complete shortcut. Press Tab
            to leave without capturing it.
          </p>
          <button
            ref={triggerRef}
            aria-describedby="hotkeys-recorder-instructions hotkeys-recorder-status"
            className="mt-6 rounded-xl border border-dashed border-[color:rgb(var(--landing-glow)/0.55)] bg-[color:rgb(var(--landing-glow)/0.08)] px-4 py-7 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)]"
            onClick={beginRecording}
            type="button"
          >
            <KeySequence binding={formatBinding(binding, platform)} centered />
            <span className="mt-4 block font-ds-mono text-[9px] uppercase tracking-[0.16em] text-white/30">
              {isRecording ? 'Press a shortcut…' : 'Click to record'}
            </span>
          </button>
          <span
            aria-live="polite"
            className="sr-only"
            id="hotkeys-recorder-status"
          >
            {isRecording
              ? 'Recording. Press the complete shortcut now.'
              : recordedBinding
                ? `Recorded ${formatBinding(recordedBinding, platform)}. Focus returned to the recorder.`
                : 'Recorder ready.'}
          </span>
          <input
            ref={inputRef}
            aria-label="Record a keyboard shortcut"
            className="sr-only"
            onBlur={() => setIsRecording(false)}
            onKeyDown={handleKeyDown}
            readOnly
            value={binding}
          />

          <dl className="mt-6 grid grid-cols-2 gap-3">
            <CommandFact label="scope" value={activeCommand.scope} />
            <CommandFact label="in inputs" value={activeCommand.inputs} />
            <CommandFact label="conflicts" value="none" />
            <CommandFact label="status" value="active" />
          </dl>
        </div>
      </div>
    </LandingWindow>
  )
}

function ScopeStack() {
  const [activeScope, setActiveScope] = React.useState('modal')

  return (
    <div className="relative mx-auto w-full max-w-[46rem] pb-8 sm:pb-0">
      {scopes.map((scope, index) => {
        const isActive = scope.name === activeScope
        const offsetClassName =
          index === 0
            ? 'sm:ml-24 sm:w-[calc(100%-6rem)]'
            : index === 1
              ? 'sm:ml-12 sm:w-[calc(100%-3rem)]'
              : ''
        return (
          <button
            key={scope.name}
            aria-pressed={isActive}
            className={`relative block w-full rounded-xl border border-white/8 bg-[#0d0d0d] p-5 text-left shadow-[0_20px_45px_rgb(0_0_0/0.28)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] aria-pressed:border-[color:rgb(var(--landing-glow)/0.55)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.1)] sm:mt-[-0.75rem] ${offsetClassName}`}
            onClick={() => setActiveScope(scope.name)}
            type="button"
          >
            <span className="flex flex-wrap items-start justify-between gap-3">
              <span>
                <span className="font-ds-mono text-[10px] uppercase tracking-[0.16em] text-[var(--landing-accent)]">
                  {index === scopes.length - 1 ? 'highest priority' : 'scope'}
                </span>
                <span className="mt-2 block text-ds-heading-4 text-white">
                  {scope.name}
                </span>
              </span>
              <span className="flex gap-2">
                {scope.keys.map((key) => (
                  <KeySequence key={key} binding={key} />
                ))}
              </span>
            </span>
            <span className="mt-3 block text-ds-body-xs text-white/35">
              {scope.body}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function KeySequence({
  binding,
  centered = false,
  className = '',
}: {
  binding: string
  centered?: boolean
  className?: string
}) {
  const groups = binding.split(/\s+then\s+/i)
  return (
    <span
      className={`flex flex-wrap gap-1.5 ${centered ? 'justify-center' : ''} ${className}`}
    >
      {groups.map((group, groupIndex) => (
        <React.Fragment key={`${group}-${groupIndex}`}>
          {groupIndex > 0 ? (
            <span className="self-center font-ds-mono text-[9px] uppercase tracking-[0.1em] text-white/25">
              then
            </span>
          ) : null}
          {group
            .split(/\s*\+\s*|\s+/)
            .filter(Boolean)
            .map((key, keyIndex) =>
              key === '·' ? (
                <span
                  key={`${key}-${keyIndex}`}
                  className="self-center text-white/25"
                >
                  ·
                </span>
              ) : (
                <kbd
                  key={`${key}-${keyIndex}`}
                  className="min-w-8 rounded-md border border-white/12 bg-white/[0.055] px-2 py-1.5 text-center font-ds-mono text-xs text-white shadow-[inset_0_-2px_0_rgb(255_255_255/0.04)]"
                >
                  {key}
                </kbd>
              ),
            )}
        </React.Fragment>
      ))}
    </span>
  )
}

function CommandFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.025] p-3">
      <dt className="font-ds-mono text-[9px] uppercase tracking-[0.13em] text-white/25">
        {label}
      </dt>
      <dd className="mt-1 font-ds-mono text-xs text-white/70">{value}</dd>
    </div>
  )
}

function normalizeKey(key: string) {
  if (key === ' ') return 'Space'
  if (key === 'Escape') return 'Esc'
  return key.length === 1 ? key.toUpperCase() : key
}

function formatBinding(binding: string, platform: 'mac' | 'windows') {
  if (platform === 'windows') return binding.replace('Mod', 'Ctrl')
  return binding
    .replace('Mod', '⌘')
    .replace('Shift', '⇧')
    .replace('Alt', '⌥')
    .replaceAll('+', ' ')
}
