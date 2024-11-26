import * as React from 'react'
import { FaTimes } from 'react-icons/fa'
import { twMerge } from 'tailwind-merge'
import { useLoaderData, useMatches } from '@tanstack/react-router'
import { marked } from 'marked'
import markedAlert from 'marked-alert'
import { gfmHeadingId, getHeadingList } from 'marked-gfm-heading-id'
import { Toc } from '~/components/Toc'
import { Doc } from '~/components/Doc'
import { Carbon } from '~/components/Carbon'
import { Partners } from '~/components/Partners'
import { useMenuConfig } from '~/components/DocsLayout'
import { DocPagination } from '~/components/DocPagination'
import { DocsCalloutBytes } from '~/components/DocsCalloutBytes'
import { DocsCalloutQueryGG } from '~/components/DocsCalloutQueryGG'
import { Library } from '~/libraries'
import { useLocalStorage } from '~/utils/useLocalStorage'

export function DocContent({
  title,
  content,
  branch,
  filePath,
  library,
}: {
  title: string
  content: string
  branch: string
  filePath: string
  library: Library
}) {
  const matches = useMatches()
  const [showBytes, setShowBytes] = useLocalStorage('showBytes', true)
  const { config } = useLoaderData({ from: '/$libraryId/$version/docs' })
  const menuConfig = useMenuConfig({
    config,
    frameworks: library.frameworks,
    repo: library.repo,
  })

  const { markup, headings } = React.useMemo(() => {
    const markup = marked.use(
      { gfm: true },
      gfmHeadingId(),
      markedAlert()
    )(content) as string

    const headings = getHeadingList()

    return { markup, headings }
  }, [content])

  const isExample = matches.some((d) => d.pathname.includes('/examples/'))

  return (
    <>
      <div
        className={twMerge(
          `max-w-full min-w-0 flex relative justify-center w-full min-h-[88dvh] lg:min-h-0`,
          !isExample && 'mx-auto w-[1000px]'
        )}
      >
        <Doc
          title={title}
          repo={library.repo}
          branch={branch}
          markup={markup}
          filePath={filePath}
        />
        <DocPagination
          config={menuConfig}
          colorFrom={library.colorFrom}
          colorTo={library.colorTo}
          textColor={library.textColor}
        />
      </div>
      <div className="-ml-2 pl-2 w-64 hidden md:block sticky top-0 max-h-screen overflow-y-auto">
        <div className="ml-auto flex flex-col space-y-4">
          <Partners libraryId={library.id} repo={library.repo} />

          {headings.length ? (
            <Toc
              headings={headings}
              colorFrom={library.colorFrom}
              colorTo={library.colorTo}
            />
          ) : null}

          <div className="p-4 bg-white dark:bg-gray-900/30 border-b border-gray-500/20 shadow-xl divide-y divide-gray-500/20 flex flex-col border-t border-l rounded-l-lg">
            {library.id === 'query' ? (
              <DocsCalloutQueryGG />
            ) : (
              <DocsCalloutBytes />
            )}
          </div>

          <div className="bg-white dark:bg-gray-900/20 border-gray-500/20 shadow-xl flex flex-col border-t border-l border-b p-4 space-y-2 rounded-l-lg">
            <Carbon />
            <div
              className="text-[.7rem] bg-gray-500 bg-opacity-10 py-1 px-2 rounded text-gray-500 italic
                dark:bg-opacity-20 self-center opacity-50 hover:opacity-100 transition-opacity"
            >
              This ad helps to keep us from burning out and rage-quitting OSS
              just *that* much more, so chill. 😉
            </div>
          </div>
        </div>
      </div>
      {showBytes ? (
        <div className="w-[300px] max-w-[350px] fixed md:hidden top-1/2 right-2 z-30 -translate-y-1/2 shadow-lg">
          <div className="bg-white dark:bg-gray-900/30 border border-black/10 dark:border-white/10 p-4 md:p-6 rounded-lg">
            {library.id === 'query' ? (
              <DocsCalloutQueryGG />
            ) : (
              <DocsCalloutBytes />
            )}
            <button
              className="absolute top-0 right-0 p-2 hover:text-red-500 opacity:30 hover:opacity-100"
              onClick={() => {
                setShowBytes(false)
              }}
            >
              <FaTimes />
            </button>
          </div>
        </div>
      ) : (
        <button
          className="right-0 top-1/2 -translate-y-[50px] fixed lg:hidden"
          onClick={() => {
            setShowBytes(true)
          }}
        >
          <div
            className="origin-bottom-right -rotate-90 text-xs bg-white dark:bg-gray-800 border border-gray-100
            hover:bg-rose-600 hover:text-white p-1 px-2 rounded-t-md shadow-md dark:border-0"
          >
            {library.id === 'query' ? (
              <>
                <strong>
                  <span role="img" aria-label="crystal ball">
                    &#128302;
                  </span>{' '}
                  Skip the docs?
                </strong>
              </>
            ) : (
              <>
                Subscribe to <strong>Bytes</strong>
              </>
            )}
          </div>
        </button>
      )}
    </>
  )
}
