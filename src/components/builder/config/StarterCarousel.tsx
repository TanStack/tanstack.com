/**
 * StarterCarousel - Grid of starter templates
 */

import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import {
  useRegistry,
  useProjectStarter,
  setProjectStarter,
} from '@tanstack/cta-ui-base/dist/store/project'

type StarterInfo = {
  id: string
  name: string
  description: string
}

export function StarterCarousel() {
  const registry = useRegistry()
  const projectStarter = useProjectStarter((s) => s.projectStarter)

  const starters = React.useMemo(
    () => (registry?.starters ?? []) as StarterInfo[],
    [registry?.starters],
  )

  // Add a "blank" option at the start
  const allOptions = React.useMemo(() => {
    return [
      { id: 'blank', name: 'Blank', description: 'Start from scratch' },
      ...starters.map((starter) => ({
        id: starter.id,
        name: starter.name,
        description: starter.description,
      })),
    ]
  }, [starters])

  const selectedId = projectStarter?.id ?? 'blank'

  const handleSelect = (id: string) => {
    if (id === 'blank') {
      setProjectStarter(undefined)
    } else {
      const starter = starters.find((s) => s.id === id)
      if (starter) {
        setProjectStarter(starter as never)
      }
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {allOptions.map((option) => (
        <StarterCard
          key={option.id}
          id={option.id}
          name={option.name}
          description={option.description}
          isSelected={selectedId === option.id}
          onSelect={handleSelect}
        />
      ))}
    </div>
  )
}

type StarterCardProps = {
  id: string
  name: string
  description: string
  isSelected: boolean
  onSelect: (id: string) => void
}

function StarterCard({
  id,
  name,
  description,
  isSelected,
  onSelect,
}: StarterCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={twMerge(
        'w-32 p-3 rounded-lg border-2 transition-all text-left',
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800',
      )}
    >
      {/* Icon placeholder */}
      <div
        className={twMerge(
          'w-8 h-8 rounded-md flex items-center justify-center mb-2',
          isSelected
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
        )}
      >
        {id === 'blank' ? (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
            />
          </svg>
        )}
      </div>

      <h3
        className={twMerge(
          'text-sm font-medium truncate',
          isSelected
            ? 'text-blue-700 dark:text-blue-300'
            : 'text-gray-900 dark:text-white',
        )}
      >
        {name}
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
        {description}
      </p>
    </button>
  )
}
