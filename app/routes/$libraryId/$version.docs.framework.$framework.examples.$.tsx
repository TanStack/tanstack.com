import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'

import { FaExternalLinkAlt } from 'react-icons/fa'
import { DocTitle } from '~/components/DocTitle'
import { CodeBlock } from '~/components/Markdown'
import { Framework, getBranch, getLibrary } from '~/libraries'
import { getInitialSandboxFileName } from '~/utils/sandbox'
import { seo } from '~/utils/seo'
import { capitalize, slugToTitle } from '~/utils/utils'

interface GitHubFile {
  name: string
  path: string
  sha: string
  size: number
  url: string
  html_url: string
  git_url: string
  download_url: string
  type: string
  _links: {
    self: string
    git: string
    html: string
  }
}

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
  loader: async ({ params }) => {
    const library = getLibrary(params.libraryId)
    const branch = getBranch(library, params.version)
    const examplePath = [params.framework, params._splat].join('/')
    const sandboxFirstFileName = getInitialSandboxFileName(
      params.framework as Framework,
      params.libraryId
    )
    const gitHubFilesUrl = `https://api.github.com/repos/${library.repo}/contents/examples/${examplePath}/src`
    const mainFileCodeUrl = `https://raw.githubusercontent.com/${library.repo}/refs/heads/${branch}/examples/${examplePath}/${sandboxFirstFileName}`

    const [mainFileCodeResult, gitHubFilesResult] = await Promise.allSettled([
      fetch(mainFileCodeUrl).then((res) => res.text()) as Promise<string>,
      fetch(gitHubFilesUrl).then((res) => res.json()) as Promise<GitHubFile[]>,
    ])

    const mainFileCode =
      mainFileCodeResult.status === 'fulfilled'
        ? mainFileCodeResult.value
        : null
    let gitHubFiles =
      gitHubFilesResult.status === 'fulfilled' ? gitHubFilesResult.value : null

    if (gitHubFiles) {
      const allFiles: GitHubFile[] = []
      const directories = gitHubFiles.filter((file) => file.type === 'dir')
      const nonDirectories = gitHubFiles.filter((file) => file.type !== 'dir')

      const directoryFiles = await Promise.all(
        directories.map(async (dir) => {
          const dirFilesResponse = await fetch(dir._links.self)
          const dirFiles = await dirFilesResponse.json()
          return dirFiles.map((file: GitHubFile) => ({
            ...file,
            name: `${dir.name}/${file.name}`, // Prefix the file name with parent directory name
          }))
        })
      )

      allFiles.push(...nonDirectories, ...directoryFiles.flat())
      gitHubFiles = allFiles
    }

    return {
      gitHubFiles,
      mainFileCode,
    }
  },
})

export default function Example() {
  const { version, framework, _splat, libraryId } = Route.useParams()
  const library = getLibrary(libraryId)
  const branch = getBranch(library, version)

  const { mainFileCode, gitHubFiles } = Route.useLoaderData<any>()

  const mainExampleFile = getInitialSandboxFileName(
    framework as Framework,
    libraryId
  )

  const examplePath = [framework, _splat].join('/')

  console.log({ examplePath, gitHubFiles })

  const [isDark, setIsDark] = React.useState(true)
  const [currentFile, setCurrentFile] = React.useState<GitHubFile | null>(
    () =>
      gitHubFiles?.find(
        (file: GitHubFile) =>
          file.path === `examples/${examplePath}/${mainExampleFile}`
      ) || null
  )

  const { data: currentCode } = useQuery({
    initialData: mainFileCode,
    queryKey: ['currentCode', library.repo, branch, currentFile?.path],
    queryFn: async () => {
      const response = await fetch(
        `https://raw.githubusercontent.com/${library.repo}/refs/heads/${branch}/${currentFile?.path}`
      )
      return response.text()
    },
  })

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

  const libraryColor = library.bgStyle
  const hideCodesandbox = library.hideCodesandboxUrl
  const hideStackblitz = library.hideStackblitzUrl
  const showVercel = library.showVercelUrl
  const showNetlify = library.showNetlifyUrl

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-auto h-[95dvh]">
      <div className="p-4 lg:p-6">
        <DocTitle>
          <span>
            {capitalize(framework)} Example: {slugToTitle(_splat!)}
          </span>
          <div className="flex items-center gap-4 flex-wrap font-normal text-xs">
            <a href="#interactive-sandbox">Interactive Sandbox ↓</a>
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
        <div className="flex flex-col gap-4">
          <div className="flex overflow-x-auto pb-2">
            {gitHubFiles.map((file: GitHubFile) => (
              <button
                key={file.path}
                onClick={() => setCurrentFile(file)}
                className={`px-4 py-2 whitespace-nowrap text-sm rounded-t-lg transition-colors duration-200 ${
                  currentFile?.path === file.path
                    ? `${libraryColor} text-white shadow-sm`
                    : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                } ${
                  currentFile?.path === file.path
                    ? `border-b-2 border-white-600`
                    : 'border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {file.name}
              </button>
            ))}
          </div>
          <CodeBlock className={`m-0 language-${currentFile?.type}`}>
            <code className="language-tsx">{currentCode}</code>
          </CodeBlock>
        </div>

        <h2 id="interactive-sandbox" className="text-2xl font-bold my-8">
          Interactive Sandbox
        </h2>
        <iframe
          src={
            library.embedEditor === 'codesandbox'
              ? codeSandboxUrl
              : stackBlitzUrl
          }
          title={`${library.name} | ${examplePath}`}
          sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
          className="flex-1 w-full min-h-[600px] overflow-hidden lg:rounded-lg shadow-xl shadow-gray-700/20 bg-white dark:bg-black"
        />
      </div>
      <div className="h-8" />
    </div>
  )
}
