import {
  queryOptions,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import React from 'react'
import { FaExternalLinkAlt } from 'react-icons/fa'
import { DocTitle } from '~/components/DocTitle'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { fetchFile, fetchRepoDirectoryContents } from '~/utils/docs'
import {
  getExampleStartingFileName,
  getExampleStartingPath,
} from '~/utils/sandbox'
import { seo } from '~/utils/seo'
import { capitalize, slugToTitle } from '~/utils/utils'
import { z } from 'zod'
import { CodeExplorer } from '~/components/CodeExplorer'
import type { GitHubFileNode } from '~/utils/documents.server'

const fileQueryOptions = (repo: string, branch: string, filePath: string) => {
  return queryOptions({
    queryKey: ['currentCode', repo, branch, filePath],
    queryFn: () =>
      fetchFile({
        data: { repo, branch, filePath },
      }),
    staleTime: Infinity, // We can cache this forever. A refresh can invalidate the cache if necessary.
  })
}

const repoDirApiContentsQueryOptions = (
  repo: string,
  branch: string,
  startingPath: string
) =>
  queryOptions({
    queryKey: ['repo-api-contents', repo, branch, startingPath],
    queryFn: () =>
      fetchRepoDirectoryContents({
        data: { repo, branch, startingPath },
      }),
    staleTime: Infinity, // We can cache this forever. A refresh can invalidate the cache if necessary.
  })

export const Route = createFileRoute({
  component: RouteComponent,
  validateSearch: z.object({
    path: z.string().optional(),
    panel: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ path: search.path }),
  loader: async ({ params, context: { queryClient }, deps: { path } }) => {
    const library = getLibrary(params.libraryId)
    const branch = getBranch(library, params.version)
    const examplePath = [params.framework, params._splat].join('/')

    // Used to tell the github contents api where to start looking for files in the target repository
    const repoStartingDirPath = `examples/${examplePath}`

    // Fetching and Caching the contents of the target directory
    const githubContents = await queryClient.ensureQueryData(
      repoDirApiContentsQueryOptions(library.repo, branch, repoStartingDirPath)
    )

    // Used to determine the starting file name for the explorer
    // It's either the selected path in the search params or a default we can derive
    // i.e. app.tsx, main.tsx, src/routes/__root.tsx, etc.
    // This value is not absolutely guaranteed to be available, so further resolution may be necessary
    const explorerCandidateStartingFileName =
      path ||
      getExampleStartingPath(params.framework as Framework, params.libraryId)

    // Using the fetched contents, get the actual starting file-path for the explorer
    // The `explorerCandidateStartingFileName` is used for matching, but the actual file-path may differ
    const currentPath = determineStartingFilePath(
      githubContents,
      explorerCandidateStartingFileName,
      params.framework as Framework,
      params.libraryId
    )

    // Now that we've resolved the starting file path, we can
    // fetching and caching the file content for the starting file path
    await queryClient.ensureQueryData(
      fileQueryOptions(library.repo, branch, currentPath)
    )

    return { repoStartingDirPath, currentPath }
  },
  head: ({ params }) => {
    const library = getLibrary(params.libraryId)

    return {
      meta: seo({
        title: `${capitalize(params.framework)} ${library.name} ${slugToTitle(
          params._splat || ''
        )} Example | ${library.name} Docs`,
        description: `An example showing how to implement ${slugToTitle(
          params._splat || ''
        )} in ${capitalize(params.framework)} using ${library.name}.`,
      }),
    }
  },
  staleTime: 1000 * 60 * 5, // 5 minutes
})

function RouteComponent() {
  const { _splat } = Route.useParams()
  return <PageComponent key={`page-${_splat}`} />
}

function PageComponent() {
  const { repoStartingDirPath, currentPath } = Route.useLoaderData()

  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const { version, framework, _splat, libraryId } = Route.useParams()
  const library = getLibrary(libraryId)
  const branch = getBranch(library, version)

  const examplePath = [framework, _splat].join('/')

  const mainExampleFile = getExampleStartingPath(
    framework as Framework,
    libraryId
  )

  const { data: githubContents } = useSuspenseQuery(
    repoDirApiContentsQueryOptions(library.repo, branch, repoStartingDirPath)
  )

  const [isDark, setIsDark] = React.useState(true)

  const activeTab = Route.useSearch({
    select: (s) => {
      if (typeof window === 'undefined') return s.panel || 'code'
      const localValue = localStorage.getItem('exampleViewPreference') as
        | 'code'
        | 'sandbox'
        | null
      return s.panel || localValue || 'code'
    },
  })
  const setActiveTab = (tab: string) => {
    if (typeof window === 'undefined') {
      localStorage.setItem('exampleViewPreference', tab)
    }
    navigate({
      search: { path: undefined, panel: tab },
      replace: true,
      resetScroll: true,
    })
  }

  const setCurrentPath = (path: string) => {
    navigate({
      search: { path, panel: undefined },
      replace: true,
      resetScroll: false,
    })
  }

  const { data: currentCode } = useQuery(
    fileQueryOptions(library.repo, branch, currentPath)
  )

  const prefetchFileContent = React.useCallback(
    (path: string) => {
      queryClient.prefetchQuery(fileQueryOptions(library.repo, branch, path))
    },
    [queryClient, library.repo, branch]
  )

  // Update local storage when tab changes
  React.useEffect(() => {
    localStorage.setItem('exampleViewPreference', activeTab)
  }, [activeTab])

  React.useEffect(() => {
    setIsDark(window.matchMedia?.(`(prefers-color-scheme: dark)`).matches)
  }, [])

  const repoUrl = `https://github.com/${library.repo}`
  const githubUrl = `https://github.com/${library.repo}/tree/${branch}/examples/${examplePath}`
  const githubExamplePath = `examples/${examplePath}`

  // preset=node can be removed once Stackblitz runs Angular as webcontainer by default
  // See https://github.com/stackblitz/core/issues/2957
  const stackBlitzUrl = `https://stackblitz.com/github/${
    library.repo
  }/tree/${branch}/examples/${examplePath}?embed=1&theme=${
    isDark ? 'dark' : 'light'
  }&preset=node&file=${mainExampleFile}`

  const codeSandboxUrl = `https://codesandbox.io/p/devbox/github/${
    library.repo
  }/tree/${branch}/examples/${examplePath}?embed=1&theme=${
    isDark ? 'dark' : 'light'
  }&file=${mainExampleFile}`

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-auto h-[95dvh]">
      <div className="p-4 lg:p-6">
        <DocTitle>
          <span>
            {capitalize(framework)} Example: {slugToTitle(_splat!)}
          </span>
          <div className="flex items-center gap-4 flex-wrap font-normal text-xs">
            {library.showNetlifyUrl ? (
              <a
                href={`https://app.netlify.com/start/deploy?repository=${repoUrl}&create_from_path=${githubExamplePath}`}
              >
                <img
                  src="https://www.netlify.com/img/deploy/button.svg"
                  alt="Deploy with Netlify"
                />
              </a>
            ) : null}
            {library.showVercelUrl ? (
              <a
                href={`https://vercel.com/new/clone?repository-url=${githubUrl}`}
              >
                <img src="https://vercel.com/button" alt="Deploy with Vercel" />
              </a>
            ) : null}
            <a
              href={githubUrl}
              target="_blank"
              className="flex gap-1 items-center"
              rel="noreferrer"
            >
              <FaExternalLinkAlt /> Github
            </a>
            {!library.hideStackblitzUrl ? (
              <a
                href={stackBlitzUrl}
                target="_blank"
                className="flex gap-1 items-center"
                rel="noreferrer"
              >
                <FaExternalLinkAlt /> StackBlitz
              </a>
            ) : null}
            {!library.hideCodesandboxUrl ? (
              <a
                href={codeSandboxUrl}
                target="_blank"
                className="flex gap-1 items-center"
                rel="noreferrer"
              >
                <FaExternalLinkAlt /> CodeSandbox
              </a>
            ) : null}
          </div>
        </DocTitle>
      </div>
      <div className="flex-1 lg:px-6 flex flex-col min-h-0">
        <CodeExplorer
          activeTab={activeTab as 'code' | 'sandbox'}
          codeSandboxUrl={codeSandboxUrl}
          currentCode={currentCode || ''}
          currentPath={currentPath}
          examplePath={examplePath}
          githubContents={githubContents || undefined}
          library={library}
          prefetchFileContent={prefetchFileContent}
          setActiveTab={setActiveTab}
          setCurrentPath={setCurrentPath}
          stackBlitzUrl={stackBlitzUrl}
        />
      </div>
    </div>
  )
}

function determineStartingFilePath(
  nodes: Array<GitHubFileNode> | null,
  candidate: string,
  framework: Framework,
  libraryId: string
) {
  if (!nodes) return candidate

  const bannedDirs = new Set(['public', '.vscode', 'tests', 'spec', 'assets'])

  const flattened = recursiveFlattenGithubContents(nodes, bannedDirs)
  const found = flattened.find((node) => node.path === candidate)
  if (found) {
    return candidate
  }

  const preferenceFiles = new Set([
    getExampleStartingFileName(framework, libraryId),
    ...['__root', 'App', 'main', 'index', 'page', 'action']
      .map((name) => [`${name}.tsx`, `${name}.ts`, `${name}.js`, `${name}.jsx`])
      .flat(),
    'README.md',
  ])

  const preferenceDirs = new Set(['src', 'routes', 'app', 'pages'])

  // Try and find a preference file
  for (const file of preferenceFiles) {
    const found = flattened.find((node) => node.name === file)
    if (found) {
      return found.path
    }
  }

  // If no preference file is found, try and find the first file from a preference directory
  for (const dir of preferenceDirs) {
    const found = flattened.find(
      (node) => node.path.startsWith(dir) && node.type === 'file'
    )
    if (found) {
      return found.path
    }
  }

  // If no preference file is found, just return the first file
  const firstFile = flattened.find((node) => node.type === 'file')
  if (firstFile) {
    return firstFile.path
  }

  // If no file is found, return the candidate
  return candidate
}

function recursiveFlattenGithubContents(
  nodes: Array<GitHubFileNode>,
  bannedDirs: Set<string> = new Set()
): Array<GitHubFileNode> {
  return nodes.flatMap((node) => {
    if (node.type === 'dir' && node.children && !bannedDirs.has(node.name)) {
      return recursiveFlattenGithubContents(node.children, bannedDirs)
    }
    return node
  })
}
