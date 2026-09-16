export function nextGridCell(
  key: string,
  row: number,
  column: number,
  rowCount: number,
  columnCount: number,
  pageRows: number,
  modifier: boolean,
) {
  switch (key) {
    case 'ArrowUp':
      row--
      break
    case 'ArrowDown':
      row++
      break
    case 'ArrowLeft':
      column--
      break
    case 'ArrowRight':
      column++
      break
    case 'Home':
      column = 0
      if (modifier) row = 0
      break
    case 'End':
      column = columnCount - 1
      if (modifier) row = rowCount - 1
      break
    case 'PageUp':
      row -= pageRows
      break
    case 'PageDown':
      row += pageRows
      break
    default:
      return undefined
  }
  return {
    row: Math.max(0, Math.min(rowCount - 1, row)),
    column: Math.max(0, Math.min(columnCount - 1, column)),
  }
}
