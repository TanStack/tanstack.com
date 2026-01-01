import { Link } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import type { MarkdownHeading } from '~/utils/markdown/processor'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '~/components/Collapsible'

type BreadcrumbsProps = {
  /** Section label (e.g., "Getting Started", "Blog") */
  section: string
  /** Optional link for the section */
  sectionTo?: string
  headings?: MarkdownHeading[]
  /** Breakpoint at which the TOC toggle is hidden (default: 'lg') */
  tocHiddenBreakpoint?: 'md' | 'lg'
}

export function Breadcrumbs({
  section,
  sectionTo,
  headings,
  tocHiddenBreakpoint = 'lg',
}: BreadcrumbsProps) {
  const showTocToggle = headings && headings.length > 1
  const hiddenClass = tocHiddenBreakpoint === 'md' ? 'md:hidden' : 'lg:hidden'

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400">
        {sectionTo ? (
          <Link
            to={sectionTo}
            className="whitespace-nowrap hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            {section}
          </Link>
        ) : (
          <span className="whitespace-nowrap">{section}</span>
        )}
        {showTocToggle && (
          <Collapsible>
            {({ open, toggle }) => (
              <>
                <CollapsibleTrigger
                  className={twMerge(
                    hiddenClass,
                    'whitespace-nowrap inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors',
                  )}
                >
                  <span>On this page</span>
                  <ChevronDown
                    className={twMerge(
                      'w-3.5 h-3.5 transition-transform duration-200',
                      open && 'rotate-180',
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className={hiddenClass}>
                  <ul className="pt-3 pb-1 flex flex-col gap-px">
                    {headings.map((heading) => (
                      <li
                        key={`breadcrumb-toc-${heading.id}`}
                        style={{
                          paddingLeft: `${(heading.level - 2) * 0.5}rem`,
                        }}
                      >
                        <Link
                          to="."
                          hash={`#${heading.id}`}
                          className="block py-1 pl-2 border-l-2 border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                          onClick={() => toggle()}
                          resetScroll={false}
                          hashScrollIntoView={{
                            behavior: 'smooth',
                          }}
                        >
                          <span
                            dangerouslySetInnerHTML={{ __html: heading.text }}
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </>
            )}
          </Collapsible>
        )}
      </div>
    </div>
  )
}
