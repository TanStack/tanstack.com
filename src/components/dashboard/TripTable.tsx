import { nextGridCell } from './keyboard'
import {
  useLayoutEffect,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  useTable,
  type Column,
  type Updater,
  type SortingState,
  type ColumnFiltersState,
  type GroupingState,
  type PaginationState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { DashboardUI } from './ui'
import { dollars, type RecordRow } from './model'
import {
  gridRequestSchema,
  type GridRequest,
  type GridSelection,
} from './request'
import type { DashboardResult } from './server/queries'
import { gridFeatures, gridColumns, formatGridValue, tripCsv } from './grid'

type GridColumn = Column<typeof gridFeatures, RecordRow>
function columnStyle(column: GridColumn): CSSProperties {
  const pinned = column.getIsPinned()
  return {
    width: column.getSize(),
    minWidth: column.getSize(),
    maxWidth: column.getSize(),
    position: pinned ? 'sticky' : undefined,
    insetInlineStart: pinned === 'start' ? column.getStart('start') : undefined,
    insetInlineEnd: pinned === 'end' ? column.getAfter('end') : undefined,
    zIndex: pinned ? 2 : undefined,
  }
}
function SelectionBox({
  checked,
  mixed,
  label,
  onChange,
  disabled,
}: {
  disabled?: boolean
  checked: boolean
  mixed: boolean
  label: string
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed && !checked
  }, [checked, mixed])
  return (
    <input
      ref={ref}
      type="checkbox"
      disabled={disabled}
      aria-label={label}
      checked={checked}
      onChange={onChange}
    />
  )
}
function ColumnFilter({
  column,
  facets,
}: {
  column: GridColumn
  facets?: DashboardResult['boroughFacets']
}) {
  const label = String(column.columnDef.header)
  const value: unknown = column.getFilterValue()
  if (column.columnDef.filterFn === 'inNumberRange') {
    const range = Array.isArray(value) ? value : []
    return (
      <div className="grid-range">
        <input
          type="number"
          step="any"
          aria-label={`${label} minimum`}
          placeholder="Min"
          value={typeof range[0] === 'number' ? range[0] : ''}
          onChange={(event) =>
            column.setFilterValue([
              event.target.value === ''
                ? undefined
                : Number(event.target.value),
              range[1],
            ])
          }
        />
        <input
          type="number"
          step="any"
          aria-label={`${label} maximum`}
          placeholder="Max"
          value={typeof range[1] === 'number' ? range[1] : ''}
          onChange={(event) =>
            column.setFilterValue([
              range[0],
              event.target.value === ''
                ? undefined
                : Number(event.target.value),
            ])
          }
        />
      </div>
    )
  }
  if (column.id === 'borough') {
    const choices =
      facets ??
      [...column.getFacetedUniqueValues().entries()]
        .map(([key, count]) => ({ value: String(key), count }))
        .sort((a, b) => a.value.localeCompare(b.value))
    return (
      <select
        aria-label={`Filter ${label}`}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) =>
          column.setFilterValue(event.target.value || undefined)
        }
      >
        <option value="">All</option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.value} ({choice.count})
          </option>
        ))}
      </select>
    )
  }
  return (
    <input
      aria-label={`Filter ${label}`}
      placeholder="Filter…"
      value={typeof value === 'string' ? value : ''}
      onChange={(event) =>
        column.setFilterValue(event.target.value || undefined)
      }
    />
  )
}

export type RemoteGrid = {
  state: GridRequest
  onChange: (state: GridRequest) => void
  result: DashboardResult | undefined
  busy: boolean
  selection: GridSelection
  setSelection: (selection: GridSelection) => void
  exportCsv: (selected: boolean) => Promise<void>
}
export function useTripGrid(
  rows: readonly RecordRow[],
  remote?: RemoteGrid,
  queryState?: Pick<RemoteGrid, 'state' | 'onChange'>,
) {
  const control = remote ?? queryState
  const [density, setDensity] = useState('comfortable')
  const [showFilters, setShowFilters] = useState(false)
  const [allRows, setAllRows] = useState(false)
  const queryStateValue = control?.state
  const controlledState = useMemo(
    () =>
      queryStateValue
        ? {
            globalFilter: queryStateValue.query,
            columnFilters: queryStateValue.filters,
            sorting: queryStateValue.sorting,
            grouping: queryStateValue.group ? [queryStateValue.group] : [],
            pagination: {
              pageIndex: queryStateValue.page,
              pageSize: queryStateValue.size,
            },
          }
        : undefined,
    [queryStateValue],
  )
  const table = useTable({
    features: gridFeatures,
    columns: gridColumns,
    data: rows,
    getRowId: (row) =>
      row.group ? `group:${row.group.value}` : String(row.id),
    globalFilterFn: 'includesString',
    columnResizeMode: 'onChange',
    defaultColumn: { minSize: 85, maxSize: 500 },
    enableRowSelection: (row) => !row.getIsGrouped() && !row.original.group,
    enableSubRowSelection: false,
    autoResetPageIndex: !control,
    manualPagination: Boolean(remote) || allRows,
    manualSorting: Boolean(remote),
    manualFiltering: Boolean(remote),
    manualGrouping: Boolean(remote),
    rowCount: remote?.result?.rowCount,
    ...(control
      ? {
          state: controlledState,
          onGlobalFilterChange: (updater: unknown) => {
            const next: unknown =
              typeof updater === 'function'
                ? updater(control.state.query)
                : updater
            control.onChange({
              ...control.state,
              query: gridRequestSchema.shape.query.parse(next),
              page: 0,
            })
          },
          onSortingChange: (updater: Updater<SortingState>) =>
            control.onChange({
              ...control.state,
              sorting: gridRequestSchema.shape.sorting.parse(
                typeof updater === 'function'
                  ? updater(control.state.sorting)
                  : updater,
              ),
              page: 0,
            }),
          onColumnFiltersChange: (updater: Updater<ColumnFiltersState>) =>
            control.onChange({
              ...control.state,
              filters: gridRequestSchema.shape.filters.parse(
                typeof updater === 'function'
                  ? updater(control.state.filters)
                  : updater,
              ),
              page: 0,
            }),
          onGroupingChange: (updater: Updater<GroupingState>) => {
            const next =
              typeof updater === 'function'
                ? updater(control.state.group ? [control.state.group] : [])
                : updater
            control.onChange({
              ...control.state,
              group: gridRequestSchema.shape.group.parse(next[0] ?? ''),
              page: 0,
            })
          },
          onPaginationChange: (updater: Updater<PaginationState>) => {
            const previous = {
              pageIndex: control.state.page,
              pageSize: control.state.size,
            }
            const next =
              typeof updater === 'function' ? updater(previous) : updater
            control.onChange({
              ...control.state,
              page: next.pageIndex,
              size: gridRequestSchema.shape.size.parse(next.pageSize),
            })
          },
        }
      : {}),
    initialState: {
      ...(!control
        ? {
            globalFilter: '',
            pagination: { pageIndex: 0, pageSize: 50 },
            sorting: [{ id: 'pickup', desc: false }],
          }
        : {}),
      columnOrder: gridColumns.map((column) => column.id ?? ''),
      columnPinning: { start: ['select', 'id'], end: [] },
      columnVisibility: { day: false },
    },
  })
  const group = control?.state.group
  const setColumnVisibility = table.setColumnVisibility
  useEffect(() => {
    if (group) setColumnVisibility((old) => ({ ...old, [group]: true }))
  }, [group, setColumnVisibility])
  return {
    table,
    remote,
    queryState: control,
    density,
    setDensity,
    showFilters,
    setShowFilters,
    allRows,
    setAllRows,
  }
}

export function TripTable({
  rows,
  controller,
  selected,
  onSelect,
  ui,
}: {
  ui: DashboardUI
  rows: readonly RecordRow[]
  controller: ReturnType<typeof useTripGrid>
  selected: number
  onSelect: (id: number) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const {
    table,
    remote,
    queryState,
    density,
    setDensity,
    showFilters,
    setShowFilters,
    allRows,
    setAllRows,
  } = controller
  const [fullScreen, setFullScreen] = useState(false)
  const [supportsFullScreen, setSupportsFullScreen] = useState(false)
  const tableRows = table.getRowModel().rows
  const filteredRows = table.getFilteredRowModel().rows
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const rowHeight =
    density === 'compact' ? 32 : density === 'spacious' ? 54 : 42
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => rowHeight,
    getItemKey: (index) => tableRows[index].id,
    overscan: 8,
  })
  useEffect(() => {
    virtualizer.measure()
  }, [rowHeight, virtualizer])
  useEffect(() => {
    virtualizer.scrollToOffset(0)
  }, [
    rows,
    table.state.sorting,
    table.state.columnFilters,
    table.state.globalFilter,
    table.state.pagination,
    table.state.grouping,
    virtualizer,
  ])
  useEffect(() => {
    setSupportsFullScreen(Boolean(document.fullscreenEnabled))
    const onChange = () =>
      setFullScreen(document.fullscreenElement === grid.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const [pendingFocus, setPendingFocus] = useState<{
    row: string
    column: string
  } | null>(null)
  const items = virtualizer.getVirtualItems()
  useLayoutEffect(() => {
    if (!pendingFocus) return
    const cell = scroller.current?.querySelector(
      `[data-grid-row="${CSS.escape(pendingFocus.row)}"][data-grid-column="${CSS.escape(pendingFocus.column)}"]`,
    )
    if (cell instanceof HTMLElement) {
      cell.focus({ preventScroll: true })
      cell.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      setPendingFocus(null)
    } else if (!tableRows.some((row) => row.id === pendingFocus.row)) {
      scroller.current?.focus({ preventScroll: true })
      setPendingFocus(null)
    }
  }, [items, pendingFocus, tableRows])
  const visibleColumns = table.getVisibleLeafColumns()
  const visibleCount = visibleColumns.length
  const fareTotal =
    remote?.result?.total.fareCents ??
    filteredRows.reduce((total, row) => total + row.original.fareCents, 0)
  const selectedTotal =
    remote?.result?.selectedTotals.fareCents ??
    selectedRows.reduce((total, row) => total + row.original.fareCents, 0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const filteredCount = remote?.result?.total.count ?? filteredRows.length
  const selectedCount =
    remote?.result?.selectedTotals.count ?? selectedRows.length
  const isSelected = (row: RecordRow) =>
    remote
      ? remote.selection.all !== remote.selection.ids.includes(row.id)
      : table.getRow(String(row.id)).getIsSelected()
  const toggleSelection = (ids: number[], checked: boolean) => {
    if (!remote) return
    const next = new Set(remote.selection.ids)
    for (const id of ids) {
      if (checked !== remote.selection.all) next.add(id)
      else next.delete(id)
    }
    remote.setSelection({ ...remote.selection, ids: [...next] })
  }
  const pageRows = rows.filter((row) => !row.group)
  const download = async (selection: boolean) => {
    setExporting(true)
    setExportError('')
    try {
      if (remote) {
        await remote.exportCsv(selection)
        return
      }
      const exportRows = selection ? selectedRows : filteredRows
      const blob = new Blob([tripCsv(exportRows.map((row) => row.original))], {
        type: 'text/csv;charset=utf-8',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = selection ? 'selected-trips.csv' : 'filtered-trips.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Export failed. Try again.',
      )
    } finally {
      setExporting(false)
    }
  }
  const reset = () => {
    if (queryState) {
      queryState.onChange(gridRequestSchema.parse({}))
      remote?.setSelection({ all: false, ids: [] })
    } else table.reset()
    if (!queryState) table.setGlobalFilter('')
    table.resetColumnOrder()
    table.resetColumnVisibility()
    table.resetColumnPinning()
    table.resetColumnSizing()
    table.resetExpanded()
    table.resetRowSelection()
    setShowFilters(false)
    setDensity('comfortable')
    setAllRows(false)
  }
  const globalFilter: unknown = table.state.globalFilter
  return (
    <div className="trip-grid" ref={grid} data-density={density}>
      <div className="grid-toolbar">
        <input
          type="search"
          className="grid-search"
          aria-label="Search trip records"
          placeholder="Search trip records…"
          value={typeof globalFilter === 'string' ? globalFilter : ''}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
        />
        <ui.Button
          aria-pressed={showFilters}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters
          {table.state.columnFilters.length
            ? ` (${table.state.columnFilters.length})`
            : ''}
        </ui.Button>
        <details className="grid-column-menu">
          <summary>Columns</summary>
          <div className="grid-column-options">
            {table
              .getAllLeafColumns()
              .filter((column) => column.id !== 'select')
              .map((column, index, columns) => (
                <div key={column.id} className="grid-column-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={() => column.toggleVisibility()}
                    />
                    {String(column.columnDef.header)}
                  </label>
                  <select
                    aria-label={`Pin ${column.columnDef.header}`}
                    value={column.getIsPinned() || 'none'}
                    onChange={(event) =>
                      column.pin(
                        event.target.value === 'start'
                          ? 'start'
                          : event.target.value === 'end'
                            ? 'end'
                            : false,
                      )
                    }
                  >
                    <option value="none">Unpinned</option>
                    <option value="start">Pin left</option>
                    <option value="end">Pin right</option>
                  </select>
                  <button
                    type="button"
                    aria-label={`Move ${column.columnDef.header} left`}
                    disabled={index === 0}
                    onClick={() => {
                      const order = columns.map((col) => col.id)
                      ;[order[index - 1], order[index]] = [
                        order[index],
                        order[index - 1],
                      ]
                      table.setColumnOrder(['select', ...order])
                    }}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${column.columnDef.header} right`}
                    disabled={index === columns.length - 1}
                    onClick={() => {
                      const order = columns.map((col) => col.id)
                      ;[order[index + 1], order[index]] = [
                        order[index],
                        order[index + 1],
                      ]
                      table.setColumnOrder(['select', ...order])
                    }}
                  >
                    →
                  </button>
                </div>
              ))}
            <ui.Button
              onClick={() => {
                table.resetColumnOrder()
                table.resetColumnVisibility()
                table.resetColumnPinning()
                table.resetColumnSizing()
              }}
            >
              Reset columns
            </ui.Button>
          </div>
        </details>
        <ui.Select
          label="Group by"
          value={table.state.grouping[0] ?? ''}
          onChange={(value) => {
            table.setGrouping(value ? [value] : [])
            if (value)
              table.setColumnVisibility((old) => ({ ...old, [value]: true }))
            table.setExpanded({})
          }}
          options={[
            { value: '', label: 'None' },
            { value: 'borough', label: 'Borough' },
            { value: 'zone', label: 'Pickup zone' },
            { value: 'day', label: 'Day' },
          ]}
        />
        <ui.Select
          label="Density"
          value={density}
          onChange={setDensity}
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'spacious', label: 'Spacious' },
          ]}
        />
        <ui.Button
          onClick={() => download(false)}
          disabled={!filteredCount || exporting || remote?.busy}
        >
          Export CSV
        </ui.Button>
        <ui.Button onClick={reset}>Reset grid</ui.Button>
        {supportsFullScreen && (
          <ui.Button
            aria-label={
              fullScreen ? 'Exit grid full screen' : 'Grid full screen'
            }
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen()
              else void grid.current?.requestFullscreen()
            }}
          >
            {fullScreen ? 'Exit full screen' : 'Full screen'}
          </ui.Button>
        )}
      </div>
      {exportError && <p role="alert">{exportError}</p>}
      <div className="grid-status" aria-live="polite">
        <span>
          {filteredCount.toLocaleString()} of{' '}
          {(remote?.result?.parent.count ?? rows.length).toLocaleString()} trips
          · {dollars(fareTotal)} in fares
        </span>
        {table.state.sorting.length > 0 && (
          <span>
            {table.state.sorting.length} sort
            {table.state.sorting.length === 1 ? '' : 's'} · Shift-click to add
          </span>
        )}
        {table.state.grouping.length > 0 && (
          <>
            {!remote && (
              <ui.Button onClick={() => table.toggleAllRowsExpanded()}>
                {table.getIsAllRowsExpanded()
                  ? 'Collapse groups'
                  : 'Expand groups'}
              </ui.Button>
            )}
            <span>Groups show average minutes and total miles and fares.</span>
          </>
        )}
      </div>
      {selectedCount > 0 && (
        <div className="grid-selection-bar">
          <strong>
            {selectedCount.toLocaleString()} selected · {dollars(selectedTotal)}
          </strong>
          <ui.Button
            disabled={exporting || remote?.busy}
            onClick={() => void download(true)}
          >
            Export selected
          </ui.Button>
          <ui.Button
            onClick={() =>
              remote
                ? remote.setSelection({ all: true, ids: [] })
                : table.toggleAllRowsSelected(true)
            }
          >
            Select all {filteredCount.toLocaleString()} filtered trips
          </ui.Button>
          <ui.Button
            onClick={() =>
              remote
                ? remote.setSelection({ all: false, ids: [] })
                : table.resetRowSelection()
            }
          >
            Clear selection
          </ui.Button>
        </div>
      )}
      <div
        ref={scroller}
        className="dashboard-records"
        // Keyboard access is required to scroll virtualized records.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        aria-label="Trip records, scroll for more"
      >
        <ui.Table
          aria-label="Trip data grid"
          aria-rowcount={
            (remote?.result?.rowCount ??
              table.getPrePaginatedRowModel().rows.length) + 1
          }
          style={{ width: table.getTotalSize(), tableLayout: 'fixed' }}
        >
          <ui.Head>
            <ui.Row aria-rowindex={1}>
              {table.getHeaderGroups()[0].headers.map((header) => {
                const column = header.column
                const sorted = column.getIsSorted()
                return (
                  <ui.Cell
                    key={header.id}
                    heading
                    style={{
                      ...columnStyle(column),
                      zIndex: column.getIsPinned() ? 4 : 3,
                    }}
                    aria-sort={
                      sorted === 'asc'
                        ? 'ascending'
                        : sorted === 'desc'
                          ? 'descending'
                          : undefined
                    }
                  >
                    {column.id === 'select' ? (
                      <SelectionBox
                        label="Select page trips"
                        disabled={remote?.busy || Boolean(remote?.state.group)}
                        checked={
                          remote
                            ? pageRows.length > 0 && pageRows.every(isSelected)
                            : table.getIsAllPageRowsSelected()
                        }
                        mixed={
                          remote
                            ? pageRows.some(isSelected) &&
                              !pageRows.every(isSelected)
                            : table.getIsSomePageRowsSelected()
                        }
                        onChange={() =>
                          remote
                            ? toggleSelection(
                                pageRows.map((row) => row.id),
                                !pageRows.every(isSelected),
                              )
                            : table.toggleAllPageRowsSelected()
                        }
                      />
                    ) : (
                      <>
                        <button
                          className="grid-sort"
                          type="button"
                          onClick={column.getToggleSortingHandler()}
                          title="Shift-click to add another sort"
                        >
                          {String(column.columnDef.header)}{' '}
                          <span>
                            {sorted
                              ? `${sorted === 'asc' ? '↑' : '↓'}${table.state.sorting.length > 1 ? column.getSortIndex() + 1 : ''}`
                              : '↕'}
                          </span>
                        </button>
                        {showFilters && column.getCanFilter() && (
                          <ColumnFilter
                            column={column}
                            facets={remote?.result?.boroughFacets}
                          />
                        )}
                        <div
                          className="grid-resizer"
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Resize ${column.columnDef.header}`}
                          aria-valuenow={column.getSize()}
                          aria-valuemin={85}
                          aria-valuemax={500}
                          tabIndex={0}
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onDoubleClick={() => column.resetSize()}
                          onKeyDown={(event) => {
                            if (
                              event.key === 'ArrowLeft' ||
                              event.key === 'ArrowRight'
                            ) {
                              event.preventDefault()
                              table.setColumnSizing((old) => ({
                                ...old,
                                [column.id]: Math.min(
                                  500,
                                  Math.max(
                                    85,
                                    column.getSize() +
                                      (event.key === 'ArrowRight' ? 10 : -10),
                                  ),
                                ),
                              }))
                            }
                            if (event.key === 'Home') {
                              event.preventDefault()
                              column.resetSize()
                            }
                          }}
                        />
                      </>
                    )}
                  </ui.Cell>
                )
              })}
            </ui.Row>
          </ui.Head>
          <ui.Body>
            {items.length > 0 && (
              <ui.Row aria-hidden="true">
                <ui.Cell
                  colSpan={visibleCount}
                  style={{ height: items[0].start, padding: 0, border: 0 }}
                />
              </ui.Row>
            )}
            {items.map((item) => {
              const row = tableRows[item.index]
              return (
                <ui.Row
                  key={row.id}
                  aria-rowindex={
                    (remote
                      ? (remote.result?.page ?? 0) * remote.state.size
                      : allRows
                        ? 0
                        : table.state.pagination.pageIndex *
                          table.state.pagination.pageSize) +
                    item.index +
                    2
                  }
                  data-selected={
                    (!row.original.group && isSelected(row.original)) ||
                    (!row.getIsGrouped() && selected === row.original.id)
                  }
                  data-grouped={
                    row.getIsGrouped() || Boolean(row.original.group)
                  }
                  style={{ height: rowHeight }}
                >
                  {row.getVisibleCells().map((cell, columnIndex) => (
                    <ui.Cell
                      key={cell.id}
                      tabIndex={0}
                      data-grid-row={row.id}
                      data-grid-column={cell.column.id}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return
                        const next = nextGridCell(
                          event.key,
                          item.index,
                          columnIndex,
                          tableRows.length,
                          visibleCount,
                          Math.max(
                            1,
                            Math.floor(
                              (scroller.current?.clientHeight ?? rowHeight) /
                                rowHeight,
                            ) - 1,
                          ),
                          event.ctrlKey || event.metaKey,
                        )
                        if (next) {
                          event.preventDefault()
                          const target = tableRows[next.row]
                          const targetCell =
                            target.getVisibleCells()[next.column]
                          setPendingFocus({
                            row: target.id,
                            column: targetCell.column.id,
                          })
                          virtualizer.scrollToIndex(next.row, { align: 'auto' })
                        } else if (event.key === 'Enter' || event.key === ' ') {
                          const control =
                            event.currentTarget.querySelector('button, input')
                          if (control instanceof HTMLElement) {
                            event.preventDefault()
                            control.click()
                          }
                        }
                      }}
                      style={columnStyle(cell.column)}
                      data-pinned={cell.column.getIsPinned() || undefined}
                    >
                      {cell.column.id === 'select' ? (
                        row.getIsGrouped() || row.original.group ? null : (
                          <SelectionBox
                            label={`Select row ${row.id}`}
                            disabled={remote?.busy}
                            checked={isSelected(row.original)}
                            mixed={false}
                            onChange={() =>
                              remote
                                ? toggleSelection(
                                    [row.original.id],
                                    !isSelected(row.original),
                                  )
                                : row.toggleSelected()
                            }
                          />
                        )
                      ) : row.original.group ? (
                        cell.column.id === remote?.state.group ? (
                          <button
                            className="grid-group"
                            onClick={() => {
                              if (!remote || !row.original.group) return
                              const id = remote.state.group
                              if (!id) return
                              const value = row.original.group.value
                              remote.onChange({
                                ...remote.state,
                                group: '',
                                page: 0,
                                filters: [
                                  ...remote.state.filters.filter(
                                    (filter) => filter.id !== id,
                                  ),
                                  {
                                    id,
                                    value:
                                      id === 'day'
                                        ? [Number(value), Number(value)]
                                        : value,
                                  },
                                ],
                              })
                            }}
                            title="View trips in this group"
                          >
                            {formatGridValue(cell.column.id, cell.getValue())} (
                            {row.original.group.count.toLocaleString()}) →
                          </button>
                        ) : ['minutes', 'miles', 'fareCents'].includes(
                            cell.column.id,
                          ) ? (
                          formatGridValue(cell.column.id, cell.getValue())
                        ) : null
                      ) : cell.getIsGrouped() ? (
                        <button
                          className="grid-group"
                          onClick={row.getToggleExpandedHandler()}
                          aria-expanded={row.getIsExpanded()}
                        >
                          {row.getIsExpanded() ? '▾' : '▸'}{' '}
                          {formatGridValue(cell.column.id, cell.getValue())} (
                          {row.subRows.length.toLocaleString()})
                        </button>
                      ) : cell.getIsPlaceholder() ? null : cell.column.id ===
                        'id' ? (
                        row.getIsGrouped() || row.original.group ? null : (
                          <ui.Button
                            aria-label={`Select trip ${row.id}`}
                            aria-pressed={selected === row.original.id}
                            onClick={() => onSelect(row.original.id)}
                          >
                            {row.id}
                          </ui.Button>
                        )
                      ) : (
                        <span
                          title={formatGridValue(
                            cell.column.id,
                            cell.getValue(),
                          )}
                        >
                          {formatGridValue(cell.column.id, cell.getValue())}
                        </span>
                      )}
                    </ui.Cell>
                  ))}
                </ui.Row>
              )
            })}
            {items.length > 0 && (
              <ui.Row aria-hidden="true">
                <ui.Cell
                  colSpan={visibleCount}
                  style={{
                    height:
                      virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0),
                    padding: 0,
                    border: 0,
                  }}
                />
              </ui.Row>
            )}
          </ui.Body>
        </ui.Table>
        {tableRows.length === 0 && (
          <p className="p-6">No trips match these filters.</p>
        )}
      </div>
      <div className="grid-pagination">
        {!remote && (
          <label>
            <input
              type="checkbox"
              checked={allRows}
              onChange={(event) => {
                setAllRows(event.target.checked)
                table.setPageIndex(0)
              }}
            />
            Continuous scroll
          </label>
        )}
        {!allRows && (
          <>
            <ui.Select
              label="Rows per page"
              value={String(table.state.pagination.pageSize)}
              onChange={(value) => table.setPageSize(Number(value))}
              options={[25, 50, 100, 250].map((value) => ({
                value: String(value),
                label: String(value),
              }))}
            />
            <span>
              Page {table.state.pagination.pageIndex + 1} of{' '}
              {Math.max(1, table.getPageCount()).toLocaleString()}
            </span>
            <ui.Button
              aria-label="First page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.firstPage()}
            >
              «
            </ui.Button>
            <ui.Button
              aria-label="Previous page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              ‹
            </ui.Button>
            <ui.Button
              aria-label="Next page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              ›
            </ui.Button>
            <ui.Button
              aria-label="Last page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.lastPage()}
            >
              »
            </ui.Button>
          </>
        )}
      </div>
    </div>
  )
}
