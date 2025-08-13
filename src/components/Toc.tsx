import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { HeadingData } from 'marked-gfm-heading-id'

const headingLevels: Record<number, string> = {
  1: 'pl-2',
  2: 'pl-2',
  3: 'pl-6',
  4: 'pl-10',
  5: 'pl-14',
  6: 'pl-16',
}

type TocProps = {
  headings: HeadingData[]
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
    <nav className="flex flex-col sticky top-2 max-h-screen divide-y divide-gray-500/20">
      <div className="p-2">
        <h3 className="text-[.9em] font-bold px-2">On this page</h3>
      </div>
      <ul
        className={twMerge(
          'p-2 flex flex-col overflow-y-auto gap-0.5 text-[.8em]'
        )}
      >
        {headings?.map((heading) => (
          <li
            key={heading.id}
            className={twMerge(
              'cursor-pointer py-[.1rem] w-full rounded hover:bg-gray-500/10',
              headingLevels[heading.level]
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
