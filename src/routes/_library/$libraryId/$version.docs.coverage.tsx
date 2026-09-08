import * as React from 'react'
import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { CaretRightIcon, CheckIcon } from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'

import { getLibrary } from '~/libraries'
import { DocContainer } from '~/components/DocContainer'
import { DocTitle } from '~/components/DocTitle'
import { seo } from '~/utils/seo'
import {
  aiCoverageQueryOptions,
  type AiCoverage,
  type AiCoverageAdapter,
} from '~/utils/ai-coverage'

export const Route = createFileRoute(
  '/_library/$libraryId/$version/docs/coverage',
)({
  beforeLoad: ({ params }) => {
    if (params.libraryId !== 'ai') {
      throw notFound()
    }
  },
  loader: ({ params, context: { queryClient } }) =>
    queryClient.ensureQueryData(aiCoverageQueryOptions(params.version)),
  head: () => ({
    meta: seo({
      title: 'TanStack AI Coverage',
      description:
        'Every TanStack AI adapter and the activities, models, and modalities it supports, generated from the packages.',
    }),
  }),
  component: CoverageRoute,
})

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

function CoverageRoute() {
  const { version } = Route.useParams()
  const { data: coverage } = useSuspenseQuery(aiCoverageQueryOptions(version))
  const library = getLibrary('ai')

  return (
    <DocContainer>
      <div className="mx-auto w-full max-w-[1200px] rounded-xl bg-white/70 p-4 dark:bg-black/40 lg:p-6">
        <DocTitle>{library.name} Coverage</DocTitle>
        <div className="h-4" />
        {coverage ? (
          <CoverageMatrix coverage={coverage} version={version} />
        ) : (
          <p className="text-sm opacity-70">
            The coverage file is not available on this branch yet.
          </p>
        )}
      </div>
    </DocContainer>
  )
}

function CoverageMatrix({
  coverage,
  version,
}: {
  coverage: AiCoverage
  version: string
}) {
  const [openId, setOpenId] = React.useState<string | null>(null)
  const generated = new Date(coverage.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <>
      <p className="max-w-3xl text-sm opacity-70">
        Every adapter package and what it can do, generated from each package's
        model metadata on {generated}. A number is how many models the adapter
        types for that activity. A check means the catalog is open-ended, so the
        adapter accepts any model the provider serves. Click a row for the model
        list.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white/90 py-2 pr-3 text-left font-semibold dark:bg-[#111]">
                Adapter
              </th>
              {coverage.activities.map((activity) => (
                <th
                  key={activity}
                  className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide opacity-70"
                >
                  {activityLabels[activity] ?? activity}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {coverage.adapters.map((adapter) => (
              <React.Fragment key={adapter.id}>
                <tr className="group">
                  <td className="sticky left-0 border-t border-gray-500/20 bg-white/90 py-2 pr-3 dark:bg-[#111]">
                    <button
                      type="button"
                      aria-expanded={openId === adapter.id}
                      className="flex w-full items-center gap-2 text-left"
                      onClick={() =>
                        setOpenId((current) =>
                          current === adapter.id ? null : adapter.id,
                        )
                      }
                    >
                      <CaretRightIcon
                        aria-hidden="true"
                        size={12}
                        className={twMerge(
                          'shrink-0 transition-transform',
                          openId === adapter.id && 'rotate-90',
                        )}
                      />
                      <span>
                        <span className="whitespace-nowrap font-medium">
                          {adapter.name}
                        </span>
                        <span className="block whitespace-nowrap font-mono text-xs opacity-50">
                          {adapter.package}
                        </span>
                      </span>
                    </button>
                  </td>
                  {coverage.activities.map((activity) => (
                    <td
                      key={activity}
                      className="border-t border-gray-500/20 px-2 py-2 text-center"
                    >
                      <Cell adapter={adapter} activity={activity} />
                    </td>
                  ))}
                </tr>
                {openId === adapter.id ? (
                  <tr>
                    <td
                      colSpan={coverage.activities.length + 1}
                      className="border-t border-gray-500/20 bg-gray-500/5 p-4"
                    >
                      <AdapterDetail adapter={adapter} version={version} />
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Cell({
  adapter,
  activity,
}: {
  adapter: AiCoverageAdapter
  activity: string
}) {
  const models = adapter.activities[activity]
  if (!models) {
    return <span className="opacity-20">·</span>
  }
  if (models.length === 0) {
    return (
      <CheckIcon
        aria-label="open-ended catalog"
        className="mx-auto text-emerald-500"
        size={16}
        weight="bold"
      />
    )
  }
  return <span className="font-mono tabular-nums">{models.length}</span>
}

function AdapterDetail({
  adapter,
  version,
}: {
  adapter: AiCoverageAdapter
  version: string
}) {
  const activities = Object.entries(adapter.activities)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <Link
          to="/$libraryId/$version/docs/$"
          params={{ libraryId: 'ai', version, _splat: adapter.docs }}
          className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-400"
        >
          {adapter.name} docs
        </Link>
        {adapter.note ? (
          <span className="opacity-70">{adapter.note}</span>
        ) : null}
      </div>
      {activities.map(([activity, models]) =>
        models.length ? (
          <div key={activity}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">
              {activityLabels[activity] ?? activity} · {models.length}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {models.map((model) => {
                const modalities = adapter.models[model]
                return (
                  <li
                    key={model}
                    className="rounded-md border border-gray-500/20 px-2 py-1 font-mono text-xs"
                    title={
                      modalities
                        ? `in: ${modalities.input.join(', ')} · out: ${modalities.output.join(', ')}`
                        : undefined
                    }
                  >
                    {model}
                    {modalities && modalities.input.length > 1 ? (
                      <span className="ml-1.5 opacity-50">
                        {modalities.input.filter((m) => m !== 'text').join(' ')}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null,
      )}
    </div>
  )
}
