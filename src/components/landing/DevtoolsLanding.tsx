import * as React from 'react'
import {
  AppWindow,
  ArrowRight,
  ArrowSquareOut,
  Eye,
  Gauge,
  MagnifyingGlass,
  Plug,
  PuzzlePiece,
  Sidebar,
  Stack,
  Terminal,
} from '@phosphor-icons/react'

import {
  LandingEyebrow,
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const devtoolsPrompt = [
  'Add TanStack Devtools to a Vite-powered TypeScript app.',
  'Mount the framework adapter once, register library and product-specific panels through the plugin API, and use typed events for runtime inspection.',
  'Enable source inspection, client/server console piping, and the default removal of Devtools imports and JSX from production builds.',
].join(' ')

const inspectorPanels = [
  {
    id: 'query',
    label: 'Query',
    stats: [
      ['queries', '42'],
      ['mutations', '3'],
      ['stale', '8'],
    ],
    rows: ['project:42', 'activity-feed', 'current-user'],
  },
  {
    id: 'router',
    label: 'Router',
    stats: [
      ['matches', '6'],
      ['loaders', '4'],
      ['pending', '1'],
    ],
    rows: ['/_app/projects/$id', '/_app/search', '/settings'],
  },
  {
    id: 'jobs',
    label: 'Jobs',
    stats: [
      ['active', '12'],
      ['queued', '5'],
      ['failed', '1'],
    ],
    rows: ['sync-catalog', 'send-digest', 'rebuild-index'],
  },
] as const

const shellParts = [
  {
    icon: AppWindow,
    label: 'Shell',
    detail: 'Trigger, panel, tabs, and settings',
  },
  {
    icon: PuzzlePiece,
    label: 'Plugins',
    detail: 'Library and product inspectors',
  },
  {
    icon: Plug,
    label: 'Events',
    detail: 'Typed local, WebSocket, and SSE transport',
  },
  {
    icon: Eye,
    label: 'Source',
    detail: 'Element and log locations in the editor',
  },
  {
    icon: Sidebar,
    label: 'Windowing',
    detail: 'Docking, persistence, hotkeys, and PiP',
  },
  { icon: Stack, label: 'Adapters', detail: 'React, Vue, Solid, and Preact' },
] as const

export default function DevtoolsLanding() {
  return (
    <LibraryLandingShell
      libraryId="devtools"
      headline="Build the inspector, not another debugging shell."
      description="Devtools gives TanStack panels and your product-specific runtime state one extensible cockpit, with plugins, typed events, source inspection, and client/server logs already handled."
      hero={<DevtoolsCockpit />}
      prompt={devtoolsPrompt}
      promptLabel="Copy Devtools prompt"
    >
      <LandingSection tone="raised">
        <LandingSectionIntro
          centered
          eyebrow="The shell is infrastructure"
          icon={<AppWindow aria-hidden="true" size={15} />}
          title="Stop rebuilding everything around the useful panel."
          body="The trigger, tabs, window management, settings, persistence, hotkeys, source bridge, and transport are shared. Each library or product team can focus on the runtime truth it wants to expose."
        />
        <ShellAnatomy />
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid items-start gap-12 lg:grid-cols-[0.76fr_1.24fr] lg:gap-16">
          <LandingSectionIntro
            eyebrow="Custom plugins"
            icon={<PuzzlePiece aria-hidden="true" size={15} />}
            title="Your product gets devtools too."
            body="Register a panel beside TanStack inspectors and communicate through a typed event client. Events can stay local or travel between browser and server over WebSocket or SSE."
          />
          <PluginEventLab />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid items-center gap-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16">
          <ConsoleBridge />
          <LandingSectionIntro
            eyebrow="One debugging conversation"
            icon={<Terminal aria-hidden="true" size={15} />}
            title="See client and server logs without changing windows."
            body="The Vite integration can pipe browser logs into the terminal and server logs into the browser console, with enhanced source locations attached."
          />
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <LandingSectionIntro
          centered
          eyebrow="Development only"
          icon={<MagnifyingGlass aria-hidden="true" size={15} />}
          title="Click straight to source. Ship none of the shell."
          body="Source injection connects elements and logs to their exact file and line during development. By default, the Vite plugin removes Devtools imports and matching JSX usage from production builds."
        />
        <SourceToBuild />
      </LandingSection>
    </LibraryLandingShell>
  )
}

function DevtoolsCockpit() {
  const [activeId, setActiveId] = React.useState<'query' | 'router' | 'jobs'>(
    'query',
  )
  const [isInspecting, setIsInspecting] = React.useState(false)
  const [source, setSource] = React.useState('src/routes/__root.tsx:42')
  const active =
    inspectorPanels.find((panel) => panel.id === activeId) ?? inspectorPanels[0]

  const selectSource = (nextSource: string) => {
    if (isInspecting) {
      setSource(nextSource)
    }
  }

  return (
    <LandingWindow label="unified devtools">
      <div className="grid min-h-[23rem] lg:grid-cols-[0.72fr_1.28fr]">
        <div className="border-white/5 bg-[#101010] p-4 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-white/25">
              your app
            </p>
            <button
              type="button"
              aria-pressed={isInspecting}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1.5 font-ds-mono text-[9px] uppercase text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white aria-pressed:border-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-bright)]"
              onClick={() => setIsInspecting((current) => !current)}
            >
              <MagnifyingGlass aria-hidden="true" size={12} /> Inspect
            </button>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-white/8 bg-[#181818]">
            <button
              type="button"
              className={
                isInspecting
                  ? 'block w-full border-b border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.13)] px-3 py-3 text-left text-ds-label-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--landing-accent-bright)]'
                  : 'block w-full border-b border-white/5 px-3 py-3 text-left text-ds-label-sm text-white/70'
              }
              onClick={() => selectSource('src/components/AppHeader.tsx:18')}
            >
              Product workspace
            </button>
            <div className="grid gap-2 p-3">
              {[
                ['Activity feed', 'src/features/activity/Feed.tsx:27'],
                ['Project summary', 'src/features/projects/Summary.tsx:14'],
                ['Queue status', 'src/features/jobs/QueueStatus.tsx:51'],
              ].map(([label, nextSource]) => (
                <button
                  key={label}
                  type="button"
                  className={
                    isInspecting
                      ? 'rounded-lg border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.08)] px-3 py-3 text-left text-ds-body-xs text-white/70 hover:bg-[color:rgb(var(--landing-glow)/0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]'
                      : 'rounded-lg border border-white/5 bg-[#111] px-3 py-3 text-left text-ds-body-xs text-white/40'
                  }
                  onClick={() => selectSource(nextSource)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div
            className="mt-3 min-w-0 rounded-lg bg-black px-3 py-2 font-ds-mono text-[9px] text-[var(--landing-accent-bright)]"
            aria-live="polite"
          >
            <span className="block truncate">{source}</span>
          </div>
        </div>

        <div className="min-w-0 bg-black p-4">
          <div
            className="flex gap-2 overflow-x-auto"
            role="group"
            aria-label="Devtools panel"
          >
            {inspectorPanels.map((panel) => (
              <button
                key={panel.id}
                type="button"
                aria-pressed={activeId === panel.id}
                className="shrink-0 rounded-lg border border-white/8 bg-[#151515] px-3 py-2 text-ds-label-sm text-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white aria-pressed:bg-white aria-pressed:text-black"
                onClick={() => setActiveId(panel.id)}
              >
                {panel.label}
              </button>
            ))}
          </div>
          <div aria-live="polite" className="mt-4">
            <div className="grid grid-cols-3 gap-2">
              {active.stats.map(([label, value]) => (
                <div key={label} className="rounded-lg bg-[#151515] p-3">
                  <p className="font-ds-mono text-[8px] uppercase tracking-[0.1em] text-white/25">
                    {label}
                  </p>
                  <p className="mt-2 text-ds-heading-4 text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {active.rows.map((row, index) => (
                <div
                  key={row}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-[#111] px-3 py-2.5"
                >
                  <span className="truncate font-ds-mono text-[10px] text-white/55">
                    {row}
                  </span>
                  <span
                    className={
                      index === 0
                        ? 'size-2 rounded-full bg-emerald-400'
                        : 'size-2 rounded-full bg-white/15'
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </LandingWindow>
  )
}

function ShellAnatomy() {
  return (
    <div className="mx-auto mt-14 max-w-[72rem]">
      <div className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shellParts.map((part, index) => {
          const Icon = part.icon
          return (
            <div
              key={part.label}
              className="relative rounded-xl border border-white/8 bg-[#101010] p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--landing-accent)] text-[var(--landing-accent-ink)]">
                  <Icon aria-hidden="true" size={19} />
                </span>
                <span className="font-ds-mono text-[9px] text-white/20">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-5 text-ds-heading-4">{part.label}</h3>
              <p className="mt-3 text-ds-body-xs text-white/35">
                {part.detail}
              </p>
            </div>
          )
        })}
      </div>
      <div className="mx-auto mt-4 flex max-w-[34rem] items-center justify-center rounded-full border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.16)] px-5 py-3 font-ds-mono text-[10px] uppercase tracking-[0.14em] text-[var(--landing-accent-bright)]">
        one cohesive development surface
      </div>
    </div>
  )
}

function PluginEventLab() {
  const [eventCount, setEventCount] = React.useState(2)
  const events = Array.from({ length: eventCount }, (_, index) => ({
    id: eventCount - index,
    label:
      index === 0
        ? 'jobs:progress'
        : index === 1
          ? 'jobs:started'
          : 'jobs:queued',
  })).slice(0, 4)

  return (
    <LandingWindow label="custom jobs plugin">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="border-white/5 p-5 lg:border-r">
          <pre className="overflow-x-auto rounded-lg bg-black p-4 font-ds-mono text-[10px] leading-5 text-white/60">
            <code>
              {
                "type JobEvents = {\n  progress: { jobId: string; percent: number }\n}\nclass JobsClient extends EventClient<JobEvents> {\n  constructor() { super({ pluginId: 'jobs' }) }\n}\nconst jobs = new JobsClient()"
              }
            </code>
          </pre>
          <div className="mt-4 rounded-lg border border-white/8 bg-[#141414] p-4">
            <p className="text-ds-label-md text-white">Background Jobs</p>
            <p className="mt-2 text-ds-body-xs text-white/35">
              A product-owned panel registered beside library inspectors.
            </p>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-white/25">
              typed event stream
            </p>
            <span className="inline-flex items-center gap-2 font-ds-mono text-[9px] text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" />{' '}
              connected
            </span>
          </div>
          <div className="mt-4 space-y-2" aria-live="polite">
            {events.map((event) => (
              <div
                key={event.id}
                className="rounded-lg border border-white/8 bg-[#121212] px-3 py-3"
              >
                <p className="font-ds-mono text-[10px] text-[var(--landing-accent-bright)]">
                  {event.label}
                </p>
                <p className="mt-1 text-ds-body-xs text-white/30">
                  sync-catalog · {event.id * 12}%
                </p>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--landing-accent)] px-3 py-2 text-ds-label-sm text-[var(--landing-accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={() => setEventCount((current) => current + 1)}
          >
            <Plug aria-hidden="true" size={15} /> Emit server event
          </button>
        </div>
      </div>
    </LandingWindow>
  )
}

function ConsoleBridge() {
  const [direction, setDirection] = React.useState<'browser' | 'server'>(
    'browser',
  )
  const browserActive = direction === 'browser'

  return (
    <LandingWindow label="console piping">
      <div className="grid gap-3 p-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <ConsolePane
          active={browserActive}
          label="browser console"
          lines={['[ui] route mounted', '[query] cache updated']}
        />
        <button
          type="button"
          className="mx-auto flex size-10 items-center justify-center rounded-full border border-[var(--landing-accent)] text-[var(--landing-accent-bright)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Reverse console piping direction"
          onClick={() =>
            setDirection((current) =>
              current === 'browser' ? 'server' : 'browser',
            )
          }
        >
          <ArrowRight
            aria-hidden="true"
            className={browserActive ? '' : 'rotate-180'}
            size={18}
          />
        </button>
        <ConsolePane
          active={!browserActive}
          label="server terminal"
          lines={['[loader] project:42', '[api] 200 /projects/42']}
        />
      </div>
      <div
        className="border-t border-white/5 px-5 py-4 text-center text-ds-body-xs text-white/35"
        aria-live="polite"
      >
        {browserActive
          ? 'Browser output is visible in the terminal.'
          : 'Server output is visible in the browser console.'}
      </div>
    </LandingWindow>
  )
}

function ConsolePane({
  active,
  label,
  lines,
}: {
  active: boolean
  label: string
  lines: readonly string[]
}) {
  return (
    <div
      className={
        active
          ? 'rounded-xl border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.12)] p-4'
          : 'rounded-xl border border-white/8 bg-[#111] p-4'
      }
    >
      <div className="flex items-center gap-2">
        <Terminal
          aria-hidden="true"
          className={
            active ? 'text-[var(--landing-accent-bright)]' : 'text-white/25'
          }
          size={16}
        />
        <p className="font-ds-mono text-[9px] uppercase tracking-[0.12em] text-white/35">
          {label}
        </p>
      </div>
      <div className="mt-4 space-y-2">
        {lines.map((line) => (
          <p key={line} className="font-ds-mono text-[9px] text-white/55">
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}

function SourceToBuild() {
  return (
    <div className="mx-auto mt-14 grid max-w-[72rem] gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-white/10 bg-[#101010] p-6 md:p-8">
        <LandingEyebrow icon={<Eye aria-hidden="true" size={14} />}>
          development
        </LandingEyebrow>
        <div className="mt-7 rounded-lg border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.12)] p-5">
          <p className="text-ds-heading-4">Project summary</p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded bg-black px-3 py-2 font-ds-mono text-[10px] text-[var(--landing-accent-bright)]">
            <span>Summary.tsx:14</span>
            <ArrowSquareOut aria-hidden="true" size={15} />
          </div>
        </div>
        <p className="mt-5 text-ds-body-xs text-white/35">
          Hold the inspector hotkey, click an element, and open its exact source
          location.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#101010] p-6 md:p-8">
        <LandingEyebrow icon={<Gauge aria-hidden="true" size={14} />}>
          production build
        </LandingEyebrow>
        <div className="mt-7 space-y-3 font-ds-mono text-[10px]">
          <BuildLine label="Devtools component imports" />
          <BuildLine label="<TanStackDevtools /> JSX" />
          <BuildLine label="plugin-only imports" />
        </div>
        <div className="mt-5 rounded-lg bg-emerald-400 px-4 py-3 text-center font-ds-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-950">
          imports + JSX removed
        </div>
        <p className="mt-5 text-ds-body-xs text-white/35">
          The Vite plugin enables removeDevtoolsOnBuild by default.
        </p>
      </div>
    </div>
  )
}

function BuildLine({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/8 bg-black px-3 py-3">
      <span className="truncate text-white/45">{label}</span>
      <span className="shrink-0 text-emerald-300">removed</span>
    </div>
  )
}
