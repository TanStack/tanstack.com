import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { CheckIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import type {
  AiCoverage as AiCoverageData,
  AiCoverageAdapter,
} from '~/utils/ai-coverage'

const activityLabels: Record<string, string> = {
  chat: 'Chat',
  image: 'Image',
  video: 'Video',
  speech: 'Speech',
  transcription: 'Transcription',
  audio: 'Audio',
  realtime: 'Realtime',
  embedding: 'Embedding',
  rerank: 'Rerank',
  search: 'Search',
  harness: 'Coding agent',
}

const chipClass =
  'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

export function AiCoverage({ coverage }: { coverage: AiCoverageData | null }) {
  const [activity, setActivity] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [openId, setOpenId] = React.useState<string | null>(null)

  if (!coverage) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center text-sm opacity-70">
        The coverage file is not available on this branch yet.
      </div>
    )
  }

  const query = search.trim().toLowerCase()
  const adapters = coverage.adapters.filter((adapter) => {
    if (activity && !(activity in adapter.activities)) return false
    if (!query) return true
    return (
      adapter.name.toLowerCase().includes(query) ||
      adapter.package.includes(query) ||
      Object.values(adapter.activities).some((models) =>
        models.some((model) => model.toLowerCase().includes(query)),
      )
    )
  })

  const modelCount = coverage.adapters.reduce(
    (sum, adapter) =>
      sum +
      Object.values(adapter.activities).reduce(
        (inner, models) => inner + models.length,
        0,
      ),
    0,
  )
  const generated = new Date(coverage.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8 lg:py-12">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-black lg:text-4xl">Coverage</h1>
          <p className="mt-3 text-sm leading-relaxed opacity-70">
            Every adapter package and what it can do, generated from the
            packages themselves. A count is how many model ids the adapter types
            for that activity. A check means the catalog is open-ended, so the
            adapter accepts whatever the provider serves.
          </p>
        </div>
        <dl className="flex gap-8 text-sm">
          <Stat label="adapters" value={coverage.adapters.length} />
          <Stat label="typed models" value={modelCount} />
          <Stat label="generated" value={generated} />
        </dl>
      </header>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter by activity"
        >
          <FilterChip
            active={activity === null}
            onClick={() => setActivity(null)}
          >
            All
          </FilterChip>
          {coverage.activities.map((item) => (
            <FilterChip
              key={item}
              active={activity === item}
              onClick={() => setActivity(activity === item ? null : item)}
            >
              {activityLabels[item] ?? item}
            </FilterChip>
          ))}
        </div>
        <label className="relative block lg:w-72">
          <MagnifyingGlassIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-50"
            size={16}
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Adapter or model id"
            aria-label="Search adapters and models"
            className="w-full rounded-lg border border-gray-500/30 bg-white/70 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 dark:bg-black/40"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adapters.map((adapter) => (
          <React.Fragment key={adapter.id}>
            <AdapterCard
              adapter={adapter}
              activities={coverage.activities}
              highlight={activity}
              open={openId === adapter.id}
              onToggle={() =>
                setOpenId((current) =>
                  current === adapter.id ? null : adapter.id,
                )
              }
            />
            {openId === adapter.id ? (
              <AdapterDetail
                adapter={adapter}
                activities={coverage.activities}
                query={query}
                onClose={() => setOpenId(null)}
              />
            ) : null}
          </React.Fragment>
        ))}
      </div>
      {adapters.length === 0 ? (
        <p className="py-16 text-center text-sm opacity-60">
          Nothing matches that filter.
        </p>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide opacity-50">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={twMerge(
        chipClass,
        active
          ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-300'
          : 'border-gray-500/30 opacity-70 hover:opacity-100',
      )}
    >
      {children}
    </button>
  )
}

function AdapterCard({
  adapter,
  activities,
  highlight,
  open,
  onToggle,
}: {
  adapter: AiCoverageAdapter
  activities: ReadonlyArray<string>
  highlight: string | null
  open: boolean
  onToggle: () => void
}) {
  const supported = activities.filter((item) => item in adapter.activities)

  return (
    <div
      className={twMerge(
        'relative flex flex-col gap-4 rounded-xl border bg-white/70 p-5 transition-colors focus-within:ring-2 focus-within:ring-blue-500 hover:border-blue-500/60 dark:bg-black/40',
        open ? 'border-blue-500' : 'border-gray-500/20',
      )}
    >
      {/* The button stretches over the card so the whole card is one target
          without putting block content inside a button. */}
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="text-left font-semibold outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
      >
        {adapter.name}
        <span className="mt-0.5 block truncate font-mono text-xs font-normal opacity-50">
          {adapter.package}
        </span>
      </button>
      <ul className="flex flex-wrap gap-1.5">
        {supported.map((item) => {
          const models = adapter.activities[item] ?? []
          const dimmed = highlight !== null && highlight !== item
          return (
            <li
              key={item}
              className={twMerge(
                'inline-flex items-center gap-1.5 rounded-md border border-gray-500/20 px-2 py-1 text-xs',
                dimmed && 'opacity-40',
              )}
            >
              {activityLabels[item] ?? item}
              {models.length ? (
                <span className="font-mono tabular-nums opacity-60">
                  {models.length}
                </span>
              ) : (
                <CheckIcon
                  aria-label="open-ended"
                  className="text-emerald-500"
                  size={12}
                  weight="bold"
                />
              )}
            </li>
          )
        })}
      </ul>
      {adapter.note ? (
        <p className="text-xs leading-relaxed opacity-60">{adapter.note}</p>
      ) : null}
    </div>
  )
}

function AdapterDetail({
  adapter,
  activities,
  query,
  onClose,
}: {
  adapter: AiCoverageAdapter
  activities: ReadonlyArray<string>
  query: string
  onClose: () => void
}) {
  return (
    <section
      aria-label={`${adapter.name} models`}
      className="col-span-full rounded-xl border border-blue-500 bg-white/70 p-5 dark:bg-black/40 lg:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{adapter.name}</h2>
          <p className="mt-1 font-mono text-xs opacity-50">{adapter.package}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link
            to="/$libraryId/$version/docs/$"
            params={{
              libraryId: 'ai',
              version: 'latest',
              _splat: adapter.docs,
            }}
            className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400"
          >
            Read the docs
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-500/30 px-2.5 py-1 text-xs hover:bg-gray-500/10"
          >
            Close
          </button>
        </div>
      </div>
      {adapter.note ? (
        <p className="mt-3 text-sm opacity-70">{adapter.note}</p>
      ) : null}
      <div className="mt-6 space-y-6">
        {activities
          .filter((item) => item in adapter.activities)
          .map((item) => {
            const models = adapter.activities[item] ?? []
            const shown = query
              ? models.filter((model) => model.toLowerCase().includes(query))
              : models
            return (
              <div key={item}>
                <h3 className="text-xs font-semibold uppercase tracking-wide opacity-60">
                  {activityLabels[item] ?? item}
                  {models.length ? ` · ${models.length}` : ' · open-ended'}
                </h3>
                {models.length ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {shown.map((model) => (
                      <ModelChip
                        key={model}
                        model={model}
                        modalities={adapter.models[model]}
                      />
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          })}
      </div>
    </section>
  )
}

function ModelChip({
  model,
  modalities,
}: {
  model: string
  modalities: AiCoverageAdapter['models'][string] | undefined
}) {
  const extraInputs = modalities?.input.filter((item) => item !== 'text') ?? []
  return (
    <li
      className="rounded-md border border-gray-500/20 px-2 py-1 font-mono text-xs"
      title={
        modalities
          ? `in: ${modalities.input.join(', ')} · out: ${modalities.output.join(', ')}`
          : undefined
      }
    >
      {model}
      {extraInputs.length ? (
        <span className="ml-1.5 opacity-50">{extraInputs.join(' ')}</span>
      ) : null}
    </li>
  )
}
