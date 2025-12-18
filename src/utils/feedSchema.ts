/**
 * Feed schema constants and types for frontend code
 * Defined here to avoid importing drizzle-orm into client bundles
 */

// Entry types
export const ENTRY_TYPES = ['release', 'blog', 'announcement'] as const

export type EntryType = (typeof ENTRY_TYPES)[number]

// Manual entry types (only 'announcement' can be created manually in admin)
// Note: 'release' and 'blog' are auto-synced from GitHub and blog respectively
export const MANUAL_ENTRY_TYPES = ['announcement'] as const

export type ManualEntryType = (typeof MANUAL_ENTRY_TYPES)[number]

// Release levels (must match db/schema.ts)
export const RELEASE_LEVELS = ['major', 'minor', 'patch'] as const

export type ReleaseLevel = (typeof RELEASE_LEVELS)[number]
