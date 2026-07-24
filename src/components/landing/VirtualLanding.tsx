import * as React from 'react'
import {
  ArrowCounterClockwise,
  ChatCircleDots,
  Columns,
  DeviceMobile,
  Eye,
  FloppyDisk,
  GridFour,
  Rows,
  Ruler,
} from '@phosphor-icons/react'

import {
  LandingEyebrow,
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const virtualPrompt =
  'Build a TanStack Virtual experience for a TypeScript app. Render only visible items plus intentional overscan, measure dynamic content, support window or element scrolling, keep stable anchors for prepends and streaming content, and restore scroll position from a snapshot. Keep the scroll surface and markup owned by the product UI.'

const TOTAL_ROWS = 100_000
const ROW_HEIGHT = 42
const VIEWPORT_HEIGHT = 252
const OVERSCAN = 4

const surfaces = [
  {
    icon: Rows,
    label: 'Element list',
    body: 'Logs, search results, menus',
  },
  {
    icon: DeviceMobile,
    label: 'Window feed',
    body: 'Documents and full-page feeds',
  },
  {
    icon: GridFour,
    label: 'Grid + lanes',
    body: 'Galleries, calendars, boards',
  },
  {
    icon: Columns,
    label: 'Two-axis grid',
    body: 'Tables and spreadsheet surfaces',
  },
] as const

export default function VirtualLanding() {
  return (
    <LibraryLandingShell
      description="Virtual calculates what belongs in the viewport, measures what cannot be predicted, and keeps the scroll contract stable while your product owns every element."
      headline="Render only what matters, without surrendering the scroll surface."
      hero={<VirtualizerLab />}
      libraryId="virtual"
      prompt={virtualPrompt}
      promptLabel="Copy Virtual prompt"
    >
      <LandingSection tone="ink">
        <div className="grid gap-12 lg:grid-cols-[0.74fr_1.26fr] lg:items-center">
          <LandingSectionIntro
            body="An estimate makes the full scroll range available immediately. Real measurements refine that model as content enters the window—without turning every offscreen item into a DOM node."
            eyebrow="Dynamic measurement"
            icon={<Ruler aria-hidden="true" size={17} />}
            title="The hard part starts when rows are not the same height."
          />
          <MeasurementLab />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid gap-12 lg:grid-cols-[1.18fr_0.82fr] lg:items-center">
          <ChatContract />
          <LandingSectionIntro
            body="A chat viewport follows new messages only when the reader is already at the end. Loading older history must preserve the current message. Streaming content changes height without stealing the anchor."
            eyebrow="End-anchored lists"
            icon={<ChatCircleDots aria-hidden="true" size={17} />}
            title="Chat turns scrolling into a contract."
          />
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <LandingSectionIntro
          body="Virtualization is a coordinate system, not a list component. Use it with the page, an element, rows and columns, sticky regions, or lanes—and snapshot that coordinate system when navigation needs an exact return."
          eyebrow="Scroll surfaces"
          icon={<Eye aria-hidden="true" size={17} />}
          title="One virtualizer idea. Many kinds of viewport."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            {surfaces.map((surface) => {
              const Icon = surface.icon
              return (
                <div
                  key={surface.label}
                  className="rounded-xl border border-border-subtle bg-background-surface p-5"
                >
                  <Icon
                    aria-hidden="true"
                    className="text-[var(--landing-accent-bright)]"
                    size={21}
                  />
                  <p className="mt-7 text-ds-heading-4 text-text-primary">
                    {surface.label}
                  </p>
                  <p className="mt-2 text-ds-body-xs text-text-primary/35">
                    {surface.body}
                  </p>
                </div>
              )
            })}
          </div>
          <SnapshotPanel />
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}

function VirtualizerLab() {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = React.useState(0)
  const visibleStart = Math.floor(scrollTop / ROW_HEIGHT)
  const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT)
  const firstMounted = Math.max(0, visibleStart - OVERSCAN)
  const lastMounted = Math.min(
    TOTAL_ROWS - 1,
    visibleStart + visibleCount + OVERSCAN - 1,
  )
  const mountedRows = Array.from(
    { length: lastMounted - firstMounted + 1 },
    (_, index) => firstMounted + index,
  )

  function jumpTo(index: number) {
    const nextScrollTop = index * ROW_HEIGHT
    scrollRef.current?.scrollTo({ top: nextScrollTop })
    setScrollTop(nextScrollTop)
  }

  return (
    <LandingWindow label="100k row viewport">
      <div className="grid min-h-[23rem] md:grid-cols-[1fr_11rem]">
        <div className="border-border-subtle p-4 md:border-r">
          <div
            ref={scrollRef}
            aria-label="Virtualized scroll viewport"
            className="relative overflow-y-auto rounded-lg border border-white/10 bg-ds-neutral-500 outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            role="region"
            style={{ height: VIEWPORT_HEIGHT }}
          >
            <div
              aria-label="One hundred thousand application events"
              className="relative"
              role="list"
              style={{ height: TOTAL_ROWS * ROW_HEIGHT }}
            >
              {mountedRows.map((index) => (
                <div
                  key={index}
                  aria-posinset={index + 1}
                  aria-setsize={TOTAL_ROWS}
                  className="absolute inset-x-2 flex items-center gap-3 border-b border-white/5 px-3"
                  role="listitem"
                  style={{
                    height: ROW_HEIGHT,
                    transform: `translateY(${index * ROW_HEIGHT}px)`,
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full bg-[var(--landing-accent)] opacity-70"
                  />
                  <span className="w-16 shrink-0 font-ds-mono text-ds-mono-2xs text-white/25">
                    #{String(index + 1).padStart(6, '0')}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-ds-mono text-ds-mono-2xs text-white/60">
                    {getRowLabel(index)}
                  </span>
                  <span className="font-ds-mono text-ds-mono-2xs text-white/20">
                    {index % 7 === 0 ? 'warn' : 'info'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ['Top', 0],
              ['50,000', 49_999],
              ['End', TOTAL_ROWS - visibleCount],
            ].map(([label, index]) => (
              <button
                key={label}
                className="rounded-md border border-border-default px-3 py-1.5 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/35 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
                onClick={() => jumpTo(Number(index))}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col p-4">
          <LandingEyebrow icon={<Eye aria-hidden="true" size={14} />}>
            dom budget
          </LandingEyebrow>
          <dl className="mt-6 space-y-4" aria-live="polite">
            <ViewportMetric label="total rows" value="100,000" />
            <ViewportMetric
              label="mounted"
              value={String(mountedRows.length)}
            />
            <ViewportMetric
              label="visible range"
              value={`${visibleStart + 1}–${Math.min(visibleStart + visibleCount, TOTAL_ROWS)}`}
            />
            <ViewportMetric label="overscan" value={`${OVERSCAN} each side`} />
          </dl>
          <div className="mt-auto rounded-lg bg-[color:rgb(var(--landing-glow)/0.12)] p-3">
            <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
              full scroll range
            </p>
            <p className="mt-2 font-ds-mono text-ds-mono-xs text-text-primary">
              {(TOTAL_ROWS * ROW_HEIGHT).toLocaleString()}px
            </p>
          </div>
        </div>
      </div>
    </LandingWindow>
  )
}

function MeasurementLab() {
  const [measured, setMeasured] = React.useState(false)
  const estimatedHeights = [64, 64, 64, 64]
  const measuredHeights = [48, 92, 58, 78]
  const heights = measured ? measuredHeights : estimatedHeights
  const total = heights.reduce((sum, height) => sum + height, 0)

  return (
    <LandingWindow label="measure pass">
      <div className="grid gap-5 p-5 sm:grid-cols-[1fr_11rem] sm:p-6">
        <div className="flex h-72 items-start gap-2 overflow-hidden rounded-lg border border-border-subtle bg-background-subtle p-4">
          {heights.map((height, index) => (
            <div
              key={index}
              className="min-w-0 flex-1 rounded-md border border-[color:rgb(var(--landing-glow)/0.25)] bg-[color:rgb(var(--landing-glow)/0.09)] p-2 transition-[height] duration-500 motion-reduce:transition-none"
              style={{ height }}
            >
              <span className="block font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
                row {241 + index}
              </span>
              <span className="mt-2 block font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-bright)]">
                {height}px
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col">
          <LandingEyebrow icon={<Ruler aria-hidden="true" size={14} />}>
            {measured ? 'measured' : 'estimated'}
          </LandingEyebrow>
          <dl className="mt-6 space-y-4">
            <ViewportMetric label="anchor" value="row 241" />
            <ViewportMetric label="block size" value={`${total}px`} />
            <ViewportMetric
              label="correction"
              value={measured ? '+20px' : 'pending'}
            />
          </dl>
          <button
            className="mt-auto rounded-md bg-[var(--landing-accent)] px-3 py-2.5 text-ds-label-sm text-[var(--landing-accent-ink)]"
            onClick={() => setMeasured((value) => !value)}
            type="button"
          >
            {measured ? 'Reset estimate' : 'Measure elements'}
          </button>
        </div>
      </div>
    </LandingWindow>
  )
}

function ChatContract() {
  const [atLatest, setAtLatest] = React.useState(true)
  const [earlierCount, setEarlierCount] = React.useState(0)
  const [streamCount, setStreamCount] = React.useState(0)
  const [unseenCount, setUnseenCount] = React.useState(0)
  const messages = atLatest
    ? [
        'The cache is warm.',
        'Deploy finished in 42s.',
        ...Array.from(
          { length: Math.min(streamCount, 2) },
          (_, index) => `Streamed update ${streamCount - index}`,
        ).reverse(),
      ]
    : [
        `Earlier message ${earlierCount + 2}`,
        `Earlier message ${earlierCount + 1}`,
        'Anchor: deploy started',
        'Still reading here.',
      ]

  return (
    <LandingWindow label="chat viewport">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <button
            className="rounded-md border border-border-default px-3 py-1.5 text-ds-label-sm text-text-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
            onClick={() => {
              setEarlierCount((count) => count + 2)
              setAtLatest(false)
              if (atLatest) setUnseenCount(0)
            }}
            type="button"
          >
            Load earlier
          </button>
          <span className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
            {atLatest ? 'following end' : 'anchor preserved'}
          </span>
        </div>

        <div className="relative mt-4 h-60 overflow-hidden rounded-lg border border-border-subtle bg-background-subtle p-4">
          <div className="absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-background-subtle to-transparent" />
          <div className="space-y-2 pt-2">
            {messages.map((message, index) => (
              <div
                key={`${message}-${index}`}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-ds-body-xs ${index % 2 === 0 ? 'bg-text-primary/[0.055] text-text-primary/55' : 'ml-auto bg-[color:rgb(var(--landing-glow)/0.18)] text-text-primary/75'}`}
              >
                {message}
              </div>
            ))}
          </div>
          {unseenCount > 0 ? (
            <button
              className="absolute right-3 bottom-3 rounded-full bg-[var(--landing-accent)] px-3 py-1.5 font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-ink)]"
              onClick={() => {
                setAtLatest(true)
                setUnseenCount(0)
              }}
              type="button"
            >
              {unseenCount} new · jump to latest
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap justify-between gap-3">
          <button
            className="rounded-md border border-border-default px-3 py-1.5 text-ds-label-sm text-text-primary/45 disabled:opacity-25"
            disabled={atLatest}
            onClick={() => {
              setAtLatest(true)
              setUnseenCount(0)
            }}
            type="button"
          >
            Go to latest
          </button>
          <button
            className="rounded-md bg-[var(--landing-accent)] px-3 py-1.5 text-ds-label-sm text-[var(--landing-accent-ink)]"
            onClick={() => {
              setStreamCount((count) => count + 1)
              if (!atLatest) setUnseenCount((count) => count + 1)
            }}
            type="button"
          >
            Stream message
          </button>
        </div>
      </div>
    </LandingWindow>
  )
}

function SnapshotPanel() {
  const [restored, setRestored] = React.useState(false)

  return (
    <LandingWindow label="navigation snapshot">
      <div className="flex h-full flex-col p-5 sm:p-6">
        <LandingEyebrow icon={<FloppyDisk aria-hidden="true" size={14} />}>
          leave → return
        </LandingEyebrow>
        <div className="mt-7 rounded-lg border border-border-subtle bg-background-subtle p-4">
          <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
            /logs/deploy-847
          </p>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-text-primary/7">
            <span
              className="block h-full rounded-full bg-[var(--landing-accent)] transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: restored ? '72%' : '0%' }}
            />
          </div>
          <div className="mt-3 flex justify-between font-ds-mono text-ds-mono-2xs text-text-primary/25">
            <span>row 0</span>
            <span
              className={restored ? 'text-[var(--landing-accent-bright)]' : ''}
            >
              row 72,418
            </span>
            <span>row 100k</span>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <ViewportMetric
            label="offset"
            value={restored ? '3,041,556px' : '—'}
          />
          <ViewportMetric label="anchor" value={restored ? '#072419' : '—'} />
        </div>
        <p className="mt-5 text-ds-body-xs text-text-primary/35">
          Restore the measured coordinate system, not just an approximate item
          index.
        </p>
        <button
          className="mt-auto flex items-center justify-center gap-2 rounded-md bg-[var(--landing-accent)] px-3 py-2.5 text-ds-label-sm text-[var(--landing-accent-ink)]"
          onClick={() => setRestored((value) => !value)}
          type="button"
        >
          <ArrowCounterClockwise aria-hidden="true" size={15} />
          {restored ? 'Clear snapshot' : 'Restore position'}
        </button>
      </div>
    </LandingWindow>
  )
}

function ViewportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border-subtle pb-3">
      <dt className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
        {label}
      </dt>
      <dd className="mt-1 font-ds-mono text-ds-mono-xs text-text-primary/70">
        {value}
      </dd>
    </div>
  )
}

function getRowLabel(index: number) {
  const labels = [
    'Query cache updated',
    'Route match resolved',
    'Background task complete',
    'Virtual range measured',
  ]
  return labels[index % labels.length] ?? 'Application event'
}
