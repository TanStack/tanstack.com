import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { seo } from '~/utils/seo'
import { intentVersionSkillsQueryOptions } from '~/queries/intent'
import { Markdown } from '~/components/markdown'
import { CopyPageDropdown } from '~/components/CopyPageDropdown'
import {
  SkillTypeBadge,
  decodePkgName,
  usePackageVersion,
} from './$packageName'

function stripFrontmatter(content: string): string {
  const lines = content.split('\n')
  if (lines[0]?.trim() !== '---') return content
  const closing = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (closing === -1) return content
  return lines
    .slice(closing + 1)
    .join('\n')
    .trimStart()
}

export const Route = createFileRoute(
  '/intent/registry/$packageName/$skillName',
)({
  head: ({ params }) => {
    const pkgName = decodePkgName(params.packageName)
    return {
      meta: seo({
        title: `${params.skillName} | ${pkgName} | Agent Skills Registry | TanStack Intent`,
        description: `Agent Skill "${params.skillName}" from ${pkgName}.`,
      }),
    }
  },
  component: SkillDetailPage,
})

function SkillDetailPage() {
  const { packageName, skillName } = Route.useParams()
  const pkgName = decodePkgName(packageName)
  const { activeVersion, latestVersion, repositoryUrl } = usePackageVersion()
  const isLatest = activeVersion === latestVersion

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
      <div className="mb-6">
        {/* Name row: title + badges left, actions right */}
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

          {/* Actions: line count + GitHub + copy */}
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
            <CopyPageDropdown content={skill.content} label="Copy skill" />
          </div>
        </div>

        {skill.description && (
          <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-2xl">
            {skill.description}
          </p>
        )}
      </div>

      {/* Requires */}
      {skill.requires && skill.requires.length > 0 && (
        <div className="mb-6 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">
            Requires
          </span>
          {skill.requires.map((req) => (
            <Link
              key={req}
              to="/intent/registry/$packageName/$skillName"
              params={{ packageName, skillName: req }}
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
          <Markdown rawContent={stripFrontmatter(skill.content)} />
        </div>
      </div>
    </>
  )
}
