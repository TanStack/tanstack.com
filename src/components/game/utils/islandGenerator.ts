// Procedural island generation for TanStack libraries
import type { LibrarySlim } from '~/libraries/types'

export interface IslandLobe {
  offsetX: number
  offsetZ: number
  scale: number // Relative to main island scale
}

// Slim partner data for the game (avoids importing full partners with images)
export interface PartnerSlim {
  id: string
  name: string
  href: string
  brandColor?: string
}

export interface IslandData {
  id: string
  type: 'library' | 'partner' | 'showcase'
  position: [number, number, number]
  rotation: number
  scale: number
  library?: LibrarySlim
  partner?: PartnerSlim
  palmCount: number
  hasCoconuts: boolean
  hasTikiShack: boolean
  elongation: number
  bumpiness: number
  lobes: IslandLobe[] // Additional spherical caps that make up the island
}

// Seeded random for consistent generation
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Popularity/size ranking (0-1 scale, higher = bigger island)
// Based on npm downloads and community usage
const LIBRARY_POPULARITY: Record<string, number> = {
  query: 1.0, // Most popular - millions of weekly downloads
  table: 0.85, // Very popular
  router: 0.75, // Growing fast
  virtual: 0.6, // Solid usage
  form: 0.5, // Newer but growing
  start: 0.45, // New framework
  store: 0.3, // Core utility
  db: 0.35, // New
  ai: 0.3, // New
  pacer: 0.25, // New utility
  ranger: 0.2, // Niche
  config: 0.2, // Tooling
  devtools: 0.25, // Tooling
}

const INNER_RADIUS = 15
const OUTER_RADIUS = 60
const MIN_ISLAND_DISTANCE = 12

// World boundary - square bounds for the playable area
export const WORLD_BOUNDARY = 85

export function generateIslands(libraries: LibrarySlim[]): IslandData[] {
  // Filter to only libraries with pages (have a `to` property)
  const validLibraries = libraries.filter((lib) => lib.to)

  const islands: IslandData[] = []
  const positions: [number, number][] = []

  validLibraries.forEach((library, index) => {
    const seed = index * 12345

    // Distribute islands in a spiral pattern with some randomness
    const baseAngle = (index / validLibraries.length) * Math.PI * 2
    const angleOffset = (seededRandom(seed) - 0.5) * 0.4
    const angle = baseAngle + angleOffset

    // Vary radius based on index to create spiral effect
    const radiusVariation = seededRandom(seed + 1)
    const radius =
      INNER_RADIUS + radiusVariation * (OUTER_RADIUS - INNER_RADIUS)

    let x = Math.cos(angle) * radius
    let z = Math.sin(angle) * radius

    // Push islands apart if too close
    for (const [px, pz] of positions) {
      const dx = x - px
      const dz = z - pz
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < MIN_ISLAND_DISTANCE) {
        const pushStrength = (MIN_ISLAND_DISTANCE - dist) / dist
        x += dx * pushStrength * 0.5
        z += dz * pushStrength * 0.5
      }
    }

    positions.push([x, z])

    // Visual variation - scale based on popularity with some randomness
    const popularity = LIBRARY_POPULARITY[library.id] ?? 0.3
    const baseScale = 0.6 + popularity * 0.6 // 0.6 to 1.2 based on popularity
    const scale = baseScale + (seededRandom(seed + 2) - 0.5) * 0.15 // ±0.075 random variation
    const rotation = seededRandom(seed + 3) * Math.PI * 2
    const palmCount = 3 + Math.floor(seededRandom(seed + 4) * 4) // 3-6 palm trees
    const hasCoconuts = seededRandom(seed + 5) > 0.6 // 40% chance of coconuts
    const hasTikiShack = popularity >= 0.7 // Only on larger/popular islands
    const elongation = 0.8 + seededRandom(seed + 7) * 0.4 // 0.8-1.2 elongation
    const bumpiness = 0.3 + seededRandom(seed + 8) * 0.7 // 0.3-1.0 bumpiness

    // Generate lobes (additional spherical caps) for organic shape
    // 0-2 additional lobes based on randomness
    const lobeCount = Math.floor(seededRandom(seed + 9) * 3) // 0, 1, or 2
    const lobes: IslandLobe[] = []
    for (let i = 0; i < lobeCount; i++) {
      const lobeSeed = seed + 100 + i * 10
      const angle = seededRandom(lobeSeed) * Math.PI * 2
      const distance = 1.5 + seededRandom(lobeSeed + 1) * 1.0 // Distance from center
      const lobeScale = 0.5 + seededRandom(lobeSeed + 2) * 0.4 // 50-90% of main scale
      lobes.push({
        offsetX: Math.cos(angle) * distance,
        offsetZ: Math.sin(angle) * distance,
        scale: lobeScale,
      })
    }

    islands.push({
      id: library.id,
      type: 'library',
      position: [x, 0, z],
      rotation,
      scale,
      library,
      palmCount,
      hasCoconuts,
      hasTikiShack,
      elongation,
      bumpiness,
      lobes,
    })
  })

  return islands
}

// Get distance between boat and island
export function getIslandDistance(
  boatPos: [number, number, number],
  islandPos: [number, number, number],
): number {
  const dx = boatPos[0] - islandPos[0]
  const dz = boatPos[2] - islandPos[2]
  return Math.sqrt(dx * dx + dz * dz)
}

// Find the nearest island within interaction range
export function findNearestIsland(
  boatPos: [number, number, number],
  islands: IslandData[],
  maxDistance: number = 8,
): IslandData | null {
  let nearest: IslandData | null = null
  let nearestDist = maxDistance

  for (const island of islands) {
    const dist = getIslandDistance(boatPos, island.position)
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = island
    }
  }

  return nearest
}

// Generate expanded zone islands for partners (placed in outer ring after upgrade)
const EXPANDED_INNER_RADIUS = 90 // Just outside the initial world boundary
const EXPANDED_OUTER_RADIUS = 160

export function generateExpandedIslands(partners: PartnerSlim[]): IslandData[] {
  const islands: IslandData[] = []
  const positions: [number, number][] = []

  partners.forEach((partner, index) => {
    const seed = (index + 100) * 54321

    // Distribute in a ring around the expanded zone
    const baseAngle = (index / partners.length) * Math.PI * 2
    const angleOffset = (seededRandom(seed) - 0.5) * 0.3
    const angle = baseAngle + angleOffset

    const radiusVariation = seededRandom(seed + 1)
    const radius =
      EXPANDED_INNER_RADIUS +
      radiusVariation * (EXPANDED_OUTER_RADIUS - EXPANDED_INNER_RADIUS)

    let x = Math.cos(angle) * radius
    let z = Math.sin(angle) * radius

    // Push islands apart if too close
    for (const [px, pz] of positions) {
      const dx = x - px
      const dz = z - pz
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < MIN_ISLAND_DISTANCE * 1.5) {
        const pushStrength = (MIN_ISLAND_DISTANCE * 1.5 - dist) / dist
        x += dx * pushStrength * 0.5
        z += dz * pushStrength * 0.5
      }
    }

    positions.push([x, z])

    // Partner islands are larger and more impressive
    const scale = 0.9 + seededRandom(seed + 2) * 0.4 // 0.9 to 1.3
    const rotation = seededRandom(seed + 3) * Math.PI * 2
    const palmCount = 4 + Math.floor(seededRandom(seed + 4) * 5) // 4-8 palm trees
    const hasCoconuts = seededRandom(seed + 5) > 0.4
    const hasTikiShack = true // All partner islands have tiki shacks
    const elongation = 0.9 + seededRandom(seed + 7) * 0.3
    const bumpiness = 0.4 + seededRandom(seed + 8) * 0.6

    // More lobes for partner islands
    const lobeCount = 1 + Math.floor(seededRandom(seed + 9) * 2) // 1-2 lobes
    const lobes: IslandLobe[] = []
    for (let i = 0; i < lobeCount; i++) {
      const lobeSeed = seed + 100 + i * 10
      const lobeAngle = seededRandom(lobeSeed) * Math.PI * 2
      const distance = 1.8 + seededRandom(lobeSeed + 1) * 1.2
      const lobeScale = 0.55 + seededRandom(lobeSeed + 2) * 0.35
      lobes.push({
        offsetX: Math.cos(lobeAngle) * distance,
        offsetZ: Math.sin(lobeAngle) * distance,
        scale: lobeScale,
      })
    }

    islands.push({
      id: `partner-${partner.id}`,
      type: 'partner',
      position: [x, 0, z],
      rotation,
      scale,
      partner,
      palmCount,
      hasCoconuts,
      hasTikiShack,
      elongation,
      bumpiness,
      lobes,
    })
  })

  return islands
}
