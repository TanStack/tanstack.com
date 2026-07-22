import * as React from 'react'
import {
  ArrowsLeftRight,
  BracketsCurly,
  Palette,
  Ruler,
  SlidersHorizontal,
} from '@phosphor-icons/react'

import {
  LandingEyebrow,
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const rangerPrompt =
  'Build a custom range control with TanStack Ranger. Use its headless geometry for multiple handles, segments, custom steps and ticks, drag and commit callbacks, and a custom interpolator when the scale is nonlinear. Keep the DOM, styling, labels, and accessible product semantics specific to the interface.'

const rangerModes = [
  {
    id: 'price',
    label: 'Price filter',
    description: 'Two handles define an included interval.',
  },
  {
    id: 'video',
    label: 'Video trim',
    description: 'Three handles mark in, playhead, and out.',
  },
  {
    id: 'gain',
    label: 'Log gain',
    description: 'One handle moves through a nonlinear scale.',
  },
] as const

type RangerMode = (typeof rangerModes)[number]['id']
type ScaleName = 'linear' | 'logarithmic' | 'stepped'

const scaleNames: ReadonlyArray<ScaleName> = [
  'linear',
  'logarithmic',
  'stepped',
]

export default function RangerLanding() {
  return (
    <LibraryLandingShell
      description="Ranger owns the difficult range math—handles, steps, ticks, segments, dragging, and interpolation—while your product owns the control."
      headline="Keep the range math. Invent the control."
      hero={<RangeStudio />}
      libraryId="ranger"
      prompt={rangerPrompt}
      promptLabel="Copy Ranger prompt"
    >
      <LandingSection tone="accent">
        <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
          <LandingSectionIntro
            body="Prices, audio gain, risk scores, and timelines do not all move through value space the same way. Supply the interpolation instead of forcing the product into a linear track."
            eyebrow="Custom interpolation"
            icon={<Ruler aria-hidden="true" size={17} />}
            title="Not every useful scale is linear."
          />
          <ScaleLab />
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <LandingSectionIntro
          body="A set of values produces handles. The spaces around them produce meaningful regions: selected, excluded, buffered, safe, risky, or already played."
          eyebrow="Multi-value geometry"
          icon={<ArrowsLeftRight aria-hidden="true" size={17} />}
          title="Values become handles. Gaps become segments."
        />

        <div className="mt-10 rounded-xl border border-white/8 bg-[#101010] p-5 sm:p-8">
          <div className="relative h-20">
            <div className="absolute inset-x-0 top-8 h-2 rounded-full bg-white/8" />
            <Segment left={0} right={22} label="excluded" tone="muted" />
            <Segment left={22} right={58} label="selected" tone="accent" />
            <Segment left={58} right={81} label="buffer" tone="soft" />
            <Segment left={81} right={100} label="excluded" tone="muted" />
            {[22, 58, 81].map((position, index) => (
              <span
                key={position}
                className="absolute top-[1.35rem] z-10 size-7 -translate-x-1/2 rounded-full border-4 border-[#101010] bg-[var(--landing-accent)] shadow-[0_0_20px_rgb(var(--landing-glow)/0.5)]"
                style={{ left: `${position}%` }}
              >
                <span className="sr-only">Handle {index + 1}</span>
              </span>
            ))}
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              ['values', '[22, 58, 81]'],
              ['handles', '3 positions'],
              ['segments', '4 regions'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-black/30 p-4">
                <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-white/25">
                  {label}
                </p>
                <p className="mt-2 font-ds-mono text-xs text-white/75">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <LandingSectionIntro
            body="Ranger provides positions, ticks, segments, and event handlers. Your interface decides whether those numbers become a price filter, a timeline, a color ramp, or something nobody has shipped yet."
            eyebrow="Headless boundary"
            icon={<Palette aria-hidden="true" size={17} />}
            title="The engine ends where the product begins."
          />

          <LandingWindow label="range contract">
            <div className="grid gap-px bg-white/5 sm:grid-cols-2">
              <ContractColumn
                accent
                eyebrow="Ranger returns"
                items={[
                  'handle positions',
                  'track segments',
                  'ticks and steps',
                  'drag + keyboard handlers',
                ]}
              />
              <ContractColumn
                eyebrow="You render"
                items={[
                  'semantic controls',
                  'product labels',
                  'brand and motion',
                  'domain-specific feedback',
                ]}
              />
            </div>
            <div className="border-t border-white/5 px-5 py-4 font-ds-mono text-[10px] text-white/35">
              <BracketsCurly
                aria-hidden="true"
                className="mr-2 inline text-[var(--landing-accent)]"
                size={15}
              />
              same geometry · entirely different surface
            </div>
          </LandingWindow>
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}

function RangeStudio() {
  const [mode, setMode] = React.useState<RangerMode>('price')
  const [values, setValues] = React.useState([24, 68, 84])
  const activeMode =
    rangerModes.find((candidate) => candidate.id === mode) ?? rangerModes[0]
  const visibleValues =
    mode === 'gain'
      ? values.slice(0, 1)
      : mode === 'price'
        ? values.slice(0, 2)
        : values

  function chooseMode(nextMode: RangerMode) {
    setMode(nextMode)
    if (nextMode === 'price') setValues([24, 68, 84])
    if (nextMode === 'video') setValues([16, 47, 82])
    if (nextMode === 'gain') setValues([61, 68, 84])
  }

  function updateValue(index: number, value: number) {
    setValues((current) => {
      const lastVisibleIndex = mode === 'price' ? 1 : mode === 'video' ? 2 : 0
      const minimum = index === 0 ? 0 : (current[index - 1] ?? 0)
      const maximum =
        index === lastVisibleIndex ? 100 : (current[index + 1] ?? 100)
      const nextValue = Math.max(minimum, Math.min(value, maximum))

      return current.map((currentValue, currentIndex) =>
        currentIndex === index ? nextValue : currentValue,
      )
    })
  }

  return (
    <LandingWindow label="range studio">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {rangerModes.map((item) => (
            <button
              key={item.id}
              aria-pressed={mode === item.id}
              className="rounded-md border border-white/8 px-3 py-2 text-ds-label-sm text-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] aria-pressed:border-[var(--landing-accent)] aria-pressed:bg-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-ink)]"
              onClick={() => chooseMode(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-7 rounded-xl border border-white/7 bg-black/35 px-5 py-8">
          <div className="relative h-16">
            <div className="absolute inset-x-0 top-7 h-2 rounded-full bg-white/10" />
            <div
              className="absolute top-7 h-2 rounded-full bg-[var(--landing-accent)] shadow-[0_0_18px_rgb(var(--landing-glow)/0.4)]"
              style={getFillStyle(mode, values)}
            />
            {visibleValues.map((value, index) => (
              <span
                key={index}
                className="absolute top-[1.1rem] size-7 -translate-x-1/2 rounded-full border-4 border-[#101010] bg-[var(--landing-accent-bright)]"
                style={{ left: `${value}%` }}
              >
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap font-ds-mono text-[9px] text-white/60">
                  {formatValue(mode, value)}
                </span>
              </span>
            ))}
          </div>
          <div className="flex justify-between font-ds-mono text-[9px] text-white/20">
            <span>{getBoundLabel(mode, false)}</span>
            <span>{getBoundLabel(mode, true)}</span>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {visibleValues.map((value, index) => (
            <label
              key={index}
              className="grid grid-cols-[5rem_1fr] items-center gap-3"
            >
              <span className="font-ds-mono text-[9px] uppercase tracking-[0.13em] text-white/30">
                {getHandleLabel(mode, index)}
              </span>
              <input
                aria-label={`${activeMode.label} ${getHandleLabel(mode, index)}`}
                className="accent-[var(--landing-accent)]"
                max="100"
                min="0"
                onChange={(event) =>
                  updateValue(index, event.target.valueAsNumber)
                }
                type="range"
                value={value}
              />
            </label>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
          <p className="text-ds-body-xs text-white/35">
            {activeMode.description}
          </p>
          <span className="font-ds-mono text-[9px] uppercase tracking-[0.13em] text-[var(--landing-accent)]">
            {visibleValues.length} handle{visibleValues.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </LandingWindow>
  )
}

function ScaleLab() {
  const [scale, setScale] = React.useState<ScaleName>('logarithmic')
  const [input, setInput] = React.useState(62)
  const output = interpolate(scale, input)
  const paths: Record<ScaleName, string> = {
    linear: 'M 4 116 L 236 8',
    logarithmic: 'M 4 116 C 70 114 152 92 236 8',
    stepped: 'M 4 116 H 62 V 91 H 120 V 64 H 178 V 36 H 236 V 8',
  }

  return (
    <LandingWindow label="interpolation lab">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {scaleNames.map((name) => (
            <button
              key={name}
              aria-pressed={scale === name}
              className="rounded-md border border-white/8 px-3 py-1.5 font-ds-mono text-[9px] uppercase tracking-[0.11em] text-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] aria-pressed:border-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-bright)]"
              onClick={() => setScale(name)}
              type="button"
            >
              {name}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_0.72fr] sm:items-center">
          <svg
            aria-label={`${scale} interpolation curve`}
            className="h-40 w-full overflow-visible rounded-lg bg-black/30 p-3"
            role="img"
            viewBox="0 0 240 124"
          >
            <path
              d="M 4 116 H 236 M 4 116 V 8"
              fill="none"
              stroke="rgba(255,255,255,.08)"
              strokeWidth="1"
            />
            <path
              d={paths[scale]}
              fill="none"
              stroke="var(--landing-accent)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
            />
          </svg>
          <div>
            <LandingEyebrow
              icon={<SlidersHorizontal aria-hidden="true" size={14} />}
            >
              position → value
            </LandingEyebrow>
            <p className="mt-4 font-ds-mono text-3xl text-white">
              {output.toFixed(1)}
            </p>
            <p className="mt-1 font-ds-mono text-[9px] uppercase tracking-[0.14em] text-white/25">
              output at {input}%
            </p>
            <input
              aria-label="Interpolation input position"
              className="mt-5 w-full accent-[var(--landing-accent)]"
              max="100"
              min="0"
              onChange={(event) => setInput(event.target.valueAsNumber)}
              type="range"
              value={input}
            />
          </div>
        </div>
      </div>
    </LandingWindow>
  )
}

function Segment({
  label,
  left,
  right,
  tone,
}: {
  label: string
  left: number
  right: number
  tone: 'accent' | 'muted' | 'soft'
}) {
  const toneClassName = {
    accent: 'bg-[var(--landing-accent)]',
    muted: 'bg-white/10',
    soft: 'bg-[color:rgb(var(--landing-glow)/0.34)]',
  }[tone]
  return (
    <span
      className={`absolute top-8 h-2 ${toneClassName}`}
      style={{ left: `${left}%`, width: `${right - left}%` }}
    >
      <span className="absolute top-5 left-1/2 -translate-x-1/2 font-ds-mono text-[8px] uppercase tracking-[0.12em] text-white/25">
        {label}
      </span>
    </span>
  )
}

function ContractColumn({
  accent = false,
  eyebrow,
  items,
}: {
  accent?: boolean
  eyebrow: string
  items: readonly string[]
}) {
  return (
    <div className="bg-[#0c0c0c] p-5 sm:p-6">
      <p
        className={`font-ds-mono text-[10px] uppercase tracking-[0.15em] ${accent ? 'text-[var(--landing-accent)]' : 'text-white/35'}`}
      >
        {eyebrow}
      </p>
      <ul className="mt-6 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-center gap-3 text-ds-body-sm text-white/65"
          >
            <span className="size-1.5 rounded-full bg-[var(--landing-accent)]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function getFillStyle(mode: RangerMode, values: readonly number[]) {
  if (mode === 'gain') return { left: '0%', width: `${values[0]}%` }
  return {
    left: `${values[0]}%`,
    width: `${values[mode === 'price' ? 1 : 2] - values[0]}%`,
  }
}

function getHandleLabel(mode: RangerMode, index: number) {
  if (mode === 'price') return index === 0 ? 'minimum' : 'maximum'
  if (mode === 'video') return ['in point', 'playhead', 'out point'][index]
  return 'gain'
}

function getBoundLabel(mode: RangerMode, maximum: boolean) {
  if (mode === 'price') return maximum ? '$2,000' : '$0'
  if (mode === 'video') return maximum ? '02:00' : '00:00'
  return maximum ? '+12 dB' : '−60 dB'
}

function formatValue(mode: RangerMode, value: number) {
  if (mode === 'price') return `$${Math.round(value * 20)}`
  if (mode === 'video') {
    const seconds = Math.round(value * 1.2)
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  }
  return `${Math.round(-60 + value * 0.72)} dB`
}

function interpolate(scale: ScaleName, input: number) {
  if (scale === 'linear') return input
  if (scale === 'logarithmic') return ((10 ** (input / 100) - 1) / 9) * 100
  return Math.round(input / 25) * 25
}
