import { create } from 'zustand'
import type { IslandData } from '../utils/islandGenerator'
import type { RockCollider } from '../utils/collision'
import {
  type Upgrade,
  type ShipStats,
  BASE_SHIP_STATS,
  applyUpgrade,
  UPGRADE_ORDER,
} from '../utils/upgrades'
import { type ShopItemType, SHOP_ITEMS } from '../utils/shopItems'

export interface CoinData {
  id: number
  position: [number, number, number]
  collected: boolean
}

export type BoatType = 'dinghy' | 'ship'
export type GameStage = 'exploration' | 'battle'

// Other players/AI in the world
export interface OtherPlayer {
  id: string
  isAI: boolean
  position: [number, number, number]
  rotation: number
  velocity: number
  boatType: BoatType
  color: string
  health: number
}

// Cannonball projectile
export interface Cannonball {
  id: number
  position: [number, number, number]
  velocity: [number, number, number]
  ownerId: string // 'player' or AI id
  createdAt: number
  isGatling?: boolean // Gatling rounds are smaller/faster
}

interface GameState {
  // Game phase
  phase: 'intro' | 'playing' | 'upgrading' | 'complete' | 'gameover'
  setPhase: (phase: GameState['phase']) => void

  // Game stage (exploration = dinghy, battle = ship + multiplayer)
  stage: GameStage
  setStage: (stage: GameStage) => void

  // Boat type and upgrades
  boatType: BoatType
  setBoatType: (type: BoatType) => void

  // Ship stats (upgradeable)
  shipStats: ShipStats
  unlockedUpgrades: Upgrade[]
  lastUnlockedUpgrade: Upgrade | null // For showing notification
  applyShipUpgrade: (upgrade: Upgrade) => void
  clearLastUnlockedUpgrade: () => void

  // Boat state
  boatPosition: [number, number, number]
  boatRotation: number
  boatVelocity: number
  boatHealth: number
  isMovingForward: boolean
  isMovingBackward: boolean
  isTurningLeft: boolean
  isTurningRight: boolean

  // Boat actions
  setBoatPosition: (pos: [number, number, number]) => void
  setBoatRotation: (rot: number) => void
  setBoatVelocity: (vel: number) => void
  setBoatHealth: (health: number) => void
  setMovingForward: (moving: boolean) => void
  setMovingBackward: (moving: boolean) => void
  setTurningLeft: (turning: boolean) => void
  setTurningRight: (turning: boolean) => void

  // World boundary (expands after upgrade)
  worldBoundary: number
  setWorldBoundary: (boundary: number) => void

  // Other players (AI + real multiplayer)
  otherPlayers: OtherPlayer[]
  setOtherPlayers: (players: OtherPlayer[]) => void
  updateOtherPlayer: (id: string, data: Partial<OtherPlayer>) => void

  // Discovery
  discoveredIslands: Set<string>
  nearbyIsland: IslandData | null
  discoveryProgress: number // 0-1 progress toward discovering current nearby island
  discoverIsland: (id: string) => void
  setNearbyIsland: (island: IslandData | null) => void
  setDiscoveryProgress: (progress: number) => void

  // Islands (core library islands + expanded partner/showcase islands)
  islands: IslandData[]
  expandedIslands: IslandData[] // Partner/showcase islands in expanded zone
  setIslands: (islands: IslandData[]) => void
  setExpandedIslands: (islands: IslandData[]) => void

  // Rock colliders
  rockColliders: RockCollider[]
  setRockColliders: (rocks: RockCollider[]) => void

  // Coins
  coins: CoinData[]
  coinsCollected: number
  setCoins: (coins: CoinData[]) => void
  collectCoin: (id: number) => void

  // Boundary collision (which edges are being hit)
  boundaryEdges: {
    north: boolean
    south: boolean
    east: boolean
    west: boolean
  }
  setBoundaryEdges: (edges: {
    north: boolean
    south: boolean
    east: boolean
    west: boolean
  }) => void

  // Cannonballs
  cannonballs: Cannonball[]
  lastFireTime: number
  lastGatlingTime: number
  fireCannon: () => void
  fireGatling: () => void
  updateCannonballs: (cannonballs: Cannonball[]) => void
  removeCannonball: (id: number) => void

  // Audio
  isMuted: boolean
  toggleMute: () => void

  // Shop
  isShopOpen: boolean
  openShop: () => void
  closeShop: () => void
  purchaseItem: (itemType: ShopItemType) => boolean

  // Active items/effects
  compassTarget: IslandData | null // Island the compass is pointing to
  speedBoostEndTime: number | null // Timestamp when speed boost ends
  setCompassTarget: (island: IslandData | null) => void
  clearCompassOnDiscover: (islandId: string) => void

  // Upgrade to ship (called when all core islands discovered)
  upgradeToShip: () => void

  // Reset
  reset: () => void

  // Restart battle (keep discoveries, reset battle state)
  restartBattle: () => void
}

// Initial world boundary for exploration stage
const INITIAL_WORLD_BOUNDARY = 85
// Expanded world boundary after upgrading to ship
const EXPANDED_WORLD_BOUNDARY = 180

const initialState = {
  phase: 'intro' as const,
  stage: 'exploration' as GameStage,
  boatType: 'dinghy' as BoatType,
  shipStats: { ...BASE_SHIP_STATS } as ShipStats,
  unlockedUpgrades: [] as Upgrade[],
  lastUnlockedUpgrade: null as Upgrade | null,
  boatPosition: [0, 0, 0] as [number, number, number],
  boatRotation: 0,
  boatVelocity: 0,
  boatHealth: 100,
  isMovingForward: false,
  isMovingBackward: false,
  isTurningLeft: false,
  isTurningRight: false,
  worldBoundary: INITIAL_WORLD_BOUNDARY,
  otherPlayers: [] as OtherPlayer[],
  discoveredIslands: new Set<string>(),
  nearbyIsland: null,
  discoveryProgress: 0,
  islands: [] as IslandData[],
  expandedIslands: [] as IslandData[],
  rockColliders: [] as RockCollider[],
  coins: [] as CoinData[],
  coinsCollected: 0,
  boundaryEdges: { north: false, south: false, east: false, west: false },
  cannonballs: [] as Cannonball[],
  lastFireTime: 0,
  lastGatlingTime: 0,
  isMuted: false,
  isShopOpen: false,
  compassTarget: null as IslandData | null,
  speedBoostEndTime: null as number | null,
}

export const useGameStore = create<GameState>((set, get) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),
  setStage: (stage) => set({ stage }),
  setBoatType: (boatType) => set({ boatType }),
  applyShipUpgrade: (upgrade: Upgrade) => {
    const { shipStats, unlockedUpgrades, boatHealth } = get()
    // Check if we already have this exact upgrade (same type and tier)
    const alreadyHave = unlockedUpgrades.some(
      (u) => u.type === upgrade.type && u.tier === upgrade.tier,
    )
    if (alreadyHave) return
    const newStats = applyUpgrade(shipStats, upgrade)

    // If maxHealth increased, also heal by that amount
    const healthGain = newStats.maxHealth - shipStats.maxHealth
    const newHealth = healthGain > 0 ? boatHealth + healthGain : boatHealth

    set({
      shipStats: newStats,
      unlockedUpgrades: [...unlockedUpgrades, upgrade],
      boatHealth: newHealth,
    })
  },
  clearLastUnlockedUpgrade: () => set({ lastUnlockedUpgrade: null }),

  setBoatPosition: (boatPosition) => set({ boatPosition }),
  setBoatRotation: (boatRotation) => set({ boatRotation }),
  setBoatVelocity: (boatVelocity) => set({ boatVelocity }),
  setBoatHealth: (boatHealth) => set({ boatHealth }),
  setMovingForward: (isMovingForward) => set({ isMovingForward }),
  setMovingBackward: (isMovingBackward) => set({ isMovingBackward }),
  setTurningLeft: (isTurningLeft) => set({ isTurningLeft }),
  setTurningRight: (isTurningRight) => set({ isTurningRight }),

  setWorldBoundary: (worldBoundary) => set({ worldBoundary }),

  setOtherPlayers: (otherPlayers) => set({ otherPlayers }),
  updateOtherPlayer: (id, data) =>
    set((state) => ({
      otherPlayers: state.otherPlayers.map((p) =>
        p.id === id ? { ...p, ...data } : p,
      ),
    })),

  discoverIsland: (id) => {
    const {
      discoveredIslands,
      islands,
      expandedIslands,
      stage,
      unlockedUpgrades,
      compassTarget,
    } = get()
    if (!discoveredIslands.has(id)) {
      const newDiscovered = new Set(discoveredIslands)
      newDiscovered.add(id)
      set({ discoveredIslands: newDiscovered })

      // Clear compass target if this is the target island
      if (compassTarget?.id === id) {
        set({ compassTarget: null })
      }

      // Check if all core islands discovered (triggers upgrade in exploration stage)
      if (stage === 'exploration' && newDiscovered.size === islands.length) {
        // Trigger upgrade sequence instead of complete
        get().upgradeToShip()
      }

      // In battle stage, check if this is a partner island and grant next upgrade in order
      if (stage === 'battle') {
        const partnerIsland = expandedIslands.find((i) => i.id === id)
        if (partnerIsland && partnerIsland.type === 'partner') {
          // Grant next upgrade in the fixed order
          const nextUpgrade = UPGRADE_ORDER[unlockedUpgrades.length]
          if (nextUpgrade) {
            get().applyShipUpgrade(nextUpgrade)
            set({ lastUnlockedUpgrade: nextUpgrade })
          }
        }
      }
    }
  },

  setNearbyIsland: (nearbyIsland) => set({ nearbyIsland }),
  setDiscoveryProgress: (discoveryProgress) => set({ discoveryProgress }),

  setIslands: (islands) => set({ islands }),
  setExpandedIslands: (expandedIslands) => set({ expandedIslands }),

  setRockColliders: (rockColliders) => set({ rockColliders }),

  setCoins: (coins) => set({ coins }),

  collectCoin: (id) => {
    const { coins, coinsCollected } = get()
    const coin = coins.find((c) => c.id === id)
    if (coin && !coin.collected) {
      const newCoins = coins.map((c) =>
        c.id === id ? { ...c, collected: true } : c,
      )
      set({ coins: newCoins, coinsCollected: coinsCollected + 1 })
    }
  },

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  setBoundaryEdges: (boundaryEdges) => set({ boundaryEdges }),

  fireCannon: () => {
    const {
      stage,
      boatPosition,
      boatRotation,
      cannonballs,
      lastFireTime,
      shipStats,
    } = get()
    if (stage !== 'battle') return

    const now = Date.now()
    if (now - lastFireTime < shipStats.sideFireRate) return

    const newCannonballs: Cannonball[] = []
    const cannonOffset = 0.5
    const baseSpeed = 20 * shipStats.cannonRange

    // Helper to create a cannonball
    // Ship forward is [sin(rotation), cos(rotation)]
    // Ship right (starboard) is [cos(rotation), -sin(rotation)]
    const createBall = (
      side: 'right' | 'left',
      spreadAngle: number = 0,
    ): Cannonball => {
      const sideMultiplier = side === 'right' ? 1 : -1

      // Position: offset perpendicular to ship heading
      const perpX = Math.cos(boatRotation) * sideMultiplier
      const perpZ = -Math.sin(boatRotation) * sideMultiplier
      const fireX = boatPosition[0] + perpX * cannonOffset
      const fireZ = boatPosition[2] + perpZ * cannonOffset

      // Velocity: fire perpendicular to ship, with optional spread
      const fireAngle = boatRotation + spreadAngle * sideMultiplier
      const velX = Math.cos(fireAngle) * baseSpeed * sideMultiplier
      const velZ = -Math.sin(fireAngle) * baseSpeed * sideMultiplier

      return {
        id: now + Math.random() * 1000,
        position: [fireX, 0.5, fireZ],
        velocity: [velX, 2, velZ],
        ownerId: 'player',
        createdAt: now,
      }
    }

    // Fire from right side
    newCannonballs.push(createBall('right'))
    if (shipStats.doubleShot) {
      newCannonballs.push(createBall('right', 0.15)) // Spread shot
    }

    // Fire from left side if dual cannons
    if (shipStats.dualCannons) {
      newCannonballs.push(createBall('left'))
      if (shipStats.doubleShot) {
        newCannonballs.push(createBall('left', 0.15))
      }
    }

    set({
      cannonballs: [...cannonballs, ...newCannonballs],
      lastFireTime: now,
    })
  },

  // Gatling gun fire (forward facing, rapid)
  fireGatling: () => {
    const {
      stage,
      boatPosition,
      boatRotation,
      cannonballs,
      shipStats,
      lastGatlingTime,
    } = get()
    if (stage !== 'battle' || !shipStats.gatlingGuns) return

    const now = Date.now()
    if (now - lastGatlingTime < shipStats.frontFireRate) return

    // Fire forward
    const speed = 35
    const velX = Math.sin(boatRotation) * speed
    const velZ = Math.cos(boatRotation) * speed

    // Slight spread
    const spread = (Math.random() - 0.5) * 0.1

    const newBall: Cannonball = {
      id: now + Math.random() * 1000,
      position: [boatPosition[0], 0.4, boatPosition[2]],
      velocity: [velX + spread * speed, 0.5, velZ + spread * speed],
      ownerId: 'player',
      createdAt: now,
      isGatling: true,
    }

    set({
      cannonballs: [...cannonballs, newBall],
      lastGatlingTime: now,
    })
  },

  updateCannonballs: (cannonballs) => set({ cannonballs }),

  removeCannonball: (id) =>
    set((state) => ({
      cannonballs: state.cannonballs.filter((c) => c.id !== id),
    })),

  upgradeToShip: () => {
    set({
      phase: 'upgrading',
      // boatType stays 'dinghy' until user clicks "Set Sail"
      stage: 'battle',
      worldBoundary: EXPANDED_WORLD_BOUNDARY,
      boatHealth: 100,
    })
    // User must click button to continue - no auto timeout
  },

  // Shop actions
  openShop: () => set({ isShopOpen: true }),
  closeShop: () => set({ isShopOpen: false }),

  purchaseItem: (itemType) => {
    const {
      coinsCollected,
      stage,
      boatHealth,
      shipStats,
      islands,
      expandedIslands,
      discoveredIslands,
    } = get()
    const item = SHOP_ITEMS.find((i) => i.type === itemType)

    if (!item) return false
    if (coinsCollected < item.cost) return false
    if (!item.stages.includes(stage)) return false

    // Deduct coins
    set({ coinsCollected: coinsCollected - item.cost })

    switch (itemType) {
      case 'compass': {
        // Find a random undiscovered island
        const allIslands =
          stage === 'battle' ? [...islands, ...expandedIslands] : islands
        const undiscovered = allIslands.filter(
          (i) => !discoveredIslands.has(i.id),
        )
        if (undiscovered.length > 0) {
          // Pick random (not nearest)
          const randomIndex = Math.floor(Math.random() * undiscovered.length)
          set({ compassTarget: undiscovered[randomIndex] })
        }
        break
      }
      case 'speedBoost': {
        // 10 second speed boost
        set({ speedBoostEndTime: Date.now() + 10000 })
        break
      }
      case 'healthPack': {
        // Restore 50 health, up to max
        const newHealth = Math.min(boatHealth + 50, shipStats.maxHealth)
        set({ boatHealth: newHealth })
        break
      }
    }

    set({ isShopOpen: false })
    return true
  },

  setCompassTarget: (island) => set({ compassTarget: island }),

  clearCompassOnDiscover: (islandId) => {
    const { compassTarget } = get()
    if (compassTarget?.id === islandId) {
      set({ compassTarget: null })
    }
  },

  reset: () =>
    set({
      ...initialState,
      islands: get().islands,
      expandedIslands: get().expandedIslands,
      rockColliders: get().rockColliders,
      coins: get().coins.map((c) => ({ ...c, collected: false })),
      discoveredIslands: new Set<string>(),
    }),

  restartBattle: () => {
    const {
      islands,
      expandedIslands,
      rockColliders,
      coins,
      discoveredIslands,
      unlockedUpgrades,
      shipStats,
    } = get()
    set({
      phase: 'playing',
      stage: 'battle',
      boatType: 'ship',
      boatPosition: [0, 0, 0],
      boatRotation: 0,
      boatVelocity: 0,
      boatHealth: shipStats.maxHealth,
      isMovingForward: false,
      isMovingBackward: false,
      isTurningLeft: false,
      isTurningRight: false,
      worldBoundary: EXPANDED_WORLD_BOUNDARY,
      otherPlayers: [],
      cannonballs: [],
      lastFireTime: 0,
      lastGatlingTime: 0,
      compassTarget: null,
      speedBoostEndTime: null,
      nearbyIsland: null,
      discoveryProgress: 0,
      coinsCollected: 0, // Reset coins on death
      // Keep these
      islands,
      expandedIslands,
      rockColliders,
      coins,
      discoveredIslands,
      unlockedUpgrades,
      shipStats,
    })
  },
}))
