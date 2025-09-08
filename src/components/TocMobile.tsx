import React from 'react'
import { Link } from '@tanstack/react-router'
import type { HeadingData } from 'marked-gfm-heading-id'
import { FaCaretRight, FaCaretDown } from 'react-icons/fa6'

interface TocMobileProps {
  headings: Array<HeadingData>
}

export function TocMobile({ headings }: TocMobileProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleToggle = (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    setIsOpen(event.currentTarget.open)
  }

  if (headings.length === 0) {
    return null
  }

  return (
    <div className="lg:hidden flex -mt-2 md:-mt-4 mb-2 bg-white/50 dark:bg-black/30 backdrop-blur-lg rounded-b-xl">
      <details className="flex-1" onToggle={handleToggle}>
        <summary
          className="px-4 py-3 text-sm font-medium w-full flex content-start items-center gap-2
          rounded-b-xl"
          aria-expanded={isOpen}
        >
          <span>{isOpen ? <FaCaretDown /> : <FaCaretRight />}</span>
          <span>On this page</span>
        </summary>
        <div className="px-2 py-2">
          <ul className="list-none grid gap-2">
            {headings.map((heading) => (
              <li
                key={`mobile-toc-${heading.id}`}
                style={{
                  paddingLeft: `${(heading.level - 1) * 0.7}rem`,
                }}
              >
                <Link
                  to="."
                  className="text-sm"
                  hash={heading.id}
                  dangerouslySetInnerHTML={{ __html: heading.text }}
                  aria-label={heading.text.replace(/<\/?[^>]+(>|$)/g, '')}
                />
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  )
}
