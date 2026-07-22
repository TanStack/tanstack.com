import * as React from 'react'
import {
  ArrowsClockwise,
  BracketsCurly,
  CirclesFour,
  Cpu,
  Radio,
  Stack,
} from '@phosphor-icons/react'

import {
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const storePrompt = [
  'Build a TanStack Store state model for a TypeScript app.',
  'Use immutable updates, derived stores, batch related writes, and useSelector so components rerender only when their selected slice changes.',
  'Keep the core framework-agnostic and use the appropriate adapter for the renderer.',
].join(' ')

const primitives = [
  {
    id: 'store',
    label: 'Store',
    title: 'A value with an explicit update path.',
    code: 'const count = createStore(0)\ncount.setState((value) => value + 1)',
    result: 'state: 1',
  },
  {
    id: 'derived',
    label: 'Derived',
    title: 'Computed state stays connected to its source.',
    code: 'const doubled = createStore(() => count.state * 2)',
    result: 'derived: 2',
  },
  {
    id: 'batch',
    label: 'Batch',
    title: 'Several writes can produce one notification.',
    code: 'batch(() => {\n  first.setState(next)\n  second.setState(next)\n})',
    result: 'notifications: 1',
  },
  {
    id: 'select',
    label: 'Select',
    title: 'A component asks for only the slice it renders.',
    code: 'const theme = useSelector(uiStore,\n  (state) => state.theme\n)',
    result: 'unrelated renders: 0',
  },
] as const

const frameworks = [
  'React',
  'Preact',
  'Solid',
  'Vue',
  'Angular',
  'Svelte',
  'Lit',
] as const

const stateTools = [
  {
    name: 'Store',
    label: 'client signal',
    detail:
      'Focused reactive state, derived values, and selected subscriptions.',
    accent: true,
  },
  {
    name: 'Router',
    label: 'URL state',
    detail: 'Shareable, bookmarkable state that belongs in navigation.',
    accent: false,
  },
  {
    name: 'Query',
    label: 'server state',
    detail: 'Asynchronous resources, caching, freshness, and synchronization.',
    accent: false,
  },
  {
    name: 'DB',
    label: 'reactive data graph',
    detail: 'Collections, joins, live queries, and optimistic API data.',
    accent: false,
  },
] as const

export default function StoreLanding() {
  return (
    <LibraryLandingShell
      libraryId="store"
      headline="A small reactive core for state that should stay local."
      description="Store is a framework-agnostic signals implementation with immutable updates, derived values, batching, and adapters that let components select only the state they render."
      hero={<RenderMicroscope />}
      prompt={storePrompt}
      promptLabel="Copy Store prompt"
    >
      <LandingSection tone="accent">
        <div className="grid items-center gap-14 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20">
          <LandingSectionIntro
            eyebrow="Infrastructure, not architecture"
            icon={<Cpu aria-hidden="true" size={15} />}
            title="Small enough to sit underneath the product."
            body="Store powers state inside framework-agnostic TanStack libraries and can stand alone in an application. It provides the reactive primitive without prescribing a product-wide state architecture."
          />
          <SignalTopology />
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <LandingSectionIntro
          centered
          eyebrow="Four focused primitives"
          icon={<BracketsCurly aria-hidden="true" size={15} />}
          title="Write, derive, batch, and select."
          body="The core stays intentionally direct: update a value, compute from other stores, group related writes, and subscribe at the granularity the renderer needs."
        />
        <PrimitiveLab />
      </LandingSection>

      <LandingSection tone="raised">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <AdapterField />
          <LandingSectionIntro
            eyebrow="Framework adapters"
            icon={<Stack aria-hidden="true" size={15} />}
            title="The binding changes. The state model does not."
            body="Use the same framework-agnostic core from vanilla TypeScript, then connect it to React, Preact, Solid, Vue, Angular, Svelte, or Lit through a thin adapter."
          />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <LandingSectionIntro
          centered
          eyebrow="Use the smallest state tool"
          icon={<CirclesFour aria-hidden="true" size={15} />}
          title="Store owns one clear part of the stack."
          body="Reach for Store when state is local to the client and benefits from reactive derivation. Keep navigation, remote resources, and relational API data in the tools designed for them."
        />
        <StateToolMap />
      </LandingSection>
    </LibraryLandingShell>
  )
}

function RenderMicroscope() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light')
  const [density, setDensity] = React.useState<'roomy' | 'compact'>('roomy')
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const [renders, setRenders] = React.useState({
    header: 1,
    rows: 1,
    sidebar: 1,
  })
  const rows =
    density === 'compact'
      ? ['Routes', 'Queries', 'Tables', 'Forms']
      : ['Routes', 'Queries', 'Tables']

  const toggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'))
    setRenders((current) => ({ ...current, header: current.header + 1 }))
  }
  const toggleDensity = () => {
    setDensity((current) => (current === 'roomy' ? 'compact' : 'roomy'))
    setRenders((current) => ({ ...current, rows: current.rows + 1 }))
  }
  const toggleSidebar = () => {
    setSidebarOpen((current) => !current)
    setRenders((current) => ({ ...current, sidebar: current.sidebar + 1 }))
  }

  return (
    <LandingWindow label="render microscope">
      <div className="grid min-h-[23rem] lg:grid-cols-[0.72fr_1.28fr]">
        <div className="border-border-subtle p-4 lg:border-r">
          <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-text-primary/25">
            uiStore.setState()
          </p>
          <div className="mt-4 space-y-2">
            <StateControl label="theme" value={theme} onClick={toggleTheme} />
            <StateControl
              label="sidebar"
              value={sidebarOpen ? 'open' : 'closed'}
              onClick={toggleSidebar}
            />
            <StateControl
              label="density"
              value={density}
              onClick={toggleDensity}
            />
          </div>
          <div className="mt-4 rounded-lg bg-[color:rgb(var(--landing-glow)/0.12)] p-4">
            <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-[var(--landing-accent-bright)]">
              derived store
            </p>
            <p className="mt-2 text-ds-label-md text-text-primary">
              visibleRows = {rows.length}
            </p>
          </div>
        </div>

        <div className="min-w-0 p-4 sm:p-5">
          <div
            className={
              theme === 'dark'
                ? 'rounded-xl bg-ds-neutral-500 p-4 text-white'
                : 'rounded-xl bg-[#f1eadc] p-4 text-[#28170d]'
            }
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-3 border-b border-current/10 pb-3">
              <span className="text-ds-heading-5">Workspace</span>
              <RenderBadge count={renders.header} label="Header" />
            </div>
            <div
              className={
                sidebarOpen
                  ? 'mt-4 grid gap-3 grid-cols-[0.42fr_1fr]'
                  : 'mt-4 grid gap-3'
              }
            >
              {sidebarOpen ? (
                <div className="rounded-lg border border-current/10 bg-current/5 p-3 text-ds-body-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">Sidebar</span>
                    <RenderBadge count={renders.sidebar} label="Sidebar" />
                  </div>
                  <div className="mt-4 space-y-2 opacity-60">
                    <p>Docs</p>
                    <p>Examples</p>
                    <p>API</p>
                  </div>
                </div>
              ) : null}
              <div className="min-w-0 rounded-lg border border-current/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-ds-body-xs">Rows</span>
                  <RenderBadge count={renders.rows} label="Rows" />
                </div>
                <div className="mt-3 space-y-2">
                  {rows.map((row) => (
                    <div
                      key={row}
                      className={
                        density === 'compact'
                          ? 'rounded border border-current/10 px-2 py-1 text-[11px]'
                          : 'rounded border border-current/10 px-3 py-2 text-ds-body-xs'
                      }
                    >
                      {row}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-ds-body-xs text-text-primary/35">
            Each control updates one slice. Only the component selecting that
            slice increments its render count.
          </p>
        </div>
      </div>
    </LandingWindow>
  )
}

function StateControl({
  label,
  onClick,
  value,
}: {
  label: string
  onClick: () => void
  value: string
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border-subtle bg-background-subtle px-3 py-3 text-left hover:border-[var(--landing-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
      onClick={onClick}
    >
      <span className="font-ds-mono text-[10px] text-text-primary/45">
        state.{label}
      </span>
      <span className="rounded bg-[var(--landing-accent)] px-2 py-1 font-ds-mono text-[9px] uppercase text-[var(--landing-accent-ink)]">
        {value}
      </span>
    </button>
  )
}

function RenderBadge({ count, label }: { count: number; label: string }) {
  return (
    <span
      className="rounded-full border border-current/15 px-2 py-1 font-ds-mono text-[8px] uppercase tracking-[0.08em] opacity-60"
      title={label + ' render count'}
    >
      render {count}
    </span>
  )
}

function SignalTopology() {
  return (
    <div className="relative mx-auto max-w-[42rem] py-5">
      <div
        aria-hidden="true"
        className="absolute inset-x-[15%] top-1/2 h-px bg-[color:rgb(var(--landing-glow)/0.55)]"
      />
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="space-y-3">
          {['state', 'actions', 'batch'].map((item) => (
            <SignalNode key={item} label={item} />
          ))}
        </div>
        <div className="flex size-28 flex-col items-center justify-center rounded-full border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.22)] text-center shadow-[0_0_60px_rgb(var(--landing-glow)/0.18)] sm:size-36">
          <Cpu
            aria-hidden="true"
            className="text-[var(--landing-accent-bright)]"
            size={28}
            weight="light"
          />
          <p className="mt-2 font-ds-display text-ds-heading-4">Store</p>
        </div>
        <div className="space-y-3">
          {['derived', 'selectors', 'subscribers'].map((item) => (
            <SignalNode key={item} label={item} />
          ))}
        </div>
      </div>
    </div>
  )
}

function SignalNode({ label }: { label: string }) {
  return (
    <div className="relative rounded-full border border-border-default bg-background-surface px-3 py-2 text-center font-ds-mono text-[9px] uppercase tracking-[0.1em] text-text-primary/45 sm:px-5">
      {label}
    </div>
  )
}

function PrimitiveLab() {
  const [activeId, setActiveId] = React.useState<
    'store' | 'derived' | 'batch' | 'select'
  >('store')
  const active =
    primitives.find((primitive) => primitive.id === activeId) ?? primitives[0]

  return (
    <div className="mx-auto mt-14 max-w-[68rem]">
      <div
        className="flex gap-5 overflow-x-auto border-b border-border-default"
        role="group"
        aria-label="Store primitives"
      >
        {primitives.map((primitive) => (
          <button
            key={primitive.id}
            type="button"
            aria-pressed={activeId === primitive.id}
            className="shrink-0 border-b-2 border-transparent px-1 pb-4 font-ds-display text-ds-heading-4 font-light text-text-primary/35 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-bright)]"
            onClick={() => setActiveId(primitive.id)}
          >
            {primitive.label}
          </button>
        ))}
      </div>
      <div
        aria-live="polite"
        className="grid overflow-hidden rounded-b-xl border border-t-0 border-border-default bg-background-surface lg:grid-cols-[1.2fr_0.8fr]"
      >
        <div className="p-6 md:p-8">
          <h3 className="text-ds-heading-2">{active.title}</h3>
          <pre className="mt-7 overflow-x-auto rounded-lg bg-ds-neutral-500 p-5 font-ds-mono text-[11px] leading-6 text-white/65">
            <code>{active.code}</code>
          </pre>
        </div>
        <div className="flex min-h-44 items-center justify-center border-t border-border-subtle bg-[color:rgb(var(--landing-glow)/0.12)] p-8 lg:border-t-0 lg:border-l">
          <div className="text-center">
            <ArrowsClockwise
              aria-hidden="true"
              className="mx-auto text-[var(--landing-accent-bright)]"
              size={30}
              weight="light"
            />
            <p className="mt-5 font-ds-mono text-[12px] text-text-primary/75">
              {active.result}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AdapterField() {
  return (
    <LandingWindow label="one store core">
      <div className="p-6">
        <div className="mx-auto flex size-28 items-center justify-center rounded-full border border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.18)] shadow-[0_0_55px_rgb(var(--landing-glow)/0.18)]">
          <Radio
            aria-hidden="true"
            className="text-[var(--landing-accent-bright)]"
            size={34}
            weight="light"
          />
        </div>
        <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {frameworks.map((framework) => (
            <div
              key={framework}
              className="rounded-lg border border-border-subtle bg-background-subtle px-3 py-3 text-center text-ds-label-sm text-text-primary/55 last:sm:col-start-2"
            >
              {framework}
            </div>
          ))}
        </div>
        <p className="mt-5 text-center font-ds-mono text-[9px] uppercase tracking-[0.14em] text-text-primary/25">
          vanilla core · renderer-specific binding
        </p>
      </div>
    </LandingWindow>
  )
}

function StateToolMap() {
  return (
    <div className="mx-auto mt-14 max-w-[72rem] overflow-hidden rounded-xl border border-border-default bg-background-surface">
      {stateTools.map((tool) => (
        <div
          key={tool.name}
          className={
            tool.accent
              ? 'grid gap-4 border-b border-[var(--landing-accent)] bg-[color:rgb(var(--landing-glow)/0.14)] p-5 last:border-b-0 md:grid-cols-[0.45fr_0.55fr_1fr] md:items-center md:p-7'
              : 'grid gap-4 border-b border-border-subtle p-5 last:border-b-0 md:grid-cols-[0.45fr_0.55fr_1fr] md:items-center md:p-7'
          }
        >
          <p className="text-ds-heading-4">{tool.name}</p>
          <p className="font-ds-mono text-[9px] uppercase tracking-[0.14em] text-[var(--landing-accent-bright)]">
            {tool.label}
          </p>
          <p className="text-ds-body-sm text-text-primary/40">{tool.detail}</p>
        </div>
      ))}
    </div>
  )
}
