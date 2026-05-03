import * as React from 'react'
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import * as v from 'valibot'
import { Copy, Check } from 'lucide-react'
import { Collapsible, CollapsibleContent } from '~/components/Collapsible'
import { seo } from '~/utils/seo'
import {
  intentPackageDetailQueryOptions,
  intentVersionSkillsQueryOptions,
  intentSkillHistoryQueryOptions,
} from '~/queries/intent'
import type { IntentPackageDetail } from '~/utils/intent.functions'
import { useToast } from '~/components/ToastProvider'
import { SkillSparklineFallback } from '~/components/intent/SkillSparklineFallback'

const LazySkillSparkline = React.lazy(() =>
  import('~/components/intent/SkillSparkline').then((m) => ({
    default: m.SkillSparkline,
  })),
)

// npm scoped package names (@scope/name) can't go in a URL segment directly.
// We encode `@scope/name` as `@scope__name` in the URL.
export function decodePkgName(slug: string): string {
  return slug.replace('__', '/')
}

// Context for sharing version + package metadata between layout and child routes
type PackageLayoutContextValue = {
  activeVersion: string
  latestVersion: string
  setVersion: (v: string) => void
  repositoryUrl: string | undefined
}

export const PackageLayoutContext =
  React.createContext<PackageLayoutContextValue | null>(null)

export function usePackageVersion() {
  const ctx = React.useContext(PackageLayoutContext)
  if (!ctx)
    throw new Error('usePackageVersion must be used within PackageLayout')
  return ctx
}

const searchSchema = v.object({
  version: v.fallback(v.optional(v.string()), undefined),
  tab: v.fallback(v.optional(v.picklist(['skills', 'history'])), undefined),
  expanded: v.fallback(v.optional(v.array(v.string())), undefined),
  expandedSkills: v.fallback(v.optional(v.array(v.string())), undefined),
})

export const Route = createFileRoute('/intent/registry/$packageName')({
  validateSearch: (search) => v.parse(searchSchema, search),
  loader: async ({ params, context: { queryClient } }) => {
    const name = decodePkgName(params.packageName)
    await queryClient.ensureQueryData(intentPackageDetailQueryOptions(name))
  },
  head: ({ params }) => {
    const name = decodePkgName(params.packageName)
    return {
      meta: seo({
        title: `${name} | Agent Skills Registry | TanStack Intent`,
        description: `Browse Agent Skills shipped with ${name}.`,
      }),
    }
  },
  component: PackageLayout,
})

function PackageLayout() {
  const { packageName } = Route.useParams()
  const name = decodePkgName(packageName)

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <React.Suspense fallback={<PackageDetailSkeleton name={name} />}>
        <PackageLayoutContent name={name} />
      </React.Suspense>
    </div>
  )
}

function PackageLayoutContent({ name }: { readonly name: string }) {
  const { version: searchVersion } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const detailQuery = useSuspenseQuery(intentPackageDetailQueryOptions(name))
  const detail = detailQuery.data

  const latestVersion = detail?.versions[0]?.version ?? ''
  const activeVersion = searchVersion ?? latestVersion

  const setVersion = React.useCallback(
    (v: string) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          version: v === latestVersion ? undefined : v,
        }),
        replace: true,
      })
    },
    [navigate, latestVersion],
  )

  if (!detail) return <PackageNotFound />

  return (
    <PackageLayoutContext.Provider
      value={{
        activeVersion,
        latestVersion,
        setVersion,
        repositoryUrl: detail.repositoryUrl ?? undefined,
      }}
    >
      <PackageLayoutInner
        name={name}
        detail={detail}
        activeVersion={activeVersion}
        setVersion={setVersion}
      />
    </PackageLayoutContext.Provider>
  )
}

function PackageLayoutInner({
  name,
  detail,
  activeVersion,
  setVersion,
}: {
  readonly name: string
  readonly detail: IntentPackageDetail
  readonly activeVersion: string
  readonly setVersion: (v: string) => void
}) {
  const { packageName, _splat: skillName } = useParams({ strict: false }) as {
    packageName: string
    _splat?: string
  }

  const skillsQuery = useSuspenseQuery(
    intentVersionSkillsQueryOptions({
      packageName: name,
      version: activeVersion,
    }),
  )
  const skills = skillsQuery.data?.skills ?? []

  const packageNames = React.useMemo(() => [name], [name])
  const skillHistoryQuery = useQuery(
    intentSkillHistoryQueryOptions(packageNames),
  )
  const skillHistory = skillHistoryQuery.data?.[name]

  return (
    <>
      {/* Breadcrumb + header */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
            <Link
              to="/$libraryId/$version"
              params={{ libraryId: 'intent', version: 'latest' }}
              className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
            >
              TanStack Intent
            </Link>
            <span>/</span>
            <Link
              to="/intent/registry"
              className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
            >
              Registry
            </Link>
            <span>/</span>
            <Link
              to="/intent/registry/$packageName"
              params={{ packageName: name.replace('/', '__') }}
              className="font-mono text-gray-900 dark:text-gray-100 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
            >
              {name}
            </Link>
          </div>

          {/* Top row: name + sparkline + version + copy */}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-50 mr-auto">
              {name}
            </h1>

            <div className="w-24 shrink-0">
              {skillHistory && skillHistory.length > 0 ? (
                <React.Suspense
                  fallback={<SkillSparklineFallback height={24} />}
                >
                  <LazySkillSparkline history={skillHistory} height={24} />
                </React.Suspense>
              ) : skillHistoryQuery.isLoading ? (
                <SkillSparklineFallback height={24} />
              ) : null}
            </div>

            {detail.versions.length > 0 && (
              <select
                id="pkg-version-select"
                value={activeVersion}
                onChange={(e) => setVersion(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500 max-w-[12rem]"
              >
                {detail.versions.map((v, i) => (
                  <option key={v.version} value={v.version}>
                    {v.version}
                    {i === 0 ? ' (latest)' : ''} — {v.skillCount}{' '}
                    {v.skillCount === 1 ? 'skill' : 'skills'}
                  </option>
                ))}
              </select>
            )}

            <CopyInstallPromptButton name={name} />
          </div>

          {/* Bottom row: description + demoted external links */}
          <div className="flex items-end justify-between gap-4 mt-1.5">
            {detail.description ? (
              <p className="text-gray-600 dark:text-gray-400 min-w-0 line-clamp-2">
                {detail.description}
              </p>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2.5 shrink-0">
              <a
                href={detail.npmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                title="npm"
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M0 0v24h6.545V6h5.455v18H24V0H0z" />
                </svg>
              </a>
              {detail.repositoryUrl && (
                <a
                  href={detail.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="GitHub"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: collapsible skills drawer */}
      <MobileSkillsDrawer
        skills={skills}
        packageName={packageName}
        activeSkillName={skillName}
      />

      {/* Desktop: two-column body — sidebar only on skill detail pages */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-0 min-h-[calc(100vh-200px)]">
        {skillName && (
          <aside className="hidden md:block w-56 shrink-0 border-r border-gray-200 dark:border-gray-800 py-6 pr-4">
            <SkillsNav
              skills={skills}
              packageName={packageName}
              activeSkillName={skillName}
            />
          </aside>
        )}

        {/* Main content */}
        <main className={`flex-1 min-w-0 py-6 ${skillName ? 'md:pl-6' : ''}`}>
          <Outlet />
        </main>
      </div>
    </>
  )
}

function CopyInstallPromptButton({ name }: { readonly name: string }) {
  const [copied, setCopied] = React.useState(false)
  const { notify } = useToast()

  const handleCopy = async () => {
    const prompt = `Install ${name} and set up its Agent Skills:

1. Install the package using the project's package manager:
   ${name}

2. Ensure @tanstack/intent is installed:
   @tanstack/intent

3. Discover and install the skills shipped with this package:
   npx @tanstack/intent install

This will detect all Agent Skills in ${name} and configure them for your coding agent.`

    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    notify(
      <div>
        <div className="font-medium">Copied install prompt</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Paste into your coding agent
        </div>
      </div>,
    )
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 hover:border-sky-300 dark:hover:border-sky-700 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
      Copy install prompt
    </button>
  )
}

type SkillEntry = { name: string; type: string | null }

function SidebarTypeBadge({ type }: { readonly type: string }) {
  const style = SKILL_TYPE_STYLES[type] ?? SKILL_TYPE_STYLES['sub-skill']
  return (
    <span
      className={`inline-block px-1.5 py-px rounded text-[10px] leading-tight border ${style}`}
    >
      {type}
    </span>
  )
}

function SkillsNav({
  skills,
  packageName,
  activeSkillName,
  onNavigate,
}: {
  readonly skills: Array<SkillEntry>
  readonly packageName: string
  readonly activeSkillName: string | undefined
  readonly onNavigate?: () => void
}) {
  if (skills.length === 0) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500">
        No skills found.
      </p>
    )
  }

  const isOnIndex = !activeSkillName

  return (
    <>
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
        Skills
      </p>
      <nav className="space-y-0.5">
        <Link
          to="/intent/registry/$packageName"
          params={{ packageName }}
          onClick={onNavigate}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
            isOnIndex
              ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          All Skills
          <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500">
            {skills.length}
          </span>
        </Link>
        {skills.map((s) => {
          const isActive = activeSkillName === s.name
          return (
            <Link
              key={s.name}
              to="/intent/registry/$packageName/{$}"
              params={{ packageName, _splat: s.name }}
              onClick={onNavigate}
              className={`flex flex-col items-start px-2 py-1.5 rounded-md text-sm font-mono transition-colors ${
                isActive
                  ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <span className="truncate w-full">{s.name}</span>
              {s.type && <SidebarTypeBadge type={s.type} />}
            </Link>
          )
        })}
      </nav>
    </>
  )
}

function MobileSkillsDrawer({
  skills,
  packageName,
  activeSkillName,
}: {
  readonly skills: Array<SkillEntry>
  readonly packageName: string
  readonly activeSkillName: string | undefined
}) {
  const [open, setOpen] = React.useState(false)
  const activeSkill = skills.find((s) => s.name === activeSkillName)

  return (
    <div className="md:hidden border-b border-gray-200 dark:border-gray-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 dark:text-gray-300"
      >
        <span className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          <span className="font-medium">
            {activeSkill ? (
              <span className="font-mono">{activeSkill.name}</span>
            ) : (
              'Skills'
            )}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ({skills.length})
          </span>
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m19 9-7 7-7-7"
          />
        </svg>
      </button>
      <Collapsible open={open}>
        <CollapsibleContent>
          <div className="px-4 pb-4 max-h-64 overflow-y-auto">
            <SkillsNav
              skills={skills}
              packageName={packageName}
              activeSkillName={activeSkillName}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export function PackageDetailSkeleton({ name }: { readonly name: string }) {
  return (
    <>
      <div className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
            <Link
              to="/$libraryId/$version"
              params={{ libraryId: 'intent', version: 'latest' }}
              className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
            >
              TanStack Intent
            </Link>
            <span>/</span>
            <Link
              to="/intent/registry"
              className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
            >
              Registry
            </Link>
            <span>/</span>
            <span className="font-mono text-gray-900 dark:text-gray-100">
              {name}
            </span>
          </div>
          <div className="animate-pulse space-y-3">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-4 w-72 bg-gray-100 dark:bg-gray-800/60 rounded" />
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-0 min-h-[calc(100vh-200px)]">
        <aside className="hidden md:block w-56 shrink-0 border-r border-gray-200 dark:border-gray-800 py-6 pr-4">
          <div className="animate-pulse space-y-2">
            <div className="h-3 w-12 bg-gray-200 dark:bg-gray-800 rounded mb-3" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-7 w-full bg-gray-100 dark:bg-gray-800/60 rounded-md"
              />
            ))}
          </div>
        </aside>
        <main className="flex-1 min-w-0 py-6 md:pl-6">
          <div className="animate-pulse space-y-3">
            <div className="h-6 w-40 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-4 w-96 bg-gray-100 dark:bg-gray-800/60 rounded" />
            <div className="mt-6 h-64 w-full bg-gray-100 dark:bg-gray-800/60 rounded-xl" />
          </div>
          <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
            Fetching package from npm...
          </p>
        </main>
      </div>
    </>
  )
}

export function PackageNotFound() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Package not found
        </h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          This package isn't in the registry yet.
        </p>
        <Link
          to="/intent/registry"
          className="mt-4 inline-block text-sky-600 dark:text-sky-400 hover:underline text-sm"
        >
          Browse registry
        </Link>
      </div>
    </div>
  )
}

export const SKILL_TYPE_STYLES: Record<string, string> = {
  core: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-900',
  'sub-skill':
    'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  framework:
    'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900',
  lifecycle:
    'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-100 dark:border-green-900',
  composition:
    'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900',
  security:
    'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-100 dark:border-red-900',
}

export function SkillTypeBadge({ type }: { readonly type: string }) {
  const style = SKILL_TYPE_STYLES[type] ?? SKILL_TYPE_STYLES['sub-skill']
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md text-xs border ${style}`}
    >
      {type}
    </span>
  )
}
