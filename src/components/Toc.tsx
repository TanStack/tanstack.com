import { HeadingData } from 'marked-gfm-heading-id'
import * as React from 'react'
import { twMerge } from 'tailwind-merge'

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
    <nav className="sticky top-2 flex max-h-screen flex-col divide-y divide-gray-500/20">
      <div className="p-2">
        <h3 className="px-2 text-[.9em] font-bold">On this page</h3>
      </div>
      <ul
        className={twMerge(
          'flex flex-col gap-0.5 overflow-y-auto p-2 text-[.8em]',
        )}
      >
        {headings?.map((heading) => (
          <li
            key={heading.id}
            className={twMerge(
              'w-full cursor-pointer rounded py-[.1rem] hover:bg-gray-500/10',
              headingLevels[heading.level],
            )}
          >
            <a
              title={heading.id}
              href={`#${heading.id}`}
              aria-current={activeHeadings.includes(heading.id) && 'location'}
              className={`block truncate aria-[current=location]:bg-gradient-to-r ${colorFrom} ${colorTo} aria-[current=location]:bg-clip-text aria-[current=location]:text-transparent`}
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
