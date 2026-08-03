import * as React from 'react'
import {
  cellSelectionFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type Cell,
  type ColumnFiltersState,
  type ColumnDef,
  type ColumnVisibilityState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import { useHotkeys } from '@tanstack/react-hotkeys'
import {
  BracketsCurlyIcon,
  CaretDownIcon,
  CaretUpIcon,
  MagnifyingGlassIcon,
  RowsIcon,
  SlidersHorizontalIcon,
  StackIcon,
} from '@phosphor-icons/react'
import { Badge } from '~/ui/Badge'

import {
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const tablePrompt =
  'Build a TanStack Table V9 data grid for a TypeScript app. Keep it headless. Define a stable tableFeatures object with only the feature plugins, create*RowModel slots, and function registries the product needs. Use TanStack Store-backed table state, selectors, or table.Subscribe for reactive reads, and external atoms only for slices the app must own. Render semantic table elements and synchronize state to the URL or server only where the product needs it.'

type TableIssue = {
  id: string
  owner: string
  project: string
  score: number
  status: 'active' | 'review' | 'shipped'
}

type StatusFilter = 'all' | TableIssue['status']
type StateMode = 'selected' | 'subscribed' | 'external'

const tableWorkbenchFeatures = tableFeatures({
  cellSelectionFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
})

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

const tableResponsibilities = ['State', 'Row processing', 'Typed APIs'] as const

const developerControls = [
  'Markup & semantics',
  'Styles & components',
  'Events & interactions',
] as const

const stateModes: Record<
  StateMode,
  { code: string; note: string; path: string }
> = {
  selected: {
    code: 'const sorting = table.state.sorting',
    note: 'Select the state a component needs when creating its table instance.',
    path: 'table store → selected state → component',
  },
  subscribed: {
    code: '<table.Subscribe selector={(state) => state.sorting}>',
    note: 'Move a reactive read to the smallest part of the tree that renders it.',
    path: 'sorting atom → subscription island → UI',
  },
  external: {
    code: 'atoms: { sorting: sortingAtom }',
    note: 'Give an external TanStack Store atom ownership when other systems share the slice.',
    path: 'external atom → table feature → app',
  },
}

const rowModelStages = [
  {
    code: 'automatic',
    label: 'Core',
    note: 'data to rows',
  },
  {
    code: 'createFilteredRowModel()',
    label: 'Filter',
    note: 'column + global',
  },
  {
    code: 'createGroupedRowModel()',
    label: 'Group',
    note: 'grouped rows',
  },
  {
    code: 'createSortedRowModel()',
    label: 'Sort',
    note: 'ordered rows',
  },
  {
    code: 'createExpandedRowModel()',
    label: 'Expand',
    note: 'visible sub-rows',
  },
  {
    code: 'createPaginatedRowModel()',
    label: 'Paginate',
    note: 'current page',
  },
] as const

const tableToolbox = [
  {
    label: 'Custom features',
    code: 'tableFeatures({ densityFeature })',
    detail:
      'Add state, options, and APIs through the same extension system used by built-in features.',
  },
  {
    label: 'Reusable tables',
    code: 'createTableHook({ features, ... })',
    detail:
      'Share typed features, options, column helpers, and registered components across a product.',
  },
  {
    label: 'Devtools',
    code: 'useTanStackTableDevtools(table)',
    detail:
      'Inspect table state and derived data in supported framework integrations instead of logging internals.',
  },
] as const

export default function TableLanding() {
  return (
    <LibraryLandingShell
      description="TanStack Table is a headless engine for sorting, pagination, filtering, faceting, grouping, aggregation, row expansion, row and cell selection, cell spanning, row and column pinning, column ordering, visibility, resizing, and more."
      headline="A powerful engine for building Data Grids."
      hero={<TableWorkbench />}
      libraryId="table"
      prompt={tablePrompt}
      promptLabel="Copy Table prompt"
    >
      <LandingSection tone="ink">
        <div className="grid gap-12 lg:grid-cols-[0.76fr_1.24fr] lg:items-center">
          <LandingSectionIntro
            body="Having 100% control of your code matters more than ever. TanStack Table supplies state and typed APIs without prescribing a single element or style. Use its built-in client-side processing or bring rows processed by your server, then render with any component library or design system, including your own."
            eyebrow="Headless by design"
            icon={<BracketsCurlyIcon aria-hidden="true" size={17} />}
            title="Build exactly the table you want with 100% control."
          />
          <OwnershipModel />
        </div>
      </LandingSection>

      <LandingSection tone="accent">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <LandingSectionIntro
            body="Every registered state slice is backed by TanStack Store, whose fine-grained reactivity is built on alien-signals. Read selected state from table.state, create local subscription islands with table.Subscribe, or hand ownership to an external writable atom when the rest of the app needs it."
            eyebrow="Fine-grained state"
            icon={<SlidersHorizontalIcon aria-hidden="true" size={17} />}
            title="Put each update on the smallest useful render path."
          />
          <StateSwitchboard />
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <LandingSectionIntro
          body="Every feature is independently tree-shakable, and table objects share feature methods in memory. Client-side row-model stages memoize derived work. When processing moves to the server, manual modes bypass those stages and consume the rows you provide."
          eyebrow="Performance architecture"
          icon={<RowsIcon aria-hidden="true" size={17} />}
          title="Deliberate bundles, allocations, and row processing."
        />
        <RowModelPipeline />
      </LandingSection>

      <LandingSection tone="accent">
        <LandingSectionIntro
          body="TanStack Table exposes its own architecture as a public toolkit. Extend it with typed features, package shared conventions into reusable table hooks and options, and inspect live instances with dedicated Devtools."
          eyebrow="Composition and tooling"
          icon={<StackIcon aria-hidden="true" size={17} />}
          title="Build one table or build your product's table system."
        />
        <TableToolbox />
      </LandingSection>
    </LibraryLandingShell>
  )
}

function TableWorkbench() {
  const gridRef = React.useRef<HTMLDivElement>(null)
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'score', desc: true },
  ])
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>({ owner: false })
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

  const columns = React.useMemo<
    Array<ColumnDef<typeof tableWorkbenchFeatures, TableIssue>>
  >(
    () => [
      {
        id: 'select',
        enableCellSelection: false,
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
                input.indeterminate =
                  table.getIsSomePageRowsSelected() &&
                  !table.getIsAllPageRowsSelected()
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
      {
        accessorKey: 'project',
        header: 'Project',
        sortFn: sortFn_alphanumeric,
      },
      {
        accessorKey: 'owner',
        header: 'Owner',
        sortFn: sortFn_alphanumeric,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => (
          <StatusBadge status={getValue<TableIssue['status']>()} />
        ),
        filterFn: (row, columnId, value) =>
          row.getValue<TableIssue['status']>(columnId) === value,
        sortFn: sortFn_alphanumeric,
      },
      { accessorKey: 'score', header: 'Score', sortFn: sortFn_basic },
    ],
    [],
  )

  const table = useTable({
    features: tableWorkbenchFeatures,
    columns,
    data: tableRows,
    enableCellSelection: true,
    enableRowSelection: true,
    getRowId: (row) => row.id,
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

  useHotkeys(
    [
      { hotkey: 'ArrowUp', callback: () => table.moveCellSelection('up') },
      { hotkey: 'ArrowDown', callback: () => table.moveCellSelection('down') },
      { hotkey: 'ArrowLeft', callback: () => table.moveCellSelection('left') },
      {
        hotkey: 'ArrowRight',
        callback: () => table.moveCellSelection('right'),
      },
      {
        hotkey: 'Shift+ArrowUp',
        callback: () => table.extendCellSelection('up'),
      },
      {
        hotkey: 'Shift+ArrowDown',
        callback: () => table.extendCellSelection('down'),
      },
      {
        hotkey: 'Shift+ArrowLeft',
        callback: () => table.extendCellSelection('left'),
      },
      {
        hotkey: 'Shift+ArrowRight',
        callback: () => table.extendCellSelection('right'),
      },
      { hotkey: 'Mod+A', callback: () => table.selectAllCells() },
      { hotkey: 'Escape', callback: () => table.resetCellSelection(true) },
    ],
    { preventDefault: true, target: gridRef },
  )

  const filteredRows = table.getFilteredRowModel().rows.length
  const selectedRows = table.getSelectedRowModel().rows.length
  const selectedCells = table.getSelectedCellCount()

  return (
    <LandingWindow label="issue workbench">
      <div className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="flex min-w-0 items-center gap-2 rounded-lg border border-border-subtle bg-text-primary/[0.025] px-3 py-2">
            <MagnifyingGlassIcon
              aria-hidden="true"
              className="shrink-0 text-[var(--landing-accent-bright)]"
              size={15}
            />
            <span className="sr-only">Search projects and owners</span>
            <input
              className="min-w-0 flex-1 bg-transparent font-ds-mono text-ds-mono-xs text-text-primary outline-none placeholder:text-text-primary/20"
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
                className="rounded-md border border-border-subtle px-2.5 py-2 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:bg-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-ink)]"
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
                  className="rounded-md border border-border-subtle px-2 py-1 font-ds-mono text-ds-mono-2xs capitalize text-text-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:bg-text-primary/8 aria-pressed:text-text-primary/60"
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
            className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25"
          >
            {filteredRows} rows · {selectedRows} selected
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            className="rounded-md border border-border-subtle px-2.5 py-1.5 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] disabled:opacity-25"
            disabled={selectedCells === 0}
            onClick={() => table.resetCellSelection(true)}
            type="button"
          >
            Clear cells
          </button>
        </div>

        <div
          ref={gridRef}
          aria-label="Issue table with selectable cells"
          className="mt-3 overflow-x-auto rounded-lg border border-border-subtle"
          role="region"
        >
          <table className="w-full min-w-[36rem] table-fixed border-collapse text-left">
            <thead className="border-b border-border-subtle bg-text-primary/[0.035]">
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
                            className="flex w-full items-center gap-1 rounded-sm font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)]"
                            onClick={header.column.getToggleSortingHandler()}
                            type="button"
                          >
                            <table.FlexRender header={header} />
                            {sort === 'asc' ? (
                              <CaretUpIcon aria-hidden="true" size={11} />
                            ) : sort === 'desc' ? (
                              <CaretDownIcon aria-hidden="true" size={11} />
                            ) : null}
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="bg-background-default transition-colors hover:bg-text-primary/[0.025] data-[selected=true]:bg-[color:rgb(var(--landing-glow)/0.1)]"
                    data-selected={row.getIsSelected()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`${getCellClassName(cell.column.id)} ${getCellSelectionClassName(cell)}`}
                        onMouseDown={
                          cell.getCanSelect()
                            ? cell.getSelectionStartHandler()
                            : undefined
                        }
                        onMouseEnter={
                          cell.getCanSelect()
                            ? cell.getSelectionExtendHandler()
                            : undefined
                        }
                        style={getCellSelectionStyle(cell)}
                        tabIndex={
                          cell.getCanSelect() ? cell.getTabIndex() : undefined
                        }
                      >
                        <span className="block truncate font-ds-mono text-ds-mono-2xs text-text-primary/65">
                          <table.FlexRender cell={cell} />
                        </span>
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-4 py-8 text-center font-ds-mono text-ds-mono-2xs text-text-primary/30"
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
              className="rounded-md border border-border-subtle px-3 py-1.5 text-ds-label-sm text-text-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] disabled:opacity-20"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              type="button"
            >
              Prev
            </button>
            <button
              className="rounded-md border border-border-subtle px-3 py-1.5 text-ds-label-sm text-text-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] disabled:opacity-20"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              type="button"
            >
              Next
            </button>
          </div>
          <span className="font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
            page {table.state.pagination.pageIndex + 1} /{' '}
            {Math.max(table.getPageCount(), 1)}
          </span>
        </div>
      </div>
    </LandingWindow>
  )
}

function OwnershipModel() {
  return (
    <LandingWindow label="headless ownership">
      <div className="grid gap-px bg-border-subtle sm:grid-cols-2">
        <div className="bg-background-surface p-5 sm:p-6">
          <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
            TanStack Table handles
          </p>
          <p className="mt-3 text-ds-title-sm text-text-primary">
            Headless table logic
          </p>
          <div className="mt-6 space-y-2">
            {tableResponsibilities.map((responsibility) => (
              <div
                key={responsibility}
                className="rounded-lg border border-border-subtle bg-background-default px-3 py-2.5 font-ds-mono text-ds-mono-xs text-text-primary/50"
              >
                {responsibility}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-background-surface p-5 sm:p-6">
          <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
            You control
          </p>
          <p className="mt-3 text-ds-title-sm text-text-primary">
            100% of the rendered result
          </p>
          <div className="mt-6 space-y-2">
            {developerControls.map((control) => (
              <div
                key={control}
                className="rounded-lg border border-[var(--landing-accent)] bg-[var(--landing-accent)]/5 px-3 py-2.5 font-ds-mono text-ds-mono-xs text-text-primary/70"
              >
                {control}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border-subtle bg-background-default p-5 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-6">
        <div>
          <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/30">
            Works with your stack
          </p>
          <p className="mt-2 text-ds-body-xs text-text-primary/60">
            Use any component library or design system, including your own.
          </p>
        </div>
        <code className="mt-4 block shrink-0 font-ds-mono text-ds-mono-xs text-[var(--landing-accent-bright)] sm:mt-0">
          headless logic → your UI
        </code>
      </div>
    </LandingWindow>
  )
}

function StateSwitchboard() {
  const [mode, setMode] = React.useState<StateMode>('subscribed')
  const selected = stateModes[mode]

  return (
    <LandingWindow label="sorting reactivity">
      <div className="p-5 sm:p-6">
        <div
          aria-label="Choose how sorting state is consumed"
          className="grid gap-2 sm:grid-cols-3"
          role="group"
        >
          {(['selected', 'subscribed', 'external'] as const).map((item) => (
            <button
              key={item}
              aria-pressed={mode === item}
              className="rounded-lg border border-border-subtle p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:bg-[color:rgb(var(--landing-glow)/0.1)]"
              onClick={() => setMode(item)}
              type="button"
            >
              <span className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/30">
                state mode
              </span>
              <span className="mt-1 block text-ds-label-md capitalize text-text-primary">
                {item}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-border-subtle bg-background-subtle p-4">
          <code className="font-ds-mono text-ds-mono-xs text-[var(--landing-accent-bright)]">
            {selected.code}
          </code>
          <p className="mt-3 text-ds-body-xs text-text-primary/35">
            {selected.note}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {selected.path.split(' → ').map((step, index) => (
            <React.Fragment key={step}>
              {index > 0 ? (
                <span className="text-text-primary/15">→</span>
              ) : null}
              <span className="rounded-md bg-text-primary/[0.035] px-3 py-2 font-ds-mono text-ds-mono-2xs text-text-primary/55">
                {step}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </LandingWindow>
  )
}

function RowModelPipeline() {
  return (
    <div className="mt-10">
      <LandingWindow label="client-side row-model pipeline">
        <div className="grid gap-2 p-5 sm:grid-cols-2 lg:grid-cols-6 lg:p-6">
          {rowModelStages.map((stage, index) => (
            <div
              key={stage.label}
              className="relative rounded-xl border border-border-subtle bg-background-surface p-4"
            >
              <p className="font-ds-mono text-ds-mono-2xs text-[var(--landing-accent-bright)]">
                {String(index + 1).padStart(2, '0')}
              </p>
              <p className="mt-5 text-ds-label-md text-text-primary">
                {stage.label}
              </p>
              <code className="mt-2 block break-all font-ds-mono text-ds-mono-2xs leading-relaxed text-text-primary/35">
                {stage.code}
              </code>
              <p className="mt-5 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/25">
                {stage.note}
              </p>
              {index < rowModelStages.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-2 top-8 z-10 hidden size-4 rotate-45 border-r border-t border-[var(--landing-accent)] bg-background-surface lg:block"
                />
              ) : null}
            </div>
          ))}
        </div>
        <div className="border-t border-border-subtle bg-background-default px-5 py-4 text-ds-body-xs text-text-primary/45 lg:px-6">
          Each registered stage memoizes its derived work. Unregistered or
          manual stages pass the previous row model through.
        </div>
      </LandingWindow>
    </div>
  )
}

function TableToolbox() {
  return (
    <div className="mt-10 grid gap-3 lg:grid-cols-3">
      {tableToolbox.map((tool) => (
        <article
          key={tool.label}
          className="rounded-xl border border-border-subtle bg-background-surface p-5"
        >
          <p className="text-ds-label-md text-text-primary">{tool.label}</p>
          <code className="mt-4 block break-words font-ds-mono text-ds-mono-xs text-[var(--landing-accent-bright)]">
            {tool.code}
          </code>
          <p className="mt-4 text-ds-body-xs text-text-primary/40">
            {tool.detail}
          </p>
        </article>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: TableIssue['status'] }) {
  return (
    <Badge
      variant={
        status === 'active'
          ? 'success'
          : status === 'review'
            ? 'warning'
            : 'info'
      }
      className="rounded font-ds-mono text-ds-mono-caps-xs uppercase"
    >
      {status}
    </Badge>
  )
}

function getCellClassName(columnId: string) {
  if (columnId === 'select') return 'w-12 px-3 py-3'
  if (columnId === 'score') return 'w-16 px-3 py-3'
  if (columnId === 'status') return 'w-24 px-3 py-3'
  if (columnId === 'owner') return 'w-24 px-3 py-3'
  return 'min-w-0 px-3 py-3'
}

function getCellSelectionClassName(
  cell: Cell<typeof tableWorkbenchFeatures, TableIssue>,
) {
  return [
    'focus-visible:outline-none',
    cell.getCanSelect() && 'cursor-cell select-none',
    cell.getIsSelected() &&
      'bg-[color:rgb(var(--landing-glow)/0.16)] text-text-primary',
    cell.getIsFocused() &&
      'outline outline-1 -outline-offset-2 outline-[var(--landing-accent-bright)]',
  ]
    .filter(Boolean)
    .join(' ')
}

function getCellSelectionStyle(
  cell: Cell<typeof tableWorkbenchFeatures, TableIssue>,
): React.CSSProperties | undefined {
  if (!cell.getIsSelected()) return undefined

  const edges = cell.getSelectionEdges()
  const shadows = [
    edges.top && 'inset 0 2px 0 var(--landing-accent)',
    edges.right && 'inset -2px 0 0 var(--landing-accent)',
    edges.bottom && 'inset 0 -2px 0 var(--landing-accent)',
    edges.left && 'inset 2px 0 0 var(--landing-accent)',
  ].filter(Boolean)

  return { boxShadow: shadows.join(', ') }
}
