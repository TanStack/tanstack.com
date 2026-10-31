// Beach-themed presentation layer for Beach Chess.
// Maps the abstract chess pieces onto a day-at-the-beach cast, and defines
// the difficulty levels and the "what kind of master are you?" personas.

import type { AiSettings, Color, PieceType } from './engine'

export interface BeachPiece {
  emoji: string
  label: string
}

// Each side gets its own cast so the two armies read differently at a glance:
// the player is the sunny daytime crew, the computer is the sunset/tiki crew.
export const BEACH_PIECES: Record<Color, Record<PieceType, BeachPiece>> = {
  w: {
    k: { emoji: '🏄', label: 'Beach King (surfer)' },
    q: { emoji: '👙', label: 'Beach Queen (bikini)' },
    r: { emoji: '🏰', label: 'Sandcastle (rook)' },
    b: { emoji: '⛱️', label: 'Beach Umbrella (bishop)' },
    n: { emoji: '🐬', label: 'Dolphin (knight)' },
    p: { emoji: '🥥', label: 'Coconut (pawn)' },
  },
  b: {
    k: { emoji: '🕺', label: 'Tiki King (beach dancer)' },
    q: { emoji: '💃', label: 'Tiki Queen (hula dancer)' },
    r: { emoji: '🗿', label: 'Tiki Totem (rook)' },
    b: { emoji: '🌴', label: 'Palm Tree (bishop)' },
    n: { emoji: '🦀', label: 'Crab (knight)' },
    p: { emoji: '🐚', label: 'Seashell (pawn)' },
  },
}

export type DifficultyId = 'calm' | 'breezy' | 'choppy' | 'stormy'

export interface Difficulty {
  id: DifficultyId
  name: string
  blurb: string
  emoji: string
  ai: AiSettings
}

// Difficulty is driven by search depth (strength) plus a "randomness" window
// that lets easier levels pick slightly sub-optimal moves — so beginners can
// actually win, while the hardest level always plays its best line.
export const DIFFICULTIES: Array<Difficulty> = [
  {
    id: 'calm',
    name: 'Calm Shallows',
    blurb: 'Gentle waves. The tide often drifts the wrong way.',
    emoji: '🏖️',
    ai: { depth: 1, randomness: 180 },
  },
  {
    id: 'breezy',
    name: 'Breezy Bay',
    blurb: 'A light sea breeze. Plays a sensible, casual game.',
    emoji: '🌊',
    ai: { depth: 2, randomness: 90 },
  },
  {
    id: 'choppy',
    name: 'Choppy Surf',
    blurb: 'Rough water. Punishes loose moves and hangs nothing.',
    emoji: '🌬️',
    ai: { depth: 3, randomness: 25 },
  },
  {
    id: 'stormy',
    name: 'Stormy Reef',
    blurb: 'Full gale. Searches deep and always plays its best.',
    emoji: '⛈️',
    ai: { depth: 4, randomness: 0 },
  },
]

export type MasterId = 'novice' | 'shell' | 'tiki' | 'wave' | 'grandmaster'

export interface Master {
  id: MasterId
  title: string
  blurb: string
  emoji: string
}

// Purely cosmetic rank the player picks for themselves — shown in the HUD and
// in the victory/defeat screens to give each game a bit of flavor.
export const MASTERS: Array<Master> = [
  {
    id: 'novice',
    title: 'Sandcastle Novice',
    blurb: 'Still learning which way the coconuts roll.',
    emoji: '🏖️',
  },
  {
    id: 'shell',
    title: 'Shell Seeker',
    blurb: 'Collects small advantages one tide pool at a time.',
    emoji: '🐚',
  },
  {
    id: 'tiki',
    title: 'Tiki Tactician',
    blurb: 'Sets cunning traps between the palm trees.',
    emoji: '🌴',
  },
  {
    id: 'wave',
    title: 'Wave Rider',
    blurb: 'Rides momentum and crashes through defenses.',
    emoji: '🏄',
  },
  {
    id: 'grandmaster',
    title: 'Grandmaster of the Shore',
    blurb: 'Commands the whole beach. Fears no tide.',
    emoji: '👑',
  },
]

export function getDifficulty(id: DifficultyId): Difficulty {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1]
}

export function getMaster(id: MasterId): Master {
  return MASTERS.find((m) => m.id === id) ?? MASTERS[0]
}
