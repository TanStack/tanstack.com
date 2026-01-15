/**
 * AddOnSection - A category section containing add-on cards
 */

import * as React from 'react'
import { AddOnCard } from './AddOnCard'

type AddOnInfo = {
  id: string
  name: string
  description: string
  type: string
  author?: string
  link?: string
  warning?: string
  priority?: number
}

type PartnerInfo = {
  brandColor?: string
}

type AddOnSectionProps = {
  title: string
  description: string
  addons: AddOnInfo[]
  defaultExpanded?: boolean
  partnerInfo?: Map<string, PartnerInfo>
}

export function AddOnSection({
  title,
  description,
  addons,
  defaultExpanded = true,
  partnerInfo,
}: AddOnSectionProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(!defaultExpanded)

  // Sort addons by priority (higher first), then alphabetically
  const sortedAddons = React.useMemo(() => {
    return [...addons].sort((a, b) => {
      const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0)
      if (priorityDiff !== 0) return priorityDiff
      return a.name.localeCompare(b.name)
    })
  }, [addons])

  return (
    <section>
      <button
        type="button"
        onClick={() => setIsCollapsed((p) => !p)}
        className="w-full flex items-center justify-between mb-3 group"
      >
        <div className="text-left">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isCollapsed ? '' : 'rotate-180'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {!isCollapsed && (
        <div className="grid grid-cols-1 gap-2">
          {sortedAddons.map((addon) => (
            <AddOnCard
              key={addon.id}
              addon={addon}
              partnerInfo={partnerInfo?.get(addon.id.toLowerCase())}
            />
          ))}
        </div>
      )}
    </section>
  )
}
