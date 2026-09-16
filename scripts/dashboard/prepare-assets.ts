import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { snapshotSchema } from '../../src/components/dashboard/model'
import { tripCsv } from '../../src/components/dashboard/csv'
const snapshot = snapshotSchema.parse(
  JSON.parse(
    await readFile('public/data/dashboard/green-2025-week1.v1.json', 'utf8'),
  ),
)
const zones = new Map(snapshot.zones.map((zone) => [zone.id, zone]))
const rows = snapshot.trips
  .map((trip) => {
    const zone = zones.get(trip.zoneId)
    if (!zone) throw new Error('Missing zone')
    return { ...trip, zone: zone.name, borough: zone.borough }
  })
  .sort((a, b) => a.pickup.localeCompare(b.pickup) || a.id - b.id)
await mkdir('/tmp/dashboard-assets', { recursive: true })
await writeFile('/tmp/dashboard-assets/trips.csv', tripCsv(rows) + '\r\n')
console.log(
  `Prepared ${rows.length} records in /tmp/dashboard-assets/trips.csv`,
)
