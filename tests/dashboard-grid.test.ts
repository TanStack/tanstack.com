import { test } from 'node:test'
import { useTripGrid } from '../src/components/dashboard/TripTable'
import { gridRequestSchema } from '../src/components/dashboard/request'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { useTable } from '@tanstack/react-table'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { snapshotSchema } from '../src/components/dashboard/model'
import {
  gridFeatures,
  gridColumns,
  tripCsv,
} from '../src/components/dashboard/grid'

const snapshot = snapshotSchema.parse(
  JSON.parse(
    readFileSync('public/data/dashboard/green-2025-week1.v1.json', 'utf8'),
  ),
)
const zones = new Map(snapshot.zones.map((zone) => [zone.id, zone]))
const rows = snapshot.trips.map((trip) => ({
  ...trip,
  zone: zones.get(trip.zoneId)?.name ?? '',
  borough: zones.get(trip.zoneId)?.borough ?? '',
}))
function useTestTable() {
  return useTable({
    features: gridFeatures,
    columns: gridColumns,
    data: rows,
    getRowId: (row) => String(row.id),
    globalFilterFn: 'includesString',
    initialState: { pagination: { pageIndex: 0, pageSize: 50 } },
  })
}

function grid() {
  let table: ReturnType<typeof useTestTable> | undefined
  function Harness() {
    table = useTestTable()
    return null
  }
  renderToStaticMarkup(createElement(Harness))
  assert.ok(table)
  return table
}

test('grid sorts numeric fare values before paginating, rather than formatted dollar strings', () => {
  const table = grid()
  table.setSorting([{ id: 'fareCents', desc: true }])
  const sorted = table.getSortedRowModel().rows
  assert.equal(sorted.length, 8936)
  assert.ok(
    sorted.every(
      (row, index) =>
        index === 0 ||
        sorted[index - 1].original.fareCents >= row.original.fareCents,
    ),
  )
  assert.equal(table.getRowModel().rows.length, 50)
  assert.equal(table.getRowModel().rows[0].id, sorted[0].id)
})

test('column ranges, global search, and facets operate on the full filtered dataset', () => {
  const table = grid()
  table.setColumnFilters([
    { id: 'borough', value: 'Queens' },
    { id: 'fareCents', value: [10, 30] },
  ])
  const expected = rows.filter(
    (row) =>
      row.borough === 'Queens' &&
      row.fareCents >= 1000 &&
      row.fareCents <= 3000,
  )
  assert.equal(table.getFilteredRowModel().rows.length, expected.length)
  table.setGlobalFilter('Forest Hills')
  assert.equal(
    table.getFilteredRowModel().rows.length,
    expected.filter((row) => row.zone === 'Forest Hills').length,
  )
  const boroughColumn = table.getColumn('borough')
  assert.ok(boroughColumn)
  assert.ok(boroughColumn.getFacetedUniqueValues().has('Queens'))
})

test('group totals match the source and expanding preserves children', () => {
  const table = grid()
  table.setGrouping(['borough'])
  const groups = table.getGroupedRowModel().rows
  const total = groups.reduce((sum, row) => {
    const value = row.getValue('fareCents')
    assert.equal(typeof value, 'number')
    return sum + Number(value)
  }, 0)
  assert.equal(
    Math.round(total * 100),
    rows.reduce((sum, row) => sum + row.fareCents, 0),
  )
  table.setExpanded(true)
  assert.ok(table.getExpandedRowModel().rows.length > rows.length)
})

test('selection tracks stable trip IDs and filtered selection excludes hidden records', () => {
  const table = grid()
  const trip = rows.find((row) => row.borough === 'Queens')
  assert.ok(trip)
  table.setRowSelection({ [trip.id]: true })
  table.setSorting([{ id: 'minutes', desc: true }])
  assert.equal(table.getSelectedRowModel().rows[0].original.id, trip.id)
  table.setColumnFilters([{ id: 'borough', value: 'Manhattan' }])
  assert.equal(table.getFilteredSelectedRowModel().rows.length, 0)
})

test('column pinning, order and visibility compose without losing columns', () => {
  const table = grid()
  table.setColumnPinning({ start: ['select', 'id'], end: ['fareCents'] })
  table.setColumnVisibility({ borough: false })
  const visible = table
    .getRowModel()
    .rows[0].getVisibleCells()
    .map((cell) => cell.column.id)
  assert.deepEqual(visible.slice(0, 2), ['select', 'id'])
  assert.equal(visible.at(-1), 'fareCents')
  assert.ok(!visible.includes('borough'))
})

test('CSV keeps numeric amounts and escapes commas and quotes', () => {
  const csv = tripCsv([
    { ...rows[0], zone: 'A, "quoted" zone', fareCents: 1234 },
  ])
  assert.ok(csv.includes('"A, ""quoted"" zone"'))
  assert.ok(csv.endsWith('"12.34"'))
  assert.equal(csv.split('\r\n').length, 2)
})

test('client pagination exposes the full row count and stable IDs across pages', () => {
  const table = grid()
  const first = table.getRowModel().rows[0].id
  table.setPageIndex(1)
  assert.equal(table.getPrePaginatedRowModel().rows.length, rows.length)
  assert.equal(table.getRowModel().rows.length, 50)
  assert.notEqual(table.getRowModel().rows[0].id, first)
  assert.equal(table.getRow(first).original.id, Number(first))
})

test('controlled grid search accepts functional updaters and resets pagination', () => {
  let next = gridRequestSchema.parse({ query: 'Forest', page: 3 })
  let controller: ReturnType<typeof useTripGrid> | undefined
  function Harness() {
    controller = useTripGrid(rows, undefined, {
      state: next,
      onChange: (value) => {
        next = value
      },
    })
    return null
  }
  renderToStaticMarkup(createElement(Harness))
  assert.ok(controller)
  controller.table.setGlobalFilter((previous: string) => `${previous} Hills`)
  assert.equal(next.query, 'Forest Hills')
  assert.equal(next.page, 0)
})
