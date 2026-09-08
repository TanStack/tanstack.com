import { Link } from '@tanstack/react-router'
import type { AiCoverage } from '~/utils/ai-coverage'

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

export function AiAdapters({ coverage }: { coverage: AiCoverage | null }) {
  if (!coverage) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-center text-sm opacity-70">
        The adapter list is not available on this branch yet.
      </p>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-8 md:px-8 lg:py-12">
      <h1 className="text-3xl font-black lg:text-4xl">Adapters</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed opacity-70">
        One package per provider. A number is how many model ids the package
        types for that activity. "Any" means the package accepts whatever the
        provider serves.
      </p>
      <ul className="mt-8 divide-y divide-gray-500/20">
        {coverage.adapters.map((adapter) => (
          <li
            key={adapter.id}
            className="grid gap-2 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6"
          >
            <div>
              <Link
                to="/$libraryId/$version/docs/$"
                params={{
                  libraryId: 'ai',
                  version: 'latest',
                  _splat: adapter.docs,
                }}
                className="font-semibold hover:underline"
              >
                {adapter.name}
              </Link>
              <p className="mt-0.5 font-mono text-xs opacity-50">
                {adapter.package}
              </p>
            </div>
            <div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {coverage.activities
                  .filter((activity) => activity in adapter.activities)
                  .map((activity) => {
                    const count = adapter.activities[activity]?.length ?? 0
                    return (
                      <li key={activity} className="whitespace-nowrap">
                        {activityLabels[activity] ?? activity}
                        <span className="ml-1 font-mono text-xs opacity-50">
                          {count || 'any'}
                        </span>
                      </li>
                    )
                  })}
              </ul>
              {adapter.note ? (
                <p className="mt-1.5 text-xs opacity-60">{adapter.note}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs opacity-50">
        Generated from the packages on{' '}
        {new Date(coverage.generatedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
        .
      </p>
    </div>
  )
}
