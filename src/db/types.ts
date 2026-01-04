// Client-safe types and constants
// This file contains NO drizzle-orm imports and can be safely imported in client code

// Type exports
export type Capability =
  | 'admin'
  | 'disableAds'
  | 'builder'
  | 'feed'
  | 'moderate-feedback'
  | 'moderate-showcases'

export type OAuthProvider = 'github' | 'google'
export type DocFeedbackType = 'note' | 'improvement'
export type DocFeedbackStatus = 'pending' | 'approved' | 'denied'
export type BannerScope = 'global' | 'targeted'
export type BannerStyle = 'info' | 'warning' | 'success' | 'promo'
export type EntryType = 'release' | 'blog' | 'announcement'
export type ShowcaseStatus = 'pending' | 'approved' | 'denied'
export type ShowcaseUseCase =
  | 'blog'
  | 'e-commerce'
  | 'saas'
  | 'dashboard'
  | 'documentation'
  | 'portfolio'
  | 'social'
  | 'developer-tool'
  | 'marketing'
  | 'media'
export type AuditAction =
  | 'user.capabilities.update'
  | 'user.adsDisabled.update'
  | 'user.sessions.revoke'
  | 'role.create'
  | 'role.update'
  | 'role.delete'
  | 'role.assignment.create'
  | 'role.assignment.delete'
  | 'banner.create'
  | 'banner.update'
  | 'banner.delete'
  | 'feed.entry.create'
  | 'feed.entry.update'
  | 'feed.entry.delete'
  | 'feedback.moderate'
  | 'showcase.create'
  | 'showcase.update'
  | 'showcase.delete'
  | 'showcase.moderate'

// Constants
export const VALID_CAPABILITIES: readonly Capability[] = [
  'admin',
  'disableAds',
  'builder',
  'feed',
  'moderate-feedback',
  'moderate-showcases',
] as const

export const SHOWCASE_USE_CASES: readonly ShowcaseUseCase[] = [
  'blog',
  'e-commerce',
  'saas',
  'dashboard',
  'documentation',
  'portfolio',
  'social',
  'developer-tool',
  'marketing',
  'media',
] as const

export const RELEASE_LEVELS = ['major', 'minor', 'patch'] as const
export type ReleaseLevel = (typeof RELEASE_LEVELS)[number]

export const ENTRY_TYPES: readonly EntryType[] = [
  'release',
  'blog',
  'announcement',
] as const

export const MANUAL_ENTRY_TYPES: readonly EntryType[] = [
  'announcement',
] as const

// Inferred model types (manually defined to avoid drizzle-orm dependency)
// These mirror the shapes from InferSelectModel but are defined manually

export interface User {
  id: string
  email: string
  name: string | null
  displayUsername: string | null
  image: string | null
  oauthImage: string | null
  capabilities: Capability[]
  adsDisabled: boolean | null
  interestedInHidingAds: boolean | null
  lastUsedFramework: string | null
  sessionVersion: number
  createdAt: Date
  updatedAt: Date
}

export interface DocFeedback {
  id: string
  userId: string
  type: DocFeedbackType
  content: string
  characterCount: number
  pagePath: string
  libraryId: string
  libraryVersion: string
  blockSelector: string
  blockContentHash: string | null
  blockMarkdown: string | null
  status: DocFeedbackStatus
  isDetached: boolean
  isCollapsed: boolean
  moderatedBy: string | null
  moderatedAt: Date | null
  moderationNote: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Showcase {
  id: string
  userId: string
  name: string
  tagline: string
  description: string | null
  url: string
  logoUrl: string | null
  screenshotUrl: string
  libraries: string[]
  useCases: ShowcaseUseCase[]
  isFeatured: boolean
  status: ShowcaseStatus
  moderatedBy: string | null
  moderatedAt: Date | null
  moderationNote: string | null
  trancoRank: number | null
  trancoRankUpdatedAt: Date | null
  voteScore: number
  createdAt: Date
  updatedAt: Date
}

export interface ShowcaseVote {
  id: string
  showcaseId: string
  userId: string
  value: number
  createdAt: Date
  updatedAt: Date
}

export interface Role {
  id: string
  name: string
  description: string | null
  capabilities: Capability[]
  createdAt: Date
  updatedAt: Date
}
