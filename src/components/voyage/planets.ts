// Data for the Space Voyage page (/voyage).
//
// Each TanStack library becomes a "planet" floating in one of three altitude
// bands ("dimensions"). The player flies a star-galleon between bands to
// discover them all — go high, go low.

import { libraries } from '~/libraries'

export interface VoyageBand {
  index: number
  name: string
  subtitle: string
  /** World-space Y altitude for this band. */
  y: number
  /** Accent color used for nebula tint + HUD. */
  color: string
}

export interface Planet {
  id: string
  /** Full library name, e.g. "TanStack Query". */
  name: string
  /** Short label without the "TanStack " prefix. */
  shortName: string
  tagline: string
  /** Where clicking the planet navigates. */
  url: string
  /** Hex brand color. */
  color: string
  band: number
  position: [number, number, number]
  radius: number
}

// Three stacked dimensions the player ascends/descends between.
export const BANDS: VoyageBand[] = [
  {
    index: 0,
    name: 'The Shallows',
    subtitle: 'low orbit',
    y: 0,
    color: '#22d3ee',
  },
  {
    index: 1,
    name: 'The Drift',
    subtitle: 'mid orbit',
    y: 78,
    color: '#a78bfa',
  },
  {
    index: 2,
    name: 'The High Reaches',
    subtitle: 'high orbit',
    y: 156,
    color: '#fbbf24',
  },
]

// Brand color per library id (hex, derived from each library's Tailwind theme).
const PLANET_COLORS: Record<string, string> = {
  query: '#ef4444',
  router: '#10b981',
  start: '#14b8a6',
  table: '#06b6d4',
  form: '#eab308',
  db: '#f97316',
  ai: '#ec4899',
  intent: '#0ea5e9',
  virtual: '#a855f7',
  pacer: '#84cc16',
  hotkeys: '#f43f5e',
  store: '#c2a06b',
  ranger: '#9ca3af',
  config: '#94a3b8',
  devtools: '#cbd5e1',
  mcp: '#d1d5db',
  cli: '#6366f1',
  workflow: '#2563eb',
}

const GOLDEN_ANGLE = 2.399963229728653
const RING_RADII = [46, 74, 102]

/**
 * Build the planet list deterministically (no Math.random at module load so
 * positions are stable across reloads). Libraries are round-robined across the
 * three bands and scattered on golden-angle spokes within each band.
 */
function buildPlanets(): Planet[] {
  const navigable = libraries.filter((lib) => lib.to && lib.tagline)

  // Bucket libraries per band, balanced round-robin.
  const buckets: Array<typeof navigable> = [[], [], []]
  navigable.forEach((lib, i) => {
    buckets[i % BANDS.length].push(lib)
  })

  const planets: Planet[] = []

  buckets.forEach((bucket, bandIndex) => {
    const band = BANDS[bandIndex]
    bucket.forEach((lib, j) => {
      const angle = j * GOLDEN_ANGLE + bandIndex * 1.1
      const ringRadius = RING_RADII[j % RING_RADII.length]
      // Deterministic vertical jitter so planets don't sit on a perfect plane.
      const jitter = Math.sin(j * 12.9898 + bandIndex * 4.1) * 7

      planets.push({
        id: lib.id,
        name: lib.name,
        shortName: lib.name.replace(/^TanStack\s+/, ''),
        tagline: lib.tagline,
        url: lib.to!,
        color: PLANET_COLORS[lib.id] ?? '#64748b',
        band: bandIndex,
        position: [
          Math.cos(angle) * ringRadius,
          band.y + jitter,
          Math.sin(angle) * ringRadius,
        ],
        radius: 5.5 + (j % 3) * 1.6,
      })
    })
  })

  return planets
}

export const PLANETS: Planet[] = buildPlanets()
export const TOTAL_PLANETS = PLANETS.length
