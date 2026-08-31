import {
  ClientOnly,
  isNotFound,
  notFound,
  createFileRoute,
} from '@tanstack/react-router'
import {
  queryOptions,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import React from 'react'
import { DocTitle } from '~/components/DocTitle'
import { Framework, getBranch, getLibrary } from '~/libraries'
import {
  fetchFile,
  fetchRepoDirectoryContents,
  fetchClientExampleFiles,
} from '~/utils/docs'
import {
  getExampleStartingFileName,
  getExampleStartingPath,
} from '~/utils/sandbox'
import { canonicalUrl, seo } from '~/utils/seo'
import { ogImageUrl } from '~/utils/og'
import { capitalize, slugToTitle } from '~/utils/utils'
import * as v from 'valibot'
import { CodeExplorer } from '~/components/CodeExplorer'
import type { GitHubFileNode } from '~/utils/documents.server'
import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import {
  ExampleDeployDialog,
  type DeployProvider,
} from '~/components/ExampleDeployDialog'
import { getDocsCacheHeaders } from '~/utils/docs-cache-headers'
import { getExampleRuntimeHeaders } from '~/utils/stackblitz-embed'
import {
  type DeploymentProviderId,
  useDeploymentProviderPlacement,
} from '~/utils/useDeploymentProviderPlacement'
import { joinRepoPath } from '~/utils/repo-path'
import {
  getLocalStorageItem,
  setLocalStorageItem,
} from '~/utils/browser-storage'
import { createRepositoryExampleDefinition } from '~/utils/repository-example'
import type { ExampleDefinition } from '~/utils/example-workspace'
import { CodeBlock } from '~/components/markdown'
import { getCodeBlockLanguageFromFilePath } from '~/components/markdown/codeBlock.shared'
import { getClientExampleConfig } from '~/utils/client-example-config'

const LazyExampleWorkbench = React.lazy(() =>
  import('~/components/examples/ExampleWorkbench.client').then((module) => ({
    default: module.ExampleWorkbench,
  })),
)

type ExamplePanel = 'code' | 'sandbox'

const examplePanelValues: ReadonlyArray<ExamplePanel> = ['code', 'sandbox']

function getExamplePanel(value: string | undefined) {
  return examplePanelValues.find((candidate) => candidate === value)
}

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
  startingPath: string,
) =>
  queryOptions({
    queryKey: ['repo-api-contents', repo, branch, startingPath],
    queryFn: () =>
      fetchRepoDirectoryContents({
        data: { repo, branch, startingPath },
      }),
    staleTime: Infinity, // We can cache this forever. A refresh can invalidate the cache if necessary.
  })

const clientExampleFilesQueryOptions = ({
  example,
  framework,
  libraryId,
  version,
}: {
  example: string
  framework: string
  libraryId: string
  version: string
}) =>
  queryOptions({
    queryKey: ['client-example-files', libraryId, version, framework, example],
    queryFn: () =>
      fetchClientExampleFiles({
        data: { example, framework, libraryId, version },
      }),
    staleTime: Infinity,
  })

export const Route = createFileRoute(
  '/_library/$libraryId/$version/docs/framework/$framework/examples/$',
)({
  component: RouteComponent,
  // This route's head() emits the rel=canonical link (it may point at the
  // /latest equivalent), so the root route must not emit its own.
  staticData: {
    ownsCanonicalLink: true,
  },
  validateSearch: v.object({
    path: v.optional(v.string()),
    panel: v.optional(v.string()),
  }),
  loaderDeps: ({ search }) => ({ path: search.path }),
  loader: async ({ params, context: { queryClient }, deps: { path } }) => {
    const library = getLibrary(params.libraryId)
    const branch = getBranch(library, params.version)
    const framework = library.frameworks.find(
      (candidate) => candidate === params.framework,
    )

    if (!framework) {
      throw notFound()
    }

    const examplePath = [framework, params._splat].join('/')
    const defaultStartingPath = getExampleStartingPath(
      framework,
      params.libraryId,
    )

    // Used to tell the github contents api where to start looking for files in the target repository
    const repoStartingDirPath = `examples/${examplePath}`

    // Old-version examples that still exist on latest canonicalize to /latest,
    // mirroring the docs routes. Resolved in parallel with the example fetch.
    const canonicalPathOverridePromise = findLatestExampleCanonicalPath({
      branch,
      latestBranch: getBranch(library, 'latest'),
      params,
      repo: library.repo,
      repoStartingDirPath,
    })

    try {
      const clientConfig = getClientExampleConfig({
        framework,
        libraryId: params.libraryId,
        slug: params._splat ?? '',
        version: params.version,
      })

      if (clientConfig) {
        const result = await queryClient.ensureQueryData(
          clientExampleFilesQueryOptions({
            example: clientConfig.slug,
            framework: clientConfig.framework,
            libraryId: clientConfig.libraryId,
            version: params.version,
          }),
        )

        if (!result.success) {
          if (result.reason === 'not-found') throw notFound()
          throw new Error(result.error)
        }

        return {
          kind: 'client' as const,
          autoStart: clientConfig.autoStart,
          canonicalPathOverride: await canonicalPathOverridePromise,
          definition: createRepositoryExampleDefinition({
            binaryFiles: result.binaryFiles,
            entry: clientConfig.entry,
            files: result.files,
            id: `${params.libraryId}-${framework}-${params._splat}`,
            initialFile: getExampleWorkspacePath(path, repoStartingDirPath),
            runtime: clientConfig.runtime,
            title: slugToTitle(params._splat || ''),
          }),
        }
      }

      // Fetching and Caching the contents of the target directory
      const githubContents = await queryClient.ensureQueryData(
        repoDirApiContentsQueryOptions(
          library.repo,
          branch,
          repoStartingDirPath,
        ),
      )
      const repoDirectoryContents = githubContents ?? null

      // Used to determine the starting file name for the explorer
      // It's either the selected path in the search params or a default we can derive
      // i.e. app.tsx, main.tsx, src/routes/__root.tsx, etc.
      // This value is not absolutely guaranteed to be available, so further resolution may be necessary
      const explorerCandidateStartingFileName = path || defaultStartingPath

      // Using the fetched contents, get the actual starting file-path for the explorer
      // The `explorerCandidateStartingFileName` is used for matching, but the actual file-path may differ
      let currentPath = joinRepoPath(
        repoStartingDirPath,
        determineStartingFilePath(
          repoDirectoryContents,
          explorerCandidateStartingFileName,
          framework,
          params.libraryId,
        ),
      )

      let currentCode: string

      try {
        currentCode = await queryClient.ensureQueryData(
          fileQueryOptions(library.repo, branch, currentPath),
        )
      } catch (error) {
        if (!path || !isRouteNotFoundError(error)) {
          throw error
        }

        const fallbackPath = joinRepoPath(
          repoStartingDirPath,
          determineStartingFilePath(
            repoDirectoryContents,
            defaultStartingPath,
            framework,
            params.libraryId,
          ),
        )

        if (fallbackPath === currentPath) {
          throw error
        }

        currentPath = fallbackPath
        currentCode = await queryClient.ensureQueryData(
          fileQueryOptions(library.repo, branch, currentPath),
        )
      }

      return {
        kind: 'external' as const,
        canonicalPathOverride: await canonicalPathOverridePromise,
        currentCode,
        repoStartingDirPath,
        currentPath,
      }
    } catch (error) {
      if (isRouteNotFoundError(error)) {
        throw notFound()
      }
      throw error
    }
  },
  head: ({ params, loaderData }) => {
    const library = getLibrary(params.libraryId)
    const exampleName = slugToTitle(params._splat || '')
    const frameworkName = capitalize(params.framework)
    const ogTitle = `${frameworkName} ${library.name} ${exampleName} Example`
    const ogDescription = `An example showing how to implement ${exampleName} in ${frameworkName} using ${library.name}.`

    const canonicalHref = canonicalUrl(
      loaderData?.canonicalPathOverride ?? buildExamplePath(params),
    )

    return {
      meta: [
        ...seo({
          title: `${ogTitle} | ${library.name} Docs`,
          description: ogDescription,
          image: ogImageUrl(library.id, {
            title: ogTitle,
            description: ogDescription,
          }),
          noindex: library.visible === false,
        }),
        { property: 'og:url', content: canonicalHref },
        { name: 'twitter:url', content: canonicalHref },
      ],
      links: [{ rel: 'canonical', href: canonicalHref }],
    }
  },
  headers: ({ params }) => {
    const { libraryId, version } = params
    const config = getClientExampleConfig({
      framework: params.framework,
      libraryId,
      slug: params._splat ?? '',
      version,
    })

    return {
      ...getDocsCacheHeaders({ libraryId, version }),
      ...getExampleRuntimeHeaders(
        config ? (config.runtime?.type ?? 'esbuild') : 'external',
      ),
    }
  },
  staleTime: 1000 * 60 * 5, // 5 minutes
})

function RouteComponent() {
  const { _splat } = Route.useParams()
  const data = Route.useLoaderData()

  return data.kind === 'client' ? (
    <ClientExamplePage
      key={`client-page-${_splat}`}
      autoStart={data.autoStart}
      definition={data.definition}
    />
  ) : (
    <ExternalExamplePage key={`external-page-${_splat}`} data={data} />
  )
}

function ExternalExamplePage({
  data: { currentCode, repoStartingDirPath, currentPath },
}: {
  data: {
    currentCode: string
    currentPath: string
    kind: 'external'
    repoStartingDirPath: string
  }
}) {
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const { version, framework, _splat, libraryId } = Route.useParams()
  const library = getLibrary(libraryId)
  const branch = getBranch(library, version)
  const frameworkId = library.frameworks.find(
    (candidate) => candidate === framework,
  )

  if (!frameworkId) {
    throw notFound()
  }

  const examplePath = [frameworkId, _splat].join('/')

  const mainExampleFile = getExampleStartingPath(frameworkId, libraryId)

  const { data: githubContents } = useSuspenseQuery(
    repoDirApiContentsQueryOptions(library.repo, branch, repoStartingDirPath),
  )

  const [isDark, setIsDark] = React.useState(true)
  const [deployDialogOpen, setDeployDialogOpen] = React.useState(false)
  const [deployProvider, setDeployProvider] =
    React.useState<DeployProvider | null>(null)

  const openDeployDialog = (provider: DeployProvider) => {
    setDeployProvider(provider)
    setDeployDialogOpen(true)
  }

  const closeDeployDialog = () => {
    setDeployDialogOpen(false)
    setDeployProvider(null)
  }
  const availableExampleDeployProviders = React.useMemo(() => {
    const providers: Array<DeploymentProviderId> = []

    if (library.showCloudflareUrl) {
      providers.push('cloudflare')
    }

    if (library.showNetlifyUrl) {
      providers.push('netlify')
    }

    if (library.showRailwayUrl) {
      providers.push('railway')
    }

    return providers
  }, [
    library.showCloudflareUrl,
    library.showNetlifyUrl,
    library.showRailwayUrl,
  ])
  const orderedExampleDeployProviders = useDeploymentProviderPlacement({
    availableProviders: availableExampleDeployProviders,
    surface: `example_deploy_buttons:${library.id}:${framework}`,
  })

  const activeTab = Route.useSearch({
    select: (s) => {
      const panel = getExamplePanel(s.panel)
      if (typeof window === 'undefined') return panel || 'code'
      const localValue = getExamplePanel(
        getLocalStorageItem('exampleViewPreference') ?? undefined,
      )
      return panel || localValue || 'code'
    },
  })
  const setActiveTab = (tab: ExamplePanel) => {
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

  const prefetchFileContent = React.useCallback(
    (path: string) => {
      const repoFilePath = joinRepoPath(repoStartingDirPath, path)

      if (repoFilePath === currentPath) {
        return
      }

      const queryState = queryClient.getQueryState([
        'currentCode',
        library.repo,
        branch,
        repoFilePath,
      ])

      if (
        queryState?.status === 'success' ||
        queryState?.fetchStatus === 'fetching'
      ) {
        return
      }

      queryClient.prefetchQuery(
        fileQueryOptions(library.repo, branch, repoFilePath),
      )
    },
    [queryClient, library.repo, branch, repoStartingDirPath, currentPath],
  )

  // Update local storage when tab changes
  React.useEffect(() => {
    setLocalStorageItem('exampleViewPreference', activeTab)
  }, [activeTab])

  React.useEffect(() => {
    setIsDark(window.matchMedia?.(`(prefers-color-scheme: dark)`).matches)
  }, [])

  const githubUrl = `https://github.com/${library.repo}/tree/${branch}/examples/${examplePath}`

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

  const renderExampleDeployButton = (provider: DeploymentProviderId) => {
    switch (provider) {
      case 'cloudflare':
        return (
          <button
            key={provider}
            type="button"
            onClick={() => openDeployDialog('cloudflare')}
            className="hover:opacity-80 transition-opacity"
          >
            <img
              src="https://deploy.workers.cloudflare.com/button"
              loading="lazy"
              alt="Deploy to Cloudflare"
            />
          </button>
        )
      case 'netlify':
        return (
          <button
            key={provider}
            type="button"
            onClick={() => openDeployDialog('netlify')}
            className="hover:opacity-80 transition-opacity"
          >
            <img
              src="https://www.netlify.com/img/deploy/button.svg"
              loading="lazy"
              alt="Deploy with Netlify"
            />
          </button>
        )
      case 'railway':
        return (
          <button
            key={provider}
            type="button"
            onClick={() => openDeployDialog('railway')}
            className="hover:opacity-80 transition-opacity"
          >
            <img
              src="https://railway.com/button.svg?utm_medium=sponsor&utm_source=oss&utm_campaign=tanstack"
              loading="lazy"
              alt="Deploy on Railway"
            />
          </button>
        )
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-auto">
      <div className="p-4 lg:p-6">
        <DocTitle>
          <span>
            {capitalize(framework)} Example: {slugToTitle(_splat!)}
          </span>
          <div className="flex items-center gap-4 flex-wrap font-normal text-xs">
            {orderedExampleDeployProviders.map((provider) =>
              renderExampleDeployButton(provider),
            )}
            <a
              href={githubUrl}
              target="_blank"
              className="flex gap-1 items-center"
              rel="noreferrer"
            >
              <ArrowSquareOutIcon /> GitHub
            </a>
            {!library.hideStackblitzUrl ? (
              <a
                href={stackBlitzUrl}
                target="_blank"
                className="flex gap-1 items-center"
                rel="noreferrer"
              >
                <ArrowSquareOutIcon /> StackBlitz
              </a>
            ) : null}
            {!library.hideCodesandboxUrl ? (
              <a
                href={codeSandboxUrl}
                target="_blank"
                className="flex gap-1 items-center"
                rel="noreferrer"
              >
                <ArrowSquareOutIcon /> CodeSandbox
              </a>
            ) : null}
          </div>
        </DocTitle>
      </div>
      <div className="flex-1 lg:px-6 flex flex-col min-h-0">
        <CodeExplorer
          activeTab={activeTab}
          codeSandboxUrl={codeSandboxUrl}
          currentCode={currentCode}
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
      {deployProvider && (
        <ExampleDeployDialog
          isOpen={deployDialogOpen}
          onClose={closeDeployDialog}
          provider={deployProvider}
          repo={library.repo}
          branch={branch}
          examplePath={examplePath}
          exampleName={slugToTitle(_splat!)}
          libraryName={library.name}
        />
      )}
    </div>
  )
}

function ClientExamplePage({
  autoStart,
  definition,
}: {
  autoStart?: boolean
  definition: ExampleDefinition
}) {
  const { version, framework, _splat, libraryId } = Route.useParams()
  const library = getLibrary(libraryId)
  const branch = getBranch(library, version)
  const examplePath = [framework, _splat].join('/')
  const githubUrl = `https://github.com/${library.repo}/tree/${branch}/examples/${examplePath}`
  const initialFile = (
    definition.initialFile ?? definition.workspace.entry
  ).replace(/^\//, '')
  const fallbackAction =
    definition.runtime?.type !== 'webcontainer'
      ? undefined
      : library.hideCodesandboxUrl
        ? {
            label: 'Open in StackBlitz',
            url: `https://stackblitz.com/github/${library.repo}/tree/${branch}/examples/${examplePath}?preset=node&file=${encodeURIComponent(initialFile)}`,
          }
        : {
            label: 'Open in CodeSandbox',
            url: `https://codesandbox.io/p/devbox/github/${library.repo}/tree/${branch}/examples/${examplePath}?file=${encodeURIComponent(initialFile)}`,
          }
  const fallback = <ClientExampleFallback definition={definition} />

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="p-4 lg:p-6">
        <DocTitle>
          <span>
            {capitalize(framework)} Example: {slugToTitle(_splat!)}
          </span>
          <a
            href={githubUrl}
            target="_blank"
            className="flex items-center gap-1 text-xs font-normal"
            rel="noreferrer"
          >
            <ArrowSquareOutIcon /> GitHub
          </a>
        </DocTitle>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:px-6">
        <ClientOnly fallback={fallback}>
          <React.Suspense fallback={fallback}>
            <LazyExampleWorkbench
              autoRun={autoStart}
              definition={definition}
              fallbackAction={fallbackAction}
              filesInitiallyOpen
              libraryColor={library.bgStyle}
              packageResolution="dynamic"
            />
          </React.Suspense>
        </ClientOnly>
      </div>
    </div>
  )
}

function ClientExampleFallback({
  definition,
}: {
  definition: ExampleDefinition
}) {
  const path = definition.initialFile ?? definition.workspace.entry
  const source = definition.workspace.files[path] ?? ''
  const language = getCodeBlockLanguageFromFilePath(path)

  return (
    <section className="not-prose flex h-[clamp(520px,75dvh,720px)] min-w-0 flex-col overflow-hidden rounded-lg border border-border-default bg-background-default">
      <header className="flex min-h-10 shrink-0 items-center border-b border-border-default px-3 font-ds-mono text-xs text-text-muted">
        {path}
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        <CodeBlock
          className="h-full border-0"
          isEmbedded
          showTypeCopyButton={false}
        >
          <code className={`language-${language}`}>{source}</code>
        </CodeBlock>
      </div>
    </section>
  )
}

function determineStartingFilePath(
  nodes: Array<GitHubFileNode> | null,
  candidate: string,
  framework: Framework,
  libraryId: string,
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
      .map((name) => [
        `${name}.tsrx`,
        `${name}.tsx`,
        `${name}.ts`,
        `${name}.js`,
        `${name}.jsx`,
      ])
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
      (node) => node.path.startsWith(dir) && node.type === 'file',
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

function isRouteNotFoundError(error: unknown) {
  return (
    isNotFound(error) ||
    (error !== null && typeof error === 'object' && 'isNotFound' in error)
  )
}

function buildExamplePath(params: {
  libraryId: string
  version: string
  framework: string
  _splat?: string
}) {
  return `/${params.libraryId}/${params.version}/docs/framework/${params.framework}/examples/${params._splat ?? ''}`
}

/**
 * When serving an old version, checks whether the same example directory
 * exists on the latest branch so the page can canonicalize to its /latest
 * equivalent. Fails open (undefined) so a lookup hiccup never breaks the page.
 */
async function findLatestExampleCanonicalPath(opts: {
  branch: string
  latestBranch: string
  params: {
    libraryId: string
    version: string
    framework: string
    _splat?: string
  }
  repo: string
  repoStartingDirPath: string
}): Promise<string | undefined> {
  if (opts.latestBranch === opts.branch) {
    return undefined
  }

  try {
    const contents = await fetchRepoDirectoryContents({
      data: {
        repo: opts.repo,
        branch: opts.latestBranch,
        startingPath: opts.repoStartingDirPath,
      },
    })

    if (!contents || contents.length === 0) {
      return undefined
    }

    return buildExamplePath({ ...opts.params, version: 'latest' })
  } catch {
    return undefined
  }
}

function getExampleWorkspacePath(
  path: string | undefined,
  repoStartingDirPath: string,
) {
  if (!path) return undefined
  const relativePath = path.startsWith(`${repoStartingDirPath}/`)
    ? path.slice(repoStartingDirPath.length + 1)
    : path
  return relativePath.startsWith('/') ? relativePath : `/${relativePath}`
}

function recursiveFlattenGithubContents(
  nodes: Array<GitHubFileNode>,
  bannedDirs: Set<string> = new Set(),
): Array<GitHubFileNode> {
  return nodes.flatMap((node) => {
    if (node.type === 'dir' && node.children && !bannedDirs.has(node.name)) {
      return recursiveFlattenGithubContents(node.children, bannedDirs)
    }
    return node
  })
}
