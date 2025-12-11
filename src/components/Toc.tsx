import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { MarkdownHeading } from '~/utils/markdown/processor'

const headingLevels: Record<number, string> = {
  1: 'pl-0.5 lg:pl-1 xl:pl-1.5 2xl:pl-2',
  2: 'pl-0.5 lg:pl-1 xl:pl-1.5 2xl:pl-2',
  3: 'pl-2 lg:pl-3 xl:pl-4 2xl:pl-6',
  4: 'pl-3 lg:pl-5 xl:pl-7 2xl:pl-10',
  5: 'pl-4 lg:pl-7 xl:pl-10 2xl:pl-14',
  6: 'pl-5 lg:pl-9 xl:pl-12 2xl:pl-16',
}

type TocProps = {
  headings: MarkdownHeading[]
  colorFrom?: string
  colorTo?: string
  activeHeadings: Array<string>
}

export function Toc({
  headings,
  colorFrom,
  colorTo,
  activeHeadings,
}: TocProps) {
  return (
    <nav className="flex flex-col sticky top-[var(--navbar-height)] max-h-[calc(100dvh-var(--navbar-height))] divide-y divide-gray-500/20">
      <div className="p-0.5 lg:p-1 xl:p-1.5 2xl:p-2">
        <h3 className="text-[.8em] lg:text-[.825em] xl:text-[.875em] 2xl:text-[.9em] font-bold px-0.5 lg:px-1 xl:px-1.5 2xl:px-2">
          On this page
        </h3>
      </div>
      <ul
        className={twMerge(
          'p-0.5 lg:p-1 xl:p-1.5 2xl:p-2 flex flex-col overflow-y-auto gap-0.5 text-[.7em] lg:text-[.725em] xl:text-[.775em] 2xl:text-[.8em]',
        )}
      >
        {headings?.map((heading) => (
          <li
            key={heading.id}
            className={twMerge(
              'cursor-pointer py-[.1rem] w-full rounded hover:bg-gray-500/10',
              headingLevels[heading.level],
            )}
          >
            <a
              title={heading.id}
              href={`#${heading.id}`}
              aria-current={activeHeadings.includes(heading.id) && 'location'}
              className={`truncate block aria-current:bg-linear-to-r ${colorFrom} ${colorTo} aria-current:bg-clip-text aria-current:text-transparent`}
              dangerouslySetInnerHTML={{
                __html: heading.text,
              }}
            />
          </li>
        ))}
      </ul>
    </nav>
  )
}
