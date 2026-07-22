import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import {
  ArrowsHorizontal,
  CaretDown,
  CaretUp,
  Funnel,
  GridNine,
  MagnifyingGlass,
  Rows,
  SlidersHorizontal,
  Stack,
} from '@phosphor-icons/react'

import {
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const tablePrompt =
  'Build a TanStack Table data grid for a TypeScript app. Keep it headless: define column definitions, row models, sorting, filtering, pagination, selection, visibility, and controlled state without prescribing markup. Render semantic table elements and synchronize table state to the URL or server only where the product needs it.'

type TableIssue = {
  id: string
  owner: string
  project: string
  score: number
  status: 'active' | 'review' | 'shipped'
}

type StatusFilter = 'all' | TableIssue['status']
type Surface = 'table' | 'cards' | 'dense'
type StateOwner = 'component' | 'url' | 'server'

const tableRows: Array<TableIssue> = [
  {
    id: 'TS-732',
    owner: 'Tanner',
    project: 'Router docs',
    score: 98,
    status: 'active',
  },
  {
    id: 'TS-681',
    owner: 'Dominik',
    project: 'Query cache',
    score: 94,
    status: 'review',
  },
  {
    id: 'TS-644',
    owner: 'Kevin',
    project: 'Table filters',
    score: 91,
    status: 'shipped',
  },
  {
    id: 'TS-612',
    owner: 'Ben',
    project: 'Virtual lists',
    score: 88,
    status: 'active',
  },
  {
    id: 'TS-590',
    owner: 'Arthur',
    project: 'Column pinning',
    score: 84,
    status: 'review',
  },
  {
    id: 'TS-551',
    owner: 'Noel',
    project: 'Faceted search',
    score: 79,
    status: 'shipped',
  },
  {
    id: 'TS-523',
    owner: 'Zach',
    project: 'Bulk actions',
    score: 76,
    status: 'active',
  },
  {
    id: 'TS-507',
    owner: 'Luca',
    project: 'Density switch',
    score: 72,
    status: 'review',
  },
]

const statusFilters: Array<{ label: string; value: StatusFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Review', value: 'review' },
  { label: 'Shipped', value: 'shipped' },
]

const rowModels = [
  { label: 'Core', code: 'getCoreRowModel()', rows: '8 rows', icon: Rows },
  {
    label: 'Filter',
    code: 'getFilteredRowModel()',
    rows: '5 rows',
    icon: Funnel,
  },
  {
    label: 'Sort',
    code: 'getSortedRowModel()',
    rows: '5 rows',
    icon: ArrowsHorizontal,
  },
  {
    label: 'Page',
    code: 'getPaginationRowModel()',
    rows: '4 rows',
    icon: Stack,
  },
] as const

const stateOwners: Record<
  StateOwner,
  { code: string; note: string; path: string }
> = {
  component: {
    code: 'onSortingChange: setSorting',
    note: 'Fast local interaction with no external coordination.',
    path: 'header → table state → row model',
  },
  url: {
    code: 'navigate({ search: { sort } })',
    note: 'Shareable, restorable state for product navigation.',
    path: 'header → URL search → table state',
  },
  server: {
    code: 'manualSorting: true',
    note: 'Table reports the next sort state; your data layer fetches the ordered rows.',
    path: 'header → controlled sorting → API query',
  },
}

export default function TableLanding() {
  return (
    <LibraryLandingShell
      description="Table is a headless engine for rows, columns, sorting, filtering, grouping, selection, pagination, and controlled state—without a data-grid component attached."
      headline="The data-grid logic, without the data-grid component."
      hero={<TableWorkbench />}
      libraryId="table"
      prompt={tablePrompt}
      promptLabel="Copy Table prompt"
    >
      <LandingSection tone="ink">
        <div className="grid gap-12 lg:grid-cols-[0.76fr_1.24fr] lg:items-center">
          <LandingSectionIntro
            body="Start with core rows, then opt into only the transformations the product needs. Each row model has one job, a visible input, and a visible output."
            eyebrow="Row-model pipeline"
            icon={<ArrowsHorizontal aria-hidden="true" size={17} />}
            title="Compose behavior instead of buying a grid monolith."
          />
          <RowPipeline />
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <LandingSectionIntro
          body="Column definitions and row models describe behavior, not elements. Feed the same model into semantic rows, responsive cards, or a dense operational view."
          eyebrow="Headless rendering"
          icon={<GridNine aria-hidden="true" size={17} />}
          title="One engine. Whatever surface the job calls for."
        />
        <div className="mt-10 space-y-4">
          <SurfaceLab />
          <TableVirtualBoundary />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <LandingSectionIntro
            body="Let Table manage state until another part of the product needs it. Then lift only sorting, filters, selection, visibility, or pagination into the component, URL, or server."
            eyebrow="State ownership"
            icon={<SlidersHorizontal aria-hidden="true" size={17} />}
            title="Control exactly the state that has somewhere else to be."
          />
          <StateSwitchboard />
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}

function TableWorkbench() {
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'score', desc: true },
  ])
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({ owner: false })
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 4,
  })
  const columnFilters = React.useMemo<ColumnFiltersState>(
    () =>
      statusFilter === 'all' ? [] : [{ id: 'status', value: statusFilter }],
    [statusFilter],
  )

  const columns = React.useMemo<Array<ColumnDef<TableIssue>>>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            aria-label="Select every row on this page"
            aria-checked={
              table.getIsSomePageRowsSelected()
                ? 'mixed'
                : table.getIsAllPageRowsSelected()
            }
            checked={table.getIsAllPageRowsSelected()}
            className="accent-[var(--landing-accent)]"
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            ref={(input) => {
              if (input) {
                input.indeterminate = table.getIsSomePageRowsSelected()
              }
            }}
            type="checkbox"
          />
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <input
            aria-label={`Select ${row.original.project}`}
            checked={row.getIsSelected()}
            className="accent-[var(--landing-accent)]"
            onChange={row.getToggleSelectedHandler()}
            type="checkbox"
          />
        ),
      },
      { accessorKey: 'project', header: 'Project' },
      { accessorKey: 'owner', header: 'Owner' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => (
          <StatusBadge status={getValue<TableIssue['status']>()} />
        ),
      },
      { accessorKey: 'score', header: 'Score' },
    ],
    [],
  )

  const table = useReactTable({
    columns,
    data: tableRows,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).trim().toLowerCase()
      if (!search) return true
      return [row.original.project, row.original.owner, row.original.status]
        .join(' ')
        .toLowerCase()
        .includes(search)
    },
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: {
      columnFilters,
      columnVisibility,
      globalFilter,
      pagination,
      rowSelection,
      sorting,
    },
  })

  const filteredRows = table.getFilteredRowModel().rows.length
  const selectedRows = table.getSelectedRowModel().rows.length

  return (
    <LandingWindow label="issue workbench">
      <div className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="flex min-w-0 items-center gap-2 rounded-lg border border-white/7 bg-white/[0.025] px-3 py-2">
            <MagnifyingGlass
              aria-hidden="true"
              className="shrink-0 text-[var(--landing-accent)]"
              size={15}
            />
            <span className="sr-only">Search projects and owners</span>
            <input
              className="min-w-0 flex-1 bg-transparent font-ds-mono text-xs text-white outline-none placeholder:text-white/20"
              onChange={(event) => {
                table.setGlobalFilter(event.target.value)
                table.setPageIndex(0)
              }}
              placeholder="Search projects or owners"
              value={globalFilter}
            />
          </label>
          <div
            aria-label="Filter issues by status"
            className="flex flex-wrap gap-1.5"
            role="group"
          >
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                aria-pressed={statusFilter === filter.value}
                className="rounded-md border border-white/7 px-2.5 py-2 font-ds-mono text-[9px] uppercase tracking-[0.1em] text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] aria-pressed:border-[var(--landing-accent)] aria-pressed:bg-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-ink)]"
                onClick={() => {
                  setStatusFilter(filter.value)
                  table.setPageIndex(0)
                }}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div
            aria-label="Toggle visible columns"
            className="flex gap-2"
            role="group"
          >
            {(['owner', 'status', 'score'] as const).map((columnId) => {
              const column = table.getColumn(columnId)
              return (
                <button
                  key={columnId}
                  aria-pressed={column?.getIsVisible() ?? false}
                  className="rounded-md border border-white/7 px-2 py-1 font-ds-mono text-[9px] capitalize text-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] aria-pressed:bg-white/8 aria-pressed:text-white/60"
                  onClick={() => column?.toggleVisibility()}
                  type="button"
                >
                  {columnId}
                </button>
              )
            })}
          </div>
          <span
            aria-live="polite"
            className="font-ds-mono text-[9px] uppercase tracking-[0.12em] text-white/25"
          >
            {filteredRows} rows · {selectedRows} selected
          </span>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-white/7">
          <table className="w-full min-w-[36rem] table-fixed border-collapse text-left">
            <thead className="border-b border-white/7 bg-white/[0.035]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const sort = header.column.getIsSorted()
                    return (
                      <th
                        key={header.id}
                        aria-sort={
                          sort === 'asc'
                            ? 'ascending'
                            : sort === 'desc'
                              ? 'descending'
                              : undefined
                        }
                        className={getCellClassName(header.column.id)}
                        scope="col"
                      >
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button
                            className="flex w-full items-center gap-1 rounded-sm font-ds-mono text-[9px] uppercase tracking-[0.12em] text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)]"
                            onClick={header.column.getToggleSortingHandler()}
                            type="button"
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            {sort === 'asc' ? (
                              <CaretUp aria-hidden="true" size={11} />
                            ) : sort === 'desc' ? (
                              <CaretDown aria-hidden="true" size={11} />
                            ) : null}
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-white/5">
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="bg-black/20 transition-colors hover:bg-white/[0.025] data-[selected=true]:bg-[color:rgb(var(--landing-glow)/0.1)]"
                    data-selected={row.getIsSelected()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={getCellClassName(cell.column.id)}
                      >
                        <span className="block truncate font-ds-mono text-[11px] text-white/65">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-4 py-8 text-center font-ds-mono text-[10px] text-white/30"
                    colSpan={table.getVisibleLeafColumns().length}
                  >
                    No rows match this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-white/8 px-3 py-1.5 text-ds-label-sm text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] disabled:opacity-20"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              type="button"
            >
              Prev
            </button>
            <button
              className="rounded-md border border-white/8 px-3 py-1.5 text-ds-label-sm text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] disabled:opacity-20"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              type="button"
            >
              Next
            </button>
          </div>
          <span className="font-ds-mono text-[9px] uppercase tracking-[0.12em] text-[var(--landing-accent)]">
            page {table.getState().pagination.pageIndex + 1} /{' '}
            {Math.max(table.getPageCount(), 1)}
          </span>
        </div>
      </div>
    </LandingWindow>
  )
}

function RowPipeline() {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {rowModels.map((model, index) => {
        const Icon = model.icon
        return (
          <div
            key={model.label}
            className="relative rounded-xl border border-white/8 bg-[#0b0b0b] p-4"
          >
            <Icon
              aria-hidden="true"
              className="text-[var(--landing-accent)]"
              size={19}
            />
            <p className="mt-6 text-ds-label-md text-white">{model.label}</p>
            <code className="mt-2 block break-all font-ds-mono text-[9px] leading-5 text-white/30">
              {model.code}
            </code>
            <p className="mt-5 font-ds-mono text-[10px] text-[var(--landing-accent-bright)]">
              {model.rows}
            </p>
            {index < rowModels.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute -right-2 top-8 z-10 hidden size-4 rotate-45 border-r border-t border-[var(--landing-accent)] bg-[#0b0b0b] sm:block"
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function SurfaceLab() {
  const [surface, setSurface] = React.useState<Surface>('table')
  const rows = tableRows.slice(0, 4)

  return (
    <LandingWindow label="render surface">
      <div className="border-b border-white/5 p-4">
        <div
          aria-label="Choose a render surface"
          className="flex flex-wrap gap-2"
          role="group"
        >
          {(['table', 'cards', 'dense'] as const).map((item) => (
            <button
              key={item}
              aria-pressed={surface === item}
              className="rounded-md border border-white/8 px-3 py-1.5 font-ds-mono text-[9px] uppercase tracking-[0.12em] text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] aria-pressed:border-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-bright)]"
              onClick={() => setSurface(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-[16rem] p-5">
        {surface === 'table' ? (
          <div className="overflow-hidden rounded-lg border border-white/7">
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[5rem_minmax(0,1fr)_5rem] gap-4 border-t border-white/5 px-4 py-3 first:border-t-0"
              >
                <span className="font-ds-mono text-[10px] text-white/30">
                  {row.id}
                </span>
                <span className="truncate text-ds-body-xs text-white/70">
                  {row.project}
                </span>
                <span className="text-right font-ds-mono text-[10px] text-[var(--landing-accent)]">
                  {row.score}
                </span>
              </div>
            ))}
          </div>
        ) : surface === 'cards' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((row) => (
              <div
                key={row.id}
                className="rounded-lg border border-white/7 bg-white/[0.025] p-4"
              >
                <StatusBadge status={row.status} />
                <p className="mt-5 text-ds-label-md text-white">
                  {row.project}
                </p>
                <p className="mt-2 text-ds-body-xs text-white/30">
                  {row.owner} · score {row.score}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-black/30 p-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-4 border-b border-white/5 px-3 py-2 last:border-b-0"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-[var(--landing-accent)]" />
                <span className="w-16 font-ds-mono text-[9px] text-white/25">
                  {row.id}
                </span>
                <span className="min-w-0 flex-1 truncate font-ds-mono text-[10px] text-white/60">
                  {row.project}
                </span>
                <span className="font-ds-mono text-[9px] text-white/25">
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </LandingWindow>
  )
}

function TableVirtualBoundary() {
  return (
    <div className="grid gap-px overflow-hidden rounded-lg border border-white/7 bg-white/7 sm:grid-cols-2">
      <div className="bg-[#0b0b0b] p-4">
        <p className="font-ds-mono text-[9px] uppercase tracking-[0.13em] text-[var(--landing-accent)]">
          Table
        </p>
        <p className="mt-2 text-ds-body-xs text-white/40">
          Owns columns, row models, feature state, and the data handed to your
          renderer.
        </p>
      </div>
      <div className="bg-[#0b0b0b] p-4">
        <p className="font-ds-mono text-[9px] uppercase tracking-[0.13em] text-[var(--landing-accent)]">
          Virtual
        </p>
        <p className="mt-2 text-ds-body-xs text-white/40">
          Measures the scroll surface and limits which rows or columns are
          mounted. Pair it with Table when rendering volume demands it.
        </p>
      </div>
    </div>
  )
}

function StateSwitchboard() {
  const [owner, setOwner] = React.useState<StateOwner>('url')
  const selected = stateOwners[owner]

  return (
    <LandingWindow label="sorting ownership">
      <div className="p-5 sm:p-6">
        <div
          aria-label="Choose who owns sorting state"
          className="grid gap-2 sm:grid-cols-3"
          role="group"
        >
          {(['component', 'url', 'server'] as const).map((item) => (
            <button
              key={item}
              aria-pressed={owner === item}
              className="rounded-lg border border-white/8 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)] aria-pressed:border-[var(--landing-accent)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.1)]"
              onClick={() => setOwner(item)}
              type="button"
            >
              <span className="font-ds-mono text-[9px] uppercase tracking-[0.13em] text-white/30">
                owned by
              </span>
              <span className="mt-1 block text-ds-label-md capitalize text-white">
                {item}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-white/6 bg-black/35 p-4">
          <code className="font-ds-mono text-xs text-[var(--landing-accent-bright)]">
            {selected.code}
          </code>
          <p className="mt-3 text-ds-body-xs text-white/35">{selected.note}</p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {selected.path.split(' → ').map((step, index) => (
            <React.Fragment key={step}>
              {index > 0 ? <span className="text-white/15">→</span> : null}
              <span className="rounded-md bg-white/[0.035] px-3 py-2 font-ds-mono text-[10px] text-white/55">
                {step}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </LandingWindow>
  )
}

function StatusBadge({ status }: { status: TableIssue['status'] }) {
  return (
    <span
      className={`inline-flex rounded px-2 py-1 font-ds-mono text-[9px] uppercase tracking-[0.1em] ${status === 'active' ? 'bg-emerald-400/12 text-emerald-300' : status === 'review' ? 'bg-amber-400/12 text-amber-300' : 'bg-blue-400/12 text-blue-300'}`}
    >
      {status}
    </span>
  )
}

function getCellClassName(columnId: string) {
  if (columnId === 'select') return 'w-12 px-3 py-3'
  if (columnId === 'score') return 'w-16 px-3 py-3'
  if (columnId === 'status') return 'w-24 px-3 py-3'
  if (columnId === 'owner') return 'w-24 px-3 py-3'
  return 'min-w-0 px-3 py-3'
}
