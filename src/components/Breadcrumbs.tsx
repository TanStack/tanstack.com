import { Link } from '@tanstack/react-router'
import { CaretDownIcon } from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import type { MarkdownHeading } from '~/utils/markdown'
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from './Dropdown'

export type BreadcrumbItem = {
  label: string
  to: string
  search?: true
  preload?: false
}

type BreadcrumbsProps = {
  /** Section label (e.g., "Getting Started", "Blog") */
  section: string
  items?: Array<BreadcrumbItem>
  /** Optional link for the section */
  sectionTo?: string
  headings?: MarkdownHeading[]
  /** Breakpoint at which the TOC toggle is hidden (default: 'lg') */
  tocHiddenBreakpoint?: 'md' | 'lg' | 'xl'
}

export function Breadcrumbs({
  section,
  sectionTo,
  items,
  headings,
  tocHiddenBreakpoint = 'lg',
}: BreadcrumbsProps) {
  const showTocToggle = headings && headings.length > 1
  const hiddenClass =
    tocHiddenBreakpoint === 'md'
      ? 'md:hidden'
      : tocHiddenBreakpoint === 'xl'
        ? 'xl:hidden'
        : 'lg:hidden'

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400">
        {items ? (
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {items.map((item, index) => (
                <li key={item.to} className="min-w-0 flex gap-2">
                  {index > 0 && <span aria-hidden="true">/</span>}
                  {index === items.length - 1 ? (
                    <span aria-current="page" className="break-words">
                      {item.label}
                    </span>
                  ) : (
                    <Link
                      to={item.to}
                      search={item.search}
                      preload={item.preload}
                      activeOptions={{ exact: true }}
                      className="hover:underline"
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : sectionTo ? (
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
          <Dropdown>
            <DropdownTrigger>
              <button
                className={twMerge(
                  hiddenClass,
                  'whitespace-nowrap inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer',
                )}
              >
                <span>On this page</span>
                <CaretDownIcon className="w-3.5 h-3.5" />
              </button>
            </DropdownTrigger>
            <DropdownContent align="end" sideOffset={8} className={hiddenClass}>
              {headings.map((heading) => (
                <DropdownItem key={`breadcrumb-toc-${heading.id}`} asChild>
                  <Link
                    to="."
                    hash={heading.id}
                    style={{
                      paddingLeft: `${(heading.level - 2) * 0.5 + 0.5}rem`,
                    }}
                    resetScroll={false}
                    hashScrollIntoView={{
                      behavior: 'smooth',
                    }}
                  >
                    <span dangerouslySetInnerHTML={{ __html: heading.text }} />
                  </Link>
                </DropdownItem>
              ))}
            </DropdownContent>
          </Dropdown>
        )}
      </div>
    </div>
  )
}
