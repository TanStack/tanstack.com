import * as React from 'react'
import { ArrowsSplit, Clock, Gauge, Rows } from '@phosphor-icons/react'

import {
  LandingEyebrow,
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const pacerPrompt =
  'Build event pacing with TanStack Pacer. Choose debounce, throttle, rate limiting, queueing, or batching according to what work may be delayed, dropped, or grouped. Use observable state, async retry and abort behavior, queue concurrency and ordering, and framework adapters only where needed.'

const policies = [
  {
    name: 'debounce',
    label: 'Debounce',
    keeps: 'The latest value',
    trades: 'Waits for quiet',
    example: 'Search input',
    executions: 1,
  },
  {
    name: 'throttle',
    label: 'Throttle',
    keeps: 'A regular sample',
    trades: 'Drops the middle',
    example: 'Pointer updates',
    executions: 4,
  },
  {
    name: 'rate-limit',
    label: 'Rate limit',
    keeps: 'Calls inside the allowance',
    trades: 'Rejects excess calls',
    example: 'API requests',
    executions: 3,
  },
  {
    name: 'queue',
    label: 'Queue',
    keeps: 'Every task',
    trades: 'Controls concurrency',
    example: 'File uploads',
    executions: 12,
  },
  {
    name: 'batch',
    label: 'Batch',
    keeps: 'Every item',
    trades: 'Groups executions',
    example: 'Analytics writes',
    executions: 3,
  },
] as const

type PolicyName = (typeof policies)[number]['name']

const rawPattern = [42, 82, 55, 93, 67, 88, 48, 74, 96, 61, 79, 46]

export default function PacerLanding() {
  return (
    <LibraryLandingShell
      description="Pacer gives noisy events and async work a shared timing model: debounce, throttle, rate limiting, queues, and batches with observable state."
      headline="Decide what runs, when it runs, and what happens under pressure."
      hero={<TimingLab />}
      libraryId="pacer"
      prompt={pacerPrompt}
      promptLabel="Copy Pacer prompt"
    >
      <LandingSection tone="raised">
        <LandingSectionIntro
          body="Each policy answers a different product question. Pick one by deciding whether work may be dropped, delayed, sampled, or grouped—not by reaching for the timer you remember."
          eyebrow="Policy map"
          icon={<ArrowsSplit aria-hidden="true" size={17} />}
          title="Choose by what you can afford to lose."
        />
        <PolicyMap />
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid gap-12 lg:grid-cols-[0.76fr_1.24fr] lg:items-center">
          <div>
            <LandingSectionIntro
              body="Queues turn a pile of promises into explicit traffic: order, priority, concurrency, expiration, retries, and cancellation all have a place in the model."
              eyebrow="Async traffic control"
              icon={<Rows aria-hidden="true" size={17} />}
              title="Backpressure becomes product behavior."
            />
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                ['order', 'priority'],
                ['workers', '2'],
                ['retries', '2 max'],
              ].map(([label, value]) => (
                <div key={label} className="border-l border-white/10 pl-4">
                  <p className="font-ds-mono text-[9px] uppercase tracking-[0.15em] text-white/30">
                    {label}
                  </p>
                  <p className="mt-2 text-ds-label-md text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <QueueControl />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <LandingWindow label="observable pacer state">
            <div className="p-5 sm:p-7">
              <div className="grid gap-3 sm:grid-cols-4">
                <StateCell label="status" value="settled" />
                <StateCell label="executions" value="128" />
                <StateCell label="pending" value="0" />
                <StateCell label="last run" value="42ms" />
              </div>
              <div className="mt-6 rounded-lg border border-white/6 bg-black/35 p-4 font-ds-mono text-xs leading-7 text-white/45">
                <p>
                  <span className="text-[var(--landing-accent-bright)]">
                    queue.store.subscribe
                  </span>
                  {'(state => {'}
                </p>
                <p className="pl-4">renderProgress(state.executionCount)</p>
                <p>{'})'}</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 font-ds-mono text-[9px] uppercase tracking-[0.13em]">
                <span className="rounded bg-[var(--landing-accent)] px-2 py-1 text-[var(--landing-accent-ink)]">
                  core
                </span>
                <span className="rounded bg-white/5 px-2 py-1 text-white/40">
                  framework adapter
                </span>
                <span className="rounded bg-white/5 px-2 py-1 text-white/40">
                  devtools
                </span>
              </div>
            </div>
          </LandingWindow>

          <LandingSectionIntro
            body="Timing state should not disappear inside a closure. Subscribe to execution counts, pending work, errors, and status; inspect the same model in devtools; adopt the core alone when that is all you need."
            eyebrow="Observable by design"
            icon={<Gauge aria-hidden="true" size={17} />}
            title="The timer is no longer a black box."
          />
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}

function TimingLab() {
  const [policyName, setPolicyName] = React.useState<PolicyName>('debounce')
  const [rawCount, setRawCount] = React.useState(24)
  const [executionCount, setExecutionCount] = React.useState(2)
  const [pendingCount, setPendingCount] = React.useState(0)
  const [rejectedCount, setRejectedCount] = React.useState(0)
  const [rateWindowOpen, setRateWindowOpen] = React.useState(true)
  const workTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const rateWindowTimerRef = React.useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined)
  const policy =
    policies.find((item) => item.name === policyName) ?? policies[0]

  React.useEffect(
    () => () => {
      if (workTimerRef.current) clearTimeout(workTimerRef.current)
      if (rateWindowTimerRef.current) clearTimeout(rateWindowTimerRef.current)
    },
    [],
  )

  function fireBurst() {
    setRawCount((count) => count + 12)

    if (policy.name === 'rate-limit') {
      setPendingCount(0)
      if (rateWindowOpen) {
        setExecutionCount((count) => count + policy.executions)
        setRejectedCount((count) => count + 12 - policy.executions)
        setRateWindowOpen(false)
        rateWindowTimerRef.current = setTimeout(() => {
          setRateWindowOpen(true)
        }, 650)
      } else {
        setRejectedCount((count) => count + 12)
      }
      return
    }

    if (workTimerRef.current) clearTimeout(workTimerRef.current)
    setPendingCount(12)
    workTimerRef.current = setTimeout(() => {
      setExecutionCount((count) => count + policy.executions)
      setPendingCount(0)
    }, 650)
  }

  function flush() {
    if (workTimerRef.current) clearTimeout(workTimerRef.current)
    if (pendingCount > 0) {
      setExecutionCount((count) => count + 1)
      setPendingCount(0)
    }
  }

  return (
    <LandingWindow label="timing oscilloscope">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {policies.map((item) => (
            <button
              key={item.name}
              aria-pressed={policyName === item.name}
              className="rounded-md border border-white/7 px-2.5 py-1.5 font-ds-mono text-[9px] uppercase tracking-[0.1em] text-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] aria-pressed:border-[var(--landing-accent)] aria-pressed:bg-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-ink)]"
              onClick={() => {
                if (workTimerRef.current) clearTimeout(workTimerRef.current)
                if (rateWindowTimerRef.current)
                  clearTimeout(rateWindowTimerRef.current)
                setPolicyName(item.name)
                setPendingCount(0)
                setRejectedCount(0)
                setRateWindowOpen(true)
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-5">
          <SignalTrack label="raw events" pattern={rawPattern} />
          <SignalTrack
            accent
            label={`${policy.label.toLowerCase()} executions`}
            pattern={getPolicyPattern(policy.name)}
          />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3" aria-live="polite">
          <StateCell label="events" value={String(rawCount)} />
          <StateCell label="executions" value={String(executionCount)} />
          <StateCell
            label={policy.name === 'rate-limit' ? 'rejected' : 'pending'}
            value={String(
              policy.name === 'rate-limit' ? rejectedCount : pendingCount,
            )}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-ds-body-xs text-white/30">
            {policy.name === 'rate-limit'
              ? `${policy.keeps} · window ${rateWindowOpen ? 'open' : 'exhausted'}`
              : `${policy.keeps} · ${policy.trades.toLowerCase()}`}
          </p>
          <div className="flex gap-2">
            {policy.name === 'rate-limit' ? (
              <span className="self-center font-ds-mono text-[9px] uppercase tracking-[0.12em] text-white/25">
                excess is rejected
              </span>
            ) : (
              <button
                className="rounded-md border border-white/10 px-3 py-2 text-ds-label-sm text-white/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] disabled:opacity-25"
                disabled={pendingCount === 0}
                onClick={flush}
                type="button"
              >
                Flush
              </button>
            )}
            <button
              className="rounded-md bg-[var(--landing-accent)] px-3 py-2 text-ds-label-sm text-[var(--landing-accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              onClick={fireBurst}
              type="button"
            >
              Fire burst
            </button>
          </div>
        </div>
      </div>
    </LandingWindow>
  )
}

function SignalTrack({
  accent = false,
  label,
  pattern,
}: {
  accent?: boolean
  label: string
  pattern: readonly number[]
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between font-ds-mono text-[9px] uppercase tracking-[0.14em] text-white/30">
        <span>{label}</span>
        <span>650ms</span>
      </div>
      <div className="flex h-20 items-end gap-1 rounded-lg border border-white/5 bg-black/40 px-3 pt-3">
        {pattern.map((height, index) => (
          <span
            key={`${height}-${index}`}
            className={`min-w-1 flex-1 rounded-t-sm ${accent ? 'bg-[var(--landing-accent)] shadow-[0_0_14px_rgb(var(--landing-glow)/0.3)]' : 'bg-white/15'}`}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function PolicyMap() {
  return (
    <div className="mt-10 overflow-hidden rounded-xl border border-white/8">
      {policies.map((policy) => (
        <div
          key={policy.name}
          className="grid gap-3 border-t border-white/5 px-5 py-5 first:border-t-0 md:grid-cols-[0.75fr_1fr_1fr_0.8fr] md:items-center"
        >
          <p className="text-ds-heading-4 text-white">{policy.label}</p>
          <Decision label="keeps" value={policy.keeps} />
          <Decision label="tradeoff" value={policy.trades} />
          <span className="w-fit rounded-md bg-[color:rgb(var(--landing-glow)/0.13)] px-2 py-1 font-ds-mono text-[10px] text-[var(--landing-accent-bright)]">
            {policy.example}
          </span>
        </div>
      ))}
    </div>
  )
}

function QueueControl() {
  const jobs = [
    { name: 'hero-video.mp4', size: '84 MB', priority: 'high' },
    { name: 'product-tour.webm', size: '31 MB', priority: 'normal' },
    { name: 'captions.vtt', size: '18 KB', priority: 'normal' },
  ] as const
  const [completed, setCompleted] = React.useState(0)
  const [isPaused, setIsPaused] = React.useState(false)

  return (
    <LandingWindow label="upload queue">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <LandingEyebrow icon={<Clock aria-hidden="true" size={14} />}>
            concurrency / 2
          </LandingEyebrow>
          <button
            aria-pressed={isPaused}
            className="rounded-md border border-white/10 px-3 py-1.5 text-ds-label-sm text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)]"
            onClick={() => setIsPaused((value) => !value)}
            type="button"
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
        <div className="mt-5 space-y-2">
          {jobs.map((job, index) => {
            const isActive =
              index >= completed && index < Math.min(completed + 2, jobs.length)
            const status =
              index < completed
                ? 'complete'
                : isActive
                  ? isPaused
                    ? 'paused'
                    : 'running'
                  : 'queued'
            return (
              <div
                key={job.name}
                className="flex items-center justify-between gap-4 rounded-lg border border-white/6 bg-white/[0.025] p-3"
              >
                <span className="min-w-0">
                  <span className="block truncate font-ds-mono text-xs text-white/75">
                    {job.name}
                  </span>
                  <span className="mt-1 block text-ds-body-xs text-white/25">
                    {job.size} · {job.priority}
                  </span>
                </span>
                <span className="shrink-0 rounded bg-[color:rgb(var(--landing-glow)/0.13)] px-2 py-1 font-ds-mono text-[9px] uppercase tracking-[0.12em] text-[var(--landing-accent)]">
                  {status}
                </span>
              </div>
            )
          })}
        </div>
        <button
          className="mt-4 w-full rounded-md bg-[var(--landing-accent)] px-3 py-2.5 text-ds-label-sm text-[var(--landing-accent-ink)] disabled:opacity-30"
          disabled={completed === jobs.length || isPaused}
          onClick={() =>
            setCompleted((value) => Math.min(value + 1, jobs.length))
          }
          type="button"
        >
          {completed === jobs.length ? 'Queue complete' : 'Complete next task'}
        </button>
      </div>
    </LandingWindow>
  )
}

function Decision({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-ds-body-xs text-white/55">
      <span className="mr-2 font-ds-mono text-[9px] uppercase tracking-[0.13em] text-white/25 md:hidden">
        {label}
      </span>
      {value}
    </p>
  )
}

function StateCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/6 bg-white/[0.025] p-3">
      <p className="font-ds-mono text-[9px] uppercase tracking-[0.13em] text-white/25">
        {label}
      </p>
      <p className="mt-2 font-ds-mono text-sm text-white">{value}</p>
    </div>
  )
}

function getPolicyPattern(policy: PolicyName) {
  if (policy === 'debounce') return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 92]
  if (policy === 'throttle') return [75, 0, 0, 68, 0, 0, 84, 0, 0, 72, 0, 0]
  if (policy === 'rate-limit') return [78, 72, 70, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  if (policy === 'queue')
    return [64, 70, 66, 74, 68, 72, 62, 76, 67, 71, 65, 73]
  return [0, 0, 78, 0, 0, 88, 0, 0, 70, 0, 0, 0]
}
