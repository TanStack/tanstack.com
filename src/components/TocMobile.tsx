import { Link } from '@tanstack/react-router'
import type { HeadingData } from 'marked-gfm-heading-id'
import React from 'react'
import { FaCaretDown, FaCaretRight } from 'react-icons/fa6'

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
    <div className="-mx-2 flex lg:hidden">
      <details className="w-full" onToggle={handleToggle}>
        <summary
          className="flex w-full content-start items-center gap-2 border-b border-gray-500/20 bg-white/50 px-4 py-3 text-sm font-medium backdrop-blur-lg dark:bg-black/60"
          aria-expanded={isOpen}
        >
          <span>{isOpen ? <FaCaretDown /> : <FaCaretRight />}</span>
          <span>On this page</span>
        </summary>
        <div className="px-2 py-2">
          <ul className="grid list-none gap-2">
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
