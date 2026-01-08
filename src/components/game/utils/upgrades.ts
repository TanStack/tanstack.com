// Ship upgrades granted by discovering partner/showcase islands

export type UpgradeType =
  | 'sideFireRate'
  | 'frontFireRate'
  | 'cannonRange'
  | 'fieldOfView'
  | 'dualCannons'
  | 'doubleShot'
  | 'gatlingGuns'
  | 'maxHealth'
  | 'healthRegen'

export interface Upgrade {
  type: UpgradeType
  tier: number // 1, 2, 3, etc.
  name: string
  description: string
  icon: string
}

// All upgrade tiers - stackable upgrades have multiple tiers
export const UPGRADES: Upgrade[] = [
  // Side Cannon Fire Rate tiers (stackable: 0.67x each)
  {
    type: 'sideFireRate',
    tier: 1,
    name: 'Broadside I',
    description: 'Side cannon cooldown -33%',
    icon: '💨',
  },
  {
    type: 'sideFireRate',
    tier: 2,
    name: 'Broadside II',
    description: 'Side cannon cooldown -33%',
    icon: '💨',
  },
  {
    type: 'sideFireRate',
    tier: 3,
    name: 'Broadside III',
    description: 'Side cannon cooldown -33%',
    icon: '💨',
  },

  // Front Cannon Fire Rate tiers (stackable: 0.75x each)
  {
    type: 'frontFireRate',
    tier: 1,
    name: 'Rapid Fire I',
    description: 'Front cannon cooldown -25%',
    icon: '🔥',
  },
  {
    type: 'frontFireRate',
    tier: 2,
    name: 'Rapid Fire II',
    description: 'Front cannon cooldown -25%',
    icon: '🔥',
  },
  {
    type: 'frontFireRate',
    tier: 3,
    name: 'Rapid Fire III',
    description: 'Front cannon cooldown -25%',
    icon: '🔥',
  },

  // Cannon Range tiers (stackable: 1.25x each)
  {
    type: 'cannonRange',
    tier: 1,
    name: 'Long Range I',
    description: 'Cannon range +25%',
    icon: '🎯',
  },
  {
    type: 'cannonRange',
    tier: 2,
    name: 'Long Range II',
    description: 'Cannon range +25%',
    icon: '🎯',
  },
  {
    type: 'cannonRange',
    tier: 3,
    name: 'Long Range III',
    description: 'Cannon range +25%',
    icon: '🎯',
  },

  // Field of View tiers (stackable: increasing each tier)
  {
    type: 'fieldOfView',
    tier: 1,
    name: "Crow's Nest I",
    description: 'Field of view +15%',
    icon: '🔭',
  },
  {
    type: 'fieldOfView',
    tier: 2,
    name: "Crow's Nest II",
    description: 'Field of view +20%',
    icon: '🔭',
  },

  // Max Health tiers (stackable: +25 each)
  {
    type: 'maxHealth',
    tier: 1,
    name: 'Reinforced Hull I',
    description: 'Max health +25',
    icon: '🛡️',
  },
  {
    type: 'maxHealth',
    tier: 2,
    name: 'Reinforced Hull II',
    description: 'Max health +25',
    icon: '🛡️',
  },
  {
    type: 'maxHealth',
    tier: 3,
    name: 'Reinforced Hull III',
    description: 'Max health +25',
    icon: '🛡️',
  },

  // Health Regen tiers (stackable: 1.5x each)
  {
    type: 'healthRegen',
    tier: 1,
    name: 'Auto Repair I',
    description: 'Health regen +50%',
    icon: '❤️‍🩹',
  },
  {
    type: 'healthRegen',
    tier: 2,
    name: 'Auto Repair II',
    description: 'Health regen +50%',
    icon: '❤️‍🩹',
  },

  // One-time unlocks
  {
    type: 'dualCannons',
    tier: 1,
    name: 'Dual Cannons',
    description: 'Fire from both sides',
    icon: '⚔️',
  },
  {
    type: 'doubleShot',
    tier: 1,
    name: 'Double Shot',
    description: 'Two cannonballs per shot',
    icon: '💥',
  },
  {
    type: 'gatlingGuns',
    tier: 1,
    name: 'Gatling Guns',
    description: 'Hold SPACE for rapid fire',
    icon: '🔫',
  },
]

// Upgrade order for partner islands (15 partners)
// Mix of incremental upgrades and one-time unlocks for good progression
export const PARTNER_UPGRADE_ORDER: Upgrade[] = [
  UPGRADES.find((u) => u.type === 'sideFireRate' && u.tier === 1)!,
  UPGRADES.find((u) => u.type === 'fieldOfView' && u.tier === 1)!,
  UPGRADES.find((u) => u.type === 'cannonRange' && u.tier === 1)!,
  UPGRADES.find((u) => u.type === 'maxHealth' && u.tier === 1)!,
  UPGRADES.find((u) => u.type === 'dualCannons' && u.tier === 1)!,
  UPGRADES.find((u) => u.type === 'gatlingGuns' && u.tier === 1)!,
  UPGRADES.find((u) => u.type === 'frontFireRate' && u.tier === 1)!,
  UPGRADES.find((u) => u.type === 'healthRegen' && u.tier === 1)!,
  UPGRADES.find((u) => u.type === 'sideFireRate' && u.tier === 2)!,
  UPGRADES.find((u) => u.type === 'cannonRange' && u.tier === 2)!,
  UPGRADES.find((u) => u.type === 'maxHealth' && u.tier === 2)!,
  UPGRADES.find((u) => u.type === 'doubleShot' && u.tier === 1)!,
  UPGRADES.find((u) => u.type === 'frontFireRate' && u.tier === 2)!,
  UPGRADES.find((u) => u.type === 'fieldOfView' && u.tier === 2)!,
  UPGRADES.find((u) => u.type === 'healthRegen' && u.tier === 2)!,
]

// Upgrade order for showcase islands (future expansion)
export const SHOWCASE_UPGRADE_ORDER: Upgrade[] = [
  UPGRADES.find((u) => u.type === 'maxHealth' && u.tier === 3)!,
  // Add more showcase-exclusive upgrades here
]

// Combined order for easy indexing
export const UPGRADE_ORDER = [
  ...PARTNER_UPGRADE_ORDER,
  ...SHOWCASE_UPGRADE_ORDER,
]

// Ship stats configuration
export interface ShipStats {
  sideFireRate: number // Side cannon cooldown in ms (lower = faster)
  frontFireRate: number // Front cannon cooldown in ms (lower = faster)
  cannonRange: number // Projectile speed multiplier
  dualCannons: boolean
  doubleShot: boolean
  gatlingGuns: boolean
  fieldOfView: number // Camera FOV multiplier
  maxHealth: number
  healthRegen: number // HP per second
}

export const BASE_SHIP_STATS: ShipStats = {
  sideFireRate: 2000,
  frontFireRate: 200,
  cannonRange: 0.7,
  dualCannons: false,
  doubleShot: false,
  gatlingGuns: false,
  fieldOfView: 1.0,
  maxHealth: 100,
  healthRegen: 0.5,
}

// Apply an upgrade to ship stats
export function applyUpgrade(stats: ShipStats, upgrade: Upgrade): ShipStats {
  const newStats = { ...stats }

  switch (upgrade.type) {
    case 'sideFireRate':
      newStats.sideFireRate = Math.max(500, stats.sideFireRate * 0.67)
      break
    case 'frontFireRate':
      newStats.frontFireRate = Math.max(50, stats.frontFireRate * 0.75)
      break
    case 'cannonRange':
      newStats.cannonRange = stats.cannonRange * 1.25
      break
    case 'fieldOfView':
      // Each tier is more powerful: 15%, 20%, 25%...
      const fovMultiplier = 1.15 + (upgrade.tier - 1) * 0.05
      newStats.fieldOfView = stats.fieldOfView * fovMultiplier
      break
    case 'dualCannons':
      newStats.dualCannons = true
      break
    case 'doubleShot':
      newStats.doubleShot = true
      break
    case 'gatlingGuns':
      newStats.gatlingGuns = true
      break
    case 'maxHealth':
      newStats.maxHealth = stats.maxHealth + 25
      break
    case 'healthRegen':
      newStats.healthRegen = stats.healthRegen * 1.5
      break
  }

  return newStats
}
