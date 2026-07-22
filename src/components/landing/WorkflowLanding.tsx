import * as React from 'react'
import {
  ArrowCounterClockwise,
  FlowArrow,
  GitBranch,
  HandPalm,
  Hourglass,
  Network,
  PlayCircle,
  ShieldCheck,
} from '@phosphor-icons/react'

import {
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const workflowPrompt = [
  'Build a durable process with TanStack Workflow using plain async TypeScript and the current ctx primitives.',
  'Model stable step IDs, retries and timeouts, replay-safe time and IDs, sleeps, external signals or approvals, and explicit workflow version routing.',
  'Choose a runtime and durable execution store appropriate for the deployment. Keep side effects idempotent because replay does not make arbitrary operations exactly once, and verify concrete APIs against the current experimental docs.',
].join(' ')

type DemoPhase = 'crashed' | 'finished' | 'resumed' | 'waiting'

const waitModes = [
  {
    id: 'sleep',
    label: 'Sleep',
    code: 'await ctx.sleep(3 * DAY)',
    stored: 'wakeAt · replay-safe timestamp',
  },
  {
    id: 'signal',
    label: 'Signal',
    code: "await ctx.waitForEvent('inventory-ready')",
    stored: 'signal id · typed payload',
  },
  {
    id: 'approval',
    label: 'Approval',
    code: "await ctx.approve({ title: 'Release order?' })",
    stored: 'approval id · decision · feedback',
  },
]

export default function WorkflowLanding() {
  return (
    <LibraryLandingShell
      libraryId="workflow"
      headline="Write an async function that can outlive its process."
      description="TanStack Workflow records durable execution around ordinary TypeScript so steps, retries, sleeps, signals, and approvals can continue after a worker disappears."
      hero={<ReplayHero />}
      prompt={workflowPrompt}
      promptLabel="Copy Workflow prompt"
    >
      <LandingSection tone="raised">
        <div className="grid items-center gap-12 lg:grid-cols-[1.06fr_0.94fr] lg:gap-16">
          <WorkflowCode />
          <LandingSectionIntro
            eyebrow="Code is the process"
            icon={<FlowArrow aria-hidden="true" size={15} />}
            title="Control flow stays in plain async TypeScript."
            body="Conditionals, loops, variables, and errors remain language features. The workflow context adds durable boundaries only where time, retries, side effects, or external input need to survive beyond the current process."
          />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-16">
          <LandingSectionIntro
            eyebrow="Time and outside input"
            icon={<Hourglass aria-hidden="true" size={15} />}
            title="Waiting is a stored state, not a worker doing nothing."
            body="A workflow can sleep until later, wait for an external event, or request human approval. Host-delivered signal IDs make retries idempotent, while recorded time and UUID primitives keep decisions deterministic when the function runs again."
          />
          <WaitLab />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <LandingSectionIntro
          centered
          eyebrow="Durability boundary"
          icon={<Network aria-hidden="true" size={15} />}
          title="Bring the runtime and store that fit your application."
          body="The workflow definition is application code. A runtime adapter executes it, and a durable store preserves the append-only history needed for recovery. Current runtimes and adapters are experimental, so deployment and version routing remain explicit choices."
        />
        <RuntimeBoundary />
      </LandingSection>
    </LibraryLandingShell>
  )
}

function ReplayHero() {
  const [phase, setPhase] = React.useState<DemoPhase>('waiting')
  const rows = [
    {
      label: 'reserve inventory',
      state: phase === 'resumed' ? 'skipped on replay' : 'completed',
    },
    {
      label: 'manager approval',
      state:
        phase === 'crashed'
          ? 'worker lost'
          : phase === 'finished'
            ? 'approval received'
            : 'waiting',
    },
    {
      label: 'release fulfillment',
      state: phase === 'finished' ? 'completed' : 'queued',
    },
  ]
  const events = [
    ['run.started', 'order-4832'],
    ['step.completed', 'reserve-inventory'],
    ['approval.requested', 'manager-approval'],
    ...(phase === 'crashed' ? [['worker.disconnected', 'process exited']] : []),
    ...(phase === 'resumed' || phase === 'finished'
      ? [
          ['history.replayed', '3 records'],
          ['step.skipped', 'reserve-inventory'],
        ]
      : []),
    ...(phase === 'finished'
      ? [
          ['approval.received', 'manager-approval'],
          ['run.completed', 'order-4832'],
        ]
      : []),
  ]

  const buttonLabel = {
    crashed: 'Resume on new worker',
    finished: 'Run the demo again',
    resumed: 'Approve the request',
    waiting: 'Crash the worker',
  }[phase]

  const advance = () => {
    if (phase === 'waiting') {
      setPhase('crashed')
    } else if (phase === 'crashed') {
      setPhase('resumed')
    } else if (phase === 'resumed') {
      setPhase('finished')
    } else {
      setPhase('waiting')
    }
  }

  return (
    <LandingWindow label="durable execution log">
      <div className="grid min-h-[24rem] md:grid-cols-[0.94fr_1.06fr]">
        <div className="border-white/5 p-4 md:border-r">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-white/25">
                run
              </p>
              <p className="mt-1 font-ds-mono text-[11px] text-white">
                order-4832
              </p>
            </div>
            <span
              className={
                phase === 'crashed'
                  ? 'rounded bg-red-400 px-2 py-1 font-ds-mono text-[9px] font-semibold uppercase text-red-950'
                  : phase === 'finished'
                    ? 'rounded bg-emerald-400 px-2 py-1 font-ds-mono text-[9px] font-semibold uppercase text-emerald-950'
                    : 'rounded bg-amber-300 px-2 py-1 font-ds-mono text-[9px] font-semibold uppercase text-amber-950'
              }
            >
              {phase}
            </span>
          </div>
          <div className="mt-5 space-y-2" aria-live="polite">
            {rows.map((row, index) => (
              <div
                key={row.label}
                className="grid grid-cols-[2rem_1fr] gap-3 rounded-lg border border-white/5 bg-[#141414] p-3"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-[color:rgb(var(--landing-glow)/0.16)] font-ds-mono text-[10px] text-[var(--landing-accent-bright)]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-ds-label-sm text-white">
                    {row.label}
                  </p>
                  <p className="mt-1 font-ds-mono text-[9px] text-white/30">
                    {row.state}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-4 w-full rounded-lg bg-[var(--landing-accent)] px-4 py-2.5 text-ds-label-sm text-[var(--landing-accent-ink)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
            onClick={advance}
          >
            {buttonLabel}
          </button>
        </div>

        <div className="min-w-0 p-4" aria-live="polite">
          <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-white/25">
            append-only history
          </p>
          <ol className="mt-4 space-y-2">
            {events.map(([event, detail], index) => (
              <li
                key={`${event}-${index}`}
                className="grid grid-cols-[auto_1fr] gap-3 rounded-lg bg-black px-3 py-2.5"
              >
                <span className="font-ds-mono text-[9px] text-white/20">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <p className="font-ds-mono text-[10px] text-[var(--landing-accent-bright)]">
                    {event}
                  </p>
                  <p className="mt-1 truncate font-ds-mono text-[9px] text-white/30">
                    {detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </LandingWindow>
  )
}

function WorkflowCode() {
  return (
    <LandingWindow label="order-workflow.ts">
      <div className="overflow-x-auto p-5 font-ds-mono text-[11px] leading-6 text-white/60 sm:p-6">
        <p>
          <span className="text-sky-300">export async function</span>{' '}
          fulfillOrder(input, ctx) {'{'}
        </p>
        <p>
          &nbsp;&nbsp;<span className="text-sky-300">const</span> reservation ={' '}
          <span className="text-pink-300">await</span> ctx.step(
        </p>
        <p>
          &nbsp;&nbsp;&nbsp;&nbsp;
          <span className="text-amber-200">'reserve-inventory'</span>, () =&gt;
          reserve(input)
        </p>
        <p>&nbsp;&nbsp;)</p>
        <p>
          &nbsp;&nbsp;<span className="text-sky-300">const</span> approval ={' '}
          <span className="text-pink-300">await</span> ctx.approve({'{'}
        </p>
        <p>
          &nbsp;&nbsp;&nbsp;&nbsp; title:{' '}
          <span className="text-amber-200">'Release fulfillment?'</span>
        </p>
        <p>&nbsp;&nbsp;{'}'})</p>
        <p>
          &nbsp;&nbsp;<span className="text-pink-300">return</span> ctx.step(
        </p>
        <p>
          &nbsp;&nbsp;&nbsp;&nbsp;
          <span className="text-amber-200">'release-fulfillment'</span>, ()
          =&gt; release(reservation, approval)
        </p>
        <p>&nbsp;&nbsp;)</p>
        <p>{'}'}</p>
        <div className="mt-5 border-t border-white/5 pt-4 text-white/30">
          Stable IDs let replay match recorded work to the same boundaries.
        </div>
      </div>
    </LandingWindow>
  )
}

function WaitLab() {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const mode = waitModes[activeIndex] ?? waitModes[0]

  return (
    <LandingWindow label="durable wait state">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {waitModes.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={index === activeIndex}
              className="rounded-lg border border-white/10 px-3 py-2 text-ds-label-sm text-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-bright)]"
              onClick={() => setActiveIndex(index)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          className="mt-5 overflow-x-auto rounded-lg bg-black p-4 font-ds-mono text-[11px] text-white/60"
          aria-live="polite"
        >
          {mode.code}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/5 bg-[#121212] p-4">
            <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-white/25">
              history record
            </p>
            <p className="mt-3 font-ds-mono text-[10px] text-[var(--landing-accent-bright)]">
              {mode.stored}
            </p>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#121212] p-4">
            <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-white/25">
              worker
            </p>
            <p className="mt-3 font-ds-mono text-[10px] text-white/45">
              free to stop while waiting
            </p>
          </div>
        </div>
      </div>
    </LandingWindow>
  )
}

function RuntimeBoundary() {
  const layers = [
    {
      icon: GitBranch,
      label: 'Workflow definition',
      detail: 'Versioned TypeScript and stable step IDs',
    },
    {
      icon: PlayCircle,
      label: 'Runtime adapter',
      detail: 'Executes, schedules, retries, and receives signals',
    },
    {
      icon: ShieldCheck,
      label: 'Durable store',
      detail: 'Persists history outside the worker process',
    },
  ]

  return (
    <div className="mx-auto mt-14 max-w-[70rem]">
      <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-0">
        {layers.map((layer, index) => {
          const Icon = layer.icon
          return (
            <React.Fragment key={layer.label}>
              <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111] p-6">
                <Icon
                  aria-hidden="true"
                  className="text-[var(--landing-accent-bright)]"
                  size={25}
                  weight="light"
                />
                <h3 className="mt-5 text-ds-heading-4">{layer.label}</h3>
                <p className="mt-3 text-ds-body-xs text-white/35">
                  {layer.detail}
                </p>
              </div>
              {index < layers.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="mx-auto h-6 w-px bg-[var(--landing-accent)] md:h-px md:w-10"
                />
              ) : null}
            </React.Fragment>
          )
        })}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#101010] p-5">
          <ArrowCounterClockwise
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--landing-accent-bright)]"
            size={19}
          />
          <p className="text-ds-body-xs text-white/40">
            Replay skips recorded steps. It does not make arbitrary external
            side effects exactly once; use idempotent boundaries.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#101010] p-5">
          <HandPalm
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--landing-accent-bright)]"
            size={19}
          />
          <p className="text-ds-body-xs text-white/40">
            Route existing runs to compatible workflow versions when definitions
            evolve.
          </p>
        </div>
      </div>
    </div>
  )
}
