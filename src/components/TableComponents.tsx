import * as React from 'react'
import { CaretUpIcon, CaretDownIcon } from '@phosphor-icons/react'

// Table - Main table wrapper
interface TableProps {
  children: React.ReactNode
  className?: string
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div
      className={`bg-white dark:bg-black/40 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto relative ${className}`}
    >
      <table className="w-full min-w-full bg-white dark:bg-black/40">
        {children}
      </table>
    </div>
  )
}

// TableHeader - Table header section
interface TableHeaderProps {
  children: React.ReactNode
  className?: string
}

export function TableHeader({ children, className = '' }: TableHeaderProps) {
  return (
    <thead
      className={`hidden md:table-header-group border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-black/40 ${className}`}
    >
      {children}
    </thead>
  )
}

// TableHeaderRow - Header row
interface TableHeaderRowProps {
  children: React.ReactNode
  className?: string
}

export function TableHeaderRow({
  children,
  className = '',
}: TableHeaderRowProps) {
  return (
    <tr
      className={`border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-black/40 ${className}`}
    >
      {children}
    </tr>
  )
}

// TableHeaderCell - Header cell
interface TableHeaderCellProps {
  children?: React.ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}

export function TableHeaderCell({
  children,
  className = '',
  align = 'left',
}: TableHeaderCellProps) {
  const alignClass =
    align === 'right'
      ? 'text-right'
      : align === 'center'
        ? 'text-center'
        : 'text-left'
  return (
    <th
      className={`px-2 py-1.5 ${alignClass} text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  )
}

// SortableTableHeaderCell - Header cell with optional sorting
interface SortableTableHeaderCellProps {
  children?: React.ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  sortDirection?: 'asc' | 'desc' | false
  onSort?: () => void
}

export function SortableTableHeaderCell({
  children,
  className = '',
  align = 'left',
  sortable = false,
  sortDirection = false,
  onSort,
}: SortableTableHeaderCellProps) {
  const alignClass =
    align === 'right'
      ? 'text-right'
      : align === 'center'
        ? 'text-center'
        : 'text-left'
  const baseClass = `px-2 py-1.5 ${alignClass} text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase whitespace-nowrap ${className}`

  if (!sortable) {
    return <th className={baseClass}>{children}</th>
  }

  return (
    <th
      className={`${baseClass} group cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 transition-colors`}
      onClick={onSort}
    >
      <span
        className={`inline-flex items-center gap-1 ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        {children}
        <span className="w-3 h-3 flex items-center justify-center">
          {sortDirection === 'asc' && <CaretUpIcon className="w-3 h-3" />}
          {sortDirection === 'desc' && <CaretDownIcon className="w-3 h-3" />}
          {!sortDirection && (
            <CaretUpIcon className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
          )}
        </span>
      </span>
    </th>
  )
}

// TableBody - Table body section
interface TableBodyProps {
  children: React.ReactNode
  className?: string
}

export function TableBody({ children, className = '' }: TableBodyProps) {
  return <tbody className={className}>{children}</tbody>
}

// TableRow - Table row
interface TableRowProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function TableRow({ children, className = '', onClick }: TableRowProps) {
  return (
    <tr
      className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/50 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

// TableCell - Table cell
interface TableCellProps {
  children: React.ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
  colSpan?: number
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void
}

export function TableCell({
  children,
  className = '',
  align = 'left',
  colSpan,
  onClick,
}: TableCellProps) {
  const alignClass =
    align === 'right'
      ? 'text-right'
      : align === 'center'
        ? 'text-center'
        : 'text-left'
  return (
    <td
      className={`px-2 py-2 ${alignClass} ${className}`}
      colSpan={colSpan}
      onClick={onClick}
    >
      {children}
    </td>
  )
}
