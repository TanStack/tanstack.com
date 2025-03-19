import {
  queryOptions,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { FaExternalLinkAlt, FaExpand, FaCompress } from 'react-icons/fa'
import { CgMenuLeft } from 'react-icons/cg'
import { DocTitle } from '~/components/DocTitle'
import { CodeBlock } from '~/components/Markdown'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { fetchFile, fetchRepoDirectoryContents } from '~/utils/docs'
import {
  getFrameworkStartFileName,
  getInitialExplorerDirectory,
  getInitialSandboxFileName,
} from '~/utils/sandbox'
import { seo } from '~/utils/seo'
import { capitalize, slugToTitle } from '~/utils/utils'
import type { GitHubFileNode } from '~/utils/documents.server'
import { z } from 'zod'
import { useWindowSize } from '~/hooks/useWindowSize'

import typescriptIconUrl from '~/images/file-icons/typescript.svg?url'
import javascriptIconUrl from '~/images/file-icons/javascript.svg?url'
import cssIconUrl from '~/images/file-icons/css.svg?url'
import htmlIconUrl from '~/images/file-icons/html.svg?url'
import jsonIconUrl from '~/images/file-icons/json.svg?url'
import svelteIconUrl from '~/images/file-icons/svelte.svg?url'
import vueIconUrl from '~/images/file-icons/vue.svg?url'
import textIconUrl from '~/images/file-icons/txt.svg?url'

const fileQueryOptions = (repo: string, branch: string, filePath: string) => {
  return queryOptions({
    queryKey: ['currentCode', repo, branch, filePath],
    queryFn: () =>
      fetchFile({
        data: { repo, branch, filePath },
      }),
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
  })

export const Route = createFileRoute(
  '/$libraryId/$version/docs/framework/$framework/examples/$'
)({
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
  component: RouteComponent,
  validateSearch: z.object({
    path: z.string().optional(),
    panel: z.string().optional(),
  }),
  loader: async ({ params, context: { queryClient } }) => {
    const library = getLibrary(params.libraryId)
    const branch = getBranch(library, params.version)
    const examplePath = [params.framework, params._splat].join('/')
    const explorerFirstDirectory = getInitialExplorerDirectory(params.libraryId)
    const explorerFirstFileName = getInitialSandboxFileName(
      params.framework as Framework,
      params.libraryId
    )

    // Used for fetching the file content of the initial file
    const explorerStartingFilePath = `examples/${examplePath}/${explorerFirstFileName}`

    // Used to indicate from where should the directory tree start.
    // i.e. from `examples/react/quickstart` or `examples/react/quickstart/src`
    const explorerDirectoryStartingPath = `examples/${examplePath}${explorerFirstDirectory}`

    await Promise.allSettled([
      queryClient.ensureQueryData(
        fileQueryOptions(library.repo, branch, explorerStartingFilePath)
      ),
      queryClient.ensureQueryData(
        repoDirApiContentsQueryOptions(
          library.repo,
          branch,
          explorerDirectoryStartingPath
        )
      ),
    ])

    return {
      explorerDirectoryStartingPath,
      explorerStartingFilePath,
    }
  },
  staleTime: 1000 * 60 * 5, // 5 minutes
})

const bannedDefaultOpenFolders = new Set(['public', '.vscode', 'tests', 'spec'])

function determineStartingFilePath(
  nodes: Array<GitHubFileNode> | null,
  candidate: string,
  framework: Framework,
  libraryId: string
) {
  if (!nodes) return candidate

  // flatten the tree to check if the candidate is a file
  function recursiveFlatten(
    nodes: Array<GitHubFileNode>
  ): Array<GitHubFileNode> {
    return nodes.flatMap((node) => {
      if (node.type === 'dir' && node.children) {
        return recursiveFlatten(node.children)
      }
      return node
    })
  }
  const flattened = recursiveFlatten(nodes)

  const found = flattened.find((node) => node.path === candidate)
  if (found) {
    return candidate
  }

  const preferenceFiles = [
    getFrameworkStartFileName(framework, libraryId),
    'page.tsx',
    'page.ts',
    'App.tsx',
    'App.ts',
    'main.tsx',
    'main.ts',
    'index.tsx',
    'index.ts',
    'action.ts',
    'README.md',
  ]
  const preferenceDirs = ['src', 'routes']

  // Try and find a preference file
  for (const file of preferenceFiles) {
    const found = flattened.find((node) => node.path === file)
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

function RouteComponent() {
  // Not sure why this inferred type is not working
  // @ts-expect-error
  const { explorerDirectoryStartingPath, explorerStartingFilePath } =
    Route.useLoaderData()

  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const { version, framework, _splat, libraryId } = Route.useParams()
  const library = getLibrary(libraryId)
  const branch = getBranch(library, version)

  const examplePath = [framework, _splat].join('/')

  const mainExampleFile = getInitialSandboxFileName(
    framework as Framework,
    libraryId
  )

  const { data: githubContents } = useSuspenseQuery(
    repoDirApiContentsQueryOptions(
      library.repo,
      branch,
      explorerDirectoryStartingPath
    )
  )

  const startingFilePath = determineStartingFilePath(
    githubContents,
    explorerStartingFilePath,
    framework as Framework,
    libraryId
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

  const currentPath = Route.useSearch({
    select: (s) => {
      return s.path || startingFilePath || explorerStartingFilePath
    },
  })

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

  const [sidebarWidth, setSidebarWidth] = React.useState(200)
  const [isResizing, setIsResizing] = React.useState(false)
  const sidebarRef = React.useRef<HTMLDivElement>(null)
  const startResizeRef = React.useRef({
    startX: 0,
    startWidth: 0,
  })

  // Initialize expandedFolders with root-level folders
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(
    () => {
      const expanded = new Set<string>()
      if (githubContents) {
        githubContents.forEach((file: GitHubFileNode) => {
          if (
            file.type === 'dir' &&
            file.depth === 0 &&
            !bannedDefaultOpenFolders.has(file.name)
          ) {
            expanded.add(file.path)
          }
        })
      }
      return expanded
    }
  )

  // Add toggle function for folders
  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const startResize = (e: React.MouseEvent) => {
    setIsResizing(true)
    startResizeRef.current = {
      startX: e.clientX,
      startWidth: sidebarWidth,
    }
  }

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

  const libraryColor = library.bgStyle
  const hideCodesandbox = library.hideCodesandboxUrl
  const hideStackblitz = library.hideStackblitzUrl
  const showVercel = library.showVercelUrl
  const showNetlify = library.showNetlifyUrl

  const [isFullScreen, setIsFullScreen] = React.useState(false)
  const windowSize = useWindowSize()
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true)

  React.useEffect(() => {
    // Default to closed on mobile (width < 768px)
    if (windowSize.width && isSidebarOpen) {
      setIsSidebarOpen(windowSize.width >= 768)
    }
  }, [windowSize.width, isSidebarOpen])

  // Add escape key handler
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isFullScreen])

  // Update local storage when tab changes
  React.useEffect(() => {
    localStorage.setItem('exampleViewPreference', activeTab)
  }, [activeTab])

  React.useEffect(() => {
    setIsDark(window.matchMedia?.(`(prefers-color-scheme: dark)`).matches)
  }, [])

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const diff = e.clientX - startResizeRef.current.startX
      const newWidth = startResizeRef.current.startWidth + diff

      if (newWidth >= 150 && newWidth <= 600) {
        setSidebarWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-auto h-[95dvh]">
      <div className="p-4 lg:p-6">
        <DocTitle>
          <span>
            {capitalize(framework)} Example: {slugToTitle(_splat!)}
          </span>
          <div className="flex items-center gap-4 flex-wrap font-normal text-xs">
            {showNetlify ? (
              <a
                href={`https://app.netlify.com/start/deploy?repository=${repoUrl}&create_from_path=${githubExamplePath}`}
              >
                <img
                  src="https://www.netlify.com/img/deploy/button.svg"
                  alt="Deploy with Netlify"
                />
              </a>
            ) : null}
            {showVercel ? (
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
            {!hideStackblitz ? (
              <a
                href={stackBlitzUrl}
                target="_blank"
                className="flex gap-1 items-center"
                rel="noreferrer"
              >
                <FaExternalLinkAlt /> StackBlitz
              </a>
            ) : null}
            {!hideCodesandbox ? (
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
        <div
          className={`flex flex-col min-h-[80dvh] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${
            isFullScreen
              ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 p-4'
              : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('code')}
                className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                  activeTab === 'code'
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Code Explorer
                {activeTab === 'code' ? (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                ) : (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-transparent" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('sandbox')}
                className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                  activeTab === 'sandbox'
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Interactive Sandbox
                {activeTab === 'sandbox' ? (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                ) : (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-transparent" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'code' ? (
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 text-sm rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                >
                  <CgMenuLeft className="w-4 h-4" />
                </button>
              ) : (
                <div className="p-2 text-sm rounded" aria-hidden>
                  <CgMenuLeft
                    className="w-4 h-4 text-transparent"
                    aria-hidden
                  />
                </div>
              )}
              <button
                onClick={() => {
                  setIsFullScreen((prev) => !prev)
                }}
                className={`p-2 text-sm rounded transition-colors mr-2 hover:bg-gray-200 dark:hover:bg-gray-700 ${
                  activeTab === 'code'
                    ? 'text-gray-700 dark:text-gray-300'
                    : 'text-gray-400 dark:text-gray-600'
                }`}
                title={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
              >
                {isFullScreen ? (
                  <FaCompress className="w-4 h-4" />
                ) : (
                  <FaExpand className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="relative flex-1">
            <div
              className={`absolute inset-0 flex ${
                activeTab === 'code' ? '' : 'hidden'
              }`}
            >
              <div
                ref={sidebarRef}
                style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
                className={`flex-shrink-0 overflow-y-auto bg-gradient-to-r from-gray-50 via-gray-50 to-transparent dark:from-gray-800/50 dark:via-gray-800/50 dark:to-transparent lg:pr-2 shadow-sm ${
                  isResizing ? '' : 'transition-all duration-300'
                } ${isSidebarOpen ? '' : 'w-0 pr-0'}`}
              >
                {githubContents && isSidebarOpen ? (
                  <div className="p-2">
                    <RenderFileTree
                      files={githubContents}
                      libraryColor={libraryColor}
                      toggleFolder={toggleFolder}
                      prefetchFileContent={prefetchFileContent}
                      expandedFolders={expandedFolders}
                      currentPath={currentPath}
                      setCurrentPath={setCurrentPath}
                    />
                  </div>
                ) : null}
              </div>
              <div
                className={`w-1 cursor-col-resize hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500 ${
                  isResizing ? '' : 'transition-colors'
                } ${isSidebarOpen ? '' : 'hidden'}`}
                onMouseDown={startResize}
              />
              <div className="flex-1 overflow-auto relative">
                <CodeBlock
                  isEmbedded
                  className={`${
                    isFullScreen ? 'max-h-[90dvh]' : 'max-h-[80dvh]'
                  }`}
                >
                  <code
                    className={`language-${overrideExtension(
                      currentPath.split('.').pop()
                    )}`}
                  >
                    {currentCode}
                  </code>
                </CodeBlock>
              </div>
            </div>

            <div
              className={`absolute inset-0 ${
                activeTab === 'sandbox' ? '' : 'pointer-events-none opacity-0'
              }`}
              aria-hidden={activeTab !== 'sandbox'}
            >
              <iframe
                src={
                  library.embedEditor === 'codesandbox'
                    ? codeSandboxUrl
                    : stackBlitzUrl
                }
                title={`${library.name} | ${examplePath}`}
                sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
                className="w-full h-full min-h-[80dvh] overflow-hidden lg:rounded-lg shadow-xl shadow-gray-700/20 bg-white dark:bg-black"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function overrideExtension(ext: string | undefined) {
  if (!ext) return 'txt'

  // Override some extensions
  if (['cts', 'mts'].includes(ext)) return 'ts'
  if (['cjs', 'mjs'].includes(ext)) return 'js'
  if (['prettierrc', 'babelrc', 'webmanifest'].includes(ext)) return 'json'
  if (['env', 'example'].includes(ext)) return 'sh'
  if (
    [
      'gitignore',
      'prettierignore',
      'log',
      'gitattributes',
      'editorconfig',
      'lock',
      'opts',
      'Dockerfile',
      'dockerignore',
      'npmrc',
      'nvmrc',
    ].includes(ext)
  )
    return 'txt'

  return ext
}

const getFileIconPath = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  switch (ext) {
    case 'ts':
    case 'tsx':
      return typescriptIconUrl
    case 'js':
    case 'jsx':
      return javascriptIconUrl
    case 'css':
      return cssIconUrl
    case 'html':
      return htmlIconUrl
    case 'json':
      return jsonIconUrl
    case 'svelte':
      return svelteIconUrl
    case 'vue':
      return vueIconUrl
    default:
      return textIconUrl
  }
}

const FileIcon = ({ filename }: { filename: string }) => {
  return (
    <img
      src={getFileIconPath(filename)}
      alt={`${filename} file icon`}
      width={16}
      height={16}
      className="inline-block"
    />
  )
}

const FolderIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="#FFC107" // Material yellow
    xmlns="http://www.w3.org/2000/svg"
    className="inline-block"
  >
    {isOpen ? (
      <path d="M1.5 2h5l1 2h7a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 14.5 14h-13A1.5 1.5 0 0 1 0 12.5v-9A1.5 1.5 0 0 1 1.5 2z" />
    ) : (
      <path d="M.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5H7l-1-2H.5z" />
    )}
  </svg>
)

function getMarginLeft(depth: number) {
  return `${depth * 2 + 12}px`
}

const RenderFileTree = (props: {
  files: GitHubFileNode[] | undefined
  libraryColor: string
  toggleFolder: (path: string) => void
  prefetchFileContent: (file: string) => void
  expandedFolders: Set<string>
  currentPath: string | null
  setCurrentPath: (file: string) => void
}) => {
  if (!props.files) return null

  return (
    <ul className="flex flex-col">
      {props.files.map((file) => (
        <li key={file.path} style={{ marginLeft: getMarginLeft(file.depth) }}>
          <button
            onClick={() => {
              if (file.type === 'dir') {
                props.toggleFolder(file.path)
              } else {
                props.setCurrentPath(file.path)
              }
            }}
            onMouseEnter={() =>
              file.type !== 'dir' && props.prefetchFileContent(file.path)
            }
            className={`px-2 py-2 text-left w-full flex items-center gap-2 text-sm rounded transition-colors duration-200 min-w-0 ${
              props.currentPath === file.path
                ? `${props.libraryColor.replace(
                    'bg-',
                    'bg-opacity-20 bg-'
                  )} text-gray-900 dark:text-white shadow-sm`
                : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <span className="flex-shrink-0 select-none">
              {file.type === 'dir' ? (
                <FolderIcon isOpen={props.expandedFolders.has(file.path)} />
              ) : (
                <FileIcon filename={file.name} />
              )}
            </span>
            <span className="truncate select-none">{file.name}</span>
          </button>
          {file.children && props.expandedFolders.has(file.path) && (
            <RenderFileTree {...props} files={file.children} />
          )}
        </li>
      ))}
    </ul>
  )
}
