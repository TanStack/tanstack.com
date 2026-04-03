import * as React from 'react'
import { SquarePen } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { DocTitle } from '~/components/DocTitle'
import { Markdown } from './Markdown'
import { DocFeedbackProvider } from '~/components/DocFeedbackProvider'
import { Button } from '~/ui'

const LazyCopyPageDropdown = React.lazy(() =>
  import('~/components/CopyPageDropdown').then((m) => ({
    default: m.CopyPageDropdown,
  })),
)

type MarkdownContentProps = {
  title: string
  repo: string
  branch: string
  filePath: string
  /** Pre-rendered HTML markup (from renderMarkdown). If not provided, rawContent will be rendered. */
  htmlMarkup?: string
  /** Raw markdown content to render. Used if htmlMarkup is not provided. */
  rawContent?: string
  /** Additional elements to render in the title bar (e.g., width toggle button) */
  titleBarActions?: React.ReactNode
  /** Additional class names for the prose container */
  proseClassName?: string
  /** Ref for the markdown container (used for heading intersection observer in docs) */
  containerRef?: React.RefObject<HTMLDivElement | null>
  // Feedback props (optional, for docs)
  libraryId?: string
  libraryVersion?: string
  pagePath?: string
  /** Current framework for filtering markdown content */
  currentFramework?: string
}

export function MarkdownContent({
  title,
  repo,
  branch,
  filePath,
  htmlMarkup,
  rawContent,
  titleBarActions,
  proseClassName,
  containerRef,
  libraryId,
  libraryVersion,
  pagePath,
  currentFramework,
}: MarkdownContentProps) {
  const [canLoadCopyControls, setCanLoadCopyControls] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(
        () => {
          setCanLoadCopyControls(true)
        },
        { timeout: 2500 },
      )

      return () => {
        window.cancelIdleCallback(idleId)
      }
    }

    const timeout = window.setTimeout(() => {
      setCanLoadCopyControls(true)
    }, 2500)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [])

  const renderMarkdownContent = () => {
    const markdownElement = htmlMarkup ? (
      <Markdown htmlMarkup={htmlMarkup} />
    ) : rawContent ? (
      <Markdown rawContent={rawContent} />
    ) : null

    if (libraryId && libraryVersion && pagePath) {
      return (
        <DocFeedbackProvider
          pagePath={pagePath}
          libraryId={libraryId}
          libraryVersion={libraryVersion}
        >
          {markdownElement}
        </DocFeedbackProvider>
      )
    }

    return markdownElement
  }

  return (
    <>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DocTitle>{title}</DocTitle>
          <div
            className="flex items-center gap-2 shrink-0"
            onFocusCapture={() => {
              setCanLoadCopyControls(true)
            }}
            onPointerEnter={() => {
              setCanLoadCopyControls(true)
            }}
          >
            {canLoadCopyControls ? (
              <React.Suspense
                fallback={
                  <Button variant="ghost" size="xs" disabled>
                    Copy page
                  </Button>
                }
              >
                <LazyCopyPageDropdown
                  repo={repo}
                  branch={branch}
                  filePath={filePath}
                  currentFramework={currentFramework}
                />
              </React.Suspense>
            ) : null}
            {titleBarActions}
          </div>
        </div>
      ) : null}
      <div className="h-4" />
      <div className="h-px bg-gray-500 opacity-20" />
      <div className="h-4" />
      <div
        ref={containerRef}
        className={twMerge(
          'prose prose-gray dark:prose-invert max-w-none',
          '[font-size:16px]',
          'styled-markdown-content',
          proseClassName,
        )}
      >
        {renderMarkdownContent()}
      </div>
      <div className="h-12" />
      <div className="w-full h-px bg-gray-500 opacity-30" />
      <div className="flex py-4">
        <Button
          variant="ghost"
          size="xs"
          as="a"
          href={`https://github.com/${repo}/edit/${branch}/${filePath}`}
        >
          <SquarePen className="w-3.5 h-3.5" />
          Edit on GitHub
        </Button>
      </div>
    </>
  )
}
