import * as React from 'react'
import { useState } from 'react'
import { MdExpandMore } from 'react-icons/md'
import { LuTable, LuList, LuColumns } from 'react-icons/lu'
import { LuRotateCcw } from 'react-icons/lu'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { twMerge } from 'tailwind-merge'

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
            className={twMerge(
              'w-3.5 h-3.5 transition-transform',
              !isExpanded && 'rotate-90',
            )}
          />
        </button>
      </div>
      {isExpanded && (
        <div
          className={twMerge(
            'mt-1 space-y-0.5',
            onSelectAll || onSelectNone ? 'pl-4' : 'pl-[1.375rem]',
          )}
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
      className={twMerge(
        'px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500',
        className,
      )}
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
  viewMode?: 'table' | 'timeline' | 'columns'
}

export function FilterBar({
  children,
  title = 'Filters',
  onClearFilters,
  hasActiveFilters,
  mobileControls,
  desktopHeader,
  viewMode,
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
                className={twMerge(
                  'w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0',
                  !isOpen && 'rotate-90',
                )}
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
        className={twMerge(
          'hidden lg:block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 overflow-y-auto',
          viewMode !== 'columns' && 'sticky',
        )}
        style={{
          ...(viewMode !== 'columns' && {
            top: 'calc(var(--navbar-height, 0px) + 1rem)',
            height: 'calc(100vh - var(--navbar-height, 0px) - 2rem)',
            maxHeight: 'calc(100vh - var(--navbar-height, 0px) - 2rem)',
          }),
        }}
      >
        {/* Header */}
        {desktopHeader && <div className="mb-2">{desktopHeader}</div>}

        {children}
      </div>
    </>
  )
}

// ViewModeToggle - View mode toggle buttons (table/timeline/columns)
interface ViewModeToggleProps {
  viewMode: 'table' | 'timeline' | 'columns'
  onViewModeChange: (viewMode: 'table' | 'timeline' | 'columns') => void
  compact?: boolean
}

export function ViewModeToggle({
  viewMode,
  onViewModeChange,
  compact = false,
}: ViewModeToggleProps) {
  const baseButtonClasses =
    'flex items-center px-1.5 py-1 rounded-md transition-colors'
  const activeButtonClasses =
    'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100'
  const inactiveButtonClasses =
    'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-600/50'

  const compactViewModes = [
    { mode: 'table' as const, icon: LuTable, title: 'Table view' },
    { mode: 'timeline' as const, icon: LuList, title: 'Timeline view' },
    { mode: 'columns' as const, icon: LuColumns, title: 'Columns view' },
  ]

  if (compact) {
    return (
      <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 flex-shrink-0">
        {compactViewModes.map(({ mode, icon: Icon, title }) => (
          <button
            key={mode}
            onClick={(e) => {
              e.stopPropagation()
              onViewModeChange(mode)
            }}
            className={twMerge(
              baseButtonClasses,
              viewMode === mode ? activeButtonClasses : inactiveButtonClasses,
            )}
            title={title}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>
    )
  }

  const viewModes = [
    {
      mode: 'table' as const,
      icon: LuTable,
      label: 'Table',
      title: 'Table view',
    },
    {
      mode: 'timeline' as const,
      icon: LuList,
      label: 'Timeline',
      title: 'Timeline view',
    },
    {
      mode: 'columns' as const,
      icon: LuColumns,
      label: 'Columns',
      title: 'Columns view',
    },
  ]

  return (
    <div className="flex items-stretch w-full gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
      {viewModes.map(({ mode, icon: Icon, label, title }) => (
        <button
          key={mode}
          onClick={() => onViewModeChange(mode)}
          className={twMerge(
            baseButtonClasses,
            'flex-1 flex-col gap-1',
            viewMode === mode ? activeButtonClasses : inactiveButtonClasses,
          )}
          title={title}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{label}</span>
        </button>
      ))}
    </div>
  )
}
