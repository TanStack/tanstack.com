import * as React from 'react'
import { FaEdit } from 'react-icons/fa'
import { marked } from 'marked'
import markedAlert from 'marked-alert'
import { gfmHeadingId, getHeadingList } from 'marked-gfm-heading-id'
import { DocTitle } from '~/components/DocTitle'
import { Markdown } from '~/components/Markdown'
import { Toc } from './Toc'
import { twMerge } from 'tailwind-merge'

type DocProps = {
  title: string
  content: string
  repo: string
  branch: string
  filePath: string
  shouldRenderToc?: boolean
  colorFrom?: string
  colorTo?: string
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
}: DocProps) {
  const { markup, headings } = React.useMemo(() => {
    const markup = marked.use(
      { gfm: true },
      gfmHeadingId(),
      markedAlert()
    )(content) as string

    const headings = getHeadingList()

    return { markup, headings }
  }, [content])

  const isTocVisible = shouldRenderToc && headings && headings.length > 1

  return (
    <div className="w-full p-2 md:p-4 xl:p-8">
      <div
        className={twMerge(
          'flex bg-white/70 dark:bg-black/50 mx-auto rounded-xl max-w-[936px]',
          isTocVisible && 'max-w-full'
        )}
      >
        <div
          className={twMerge(
            'flex overflow-auto flex-col w-full p-4 lg:p-6',
            isTocVisible && 'border-r border-gray-500/20 !pr-0'
          )}
        >
          {title ? <DocTitle>{title}</DocTitle> : null}
          <div className="h-4" />
          <div className="h-px bg-gray-500 opacity-20" />
          <div className="h-4" />
          <div
            className={twMerge(
              'prose prose-gray prose-sm prose-p:leading-7 dark:prose-invert max-w-none',
              isTocVisible && 'pr-4 lg:pr-6'
            )}
          >
            <Markdown htmlMarkup={markup} />
          </div>
          <div className="h-12" />
          <div className="w-full h-px bg-gray-500 opacity-30" />
          <div className="py-4 opacity-70">
            <a
              href={`https://github.com/${repo}/tree/${branch}/${filePath}`}
              className="flex items-center gap-2"
            >
              <FaEdit /> Edit on GitHub
            </a>
          </div>
          <div className="h-24" />
        </div>

        {isTocVisible && (
          <div className="max-w-52 w-full hidden 2xl:block transition-all">
            <Toc headings={headings} colorFrom={colorFrom} colorTo={colorTo} />
          </div>
        )}
      </div>
    </div>
  )
}
