import * as React from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { seo } from '~/utils/seo'
import {
  intentPackageDetailQueryOptions,
  intentVersionSkillsQueryOptions,
  intentSingleSkillHistoryQueryOptions,
} from '~/queries/intent'
import {
  getIntentSkillPage,
  type SkillVersionEntry,
} from '~/utils/intent.functions'
import { CopyPageDropdown } from '~/components/CopyPageDropdown'
import { SkillSparklineFallback } from '~/components/intent/SkillSparklineFallback'
import {
  SkillTypeBadge,
  decodePkgName,
  usePackageVersion,
} from './$packageName'
import { Route as PackageRoute } from './$packageName'

const LazySkillSparkline = React.lazy(() =>
  import('~/components/intent/SkillSparkline').then((m) => ({
    default: m.SkillSparkline,
  })),
)

export const Route = createFileRoute(
  '/intent/registry/$packageName/{$}',
)({
  loaderDeps: ({ search }) => ({ version: search.version }),
  loader: async ({ params, deps, context: { queryClient } }) => {
    const name = decodePkgName(params.packageName)
    const skillName = params._splat ?? ''
    const detail = queryClient.getQueryData(
      intentPackageDetailQueryOptions(name).queryKey,
    )
    const latestVersion = detail?.versions[0]?.version ?? ''
    const activeVersion = deps.version ?? latestVersion
    if (activeVersion && skillName) {
      await queryClient.ensureQueryData(
        intentVersionSkillsQueryOptions({
          packageName: name,
          version: activeVersion,
        }),
      )

      return getIntentSkillPage({
        data: {
          packageName: name,
          skillName,
          version: activeVersion,
        },
      })
    }

    return null
  },
  head: ({ params }) => {
    const pkgName = decodePkgName(params.packageName)
    const skillName = params._splat ?? ''
    return {
      meta: seo({
        title: `${skillName} | ${pkgName} | Agent Skills Registry | TanStack Intent`,
        description: `Agent Skill "${skillName}" from ${pkgName}.`,
      }),
    }
  },
  component: SkillDetailPage,
})

function SkillDetailPage() {
  const { packageName, _splat: skillName = '' } = Route.useParams()
  const skillPage = Route.useLoaderData()
  const pkgName = decodePkgName(packageName)
  const { activeVersion } = usePackageVersion()
  const { tab: urlTab } = PackageRoute.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const tab = urlTab === 'history' ? 'history' : 'skill'
  const setTab = React.useCallback(
    (t: 'skill' | 'history') => {
      void navigate({
        search: (prev) => ({
          ...prev,
          tab: t === 'skill' ? undefined : t,
        }),
        replace: true,
      })
    },
    [navigate],
  )

  const skillsQuery = useSuspenseQuery(
    intentVersionSkillsQueryOptions({
      packageName: pkgName,
      version: activeVersion,
    }),
  )
  const skills = skillsQuery.data?.skills ?? []
  const skill = skills.find((s) => s.name === skillName)

  if (!skill) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-48 text-center px-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Skill not found
        </h2>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          This skill doesn't exist for the selected version.
        </p>
        <Link
          to="/intent/registry/$packageName"
          params={{ packageName }}
          className="mt-4 inline-block text-sky-600 dark:text-sky-400 hover:underline text-sm"
        >
          Back to {pkgName}
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* Skill meta */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <h2 className="text-xl font-bold font-mono text-gray-900 dark:text-gray-50">
              {skillName}
            </h2>
            {skill.type && <SkillTypeBadge type={skill.type} />}
            {skill.framework && (
              <span className="inline-block px-2 py-0.5 rounded-md text-xs bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900">
                {skill.framework}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
              {skill.lineCount} lines
            </span>
            {skill.skillPath && (
              <a
                href={`https://app.unpkg.com/${pkgName}@${activeVersion}/files/skills/${skill.skillPath}/SKILL.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                Source
              </a>
            )}
            <CopyPageDropdown label="Copy skill" />
          </div>
        </div>

        {skill.description && (
          <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-2xl">
            {skill.description}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setTab('skill')}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'skill'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Skill
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'history'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          History
        </button>
      </div>

      {tab === 'skill' ? (
        <>
          {/* Requires */}
          {skill.requires && skill.requires.length > 0 && (
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">
                Requires
              </span>
              {skill.requires.map((req) => (
                <Link
                  key={req}
                  to="/intent/registry/$packageName/{$}"
                  params={{ packageName, _splat: req }}
                  className="inline-block px-2 py-0.5 rounded-md text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                >
                  {req}
                </Link>
              ))}
            </div>
          )}

          {/* Skill content */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden p-6">
            <div className="prose prose-gray dark:prose-invert max-w-none [font-size:16px] styled-markdown-content">
              {skillPage?.contentRsc ?? null}
            </div>
          </div>
        </>
      ) : (
        <SkillVersionHistory
          packageName={pkgName}
          skillName={skillName}
          activeVersion={activeVersion}
        />
      )}
    </>
  )
}

function SkillVersionHistory({
  packageName,
  skillName,
  activeVersion,
}: {
  readonly packageName: string
  readonly skillName: string
  readonly activeVersion: string
}) {
  const historyQuery = useQuery(
    intentSingleSkillHistoryQueryOptions({ packageName, skillName }),
  )
  const entries = historyQuery.data

  const significantEntries = React.useMemo(
    () => entries?.filter((e) => e.status !== 'unchanged'),
    [entries],
  )

  const sparklineHistory = React.useMemo(() => {
    if (!entries || entries.length < 2) return null
    return entries
      .slice()
      .reverse()
      .map((e) => ({
        version: e.version,
        total: e.skill?.lineCount ?? 0,
        added: e.status === 'added' ? 1 : 0,
        removed: e.status === 'removed' ? 1 : 0,
        modified: e.status === 'modified' ? 1 : 0,
      }))
  }, [entries])

  if (historyQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-10 rounded-xl bg-gray-50 dark:bg-gray-900/30 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (!significantEntries || significantEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-48 text-center px-4">
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          No changes recorded for this skill.
        </p>
      </div>
    )
  }

  return (
    <div>
      {sparklineHistory && (
        <div className="mb-5 rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <React.Suspense fallback={<SkillSparklineFallback height={48} />}>
            <LazySkillSparkline history={sparklineHistory} height={48} />
          </React.Suspense>
        </div>
      )}

      <div className="relative">
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-800" />
        <div className="space-y-0">
          {significantEntries.map((entry) => (
            <SkillVersionRow
              key={entry.version}
              entry={entry}
              isActive={entry.version === activeVersion}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function SkillVersionRow({
  entry,
  isActive,
}: {
  readonly entry: SkillVersionEntry
  readonly isActive: boolean
}) {
  const statusConfig = {
    added: {
      label: 'Added',
      color: 'text-emerald-600 dark:text-emerald-400',
      dot: 'border-emerald-500 bg-emerald-500',
    },
    modified: {
      label: 'Modified',
      color: 'text-amber-600 dark:text-amber-400',
      dot: 'border-amber-500 bg-amber-500',
    },
    removed: {
      label: 'Removed',
      color: 'text-red-500 dark:text-red-400',
      dot: 'border-red-500 bg-red-500',
    },
    unchanged: {
      label: '',
      color: 'text-gray-400',
      dot: 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950',
    },
  }[entry.status]

  return (
    <div className="relative pl-8 pb-3">
      <div
        className={`absolute left-[7px] top-[5px] w-[9px] h-[9px] rounded-full border-2 ${
          isActive ? 'border-sky-500 bg-sky-500' : statusConfig.dot
        }`}
      />

      <div className="flex items-center gap-3">
        <span
          className={`font-mono text-sm font-semibold ${
            isActive
              ? 'text-sky-600 dark:text-sky-400'
              : 'text-gray-900 dark:text-gray-100'
          }`}
        >
          v{entry.version}
        </span>
        <span className={`text-xs font-medium ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
        {entry.skill && (
          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
            {entry.skill.lineCount}L
          </span>
        )}
        {entry.lineCountDelta != null && entry.lineCountDelta !== 0 && (
          <span
            className={`text-xs tabular-nums ${
              entry.lineCountDelta > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-500 dark:text-red-400'
            }`}
          >
            ({entry.lineCountDelta > 0 ? '+' : ''}
            {entry.lineCountDelta})
          </span>
        )}
        {entry.publishedAt && (
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
            {new Date(entry.publishedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        )}
      </div>
    </div>
  )
}
