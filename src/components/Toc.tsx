import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { MarkdownHeading } from '~/utils/markdown/processor'

const headingLevels: Record<number, string> = {
  1: '',
  2: '',
  3: 'pl-2',
  4: 'pl-4',
  5: 'pl-6',
  6: 'pl-8',
}

type TocProps = {
  headings: MarkdownHeading[]
  colorFrom?: string
  colorTo?: string
  textColor?: string
  activeHeadings: Array<string>
}

export function Toc({
  headings,
  colorFrom,
  colorTo,
  textColor,
  activeHeadings,
}: TocProps) {
  return (
    <nav className="flex flex-col sticky top-[var(--navbar-height)] max-h-[calc(100dvh-var(--navbar-height))]">
      <div className="py-1">
        <h3 className="text-[.8em] lg:text-[.825em] xl:text-[.875em] 2xl:text-[.9em] font-bold">
          On this page
        </h3>
      </div>
      <ul
        className={twMerge(
          'py-1 flex flex-col overflow-y-auto gap-0.5 text-[.6em] lg:text-[.65em] xl:text-[.7em] 2xl:text-[.75em]',
        )}
      >
        {headings?.map((heading) => (
          <li
            key={heading.id}
            className={twMerge(
              'cursor-pointer py-1 w-full rounded hover:bg-gray-500/10',
              headingLevels[heading.level],
            )}
          >
            <a
              title={heading.id}
              href={`#${heading.id}`}
              aria-current={activeHeadings.includes(heading.id) && 'location'}
              className={twMerge(
                'flex items-start gap-1.5 transition-colors duration-200 opacity-60 hover:opacity-100',
                activeHeadings.includes(heading.id) &&
                  `opacity-100 ${textColor}`,
              )}
            >
              <span
                className={twMerge(
                  'w-1.5 h-1.5 mt-1.5 shrink-0 rounded-full transition-opacity duration-200',
                  activeHeadings.includes(heading.id)
                    ? `bg-current`
                    : 'opacity-0',
                )}
              />
              <span dangerouslySetInnerHTML={{ __html: heading.text }} />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
