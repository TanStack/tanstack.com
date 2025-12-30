import * as React from 'react'
import { FoldHorizontal, SquarePen, UnfoldHorizontal } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { useWidthToggle } from '~/components/DocsLayout'
import { DocTitle } from '~/components/DocTitle'
import { Markdown } from '~/components/Markdown'
import { AdGate } from '~/contexts/AdsContext'
import { CopyPageDropdown } from './CopyPageDropdown'
import { GamHeader } from './Gam'
import { Toc } from './Toc'
import { TocMobile } from './TocMobile'
import { DocFeedbackProvider } from './DocFeedbackProvider'
import { renderMarkdown } from '~/utils/markdown'
import { DocBreadcrumb } from './DocBreadcrumb'
import type { ConfigSchema } from '~/utils/config'

type DocProps = {
  title: string
  content: string
  repo: string
  branch: string
  filePath: string
  shouldRenderToc?: boolean
  colorFrom?: string
  colorTo?: string
  textColor?: string
  // Feedback props (optional)
  libraryId?: string
  libraryVersion?: string
  pagePath?: string
  // Breadcrumb props (optional)
  config?: ConfigSchema
}

export function Doc({
  title,
  content,
  repo,
  branch,
  filePath,
  shouldRenderToc = false,
  colorFrom,
  colorTo,
  textColor,
  libraryId,
  libraryVersion,
  pagePath,
  config,
}: DocProps) {
  // Extract headings synchronously during render to avoid hydration mismatch
  const { headings, markup } = React.useMemo(
    () => renderMarkdown(content),
    [content],
  )

  const isTocVisible = shouldRenderToc && headings.length > 1

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
        <div className="py-2 pb-6 lg:py-4 lg:pb-8 xl:py-6 xl:pb-10 max-w-full">
          <GamHeader />
        </div>
      </AdGate>
      <div
        className={twMerge(
          'w-full flex mx-auto max-w-[768px]',
          isTocVisible && 'max-w-full',
        )}
      >
        <div
          className={twMerge(
            'flex overflow-auto flex-col w-full sm:pr-2 lg:pr-4 xl:pr-6',
            isTocVisible && 'pr-0!',
          )}
        >
          {config && title && (
            <div className="mb-3 pr-2 lg:pr-4">
              <DocBreadcrumb config={config} title={title} />
            </div>
          )}
          {title ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pr-2 lg:pr-4">
              <DocTitle>{title}</DocTitle>
              <div className="flex items-center gap-2 shrink-0">
                <CopyPageDropdown />

                {setIsFullWidth && (
                  <button
                    onClick={() => setIsFullWidth(!isFullWidth)}
                    className="p-2 mr-4 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors shrink-0 hidden [@media(min-width:1535px)]:inline-flex"
                    title={isFullWidth ? 'Constrain width' : 'Expand width'}
                  >
                    {isFullWidth ? (
                      <FoldHorizontal className="w-4 h-4" />
                    ) : (
                      <UnfoldHorizontal className="w-4 h-4" />
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
              isTocVisible && 'sm:pr-2 lg:pr-4 xl:pr-6',
              'styled-markdown-content',
            )}
          >
            {libraryId && libraryVersion && pagePath ? (
              <DocFeedbackProvider
                pagePath={pagePath}
                libraryId={libraryId}
                libraryVersion={libraryVersion}
              >
                <Markdown htmlMarkup={markup} />
              </DocFeedbackProvider>
            ) : (
              <Markdown htmlMarkup={markup} />
            )}
          </div>
          <div className="h-12" />
          <div className="w-full h-px bg-gray-500 opacity-30" />
          <div className="flex py-4 opacity-70">
            <a
              href={`https://github.com/${repo}/edit/${branch}/${filePath}`}
              className="flex items-center gap-2"
            >
              <SquarePen /> Edit on GitHub
            </a>
          </div>
          <div className="h-24" />
        </div>

        {isTocVisible && (
          <div className="pl-2 xl:pl-6 2xl:pl-8 max-w-32 lg:max-w-36 xl:max-w-44 2xl:max-w-56 3xl:max-w-64 w-full hidden lg:block transition-all">
            <Toc
              headings={headings}
              activeHeadings={activeHeadings}
              colorFrom={colorFrom}
              colorTo={colorTo}
              textColor={textColor}
            />
          </div>
        )}
      </div>
    </div>
  )
}
