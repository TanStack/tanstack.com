import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { HeadingData } from 'marked-gfm-heading-id'
import { useLocation } from '@tanstack/react-router'

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
}

export function Toc({ headings, colorFrom, colorTo }: TocProps) {
  const location = useLocation()

  const [hash, setHash] = React.useState('')

  React.useEffect(() => {
    setHash(location.hash)
  }, [location])

  return (
    <nav className="flex flex-col p-2 gap-1 sticky top-2 max-h-screen">
      <h3 className="text-[.9em] font-medium px-2">On this page</h3>

      <ul
        className={twMerge('flex flex-col overflow-y-auto gap-0.5 text-[.8em]')}
      >
        {headings?.map((heading) => (
          <li
            key={heading.id}
            className={twMerge(
              'cursor-pointer py-[.1rem] w-full rounded-lg hover:bg-gray-500 hover:bg-opacity-10',
              headingLevels[heading.level]
            )}
          >
            <a
              title={heading.id}
              href={`#${heading.id}`}
              aria-current={hash === heading.id && 'location'}
              className={`truncate block aria-current:bg-gradient-to-r ${colorFrom} ${colorTo} aria-current:bg-clip-text aria-current:text-transparent`}
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
