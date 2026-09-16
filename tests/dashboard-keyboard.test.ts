import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextGridCell } from '../src/components/dashboard/keyboard'
test('keyboard movement clamps at dataset edges and retains the column on vertical movement', () => {
  assert.deepEqual(nextGridCell('ArrowUp', 0, 3, 50, 9, 8, false), {
    row: 0,
    column: 3,
  })
  assert.deepEqual(nextGridCell('ArrowDown', 49, 3, 50, 9, 8, false), {
    row: 49,
    column: 3,
  })
  assert.deepEqual(nextGridCell('PageDown', 8, 3, 50, 9, 8, false), {
    row: 16,
    column: 3,
  })
  assert.deepEqual(nextGridCell('PageUp', 3, 3, 50, 9, 8, false), {
    row: 0,
    column: 3,
  })
})
test('Home and End distinguish a row from the complete loaded page', () => {
  assert.deepEqual(nextGridCell('Home', 25, 3, 50, 9, 8, false), {
    row: 25,
    column: 0,
  })
  assert.deepEqual(nextGridCell('End', 25, 3, 50, 9, 8, false), {
    row: 25,
    column: 8,
  })
  assert.deepEqual(nextGridCell('End', 25, 3, 50, 9, 8, true), {
    row: 49,
    column: 8,
  })
  assert.deepEqual(nextGridCell('Home', 25, 3, 50, 9, 8, true), {
    row: 0,
    column: 0,
  })
  assert.equal(nextGridCell('Tab', 25, 3, 50, 9, 8, false), undefined)
})
