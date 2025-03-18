import {
  queryOptions,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'

import { FaExternalLinkAlt, FaExpand, FaCompress } from 'react-icons/fa'
import { DocTitle } from '~/components/DocTitle'
import { CodeBlock } from '~/components/Markdown'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { fetchFile, fetchRepoDirectoryContents } from '~/utils/docs'
import { getInitialSandboxFileName } from '~/utils/sandbox'
import { seo } from '~/utils/seo'
import { capitalize, slugToTitle } from '~/utils/utils'
import type { GitHubFileNode } from '~/utils/documents.server'

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
      fetchRepoDirectoryContents({ data: { repo, branch, startingPath } }),
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
  component: Example,
  loader: async ({ params, context: { queryClient } }) => {
    const library = getLibrary(params.libraryId)
    const branch = getBranch(library, params.version)
    const examplePath = [params.framework, params._splat].join('/')
    const sandboxFirstFileName = getInitialSandboxFileName(
      params.framework as Framework,
      params.libraryId
    )
    const directoryStartingPath = `examples/${examplePath}/src`
    const sandboxStartingFilePath = `examples/${examplePath}/${sandboxFirstFileName}`

    await Promise.allSettled([
      queryClient.ensureQueryData(
        fileQueryOptions(library.repo, branch, sandboxStartingFilePath)
      ),
      queryClient.ensureQueryData(
        repoDirApiContentsQueryOptions(
          library.repo,
          branch,
          directoryStartingPath
        )
      ),
    ])

    return {
      directoryStartingPath,
      sandboxStartingFilePath,
    }
  },
})

export default function Example() {
  // Not sure why this inferred type is not working
  // @ts-expect-error
  const { directoryStartingPath, sandboxStartingFilePath } =
    Route.useLoaderData()

  const queryClient = useQueryClient()
  const { version, framework, _splat, libraryId } = Route.useParams()
  const library = getLibrary(libraryId)
  const branch = getBranch(library, version)

  const mainExampleFile = getInitialSandboxFileName(
    framework as Framework,
    libraryId
  )

  const { data: gitHubFiles } = useSuspenseQuery(
    repoDirApiContentsQueryOptions(library.repo, branch, directoryStartingPath)
  )
  const examplePath = [framework, _splat].join('/')

  const [isDark, setIsDark] = React.useState(true)
  const [currentPath, setCurrentPath] = React.useState<string>(
    sandboxStartingFilePath
  )

  const { data: currentCode } = useQuery(
    fileQueryOptions(library.repo, branch, currentPath)
  )

  const prefetchFileContent = React.useCallback(
    (path: string) => {
      queryClient.prefetchQuery(fileQueryOptions(library.repo, branch, path))
    },
    [queryClient, library.repo, branch]
  )

  const [sidebarWidth, setSidebarWidth] = React.useState(250)
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
      if (gitHubFiles) {
        gitHubFiles.forEach((file: GitHubFileNode) => {
          if (file.type === 'dir' && file.depth === 0) {
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

  // Add tab state with local storage persistence
  const [activeTab, setActiveTab] = React.useState<'code' | 'sandbox'>(() => {
    if (typeof window === 'undefined') return 'code'
    return (
      (localStorage.getItem('exampleViewPreference') as 'code' | 'sandbox') ||
      'code'
    )
  })

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
          className={`flex flex-col min-h-[80dvh] ${
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
                {activeTab === 'code' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
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
                {activeTab === 'sandbox' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </button>
            </div>
            <button
              onClick={() => {
                if (activeTab === 'code') {
                  setIsFullScreen(!isFullScreen)
                } else {
                  setActiveTab('code')
                  setIsFullScreen(true)
                }
              }}
              className={`p-2 text-sm rounded transition-colors mr-2 hover:bg-gray-200 dark:hover:bg-gray-700 group relative ${
                activeTab === 'code'
                  ? 'text-gray-700 dark:text-gray-300'
                  : 'text-gray-400 dark:text-gray-600'
              }`}
              aria-label={
                isFullScreen ? 'Exit full screen' : 'Enter full screen'
              }
            >
              {isFullScreen ? (
                <FaCompress className="w-4 h-4" />
              ) : (
                <FaExpand className="w-4 h-4" />
              )}
              <div className="absolute bottom-full right-full mb-2 mr-2 hidden group-hover:block whitespace-nowrap px-2 py-1 text-xs bg-gray-900 text-white rounded shadow-lg">
                {isFullScreen ? 'Exit full screen' : 'Enter full screen'}
              </div>
            </button>
          </div>

          {activeTab === 'code' ? (
            <div className="flex flex-1">
              <div
                ref={sidebarRef}
                style={{ width: sidebarWidth }}
                className="flex-shrink-0 overflow-y-auto border-r border-gray-200 dark:border-gray-700 pr-2 bg-gray-50 dark:bg-gray-800/50 shadow-sm"
              >
                {gitHubFiles ? (
                  <div className="p-2">
                    <RenderFileTree
                      files={gitHubFiles}
                      libraryColor={libraryColor}
                      toggleFolder={toggleFolder}
                      prefetchFileContent={prefetchFileContent}
                      expandedFolders={expandedFolders}
                      currentPath={currentPath}
                      setCurrentPath={setCurrentPath}
                    />
                  </div>
                ) : (
                  <div className="px-4 text-sm text-gray-500">
                    No files found
                  </div>
                )}
              </div>
              <div
                className="w-1 cursor-col-resize hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500 transition-colors"
                onMouseDown={startResize}
              />
              <div className="flex-1 pl-4 overflow-auto relative">
                <CodeBlock className={`mt-4 max-h-[80dvh]`}>
                  <code className={`language-${currentPath.split('.').pop()}`}>
                    {currentCode}
                  </code>
                </CodeBlock>
              </div>
            </div>
          ) : (
            <div className="flex-1">
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
          )}
        </div>
      </div>
    </div>
  )
}

const FileIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="#61DAFB" // React brand blue
    xmlns="http://www.w3.org/2000/svg"
    className="inline-block"
  >
    <path d="M14 4.5V14C14 14.5523 13.5523 15 13 15H3C2.44772 15 2 14.5523 2 14V2C2 1.44772 2.44772 1 3 1H10.5L14 4.5Z" />
  </svg>
)

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
    <div className="flex flex-col">
      {props.files.map((file) => (
        <div key={file.path} style={{ marginLeft: `${file.depth * 16}px` }}>
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
            <span className="flex-shrink-0">
              {file.type === 'dir' ? (
                <FolderIcon isOpen={props.expandedFolders.has(file.path)} />
              ) : (
                <FileIcon />
              )}
            </span>
            <span className="truncate">{file.name}</span>
          </button>
          {file.children && props.expandedFolders.has(file.path) && (
            <RenderFileTree {...props} files={file.children} />
          )}
        </div>
      ))}
    </div>
  )
}
