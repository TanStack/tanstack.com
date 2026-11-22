/**
 * Progression State Machine
 *
 * Tracks game progression through phases and badge tiers.
 * This machine handles high-level game state transitions while
 * the game store continues to manage real-time game state (positions, health, etc.)
 *
 * States:
 * - intro: Initial screen before starting
 * - exploration: Dinghy phase, discovering library islands
 * - upgrading: Overlay showing ship upgrade (libraries complete)
 * - battle.partners: Ship phase, discovering partner islands
 * - battle.showcase: Showcase islands unlocked (partners complete)
 * - battle.corners: Corner islands unlocked (showcases complete)
 * - gameover: Ship destroyed, can respawn
 * - victory: All corners captured
 *
 * Badges earned:
 * - explorer: Complete library exploration
 * - adventurer: Discover all partners
 * - champion: Discover all showcases
 * - conqueror: Capture all corners
 */

export type BadgeTier =
  | 'none'
  | 'explorer' // Completed library exploration
  | 'adventurer' // Discovered all partners
  | 'champion' // Discovered all showcases
  | 'conqueror' // Captured all corners

export const BADGE_INFO: Record<
  BadgeTier,
  { name: string; description: string; color: string; icon: string }
> = {
  none: {
    name: 'None',
    description: 'Start your journey',
    color: '#6b7280',
    icon: '🚣',
  },
  explorer: {
    name: 'Explorer',
    description: 'Discovered all TanStack libraries',
    color: '#06b6d4',
    icon: '⭐',
  },
  adventurer: {
    name: 'Adventurer',
    description: 'Allied with all partners',
    color: '#f59e0b',
    icon: '🌟',
  },
  champion: {
    name: 'Champion',
    description: 'Conquered the showcase islands',
    color: '#8b5cf6',
    icon: '💫',
  },
  conqueror: {
    name: 'Conqueror',
    description: 'Defeated all corner bosses',
    color: '#ef4444',
    icon: '🏆',
  },
}

export interface ProgressionContext {
  highestBadge: BadgeTier
  newBadgeEarned: BadgeTier | null // For showing badge earned overlay
  librariesDiscovered: number
  librariesTotal: number
  partnersDiscovered: number
  partnersTotal: number
  showcasesDiscovered: number
  showcasesTotal: number
  cornersDiscovered: number
  cornersTotal: number
}

export type ProgressionEvent =
  | { type: 'START_GAME' }
  | { type: 'DISCOVER_LIBRARY' }
  | { type: 'DISCOVER_PARTNER' }
  | { type: 'DISCOVER_SHOWCASE' }
  | { type: 'DISCOVER_CORNER' }
  | { type: 'UPGRADE_COMPLETE' }
  | { type: 'SHIP_DESTROYED' }
  | { type: 'RESPAWN' }
  | { type: 'DISMISS_VICTORY' }
  | { type: 'DISMISS_BADGE' }
  | { type: 'RESET' }
  | {
      type: 'SET_TOTALS'
      libraries: number
      partners: number
      showcases: number
      corners: number
    }
  | {
      type: 'RESTORE_PROGRESS'
      librariesDiscovered: number
      partnersDiscovered: number
      showcasesDiscovered: number
      cornersDiscovered: number
      highestBadge: BadgeTier
    }

type BattlePhase = 'partners' | 'showcase' | 'corners'

export type ProgressionValue =
  | 'intro'
  | 'exploration'
  | 'upgrading'
  | { battle: BattlePhase }
  | 'gameover'
  | 'victory'

export interface ProgressionState {
  value: ProgressionValue
  context: ProgressionContext
}

export const initialProgressionState: ProgressionState = {
  value: 'intro',
  context: {
    highestBadge: 'none',
    newBadgeEarned: null,
    librariesDiscovered: 0,
    librariesTotal: 0,
    partnersDiscovered: 0,
    partnersTotal: 0,
    showcasesDiscovered: 0,
    showcasesTotal: 0,
    cornersDiscovered: 0,
    cornersTotal: 0,
  },
}

const allLibrariesDiscovered = (context: ProgressionContext) =>
  context.librariesDiscovered >= context.librariesTotal &&
  context.librariesTotal > 0
const allPartnersDiscovered = (context: ProgressionContext) =>
  context.partnersDiscovered >= context.partnersTotal &&
  context.partnersTotal > 0
const allShowcasesDiscovered = (context: ProgressionContext) =>
  context.showcasesDiscovered >= context.showcasesTotal &&
  context.showcasesTotal > 0
const allCornersDiscovered = (context: ProgressionContext) =>
  context.cornersDiscovered >= context.cornersTotal && context.cornersTotal > 0

const earnBadge = (badge: BadgeTier) => ({
  highestBadge: badge,
  newBadgeEarned: badge,
})

/**
 * Pure transition function. Guards are evaluated against the context
 * before the event's increments are applied. Events that the current
 * state doesn't handle return the same state object.
 */
export function transition(
  state: ProgressionState,
  event: ProgressionEvent,
): ProgressionState {
  const { value, context } = state

  // Events handled from every state
  switch (event.type) {
    case 'SET_TOTALS':
      return {
        value,
        context: {
          ...context,
          librariesTotal: event.libraries,
          partnersTotal: event.partners,
          showcasesTotal: event.showcases,
          cornersTotal: event.corners,
        },
      }
    case 'DISMISS_BADGE':
      return { value, context: { ...context, newBadgeEarned: null } }
    case 'RESET':
      return {
        value: 'intro',
        context: {
          ...context,
          highestBadge: 'none',
          newBadgeEarned: null,
          librariesDiscovered: 0,
          partnersDiscovered: 0,
          showcasesDiscovered: 0,
          cornersDiscovered: 0,
        },
      }
  }

  const libraries = {
    ...context,
    librariesDiscovered: context.librariesDiscovered + 1,
  }
  const partners = {
    ...context,
    partnersDiscovered: context.partnersDiscovered + 1,
  }
  const showcases = {
    ...context,
    showcasesDiscovered: context.showcasesDiscovered + 1,
  }
  const corners = {
    ...context,
    cornersDiscovered: context.cornersDiscovered + 1,
  }

  if (value === 'intro') {
    if (event.type === 'START_GAME') return { value: 'exploration', context }
    if (event.type === 'RESTORE_PROGRESS') {
      const restored = {
        ...context,
        librariesDiscovered: event.librariesDiscovered,
        partnersDiscovered: event.partnersDiscovered,
        showcasesDiscovered: event.showcasesDiscovered,
        cornersDiscovered: event.cornersDiscovered,
        highestBadge: event.highestBadge,
      }
      // Allow restoring to any state
      if (event.highestBadge === 'conqueror')
        return { value: 'victory', context: restored }
      if (event.highestBadge === 'champion')
        return { value: { battle: 'corners' }, context: restored }
      if (event.highestBadge === 'adventurer')
        return { value: { battle: 'showcase' }, context: restored }
      if (event.highestBadge === 'explorer')
        return { value: { battle: 'partners' }, context: restored }
      if (event.librariesDiscovered > 0)
        return { value: 'exploration', context: restored }
    }
    return state
  }

  // Dinghy phase - discovering library islands
  if (value === 'exploration') {
    if (event.type === 'DISCOVER_LIBRARY') {
      // Entering 'upgrading' earns the explorer badge
      return allLibrariesDiscovered(context)
        ? {
            value: 'upgrading',
            context: { ...libraries, ...earnBadge('explorer') },
          }
        : { value, context: libraries }
    }
    return state
  }

  // Showing upgrade overlay - libraries complete
  if (value === 'upgrading') {
    if (event.type === 'UPGRADE_COMPLETE')
      return { value: { battle: 'partners' }, context }
    return state
  }

  // Ship destroyed
  if (value === 'gameover') {
    if (event.type === 'RESPAWN')
      return { value: { battle: 'partners' }, context }
    return state
  }

  // All corners captured - game complete
  if (value === 'victory') {
    if (event.type === 'DISMISS_VICTORY')
      return { value: { battle: 'corners' }, context }
    return state
  }

  // Ship phase with combat
  if (event.type === 'SHIP_DESTROYED') return { value: 'gameover', context }

  const battle = value.battle
  switch (event.type) {
    case 'DISCOVER_LIBRARY':
      return { value, context: libraries }
    case 'DISCOVER_PARTNER':
      return battle === 'partners' && allPartnersDiscovered(context)
        ? {
            value: { battle: 'showcase' },
            context: { ...partners, ...earnBadge('adventurer') },
          }
        : { value, context: partners }
    case 'DISCOVER_SHOWCASE':
      if (battle === 'partners') return state
      return battle === 'showcase' && allShowcasesDiscovered(context)
        ? {
            value: { battle: 'corners' },
            context: { ...showcases, ...earnBadge('champion') },
          }
        : { value, context: showcases }
    case 'DISCOVER_CORNER':
      if (battle !== 'corners') return state
      return allCornersDiscovered(context)
        ? {
            value: 'victory',
            context: { ...corners, ...earnBadge('conqueror') },
          }
        : { value, context: corners }
  }
  return state
}

// Helper to get current phase string from state value
export function getPhaseFromState(
  stateValue: ProgressionValue,
): 'intro' | 'playing' | 'upgrading' | 'gameover' | 'victory' {
  if (stateValue === 'exploration') return 'playing'
  if (typeof stateValue === 'object') return 'playing'
  return stateValue
}

// Helper to get battle sub-phase
export function getBattlePhase(
  stateValue: ProgressionValue,
): BattlePhase | null {
  return typeof stateValue === 'object' ? stateValue.battle : null
}
