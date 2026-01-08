import type { CoinData } from '../hooks/useGameStore'
import type { IslandData } from './islandGenerator'
import { WORLD_BOUNDARY } from './islandGenerator'

const COIN_COUNT = 50
const MIN_DIST_FROM_ISLAND = 8
const MIN_DIST_FROM_COIN = 5
const MIN_DIST_FROM_CENTER = 10 // Don't spawn too close to start

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

export function generateCoins(islands: IslandData[]): CoinData[] {
  const coins: CoinData[] = []
  const positions: [number, number][] = []

  let attempts = 0
  const maxAttempts = COIN_COUNT * 20

  while (coins.length < COIN_COUNT && attempts < maxAttempts) {
    attempts++
    const seed = attempts * 7919 // Prime number for better distribution

    // Random position within world bounds (with some margin)
    const margin = 10
    const x = (seededRandom(seed) - 0.5) * (WORLD_BOUNDARY - margin) * 2
    const z = (seededRandom(seed + 1) - 0.5) * (WORLD_BOUNDARY - margin) * 2

    // Check distance from center (starting area)
    const distFromCenter = Math.sqrt(x * x + z * z)
    if (distFromCenter < MIN_DIST_FROM_CENTER) continue

    // Check distance from islands
    let tooCloseToIsland = false
    for (const island of islands) {
      const dx = x - island.position[0]
      const dz = z - island.position[2]
      const dist = Math.sqrt(dx * dx + dz * dz)
      // Account for island scale
      const minDist = MIN_DIST_FROM_ISLAND * island.scale
      if (dist < minDist) {
        tooCloseToIsland = true
        break
      }
    }
    if (tooCloseToIsland) continue

    // Check distance from other coins
    let tooCloseToCoin = false
    for (const [px, pz] of positions) {
      const dx = x - px
      const dz = z - pz
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < MIN_DIST_FROM_COIN) {
        tooCloseToCoin = true
        break
      }
    }
    if (tooCloseToCoin) continue

    // Valid position found
    positions.push([x, z])
    coins.push({
      id: coins.length,
      position: [x, 0.5, z], // Slightly above water
      collected: false,
    })
  }

  return coins
}
