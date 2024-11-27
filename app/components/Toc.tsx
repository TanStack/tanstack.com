import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { HeadingData } from 'marked-gfm-heading-id'
import { useLocation } from '@tanstack/react-router'

const headingLevels: Record<number, string> = {
  1: 'pl-1',
  2: 'pl-2',
  3: 'pl-6',
  4: 'pl-10',
  5: 'pl-14',
  6: 'pl-16',
}

export function Toc({
  colorFrom,
  colorTo,
  headings,
}: {
  headings: HeadingData[]
  colorFrom: string
  colorTo: string
}) {
  const location = useLocation()

  const [hash, setHash] = React.useState('')
  const [isCollapsed, setIsCollapsed] = React.useState(true)

  React.useEffect(() => {
    setHash(location.hash)
  }, [location])

  function toggleCollapse() {
    setIsCollapsed((prev) => !prev)
  }

  return (
    <nav className="bg-white dark:bg-gray-900/30 border-b border-gray-500/20 shadow-xl divide-y divide-gray-500/20 flex flex-col border-t border-l rounded-l-lg">
      <button
        className="uppercase p-3 font-black text-center opacity-50 hover:bg-gray-500/10 dark:hover:bg-gray-500/10 transition-colors hover:opacity-100"
        onClick={toggleCollapse}
      >
        On this page
      </button>
      <ul
        className={twMerge(
          'flex flex-col overflow-y-auto gap-0.5 text-[.85em]',
          isCollapsed ? 'max-h-[0px]' : 'p-1 max-h-[600px]'
        )}
      >
        {headings.map((heading) => (
          <li
            key={heading.id}
            className={twMerge(
              'cursor-pointer pr-2 py-[.1rem] w-full rounded-lg hover:bg-gray-500 hover:bg-opacity-10',
              headingLevels[heading.level]
            )}
          >
            <a
              href={`#${heading.id}`}
              className={`truncate block aria-current:bg-gradient-to-r ${colorFrom} ${colorTo} aria-current:bg-clip-text aria-current:text-transparent`}
              aria-current={hash === `${heading.id}` ? 'location' : undefined}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
