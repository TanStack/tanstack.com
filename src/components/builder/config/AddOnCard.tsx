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

type PartnerInfo = {
  brandColor?: string
}

type AddOnCardProps = {
  addon: AddOnInfo
  partnerInfo?: PartnerInfo
}

export function AddOnCard({ addon, partnerInfo }: AddOnCardProps) {
  const { toggleAddOn, addOnState, userSelectedAddOns } = useAddOns()

  const state = addOnState[addon.id]
  // Use addOnState to determine if selected (includes dependency resolution)
  const isSelected = state?.selected ?? false
  // Auto-enabled means it was selected by a dependency, not user selection
  const isAutoEnabled = isSelected && !userSelectedAddOns.includes(addon.id)
  // Disabled means it can't be toggled (e.g., forced add-on)
  const isDisabled = state && !state.enabled

  const handleToggle = () => {
    toggleAddOn(addon.id)
  }

  const isPartner = !!partnerInfo

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isDisabled}
      className={twMerge(
        'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all relative overflow-hidden',
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800',
        isDisabled && 'opacity-50 cursor-not-allowed',
        isPartner &&
          !isSelected &&
          'ring-1 ring-inset ring-gray-200/50 dark:ring-gray-700/50',
      )}
      style={
        isPartner && partnerInfo.brandColor
          ? {
              borderLeftWidth: '3px',
              borderLeftColor: partnerInfo.brandColor,
            }
          : undefined
      }
    >
      {/* Checkbox indicator */}
      <div
        className={twMerge(
          'w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors',
          isSelected
            ? 'border-blue-500 bg-blue-500 text-white'
            : 'border-gray-300 dark:border-gray-600',
        )}
      >
        {isSelected && (
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
              isSelected
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

          {/* Partner badge - right aligned */}
          {isPartner && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ml-auto"
              style={{
                backgroundColor: partnerInfo.brandColor
                  ? `${partnerInfo.brandColor}18`
                  : undefined,
                color: partnerInfo.brandColor || undefined,
              }}
            >
              <svg
                className="w-2.5 h-2.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z"
                  clipRule="evenodd"
                />
              </svg>
              Partner
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
