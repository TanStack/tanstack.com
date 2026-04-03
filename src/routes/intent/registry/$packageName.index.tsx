import * as React from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import {
  intentPackageDetailQueryOptions,
  intentVersionSkillsQueryOptions,
  intentPackageChangelogQueryOptions,
} from '~/queries/intent'
import type { ChangelogEntry } from '~/utils/intent.functions'
import { Collapsible, CollapsibleContent } from '~/components/Collapsible'
const LazySkillDiffViewer = React.lazy(() =>
  import('~/components/intent/SkillDiffViewer').then((m) => ({
    default: m.SkillDiffViewer,
  })),
)
import { SkillDependencyGraph } from '~/components/intent/SkillDependencyGraph'
import {
  decodePkgName,
  usePackageVersion,
  SkillTypeBadge,
} from './$packageName'
import { Route as PackageRoute } from './$packageName'

export const Route = createFileRoute('/intent/registry/$packageName/')({
  loaderDeps: ({ search }) => ({ version: search.version }),
  loader: async ({ params, deps, context: { queryClient } }) => {
    const name = decodePkgName(params.packageName)
    const detail = queryClient.getQueryData(
      intentPackageDetailQueryOptions(name).queryKey,
    )
    const latestVersion = detail?.versions[0]?.version ?? ''
    const activeVersion = deps.version ?? latestVersion
    if (activeVersion) {
      await queryClient.ensureQueryData(
        intentVersionSkillsQueryOptions({
          packageName: name,
          version: activeVersion,
        }),
      )
    }
  },
  component: PackageIndexPage,
})

function PackageIndexPage() {
  const { packageName } = Route.useParams()
  const pkgName = decodePkgName(packageName)
  const { activeVersion } = usePackageVersion()
  const {
    tab: urlTab,
    expanded: urlExpanded,
    expandedSkills: urlExpandedSkills,
  } = PackageRoute.useSearch()
  const navigate = useNavigate({ from: PackageRoute.fullPath })

  const tab = urlTab === 'history' ? 'history' : 'skills'
  const setTab = React.useCallback(
    (t: 'skills' | 'history') => {
      void navigate({
        search: (prev) => ({
          ...prev,
          tab: t === 'skills' ? undefined : t,
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

  const changelogQuery = useQuery(intentPackageChangelogQueryOptions(pkgName))

  const expandedSkillSet = React.useMemo(
    () => new Set(urlExpandedSkills ?? []),
    [urlExpandedSkills],
  )
  const toggleSkillExpanded = React.useCallback(
    (name: string) => {
      const next = new Set(expandedSkillSet)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      const arr = Array.from(next)
      void navigate({
        search: (prev) => ({
          ...prev,
          expandedSkills: arr.length > 0 ? arr : undefined,
        }),
        replace: true,
      })
    },
    [expandedSkillSet, navigate],
  )

  // Build a map of skill name -> 'added' | 'modified' from the changelog entry for the active version
  const skillChangeMap = React.useMemo(() => {
    const map = new Map<string, 'added' | 'modified'>()
    const entry = changelogQuery.data?.find((e) => e.version === activeVersion)
    if (!entry?.diff) return map
    for (const s of entry.diff.added) map.set(s.name, 'added')
    for (const s of entry.diff.modified) map.set(s.to.name, 'modified')
    return map
  }, [changelogQuery.data, activeVersion])

  return (
    <div>
      <div className="flex items-center gap-1 mb-5 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setTab('skills')}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'skills'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Skills
          <span className="ml-1.5 text-xs tabular-nums text-gray-400 dark:text-gray-500">
            {skills.length}
          </span>
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
          {changelogQuery.data && (
            <span className="ml-1.5 text-xs tabular-nums text-gray-400 dark:text-gray-500">
              {changelogQuery.data.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'skills' ? (
        <>
          {skills.some((s) => s.requires && s.requires.length > 0) && (
            <div className="mb-5">
              <SkillDependencyGraph skills={skills} packageName={packageName} />
            </div>
          )}
          <SkillsList
            skills={skills}
            packageName={packageName}
            expandedSkills={expandedSkillSet}
            toggleSkillExpanded={toggleSkillExpanded}
            skillChangeMap={skillChangeMap}
          />
        </>
      ) : (
        <ChangelogView
          entries={changelogQuery.data}
          isLoading={changelogQuery.isLoading}
          packageName={packageName}
          activeVersion={activeVersion}
          expandedVersions={urlExpanded}
          onExpandedChange={(versions) => {
            void navigate({
              search: (prev) => ({
                ...prev,
                expanded: versions.length > 0 ? versions : undefined,
              }),
              replace: true,
            })
          }}
        />
      )}
    </div>
  )
}

function SkillsList({
  skills,
  packageName,
  expandedSkills,
  toggleSkillExpanded,
  skillChangeMap,
}: {
  readonly skills: Array<{
    id: number
    name: string
    description: string | null
    type: string | null
    framework: string | null
    lineCount: number
  }>
  readonly packageName: string
  readonly expandedSkills: Set<string>
  readonly toggleSkillExpanded: (name: string) => void
  readonly skillChangeMap: Map<string, 'added' | 'modified'>
}) {
  if (skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-48 text-center px-4">
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          No skills found for this version.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {skills.map((skill) => {
        const isExpanded = expandedSkills.has(skill.name)
        const changeStatus = skillChangeMap.get(skill.name)
        return (
          <div
            key={skill.id}
            className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
          >
            <div className="flex items-start gap-3 px-4 py-3">
              <button
                onClick={() => toggleSkillExpanded(skill.name)}
                className="mt-0.5 shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m9 18 6-6-6-6"
                  />
                </svg>
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to="/intent/registry/$packageName/$skillName"
                    params={{ packageName, skillName: skill.name }}
                    className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                  >
                    {skill.name}
                  </Link>
                  {skill.type && <SkillTypeBadge type={skill.type} />}
                  {skill.framework && (
                    <span className="inline-block px-2 py-0.5 rounded-md text-xs bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900">
                      {skill.framework}
                    </span>
                  )}
                  {changeStatus === 'added' && (
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] leading-tight font-medium bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
                      added
                    </span>
                  )}
                  {changeStatus === 'modified' && (
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] leading-tight font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900">
                      modified
                    </span>
                  )}
                </div>
                {skill.description && (
                  <button
                    onClick={() => toggleSkillExpanded(skill.name)}
                    className={`mt-1 text-sm text-gray-500 dark:text-gray-400 text-left w-full ${isExpanded ? '' : 'line-clamp-1'}`}
                  >
                    {skill.description}
                  </button>
                )}
              </div>

              <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500 tabular-nums mt-0.5">
                {skill.lineCount} lines
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ChangelogView({
  entries,
  isLoading,
  packageName,
  activeVersion,
  expandedVersions: urlExpanded,
  onExpandedChange,
}: {
  readonly entries: Array<ChangelogEntry> | undefined
  readonly isLoading: boolean
  readonly packageName: string
  readonly activeVersion: string
  readonly expandedVersions: Array<string> | undefined
  readonly onExpandedChange: (versions: Array<string>) => void
}) {
  // Default: expand the latest version (first entry) if nothing in URL
  const expandedSet = React.useMemo(() => {
    if (urlExpanded) return new Set(urlExpanded)
    if (entries && entries.length > 0) return new Set([entries[0].version])
    return new Set<string>()
  }, [urlExpanded, entries])

  const toggleVersion = React.useCallback(
    (version: string) => {
      const next = new Set(expandedSet)
      if (next.has(version)) {
        next.delete(version)
      } else {
        next.add(version)
      }
      onExpandedChange(Array.from(next))
    },
    [expandedSet, onExpandedChange],
  )

  // Map each version to its predecessor (for diff viewer)
  const prevVersionMap = React.useMemo(() => {
    const map = new Map<string, string>()
    if (!entries) return map
    for (let i = 0; i < entries.length - 1; i++) {
      map.set(entries[i].version, entries[i + 1].version)
    }
    return map
  }, [entries])

  // Group entries: consecutive unchanged versions collapse into a single "gap" row
  type ChangelogGroup =
    | { kind: 'entry'; entry: ChangelogEntry }
    | { kind: 'gap'; count: number; fromVersion: string; toVersion: string }

  const groups = React.useMemo((): Array<ChangelogGroup> => {
    if (!entries || entries.length === 0) return []
    const result: Array<ChangelogGroup> = []
    let unchangedRun: Array<ChangelogEntry> = []

    const flushRun = () => {
      if (unchangedRun.length === 0) return
      result.push({
        kind: 'gap',
        count: unchangedRun.length,
        fromVersion: unchangedRun[unchangedRun.length - 1].version,
        toVersion: unchangedRun[0].version,
      })
      unchangedRun = []
    }

    for (const entry of entries) {
      const hasChanges =
        entry.diff &&
        (entry.diff.added.length > 0 ||
          entry.diff.removed.length > 0 ||
          entry.diff.modified.length > 0)
      if (!hasChanges) {
        unchangedRun.push(entry)
      } else {
        flushRun()
        result.push({ kind: 'entry', entry })
      }
    }
    flushRun()
    return result
  }, [entries])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-48 text-center px-4">
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          No history available.
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-800" />

      <div className="space-y-0">
        {groups.map((group) => {
          if (group.kind === 'gap') {
            return (
              <div
                key={`gap-${group.fromVersion}`}
                className="relative pl-8 pb-4"
              >
                <div className="absolute left-[9px] top-[7px] w-[5px] h-[5px] rounded-full bg-gray-300 dark:bg-gray-700" />
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                  {group.count} versions (no changes)
                </span>
              </div>
            )
          }

          const entry = group.entry
          const hasChanges =
            entry.diff &&
            (entry.diff.added.length > 0 ||
              entry.diff.removed.length > 0 ||
              entry.diff.modified.length > 0)
          const isActive = entry.version === activeVersion
          const isExpanded = expandedSet.has(entry.version)

          return (
            <div key={entry.version} className="relative pl-8 pb-4">
              {/* Timeline dot */}
              <div
                className={`absolute left-[7px] top-[7px] w-[9px] h-[9px] rounded-full border-2 ${
                  isActive
                    ? 'border-sky-500 bg-sky-500'
                    : hasChanges
                      ? 'border-sky-400 dark:border-sky-600 bg-white dark:bg-gray-950'
                      : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950'
                }`}
              />

              <button
                onClick={() => toggleVersion(entry.version)}
                className="w-full text-left group"
              >
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
                  <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                    {entry.total} {entry.total === 1 ? 'skill' : 'skills'}
                  </span>
                  {entry.publishedAt && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(entry.publishedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                  {hasChanges && (
                    <div className="flex items-center gap-1.5 text-xs tabular-nums">
                      {entry.diff!.added.length > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          +{entry.diff!.added.length}
                        </span>
                      )}
                      {entry.diff!.removed.length > 0 && (
                        <span className="text-red-500 dark:text-red-400">
                          -{entry.diff!.removed.length}
                        </span>
                      )}
                      {entry.diff!.modified.length > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          ~{entry.diff!.modified.length}
                        </span>
                      )}
                    </div>
                  )}
                  {hasChanges && (
                    <svg
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform ml-auto ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m9 18 6-6-6-6"
                      />
                    </svg>
                  )}
                </div>
              </button>

              {entry.diff && hasChanges && (
                <Collapsible open={isExpanded}>
                  <CollapsibleContent>
                    <div className="mt-2 ml-1 space-y-1">
                      {entry.diff.added.map((skill) => (
                        <ChangelogSkillRow
                          key={skill.name}
                          status="added"
                          name={skill.name}
                          type={skill.type}
                          framework={skill.framework}
                          lineCount={skill.lineCount}
                          packageName={packageName}
                        />
                      ))}
                      {entry.diff.modified.map(({ from, to }) => (
                        <ChangelogSkillRow
                          key={to.name}
                          status="modified"
                          name={to.name}
                          type={to.type}
                          framework={to.framework}
                          lineCount={to.lineCount}
                          lineCountDelta={to.lineCount - from.lineCount}
                          packageName={packageName}
                          diffVersions={{
                            packageName: decodePkgName(packageName),
                            fromVersion: prevVersionMap.get(entry.version)!,
                            toVersion: entry.version,
                          }}
                        />
                      ))}
                      {entry.diff.removed.map((skill) => (
                        <ChangelogSkillRow
                          key={skill.name}
                          status="removed"
                          name={skill.name}
                          type={skill.type}
                          framework={skill.framework}
                          lineCount={skill.lineCount}
                          packageName={packageName}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChangelogSkillRow({
  status,
  name,
  type,
  framework,
  lineCount,
  lineCountDelta,
  packageName,
  diffVersions,
}: {
  readonly status: 'added' | 'modified' | 'removed'
  readonly name: string
  readonly type: string | null
  readonly framework: string | null
  readonly lineCount: number
  readonly lineCountDelta?: number
  readonly packageName: string
  readonly diffVersions?: {
    packageName: string
    fromVersion: string
    toVersion: string
  }
}) {
  const [showDiff, setShowDiff] = React.useState(false)

  const statusConfig = {
    added: {
      prefix: '+',
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    },
    modified: {
      prefix: '~',
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/20',
    },
    removed: {
      prefix: '-',
      color: 'text-red-500 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/20',
    },
  }[status]

  return (
    <div className={`rounded-lg ${statusConfig.bg}`}>
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span
          className={`font-mono text-xs font-bold w-3 ${statusConfig.color}`}
        >
          {statusConfig.prefix}
        </span>
        <Link
          to="/intent/registry/$packageName/$skillName"
          params={{ packageName, skillName: name }}
          className="font-mono text-sm text-gray-900 dark:text-gray-100 hover:text-sky-600 dark:hover:text-sky-400 transition-colors truncate"
        >
          {name}
        </Link>
        {type && <SkillTypeBadge type={type} />}
        {framework && (
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900">
            {framework}
          </span>
        )}
        {diffVersions && (
          <button
            onClick={() => setShowDiff((d) => !d)}
            className="text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
          >
            {showDiff ? 'hide diff' : 'diff'}
          </button>
        )}
        <span className="ml-auto shrink-0 text-xs text-gray-400 dark:text-gray-500 tabular-nums">
          {lineCount}L
          {lineCountDelta != null && lineCountDelta !== 0 && (
            <span
              className={
                lineCountDelta > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500 dark:text-red-400'
              }
            >
              {' '}
              ({lineCountDelta > 0 ? '+' : ''}
              {lineCountDelta})
            </span>
          )}
        </span>
      </div>
      {diffVersions && (
        <Collapsible open={showDiff}>
          <CollapsibleContent>
            <div className="px-3 pb-2">
              <React.Suspense
                fallback={
                  <div className="h-24 rounded-lg bg-gray-50 dark:bg-gray-900/30 animate-pulse" />
                }
              >
                <LazySkillDiffViewer
                  packageName={diffVersions.packageName}
                  skillName={name}
                  fromVersion={diffVersions.fromVersion}
                  toVersion={diffVersions.toVersion}
                />
              </React.Suspense>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
