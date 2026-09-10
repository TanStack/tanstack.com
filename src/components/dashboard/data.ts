import {
  createCollection,
  localOnlyCollectionOptions,
} from '@tanstack/react-db'
import { type Snapshot } from './model'

export { snapshotOptions } from './query-options'

// Query owns the immutable file cache. These route-owned, read-only collections
// exist only while the dashboard is mounted and never write back to the file.
export function createSnapshotCollections(snapshot: Snapshot) {
  return {
    trips: createCollection(
      localOnlyCollectionOptions({
        initialData: snapshot.trips,
        getKey: (trip) => trip.id,
      }),
    ),
    zones: createCollection(
      localOnlyCollectionOptions({
        initialData: snapshot.zones,
        getKey: (zone) => zone.id,
      }),
    ),
  }
}
