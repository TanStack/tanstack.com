/**
 * AddOnCard - Individual add-on toggle card
 */

import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { useAddOns } from '@tanstack/cta-ui-base/dist/store/project'

type AddOnInfo = {
  id: string
  name: string
  description: string
  type: string
  author?: string
  link?: string
  warning?: string
}

type AddOnCardProps = {
  addon: AddOnInfo
}

export function AddOnCard({ addon }: AddOnCardProps) {
  const { toggleAddOn, chosenAddOns, addOnState } = useAddOns()

  const isSelected = chosenAddOns.includes(addon.id)
  const state = addOnState[addon.id]
  // Auto-enabled means it was enabled by a dependency, not user selection
  const isAutoEnabled = state?.enabled && !isSelected

  const handleToggle = () => {
    toggleAddOn(addon.id)
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={twMerge(
        'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
        isSelected || isAutoEnabled
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800',
      )}
    >
      {/* Checkbox indicator */}
      <div
        className={twMerge(
          'w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors',
          isSelected || isAutoEnabled
            ? 'border-blue-500 bg-blue-500 text-white'
            : 'border-gray-300 dark:border-gray-600',
        )}
      >
        {(isSelected || isAutoEnabled) && (
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3
            className={twMerge(
              'text-sm font-medium truncate',
              isSelected || isAutoEnabled
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-gray-900 dark:text-white',
            )}
          >
            {addon.name}
          </h3>

          {/* Auto-selected indicator */}
          {isAutoEnabled && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              auto
            </span>
          )}

          {/* Warning indicator */}
          {addon.warning && (
            <span className="text-amber-500" title={addon.warning}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
          {addon.description}
        </p>

        {/* Author / Link */}
        {addon.author && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
            by {addon.author}
          </p>
        )}
      </div>

      {/* External link */}
      {addon.link && (
        <a
          href={addon.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
        >
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
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      )}
    </button>
  )
}
