import type { RecordRow } from './model'
export function tripCsv(rows: readonly RecordRow[]) {
  const escape = (value: string | number) =>
    `"${String(value).replaceAll('"', '""')}"`
  return [
    [
      'Trip ID',
      'Pickup NYC time',
      'Borough',
      'Pickup zone',
      'Minutes',
      'Miles',
      'Base fare USD',
    ],
    ...rows.map((row) => [
      row.id,
      row.pickup.replace('T', ' '),
      row.borough,
      row.zone,
      row.minutes,
      row.miles,
      (row.fareCents / 100).toFixed(2),
    ]),
  ]
    .map((row) => row.map(escape).join(','))
    .join('\r\n')
}
