import * as React from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import * as v from 'valibot'
import { seo } from '~/utils/seo'
import {
  intentStatsQueryOptions,
  intentDirectoryQueryOptions,
  intentSkillSearchQueryOptions,
  intentSkillHistoryQueryOptions,
} from '~/queries/intent'
import type {
  EnrichedIntentPackage,
  SkillHistoryEntry,
  SkillSearchResult,
} from '~/utils/intent.functions'
import { SkillTypeBadge } from './$packageName'
import { SkillSparklineFallback } from '~/components/intent/SkillSparklineFallback'

const LazySkillSparkline = React.lazy(() =>
  import('~/components/intent/SkillSparkline').then((m) => ({
    default: m.SkillSparkline,
  })),
)

const searchSchema = v.object({
  q: v.optional(v.string()),
  tab: v.optional(v.picklist(['packages', 'skills']), 'packages'),
  framework: v.optional(v.string()),
  sort: v.optional(
    v.picklist(['downloads', 'name', 'skills', 'newest']),
    'downloads',
  ),
  page: v.optional(v.number(), 0),
  view: v.optional(v.picklist(['grid', 'list']), 'grid'),
})

export const Route = createFileRoute('/intent/registry/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps, context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(intentStatsQueryOptions()),
      queryClient.ensureQueryData(
        intentDirectoryQueryOptions({
          search: deps.q,
          framework: deps.framework,
          sort: deps.sort,
          page: deps.page,
        }),
      ),
    ]),
  head: () => ({
    meta: seo({
      title: 'Agent Skills Registry | TanStack Intent',
      description:
        'Browse npm packages that ship Agent Skills via TanStack Intent. Find skills for your favorite libraries and install them in seconds.',
    }),
  }),
  component: IntentRegistryPage,
  staticData: {
    includeSearchInCanonical: true,
  },
})

function IntentRegistryPage() {
  const { q, tab, framework, sort, page, view } = Route.useSearch()
  const navigate = Route.useNavigate()

  const statsQuery = useSuspenseQuery(intentStatsQueryOptions())
  const directoryQuery = useSuspenseQuery(
    intentDirectoryQueryOptions({ search: q, framework, sort, page }),
  )
  const skillSearchQuery = useQuery({
    ...intentSkillSearchQueryOptions(q ?? ''),
    enabled: tab === 'skills' && (q?.trim().length ?? 0) > 0,
  })

  const stats = statsQuery.data
  const { packages, total } = directoryQuery.data ?? { packages: [], total: 0 }

  const packageNames = React.useMemo(
    () => packages.map((p) => p.name),
    [packages],
  )
  const skillHistoryQuery = useQuery(
    intentSkillHistoryQueryOptions(packageNames),
  )
  const skillHistory = React.useMemo(
    () => skillHistoryQuery.data ?? {},
    [skillHistoryQuery.data],
  )
  const maxSlots = React.useMemo(
    () => Math.max(...Object.values(skillHistory).map((h) => h.length), 2),
    [skillHistory],
  )

  const [searchInput, setSearchInput] = React.useState(q ?? '')

  // Sync local input back to URL (debounced)
  React.useEffect(() => {
    const id = setTimeout(() => {
      navigate({
        search: (s) => ({ ...s, q: searchInput || undefined, page: 0 }),
      })
    }, 300)
    return () => clearTimeout(id)
  }, [searchInput, navigate])

  const PAGE_SIZE = 24
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const skillHits = skillSearchQuery.data ?? []

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/30 dark:to-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
            <Link
              to="/$libraryId/$version"
              params={{ libraryId: 'intent', version: 'latest' }}
              className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
            >
              TanStack Intent
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-gray-100">Registry</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-50 tracking-tight">
            Agent Skills Registry
          </h1>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
            npm packages that ship versioned Agent Skills. Install them and your
            AI coding agent learns your dependencies automatically.
          </p>

          <div className="mt-6 flex flex-wrap gap-6 text-sm">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                {stats?.packageCount ?? 0}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {stats?.packageCount === 1 ? 'package' : 'packages'}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                {stats?.skillCount ?? 0}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {stats?.skillCount === 1 ? 'skill' : 'skills'}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                {stats?.versionCount ?? 0}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {stats?.versionCount === 1 ? 'version' : 'versions'} indexed
              </span>
            </div>
          </div>

          <div className="mt-6">
            <Link
              to="/$libraryId/$version/docs/$"
              params={
                {
                  libraryId: 'intent',
                  version: 'latest',
                  _splat: 'registry',
                } as never
              }
              className="inline-flex items-center gap-1.5 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"
                />
              </svg>
              Ship skills with your library and get listed here
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Tabs + search row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Tabs */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0">
            {(['packages', 'skills'] as const).map((t) => (
              <button
                key={t}
                onClick={() =>
                  navigate({
                    search: (s) => ({ ...s, tab: t, page: 0 }),
                    replace: true,
                  })
                }
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  tab === t
                    ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Search input */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z"
              />
            </svg>
            <input
              type="search"
              placeholder="Search packages and skills..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          {/* Framework filter + sort + view toggle (packages only) */}
          {tab === 'packages' && (
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={sort}
                onChange={(e) => {
                  const val = e.target.value
                  if (
                    val === 'downloads' ||
                    val === 'name' ||
                    val === 'skills' ||
                    val === 'newest'
                  ) {
                    navigate({ search: (s) => ({ ...s, sort: val, page: 0 }) })
                  }
                }}
                className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="downloads">Most downloaded</option>
                <option value="skills">Most skills</option>
                <option value="newest">Newest</option>
                <option value="name">Name A-Z</option>
              </select>

              {/* Grid / List toggle */}
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  title="Grid view"
                  onClick={() =>
                    navigate({ search: (s) => ({ ...s, view: 'grid' }) })
                  }
                  className={`p-2.5 transition-colors ${
                    view === 'grid'
                      ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400'
                      : 'bg-white dark:bg-gray-900 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
                    />
                  </svg>
                </button>
                <button
                  title="List view"
                  onClick={() =>
                    navigate({ search: (s) => ({ ...s, view: 'list' }) })
                  }
                  className={`p-2.5 transition-colors border-l border-gray-200 dark:border-gray-700 ${
                    view === 'list'
                      ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400'
                      : 'bg-white dark:bg-gray-900 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Framework filters */}
        {tab === 'packages' && (
          <FrameworkFilters
            packages={packages}
            activeFramework={framework}
            onSelect={(fw) =>
              navigate({
                search: (s) => ({
                  ...s,
                  framework: fw || undefined,
                  page: 0,
                }),
              })
            }
          />
        )}

        {/* Packages tab */}
        {tab === 'packages' &&
          (packages.length === 0 ? (
            <EmptyState hasSearch={!!q} />
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {total} {total === 1 ? 'package' : 'packages'}
                {q ? ` matching "${q}"` : ''}
              </p>
              {view === 'list' ? (
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60 text-xs text-gray-500 dark:text-gray-400">
                        <th className="px-4 py-2 font-medium">Package</th>
                        <th className="px-4 py-2 font-medium">Version</th>
                        <th className="px-4 py-2 font-medium hidden lg:table-cell">
                          Description
                        </th>
                        <th className="px-4 py-2 font-medium hidden sm:table-cell">
                          Frameworks
                        </th>
                        <th className="px-4 py-2 font-medium text-right">
                          Skills
                        </th>
                        <th className="px-4 py-2 font-medium text-right">
                          Downloads
                        </th>
                        <th className="px-4 py-2 font-medium text-right hidden md:table-cell">
                          Published
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {packages.map((pkg) => (
                        <PackageRow
                          key={pkg.name}
                          pkg={pkg}
                          history={skillHistory[pkg.name]}
                          historyLoading={skillHistoryQuery.isLoading}
                          maxSlots={maxSlots}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {packages.map((pkg) => (
                    <PackageCard
                      key={pkg.name}
                      pkg={pkg}
                      history={skillHistory[pkg.name]}
                      historyLoading={skillHistoryQuery.isLoading}
                      maxSlots={maxSlots}
                    />
                  ))}
                </div>
              )}
              {totalPages > 1 && (
                <div className="mt-8 flex justify-center gap-2">
                  <button
                    disabled={page === 0}
                    onClick={() =>
                      navigate({ search: (s) => ({ ...s, page: page - 1 }) })
                    }
                    className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() =>
                      navigate({ search: (s) => ({ ...s, page: page + 1 }) })
                    }
                    className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ))}

        {/* Skills tab */}
        {tab === 'skills' &&
          (!q?.trim() ? (
            <div className="text-center py-16 text-sm text-gray-500 dark:text-gray-400">
              Type something to search across all skill names, descriptions, and
              content.
            </div>
          ) : skillSearchQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"
                />
              ))}
            </div>
          ) : skillHits.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-500 dark:text-gray-400">
              No skills matched{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                "{q}"
              </span>
              .
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {skillHits.length} {skillHits.length === 1 ? 'skill' : 'skills'}{' '}
                matching "{q}"
              </p>
              <div className="flex flex-col gap-2">
                {skillHits.map((hit) => (
                  <SkillHitRow key={hit.skillId} hit={hit} query={q ?? ''} />
                ))}
              </div>
            </>
          ))}

        {/* Ship your skills CTA */}
        <div className="mt-16 mb-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-sky-50/50 to-white dark:from-sky-950/20 dark:to-gray-900 p-8 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-950/60 mb-4">
            <svg
              className="w-5 h-5 text-sky-600 dark:text-sky-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
            Ship Agent Skills with your library
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg mx-auto mb-5">
            Add the{' '}
            <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs font-mono">
              tanstack-intent
            </code>{' '}
            keyword to your package, generate skills with the CLI, and your
            library appears here automatically.
          </p>
          <Link
            to="/$libraryId/$version/docs/$"
            params={
              {
                libraryId: 'intent',
                version: 'latest',
                _splat: 'registry',
              } as never
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white text-sm font-medium transition-colors"
          >
            Get started
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}

function PackageCard({
  pkg,
  history,
  historyLoading,
  maxSlots,
}: {
  readonly pkg: EnrichedIntentPackage
  readonly history?: Array<SkillHistoryEntry>
  readonly historyLoading?: boolean
  readonly maxSlots?: number
}) {
  const publishedLabel = formatRelativeDate(pkg.publishedAt)
  const navigate = useNavigate()
  const pkgSlug = pkg.name.replace('/', '__')

  const handleVersionClick = React.useCallback(
    (entry: SkillHistoryEntry) => {
      navigate({
        to: '/intent/registry/$packageName',
        params: { packageName: pkgSlug },
        search: { version: entry.version },
      })
    },
    [navigate, pkgSlug],
  )

  const isRecent = isRecentlyPublished(pkg.publishedAt)

  return (
    <Link
      to="/intent/registry/$packageName"
      params={{ packageName: pkgSlug }}
      className="group flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors break-all">
            {pkg.name}
          </h3>
          {isRecent && (
            <span className="shrink-0 inline-block px-1.5 py-0.5 rounded text-[10px] leading-tight font-medium bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
              new
            </span>
          )}
        </div>
        <div className="shrink-0 w-20">
          {history && history.length > 0 ? (
            <React.Suspense fallback={<SkillSparklineFallback height={24} />}>
              <LazySkillSparkline
                history={history}
                height={24}
                maxSlots={maxSlots}
                onVersionClick={handleVersionClick}
              />
            </React.Suspense>
          ) : historyLoading ? (
            <SkillSparklineFallback height={24} />
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mb-2">
        <span className="tabular-nums">
          {pkg.skillNames.length}{' '}
          {pkg.skillNames.length === 1 ? 'skill' : 'skills'}
        </span>
        <span className="tabular-nums">
          {pkg.monthlyDownloads > 0
            ? `${formatDownloads(pkg.monthlyDownloads)}/mo`
            : '0 downloads'}
        </span>
        {publishedLabel && <span>{publishedLabel}</span>}
      </div>

      {pkg.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
          {pkg.description}
        </p>
      )}

      <div className="flex items-center gap-1 mt-auto">
        {pkg.frameworks.slice(0, 3).map((fw) => (
          <span
            key={fw}
            className="inline-block px-2 py-0.5 rounded-md text-xs bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900"
          >
            {fw}
          </span>
        ))}
        {pkg.frameworks.length > 3 && (
          <span className="inline-block px-2 py-0.5 rounded-md text-xs bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            +{pkg.frameworks.length - 3}
          </span>
        )}
      </div>
    </Link>
  )
}

function PackageRow({
  pkg,
  history,
  historyLoading,
  maxSlots,
}: {
  readonly pkg: EnrichedIntentPackage
  readonly history?: Array<SkillHistoryEntry>
  readonly historyLoading?: boolean
  readonly maxSlots?: number
}) {
  const publishedLabel = formatRelativeDate(pkg.publishedAt)
  const navigate = useNavigate()
  const pkgSlug = pkg.name.replace('/', '__')

  const handleVersionClick = React.useCallback(
    (entry: SkillHistoryEntry) => {
      navigate({
        to: '/intent/registry/$packageName',
        params: { packageName: pkgSlug },
        search: { version: entry.version },
      })
    },
    [navigate, pkgSlug],
  )

  const isRecent = isRecentlyPublished(pkg.publishedAt)

  return (
    <tr className="group bg-white dark:bg-gray-900 hover:bg-sky-50/40 dark:hover:bg-sky-950/20 transition-colors">
      <td className="px-4 py-3 max-w-[14rem]">
        <div className="flex items-center gap-2">
          <Link
            to="/intent/registry/$packageName"
            params={{ packageName: pkgSlug }}
            className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors truncate block"
          >
            {pkg.name}
          </Link>
          {isRecent && (
            <span className="shrink-0 inline-block px-1.5 py-0.5 rounded text-[10px] leading-tight font-medium bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
              new
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
        v{pkg.latestVersion}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        {pkg.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-sm">
            {pkg.description}
          </p>
        )}
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <div className="flex items-center gap-1.5">
          {pkg.frameworks.slice(0, 2).map((fw) => (
            <span
              key={fw}
              className="inline-block px-1.5 py-0.5 rounded text-xs bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900 whitespace-nowrap"
            >
              {fw}
            </span>
          ))}
          {pkg.frameworks.length > 2 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              +{pkg.frameworks.length - 2}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {history && history.length > 0 ? (
          <React.Suspense fallback={<SkillSparklineFallback height={24} />}>
            <LazySkillSparkline
              history={history}
              height={24}
              maxSlots={maxSlots}
              onVersionClick={handleVersionClick}
            />
          </React.Suspense>
        ) : historyLoading ? (
          <SkillSparklineFallback height={24} />
        ) : (
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            {pkg.skillNames.length}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 tabular-nums text-right whitespace-nowrap">
        {formatDownloads(pkg.monthlyDownloads)}/mo
      </td>
      <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 text-right whitespace-nowrap hidden md:table-cell">
        {publishedLabel ?? '\u2014'}
      </td>
    </tr>
  )
}

function SkillHitRow({
  hit,
  query,
}: {
  readonly hit: SkillSearchResult
  readonly query: string
}) {
  return (
    <Link
      to="/intent/registry/$packageName/{$}"
      params={{
        packageName: hit.packageName.replace('/', '__'),
        _splat: hit.skillName,
      }}
      className="group flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-sm transition-all"
    >
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs text-gray-400 dark:text-gray-500 mb-0.5">
          <HighlightMatch text={hit.packageName} query={query} />
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
            <HighlightMatch text={hit.skillName} query={query} />
          </span>
          {hit.type && <SkillTypeBadge type={hit.type} />}
          {hit.framework && (
            <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              {hit.framework}
            </span>
          )}
        </div>
        {hit.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            <HighlightMatch text={hit.description} query={query} />
          </p>
        )}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1 text-xs text-gray-400 dark:text-gray-500 tabular-nums">
        <span>v{hit.version}</span>
        {hit.lineCount > 0 && (
          <span>
            {hit.lineCount} {hit.lineCount === 1 ? 'line' : 'lines'}
          </span>
        )}
      </div>
    </Link>
  )
}

function HighlightMatch({
  text,
  query,
}: {
  readonly text: string
  readonly query: string
}) {
  if (!query.trim()) return <>{text}</>

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-amber-200/60 dark:bg-amber-500/20 text-inherit rounded-sm px-px"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  )
}

function FrameworkFilters({
  packages,
  activeFramework,
  onSelect,
}: {
  readonly packages: Array<EnrichedIntentPackage>
  readonly activeFramework: string | undefined
  readonly onSelect: (framework: string | undefined) => void
}) {
  const frameworks = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const pkg of packages) {
      for (const fw of pkg.frameworks) {
        counts.set(fw, (counts.get(fw) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
  }, [packages])

  if (frameworks.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 mb-4 flex-wrap">
      <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mr-1">
        Framework
      </span>
      <button
        onClick={() => onSelect(undefined)}
        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
          !activeFramework
            ? 'bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
            : 'bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }`}
      >
        All
      </button>
      {frameworks.map(({ name, count }) => (
        <button
          key={name}
          onClick={() => onSelect(activeFramework === name ? undefined : name)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            activeFramework === name
              ? 'bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
              : 'bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          {name}
          <span className="ml-1 text-gray-400 dark:text-gray-500 tabular-nums">
            {count}
          </span>
        </button>
      ))}
    </div>
  )
}

function EmptyState({ hasSearch }: { readonly hasSearch: boolean }) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/40 mb-4">
        <svg
          className="w-6 h-6 text-sky-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
          />
        </svg>
      </div>
      {hasSearch ? (
        <>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            No packages found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try a different search term.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            No packages yet
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
            No packages have been indexed yet. Check back after the first sync
            runs.
          </p>
          <a
            href="https://github.com/tanstack/intent"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm text-sky-600 dark:text-sky-400 hover:underline"
          >
            Ship skills with your package
          </a>
        </>
      )}
    </div>
  )
}

const RECENT_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

function isRecentlyPublished(iso: string | null): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < RECENT_THRESHOLD_MS
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function formatRelativeDate(iso: string | null): string | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)
  if (years > 0) return `${years}y ago`
  if (months > 0) return `${months}mo ago`
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}
