import { AsyncLocalStorage } from 'node:async_hooks'

type Operation = 'get' | 'put' | 'list' | 'delete'
type Counts = { get: number; put: number; list: number; delete: number }
type Measurement = {
  source: string
  counts: Map<string, Counts>
}

const measurements = new AsyncLocalStorage<Measurement>()

// Count attempts, including failed requests. Never log object keys or bodies.
export function recordBlobStorageOperation(
  bucket: string,
  operation: Operation,
) {
  const measurement = measurements.getStore()
  if (!measurement) return
  const key = `${bucket}:${measurement.source}`
  let counts = measurement.counts.get(key)
  if (!counts) {
    counts = { get: 0, put: 0, list: 0, delete: 0 }
    measurement.counts.set(key, counts)
  }
  counts[operation] += 1
}

export async function measureBlobStorageOperations<T>(
  source: string,
  work: () => Promise<T>,
): Promise<T> {
  const parent = measurements.getStore()
  const counts = parent?.counts ?? new Map<string, Counts>()
  try {
    return await measurements.run({ source, counts }, work)
  } finally {
    const sampleRate =
      source.startsWith('mark') ||
      source.endsWith('-invalidation') ||
      source === 'pruneStaleCacheRows'
        ? 1
        : 0.01
    if (!parent && counts.size && Math.random() < sampleRate) {
      console.log(
        JSON.stringify({
          event: 'r2_operations',
          source,
          sampleRate,
          operations: Object.fromEntries(counts),
        }),
      )
    }
  }
}
