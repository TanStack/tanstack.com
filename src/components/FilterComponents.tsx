import * as React from 'react'
import { useState } from 'react'
import { MdExpandMore } from 'react-icons/md'
import { LuTable, LuList } from 'react-icons/lu'
import { useDebouncedValue } from '@tanstack/react-pacer'

// FilterSection - Collapsible section with select all/none
interface FilterSectionProps {
  title: string
  sectionKey: string
  children: React.ReactNode
  onSelectAll?: () => void
  onSelectNone?: () => void
  isAllSelected?: boolean
  isSomeSelected?: boolean
  expandedSections: Record<string, boolean>
  onToggleSection: (section: string) => void
}

export function FilterSection({
  title,
  sectionKey,
  children,
  onSelectAll,
  onSelectNone,
  isAllSelected,
  isSomeSelected,
  expandedSections,
  onToggleSection,
}: FilterSectionProps) {
  const isExpanded = expandedSections[sectionKey] ?? true
  const checkboxRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = isSomeSelected === true
    }
  }, [isSomeSelected])

  const handleCheckboxChange = () => {
    if (isAllSelected) {
      onSelectNone?.()
    } else {
      onSelectAll?.()
    }
  }

  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5">
        {(onSelectAll || onSelectNone) && (
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={isAllSelected ?? false}
            onChange={(e) => {
              e.stopPropagation()
              handleCheckboxChange()
            }}
            onClick={(e) => e.stopPropagation()}
            className="rounded cursor-pointer"
          />
        )}
        <button
          onClick={() => onToggleSection(sectionKey)}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors flex-1 py-0"
        >
          <span>{title}</span>
          <MdExpandMore
            className={`w-3.5 h-3.5 transition-transform ${
              isExpanded ? '' : 'rotate-90'
            }`}
          />
        </button>
      </div>
      {isExpanded && (
        <div
          className={`mt-1 space-y-0.5 ${
            onSelectAll || onSelectNone ? 'pl-4' : 'pl-[1.375rem]'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// FilterCheckbox - Standardized checkbox item with count badge
interface FilterCheckboxProps {
  label: string
  checked: boolean
  onChange: () => void
  count?: number
  capitalize?: boolean
}

export function FilterCheckbox({
  label,
  checked,
  onChange,
  count,
  capitalize = false,
}: FilterCheckboxProps) {
  return (
    <label className="flex items-center gap-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-1.5 py-0 rounded">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="rounded"
      />
      <span className={capitalize ? 'capitalize' : ''}>{label}</span>
      {count !== undefined && (
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
          {count}
        </span>
      )}
    </label>
  )
}

// FilterSearch - Search input component with debouncing
interface FilterSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  debounceMs?: number
}

export function FilterSearch({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  debounceMs = 300,
}: FilterSearchProps) {
  // Local state for immediate UI updates
  const [inputValue, setInputValue] = useState(value || '')

  // Debounce the input value
  const [debouncedValue] = useDebouncedValue(inputValue, {
    wait: debounceMs,
  })

  // Update parent when debounced value changes
  React.useEffect(() => {
    onChange(debouncedValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue])

  // Sync local state when value prop changes externally
  React.useEffect(() => {
    setInputValue(value || '')
  }, [value])

  return (
    <input
      type="text"
      placeholder={placeholder}
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      className={`px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    />
  )
}

// FilterBar - Wrapper that handles mobile/desktop split
interface FilterBarProps {
  children: React.ReactNode
  title?: string
  onClearFilters?: () => void
  hasActiveFilters?: boolean
  mobileControls?: React.ReactNode
  desktopHeader?: React.ReactNode
}

export function FilterBar({
  children,
  title = 'Filters',
  onClearFilters,
  hasActiveFilters,
  mobileControls,
  desktopHeader,
}: FilterBarProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Mobile: Collapsible */}
      <div className="lg:hidden">
        <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 sm:p-3">
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <div
              className="flex items-center gap-1.5 whitespace-nowrap cursor-pointer flex-shrink-0"
              onClick={() => setIsOpen((prev) => !prev)}
            >
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {title}
              </span>
              <MdExpandMore
                className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0 ${
                  isOpen ? '' : 'rotate-90'
                }`}
              />
            </div>
            {mobileControls && (
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-auto flex-wrap">
                {mobileControls}
              </div>
            )}
          </div>
          {isOpen && (
            <div className="pt-2 sm:pt-3 mt-2 sm:mt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="max-h-[60vh] overflow-y-auto">{children}</div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop: Always visible */}
      <div
        className="hidden lg:block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sticky overflow-y-auto"
        style={{
          top: 'calc(var(--navbar-height, 0px) + 1rem)',
          height: 'calc(100vh - var(--navbar-height, 0px) - 2rem)',
          maxHeight: 'calc(100vh - var(--navbar-height, 0px) - 2rem)',
        }}
      >
        {/* Header */}
        {(desktopHeader || onClearFilters) && (
          <div className="flex items-center justify-between mb-2">
            {desktopHeader}
            {hasActiveFilters && onClearFilters && (
              <button
                onClick={onClearFilters}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        )}

        {children}
      </div>
    </>
  )
}

// ViewModeToggle - View mode toggle buttons (table/timeline)
interface ViewModeToggleProps {
  viewMode: 'table' | 'timeline'
  onViewModeChange: (viewMode: 'table' | 'timeline') => void
  compact?: boolean
}

export function ViewModeToggle({
  viewMode,
  onViewModeChange,
  compact = false,
}: ViewModeToggleProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onViewModeChange('table')
          }}
          className={
            viewMode === 'table'
              ? 'flex items-center px-1.5 py-1 rounded-md bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 transition-colors'
              : 'flex items-center px-1.5 py-1 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-600/50 transition-colors'
          }
          title="Table view"
        >
          <LuTable className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onViewModeChange('timeline')
          }}
          className={
            viewMode === 'timeline'
              ? 'flex items-center px-1.5 py-1 rounded-md bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 transition-colors'
              : 'flex items-center px-1.5 py-1 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-600/50 transition-colors'
          }
          title="Timeline view"
        >
          <LuList className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
      <button
        onClick={() => onViewModeChange('table')}
        className={
          viewMode === 'table'
            ? 'flex items-center gap-1 px-1.5 py-1 rounded-md bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 transition-colors'
            : 'flex items-center gap-1 px-1.5 py-1 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-600/50 transition-colors'
        }
        title="Table view"
      >
        <LuTable className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">Table</span>
      </button>
      <button
        onClick={() => onViewModeChange('timeline')}
        className={
          viewMode === 'timeline'
            ? 'flex items-center gap-1 px-1.5 py-1 rounded-md bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 transition-colors'
            : 'flex items-center gap-1 px-1.5 py-1 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-600/50 transition-colors'
        }
        title="Timeline view"
      >
        <LuList className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">Timeline</span>
      </button>
    </div>
  )
}
