// Lightweight store bridging the imperative Three.js VoyageEngine and the
// React HUD. The engine writes; the HUD reads. Kept deliberately small — no
// persistence, no game logic, just the handful of values the overlay shows.

import { create } from 'zustand'
import { TOTAL_PLANETS, type Planet } from './planets'

/** Doubloons awarded for charting a new world. */
export const DOUBLOONS_PER_WORLD = 250

export interface NearbyPlanet {
  id: string
  name: string
  shortName: string
  tagline: string
  url: string
  color: string
}

/** Most recently charted world — drives the celebratory toast. */
export interface ChartEvent {
  id: string
  name: string
  shortName: string
  color: string
  /** Increments each discovery so the HUD can re-trigger the toast. */
  tick: number
}

/** The boss currently being fought in the end-game gauntlet. */
export interface BossInfo {
  name: string
  color: string
  /** 1-based level. */
  level: number
  total: number
  maxHp: number
}

interface VoyageState {
  /** Index into BANDS the ship is currently closest to. */
  bandIndex: number
  /** Smooth 0..(BANDS.length-1) altitude for the HUD gauge. */
  altitude: number
  /** Set of discovered planet ids. */
  discovered: Set<string>
  discoveredCount: number
  /** Planet the ship is hovering near (close enough to visit), or null. */
  nearby: NearbyPlanet | null

  // Rewards
  /** Treasure earned from charting worlds. */
  doubloons: number
  /** True once every world has been charted. */
  completed: boolean
  /** The latest charted world, for the toast. */
  lastCharted: ChartEvent | null

  // Combat
  /** Player hull 0..maxHealth. */
  health: number
  maxHealth: number
  /** Pirate ships destroyed. */
  piratesSunk: number
  /** True while the ship is wrecked and respawning. */
  shipwrecked: boolean

  // End-game boss gauntlet
  /** True while the Pirate Armada gauntlet is underway. */
  gauntletActive: boolean
  /** Current boss meta, or null between bosses. */
  boss: BossInfo | null
  /** Current boss hull (0..boss.maxHp). */
  bossHp: number
  /** Bosses defeated this run. */
  bossesDefeated: number
  /** True once the whole gauntlet is cleared. */
  champion: boolean

  setBand: (bandIndex: number, altitude: number) => void
  discover: (planet: Planet) => void
  setNearby: (nearby: NearbyPlanet | null) => void
  setHealth: (health: number) => void
  addPirateSunk: () => void
  addDoubloons: (amount: number) => void
  setShipwrecked: (wrecked: boolean) => void
  setGauntletActive: (active: boolean) => void
  setBoss: (boss: BossInfo | null) => void
  setBossHp: (hp: number) => void
  addBossDefeated: () => void
  setChampion: (champion: boolean) => void
}

export const PLAYER_MAX_HEALTH = 100

export const useVoyageStore = create<VoyageState>((set) => ({
  bandIndex: 0,
  altitude: 0,
  discovered: new Set<string>(),
  discoveredCount: 0,
  nearby: null,

  doubloons: 0,
  completed: false,
  lastCharted: null,

  health: PLAYER_MAX_HEALTH,
  maxHealth: PLAYER_MAX_HEALTH,
  piratesSunk: 0,
  shipwrecked: false,

  gauntletActive: false,
  boss: null,
  bossHp: 0,
  bossesDefeated: 0,
  champion: false,

  setBand: (bandIndex, altitude) =>
    set((s) =>
      s.bandIndex === bandIndex && s.altitude === altitude
        ? s
        : { bandIndex, altitude },
    ),

  discover: (planet) =>
    set((s) => {
      if (s.discovered.has(planet.id)) return s
      const discovered = new Set(s.discovered)
      discovered.add(planet.id)
      const discoveredCount = discovered.size
      return {
        discovered,
        discoveredCount,
        doubloons: s.doubloons + DOUBLOONS_PER_WORLD,
        completed: discoveredCount >= TOTAL_PLANETS,
        lastCharted: {
          id: planet.id,
          name: planet.name,
          shortName: planet.shortName,
          color: planet.color,
          tick: (s.lastCharted?.tick ?? 0) + 1,
        },
      }
    }),

  setNearby: (nearby) =>
    set((s) => {
      if (s.nearby?.id === nearby?.id) return s
      return { nearby }
    }),

  setHealth: (health) => set((s) => (s.health === health ? s : { health })),

  addPirateSunk: () => set((s) => ({ piratesSunk: s.piratesSunk + 1 })),

  addDoubloons: (amount) => set((s) => ({ doubloons: s.doubloons + amount })),

  setShipwrecked: (shipwrecked) =>
    set((s) => (s.shipwrecked === shipwrecked ? s : { shipwrecked })),

  setGauntletActive: (gauntletActive) =>
    set((s) => (s.gauntletActive === gauntletActive ? s : { gauntletActive })),

  setBoss: (boss) => set({ boss, bossHp: boss ? boss.maxHp : 0 }),

  setBossHp: (bossHp) => set((s) => (s.bossHp === bossHp ? s : { bossHp })),

  addBossDefeated: () => set((s) => ({ bossesDefeated: s.bossesDefeated + 1 })),

  setChampion: (champion) =>
    set((s) => (s.champion === champion ? s : { champion })),
}))
