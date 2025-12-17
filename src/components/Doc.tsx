import * as React from 'react'
import { FoldHorizontal, SquarePen, UnfoldHorizontal } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { useWidthToggle } from '~/components/DocsLayout'
import { DocTitle } from '~/components/DocTitle'
import { Markdown } from '~/components/Markdown'
import {
  MarkdownHeadingProvider,
  useMarkdownHeadings,
} from '~/components/MarkdownHeadingContext'
import { AdGate } from '~/contexts/AdsContext'
import { CopyMarkdownButton } from './CopyMarkdownButton'
import { GamHeader } from './Gam'
import { Toc } from './Toc'
import { TocMobile } from './TocMobile'
import { DocFeedbackProvider } from './DocFeedbackProvider'

type DocProps = {
  title: string
  content: string
  repo: string
  branch: string
  filePath: string
  shouldRenderToc?: boolean
  colorFrom?: string
  colorTo?: string
  // Feedback props (optional)
  libraryId?: string
  libraryVersion?: string
  pagePath?: string
}

function DocContent({
  title,
  content,
  repo,
  branch,
  filePath,
  shouldRenderToc = false,
  colorFrom,
  colorTo,
  libraryId,
  libraryVersion,
  pagePath,
}: DocProps) {
  const { headings } = useMarkdownHeadings()

  const isTocVisible = shouldRenderToc && headings && headings.length > 1

  const markdownContainerRef = React.useRef<HTMLDivElement>(null)
  const [activeHeadings, setActiveHeadings] = React.useState<Array<string>>([])

  const headingElementRefs = React.useRef<
    Record<string, IntersectionObserverEntry>
  >({})

  // Try to get the width toggle context from DocsLayout
  let isFullWidth = false
  let setIsFullWidth: ((isFullWidth: boolean) => void) | undefined

  try {
    const context = useWidthToggle()
    isFullWidth = context.isFullWidth
    setIsFullWidth = context.setIsFullWidth
  } catch {
    // Context not available, that's okay
  }

  React.useEffect(() => {
    const callback = (headingsList: Array<IntersectionObserverEntry>) => {
      headingElementRefs.current = headingsList.reduce(
        (map, headingElement) => {
          map[headingElement.target.id] = headingElement
          return map
        },
        headingElementRefs.current,
      )

      const visibleHeadings: Array<IntersectionObserverEntry> = []
      Object.keys(headingElementRefs.current).forEach((key) => {
        const headingElement = headingElementRefs.current[key]
        if (headingElement.isIntersecting) {
          visibleHeadings.push(headingElement)
        }
      })

      if (visibleHeadings.length >= 1) {
        setActiveHeadings(visibleHeadings.map((h) => h.target.id))
      }
    }

    const observer = new IntersectionObserver(callback, {
      rootMargin: '0px',
      threshold: 0.2,
    })

    const headingElements = Array.from(
      markdownContainerRef.current?.querySelectorAll(
        'h2[id], h3[id], h4[id], h5[id], h6[id]',
      ) ?? [],
    )
    headingElements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [headings])

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {shouldRenderToc ? <TocMobile headings={headings} /> : null}
      <AdGate>
        <div className="mb-2 xl:mb-4 max-w-full">
          <GamHeader />
        </div>
      </AdGate>
      <div
        className={twMerge(
          'w-full flex bg-white/70 dark:bg-black/40 mx-auto rounded-xl max-w-[936px]',
          isTocVisible && 'max-w-full',
          shouldRenderToc && 'lg:pt-0',
        )}
      >
        <div
          className={twMerge(
            'flex overflow-auto flex-col w-full p-2 lg:p-4 xl:p-6',
            isTocVisible && 'pr-0!',
          )}
        >
          {title ? (
            <div className="flex items-center justify-between gap-4 pr-2 lg:pr-4">
              <DocTitle>{title}</DocTitle>
              <div className="flex items-center gap-4">
                <CopyMarkdownButton
                  repo={repo}
                  branch={branch}
                  filePath={filePath}
                />

                {setIsFullWidth && (
                  <button
                    onClick={() => setIsFullWidth(!isFullWidth)}
                    className="p-2 mr-4 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors shrink-0 hidden [@media(min-width:1800px)]:inline-flex"
                    title={isFullWidth ? 'Constrain width' : 'Expand width'}
                  >
                    {isFullWidth ? (
                      <FoldHorizontal className="w-4 h-4" />
                    ) : (
                      <UnfoldHorizontal
                        className="w-4 h-4"
                      />
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : null}
          <div className="h-4" />
          <div className="h-px bg-gray-500 opacity-20" />
          <div className="h-4" />
          <div
            ref={markdownContainerRef}
            className={twMerge(
              'prose prose-gray dark:prose-invert max-w-none',
              '[font-size:14px]',
              isTocVisible && 'pr-2 lg:pr-4 xl:pr-6',
              'styled-markdown-content',
            )}
          >
            {libraryId && libraryVersion && pagePath ? (
              <DocFeedbackProvider
                pagePath={pagePath}
                libraryId={libraryId}
                libraryVersion={libraryVersion}
              >
                <Markdown rawContent={content} />
              </DocFeedbackProvider>
            ) : (
              <Markdown rawContent={content} />
            )}
          </div>
          <div className="h-12" />
          <div className="w-full h-px bg-gray-500 opacity-30" />
          <div className="flex py-4 opacity-70">
            <a
              href={`https://github.com/${repo}/edit/${branch}/${filePath}`}
              className="flex items-center gap-2"
            >
              <SquarePen size={16} /> Edit on GitHub
            </a>
          </div>
          <div className="h-24" />
        </div>

        {isTocVisible && (
          <div className="border-l border-gray-500/20 max-w-32 lg:max-w-36 xl:max-w-44 2xl:max-w-52 w-full hidden lg:block transition-all">
            <Toc
              headings={headings}
              activeHeadings={activeHeadings}
              colorFrom={colorFrom}
              colorTo={colorTo}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function Doc(props: DocProps) {
  return (
    <MarkdownHeadingProvider>
      <DocContent {...props} />
    </MarkdownHeadingProvider>
  )
}
