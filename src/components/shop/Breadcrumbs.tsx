import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

export type Crumb = {
  label: string
  href?: string
}

/**
 * Accessible breadcrumb trail. The last crumb renders as plain text
 * (current location); intermediate crumbs link back.
 */
export function Breadcrumbs({ crumbs }: { crumbs: Array<Crumb> }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex items-center gap-1.5 flex-wrap text-gray-600 dark:text-gray-400">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <React.Fragment key={`${crumb.label}-${i}`}>
              <li>
                {crumb.href && !isLast ? (
                  <Link
                    to={crumb.href}
                    className="hover:text-black dark:hover:text-white transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className={
                      isLast ? 'text-black dark:text-white font-medium' : ''
                    }
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
              {isLast ? null : (
                <li aria-hidden="true" className="text-gray-400">
                  <ChevronRight className="w-3.5 h-3.5" />
                </li>
              )}
            </React.Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
