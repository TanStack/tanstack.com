import * as React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { intentVersionSkillsQueryOptions } from '~/queries/intent'
import {
  decodePkgName,
  usePackageVersion,
  SkillTypeBadge,
} from './$packageName'

export const Route = createFileRoute('/intent/registry/$packageName/')({
  component: PackageIndexPage,
})

function PackageIndexPage() {
  const { packageName } = Route.useParams()
  const pkgName = decodePkgName(packageName)
  const { activeVersion } = usePackageVersion()

  const skillsQuery = useSuspenseQuery(
    intentVersionSkillsQueryOptions({
      packageName: pkgName,
      version: activeVersion,
    }),
  )
  const skills = skillsQuery.data?.skills ?? []

  const [expandedId, setExpandedId] = React.useState<number | null>(null)

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
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
        {skills.length} {skills.length === 1 ? 'skill' : 'skills'}
      </p>
      {skills.map((skill) => {
        const isExpanded = expandedId === skill.id
        return (
          <div
            key={skill.id}
            className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
          >
            <div className="flex items-start gap-3 px-4 py-3">
              <button
                onClick={() => setExpandedId(isExpanded ? null : skill.id)}
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
                </div>
                {skill.description && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : skill.id)}
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
