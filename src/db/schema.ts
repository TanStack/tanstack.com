import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  integer,
  bigint,
  real,
  index,
  uniqueIndex,
  unique,
  date,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'

// Re-export client-safe types and constants
export type {
  Capability,
  OAuthProvider,
  DocFeedbackType,
  DocFeedbackStatus,
  BannerScope,
  BannerStyle,
  EntryType,
  ShowcaseStatus,
  ShowcaseUseCase,
  AuditAction,
  ReleaseLevel,
} from './types'

import {
  CAPABILITIES,
  OAUTH_PROVIDERS,
  DOC_FEEDBACK_TYPES,
  DOC_FEEDBACK_STATUSES,
  BANNER_SCOPES,
  BANNER_STYLES,
  ENTRY_TYPES,
  SHOWCASE_STATUSES,
  SHOWCASE_USE_CASES,
  AUDIT_ACTIONS,
} from './types'

export {
  CAPABILITIES,
  VALID_CAPABILITIES,
  OAUTH_PROVIDERS,
  DOC_FEEDBACK_TYPES,
  DOC_FEEDBACK_STATUSES,
  BANNER_SCOPES,
  BANNER_STYLES,
  ENTRY_TYPES,
  SHOWCASE_STATUSES,
  SHOWCASE_USE_CASES,
  AUDIT_ACTIONS,
  RELEASE_LEVELS,
  MANUAL_ENTRY_TYPES,
} from './types'

// Enums - using imported constants as single source of truth
export const capabilityEnum = pgEnum('capability', CAPABILITIES)
// Note: feed_category enum was dropped in migration 0011
export const oauthProviderEnum = pgEnum('oauth_provider', OAUTH_PROVIDERS)
export const docFeedbackTypeEnum = pgEnum(
  'doc_feedback_type',
  DOC_FEEDBACK_TYPES,
)
export const docFeedbackStatusEnum = pgEnum(
  'doc_feedback_status',
  DOC_FEEDBACK_STATUSES,
)
export const bannerScopeEnum = pgEnum('banner_scope', BANNER_SCOPES)
export const bannerStyleEnum = pgEnum('banner_style', BANNER_STYLES)
export const entryTypeEnum = pgEnum('entry_type', ENTRY_TYPES)
export const showcaseStatusEnum = pgEnum('showcase_status', SHOWCASE_STATUSES)
export const showcaseUseCaseEnum = pgEnum(
  'showcase_use_case',
  SHOWCASE_USE_CASES,
)
export const auditActionEnum = pgEnum('audit_action', AUDIT_ACTIONS)

// Note: Types and constants are defined in ./types.ts and re-exported above
// This keeps client-safe exports separate from server-only drizzle schema

// Users table
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }),
    displayUsername: varchar('display_username', { length: 255 }),
    image: text('image'),
    oauthImage: text('oauth_image'),
    capabilities: capabilityEnum('capabilities').array().notNull().default([]),
    adsDisabled: boolean('ads_disabled').default(false),
    interestedInHidingAds: boolean('interested_in_hiding_ads').default(false),
    lastUsedFramework: varchar('last_used_framework', { length: 50 }),
    sessionVersion: integer('session_version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    createdAtIdx: index('users_created_at_idx').on(table.createdAt),
  }),
)

export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>

// Roles table
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    description: text('description'),
    capabilities: capabilityEnum('capabilities').array().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    nameIdx: index('roles_name_idx').on(table.name),
  }),
)

export type Role = InferSelectModel<typeof roles>
export type NewRole = InferInsertModel<typeof roles>

// Role assignments table
export const roleAssignments = pgTable(
  'role_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index('role_assignments_user_id_idx').on(table.userId),
    roleIdIdx: index('role_assignments_role_id_idx').on(table.roleId),
    userRoleUnique: uniqueIndex('role_assignments_user_role_unique').on(
      table.userId,
      table.roleId,
    ),
  }),
)

export type RoleAssignment = InferSelectModel<typeof roleAssignments>
export type NewRoleAssignment = InferInsertModel<typeof roleAssignments>

// Sessions table
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    ipAddress: varchar('ip_address', { length: 45 }), // IPv6 max length
    userAgent: text('user_agent'),
  },
  (table) => ({
    tokenIdx: index('sessions_token_idx').on(table.token),
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
  }),
)

export type Session = InferSelectModel<typeof sessions>
export type NewSession = InferInsertModel<typeof sessions>

// OAuth accounts table
export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: oauthProviderEnum('provider').notNull(),
    providerAccountId: varchar('provider_account_id', {
      length: 255,
    }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index('oauth_accounts_user_id_idx').on(table.userId),
    providerAccountUnique: uniqueIndex(
      'oauth_accounts_provider_account_unique',
    ).on(table.provider, table.providerAccountId),
    providerAccountIdx: index('oauth_accounts_provider_account_idx').on(
      table.provider,
      table.providerAccountId,
    ),
  }),
)

export type OAuthAccount = InferSelectModel<typeof oauthAccounts>
export type NewOAuthAccount = InferInsertModel<typeof oauthAccounts>

// Feed entries table
export const feedEntries = pgTable(
  'feed_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Unique identifier (e.g., "github:tanstack/query:v5.0.0" or UUID for manual)
    entryId: varchar('entry_id', { length: 255 }).notNull().unique(),
    // Entry type: release (auto-synced from GitHub), blog (auto-synced), announcement (manual)
    entryType: entryTypeEnum('entry_type').notNull().default('announcement'),
    title: text('title').notNull(),
    content: text('content').notNull(), // Markdown content
    excerpt: text('excerpt'),
    publishedAt: timestamp('published_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    // Source-specific metadata (JSON blob for debugging)
    metadata: jsonb('metadata'),
    // Categorization
    libraryIds: varchar('library_ids', { length: 255 })
      .array()
      .notNull()
      .default([]),
    partnerIds: varchar('partner_ids', { length: 255 })
      .array()
      .notNull()
      .default([]),
    tags: varchar('tags', { length: 255 }).array().notNull().default([]),
    // Display control
    showInFeed: boolean('show_in_feed').notNull().default(true),
    featured: boolean('featured').default(false),
    // Auto-sync metadata
    autoSynced: boolean('auto_synced').notNull().default(false),
    lastSyncedAt: timestamp('last_synced_at', {
      withTimezone: true,
      mode: 'date',
    }),
  },
  (table) => ({
    publishedAtIdx: index('feed_entries_published_at_idx').on(
      table.publishedAt,
    ),
    entryTypeIdx: index('feed_entries_entry_type_idx').on(table.entryType),
    showInFeedPublishedIdx: index(
      'feed_entries_show_in_feed_published_at_idx',
    ).on(table.showInFeed, table.publishedAt),
    // GIN indexes for array columns (created via SQL migration)
    // libraryIdsGin: index('feed_entries_library_ids_gin_idx').using('gin', table.libraryIds),
    // tagsGin: index('feed_entries_tags_gin_idx').using('gin', table.tags),
  }),
)

export type FeedEntry = InferSelectModel<typeof feedEntries>
export type NewFeedEntry = InferInsertModel<typeof feedEntries>

// Feed config table
export const feedConfig = pgTable(
  'feed_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 255 }).notNull().unique(), // e.g., 'defaultFilters'
    value: jsonb('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    keyIdx: index('feed_config_key_idx').on(table.key),
  }),
)

export type FeedConfig = InferSelectModel<typeof feedConfig>
export type NewFeedConfig = InferInsertModel<typeof feedConfig>

// GitHub Stats cache table (for caching expensive GitHub API calls)
export const githubStatsCache = pgTable(
  'github_stats_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Cache key: repo name (e.g., "tanstack/query") or "org:tanstack" for org aggregate
    cacheKey: varchar('cache_key', { length: 255 }).notNull().unique(),
    // Cached GitHub stats data (JSON)
    stats: jsonb('stats').notNull(),
    // Previous stats data (JSON) - for calculating deltas and animation trajectory
    previousStats: jsonb('previous_stats'),
    // When this cache entry expires (should refresh after this)
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    cacheKeyIdx: index('github_stats_cache_key_idx').on(table.cacheKey),
    expiresAtIdx: index('github_stats_cache_expires_at_idx').on(
      table.expiresAt,
    ),
  }),
)

export type GithubStatsCache = InferSelectModel<typeof githubStatsCache>

// NPM Packages table (combines registry and stats cache)
export const npmPackages = pgTable(
  'npm_packages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Package name (e.g., "@tanstack/react-query")
    packageName: varchar('package_name', { length: 255 }).notNull().unique(),

    // Package metadata (from npm registry)
    githubRepo: varchar('github_repo', { length: 255 }),
    libraryId: varchar('library_id', { length: 255 }),
    isLegacy: boolean('is_legacy').default(false),
    metadataCheckedAt: timestamp('metadata_checked_at', {
      withTimezone: true,
      mode: 'date',
    }),

    // Stats cache (from npm downloads API)
    downloads: bigint('downloads', { mode: 'number' }),
    ratePerDay: real('rate_per_day'), // Growth rate in downloads per day (for animation)
    statsExpiresAt: timestamp('stats_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    packageNameIdx: index('npm_packages_package_name_idx').on(
      table.packageName,
    ),
    githubRepoIdx: index('npm_packages_github_repo_idx').on(table.githubRepo),
    libraryIdIdx: index('npm_packages_library_id_idx').on(table.libraryId),
    statsExpiresAtIdx: index('npm_packages_stats_expires_at_idx').on(
      table.statsExpiresAt,
    ),
  }),
)

export type NpmPackage = InferSelectModel<typeof npmPackages>
export type NewNpmPackage = InferInsertModel<typeof npmPackages>

// NPM Org Stats cache table (for pre-aggregated org-level stats)
export const npmOrgStatsCache = pgTable(
  'npm_org_stats_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Organization name (e.g., "tanstack")
    orgName: varchar('org_name', { length: 255 }).notNull().unique(),
    // Pre-aggregated total downloads
    totalDownloads: bigint('total_downloads', { mode: 'number' }).notNull(),
    // Per-package stats breakdown (JSON) - needed for per-package rate info
    packageStats: jsonb('package_stats').notNull(),
    // When this cache entry expires (should refresh after this)
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    orgNameIdx: index('npm_org_stats_cache_org_name_idx').on(table.orgName),
    expiresAtIdx: index('npm_org_stats_cache_expires_at_idx').on(
      table.expiresAt,
    ),
  }),
)

export type NpmOrgStatsCache = InferSelectModel<typeof npmOrgStatsCache>
export type NewNpmOrgStatsCache = InferInsertModel<typeof npmOrgStatsCache>

// NPM Library Stats cache table (for pre-aggregated library-level stats)
export const npmLibraryStatsCache = pgTable(
  'npm_library_stats_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Library ID (e.g., "query", "table")
    libraryId: varchar('library_id', { length: 255 }).notNull().unique(),
    // Pre-aggregated total downloads for this library
    totalDownloads: bigint('total_downloads', { mode: 'number' }).notNull(),
    // Previous total downloads (for calculating rate of change)
    previousTotalDownloads: bigint('previous_total_downloads', {
      mode: 'number',
    }),
    // Package count
    packageCount: integer('package_count').notNull(),
    // When this cache entry was last updated
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    libraryIdIdx: index('npm_library_stats_cache_library_id_idx').on(
      table.libraryId,
    ),
  }),
)

export type NpmLibraryStatsCache = InferSelectModel<typeof npmLibraryStatsCache>
export type NewNpmLibraryStatsCache = InferInsertModel<
  typeof npmLibraryStatsCache
>

// NPM Download Chunks cache table (for caching historical date range downloads)
// This table stores immutable historical chunks and cacheable recent chunks
// to avoid repeated API calls and rate limiting
export const npmDownloadChunks = pgTable(
  'npm_download_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Package identifier
    packageName: varchar('package_name', { length: 255 }).notNull(),
    // Date range for this chunk (inclusive, YYYY-MM-DD format)
    dateFrom: varchar('date_from', { length: 10 }).notNull(),
    dateTo: varchar('date_to', { length: 10 }).notNull(),
    // Bin size for aggregation (future-proofing for stats visualizer)
    // 'daily' = raw daily data, 'weekly'/'monthly' for future aggregations
    binSize: varchar('bin_size', { length: 20 }).notNull().default('daily'),
    // Aggregate total downloads for this chunk (sum of dailyData)
    totalDownloads: bigint('total_downloads', { mode: 'number' }).notNull(),
    // Detailed daily breakdown (array of { day: string, downloads: number })
    // Stores the actual npm API response data for this date range
    dailyData: jsonb('daily_data').notNull(),
    // Cache control
    // isImmutable: true for chunks completely in the past (won't change)
    // isImmutable: false for chunks touching today (may need refresh)
    isImmutable: boolean('is_immutable').notNull().default(false),
    // expiresAt: null if immutable, timestamp if needs periodic refresh
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Composite unique index: one chunk per package/dateRange/binSize combo
    packageDateBinUnique: uniqueIndex(
      'npm_download_chunks_package_date_bin_unique',
    ).on(table.packageName, table.dateFrom, table.dateTo, table.binSize),
    // Individual indexes for efficient lookups
    packageNameIdx: index('npm_download_chunks_package_name_idx').on(
      table.packageName,
    ),
    dateFromIdx: index('npm_download_chunks_date_from_idx').on(table.dateFrom),
    dateToIdx: index('npm_download_chunks_date_to_idx').on(table.dateTo),
    expiresAtIdx: index('npm_download_chunks_expires_at_idx').on(
      table.expiresAt,
    ),
    isImmutableIdx: index('npm_download_chunks_is_immutable_idx').on(
      table.isImmutable,
    ),
  }),
)

export type NpmDownloadChunk = InferSelectModel<typeof npmDownloadChunks>
export type NewNpmDownloadChunk = InferInsertModel<typeof npmDownloadChunks>

// Doc feedback table (for user notes and improvement suggestions on documentation)
export const docFeedback = pgTable(
  'doc_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Content
    type: docFeedbackTypeEnum('type').notNull(),
    content: text('content').notNull(),
    characterCount: integer('character_count').notNull(), // Store raw character count, points derived from this

    // Location
    pagePath: varchar('page_path', { length: 500 }).notNull(), // e.g., "/query/v5/docs/overview"
    libraryId: varchar('library_id', { length: 255 }).notNull(), // e.g., "query"
    libraryVersion: varchar('library_version', { length: 50 }).notNull(), // e.g., "v5.0.0"
    blockSelector: text('block_selector').notNull(), // hierarchical selector for resilience
    blockContentHash: varchar('block_content_hash', { length: 64 }), // SHA-256 hash for drift detection
    blockMarkdown: text('block_markdown'), // Captured content at time of feedback (guards against doc drift)

    // State
    status: docFeedbackStatusEnum('status').notNull().default('pending'),
    isDetached: boolean('is_detached').notNull().default(false), // true if block moved/deleted
    isCollapsed: boolean('is_collapsed').notNull().default(false), // UI state: collapsed or expanded

    // Moderation
    moderatedBy: uuid('moderated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    moderatedAt: timestamp('moderated_at', {
      withTimezone: true,
      mode: 'date',
    }),
    moderationNote: text('moderation_note'), // Internal note from moderator

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index('doc_feedback_user_id_idx').on(table.userId),
    statusIdx: index('doc_feedback_status_idx').on(table.status),
    libraryIdx: index('doc_feedback_library_idx').on(table.libraryId),
    pagePathIdx: index('doc_feedback_page_path_idx').on(table.pagePath),
    createdAtIdx: index('doc_feedback_created_at_idx').on(table.createdAt),
    isDetachedIdx: index('doc_feedback_is_detached_idx').on(table.isDetached),
    moderatedByIdx: index('doc_feedback_moderated_by_idx').on(
      table.moderatedBy,
    ),
  }),
)

export type DocFeedback = InferSelectModel<typeof docFeedback>
export type NewDocFeedback = InferInsertModel<typeof docFeedback>

// Banners table (separate from feed entries)
export const banners = pgTable(
  'banners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Display content
    title: text('title').notNull(),
    content: text('content'), // Optional longer content/description
    // Link (makes banner clickable)
    linkUrl: text('link_url'),
    linkText: varchar('link_text', { length: 255 }),
    // Styling
    style: bannerStyleEnum('style').notNull().default('info'),
    // Targeting
    scope: bannerScopeEnum('scope').notNull().default('global'),
    pathPrefixes: varchar('path_prefixes', { length: 255 })
      .array()
      .notNull()
      .default([]),
    // Scheduling
    isActive: boolean('is_active').notNull().default(true),
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    // Priority (higher = shown first when multiple banners match)
    priority: integer('priority').notNull().default(0),
    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    isActiveIdx: index('banners_is_active_idx').on(table.isActive),
    priorityIdx: index('banners_priority_idx').on(table.priority),
    startsAtIdx: index('banners_starts_at_idx').on(table.startsAt),
    expiresAtIdx: index('banners_expires_at_idx').on(table.expiresAt),
  }),
)

export type Banner = InferSelectModel<typeof banners>
export type NewBanner = InferInsertModel<typeof banners>

// Banner dismissals table (for tracking which banners users have dismissed)
export const bannerDismissals = pgTable(
  'banner_dismissals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bannerId: uuid('banner_id')
      .notNull()
      .references(() => banners.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    bannerIdIdx: index('banner_dismissals_banner_id_idx').on(table.bannerId),
    userIdIdx: index('banner_dismissals_user_id_idx').on(table.userId),
    userBannerUnique: uniqueIndex('banner_dismissals_user_banner_unique').on(
      table.userId,
      table.bannerId,
    ),
  }),
)

export type BannerDismissal = InferSelectModel<typeof bannerDismissals>
export type NewBannerDismissal = InferInsertModel<typeof bannerDismissals>

// Announcement dismissals table (legacy - for tracking which feed entry banners users have dismissed)
export const announcementDismissals = pgTable(
  'announcement_dismissals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // The feed entry ID (references feedEntries.entryId, not the UUID)
    announcementId: varchar('announcement_id', { length: 255 }).notNull(),
    // User who dismissed (nullable for future anonymous tracking if needed)
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    announcementIdIdx: index('announcement_dismissals_announcement_id_idx').on(
      table.announcementId,
    ),
    userIdIdx: index('announcement_dismissals_user_id_idx').on(table.userId),
    // Ensure a user can only dismiss an announcement once
    userAnnouncementUnique: uniqueIndex(
      'announcement_dismissals_user_announcement_unique',
    ).on(table.userId, table.announcementId),
  }),
)

export type AnnouncementDismissal = InferSelectModel<
  typeof announcementDismissals
>
export type NewAnnouncementDismissal = InferInsertModel<
  typeof announcementDismissals
>

// Login history table (tracks user logins for analytics and security)
export const loginHistory = pgTable(
  'login_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: oauthProviderEnum('provider').notNull(),
    ipAddress: varchar('ip_address', { length: 45 }), // IPv6 max length
    userAgent: text('user_agent'),
    isNewUser: boolean('is_new_user').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index('login_history_user_id_idx').on(table.userId),
    createdAtIdx: index('login_history_created_at_idx').on(table.createdAt),
    providerIdx: index('login_history_provider_idx').on(table.provider),
  }),
)

export type LoginHistory = InferSelectModel<typeof loginHistory>
export type NewLoginHistory = InferInsertModel<typeof loginHistory>

// Audit logs table (tracks admin actions for security and compliance)
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Who performed the action
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // What action was performed
    action: auditActionEnum('action').notNull(),
    // Target of the action (user, role, banner, etc.)
    targetType: varchar('target_type', { length: 50 }).notNull(), // 'user', 'role', 'banner', 'feed_entry', 'feedback'
    targetId: varchar('target_id', { length: 255 }).notNull(), // UUID or other identifier
    // Details of the change
    details: jsonb('details'), // { before: {...}, after: {...} } or other relevant data
    // Request metadata
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    actorIdIdx: index('audit_logs_actor_id_idx').on(table.actorId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
    targetTypeIdx: index('audit_logs_target_type_idx').on(table.targetType),
    targetIdIdx: index('audit_logs_target_id_idx').on(table.targetId),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  }),
)

export type AuditLog = InferSelectModel<typeof auditLogs>
export type NewAuditLog = InferInsertModel<typeof auditLogs>

// Daily user activity table (one row per user per day for DAU/streak tracking)
export const userActivity = pgTable(
  'user_activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(), // YYYY-MM-DD format
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userDateUnique: uniqueIndex('user_activity_user_date_unique').on(
      table.userId,
      table.date,
    ),
    userIdIdx: index('user_activity_user_id_idx').on(table.userId),
    dateIdx: index('user_activity_date_idx').on(table.date),
  }),
)

export type UserActivity = InferSelectModel<typeof userActivity>
export type NewUserActivity = InferInsertModel<typeof userActivity>

// Showcases table (user-submitted projects using TanStack libraries)
export const showcases = pgTable(
  'showcases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Project info
    name: varchar('name', { length: 255 }).notNull(),
    tagline: varchar('tagline', { length: 500 }).notNull(),
    description: text('description'),
    url: text('url').notNull(),
    logoUrl: text('logo_url'),
    screenshotUrl: text('screenshot_url').notNull(),
    sourceUrl: text('source_url'),

    // Libraries (stored as array of library IDs)
    libraries: text('libraries').array().notNull(),

    // Use cases (multi-select)
    useCases: showcaseUseCaseEnum('use_cases').array().notNull().default([]),

    // Featured flag (admin-set for homepage prominence)
    isFeatured: boolean('is_featured').notNull().default(false),

    // Moderation
    status: showcaseStatusEnum('status').notNull().default('pending'),
    moderatedBy: uuid('moderated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    moderatedAt: timestamp('moderated_at', {
      withTimezone: true,
      mode: 'date',
    }),
    moderationNote: text('moderation_note'),

    // Popularity ranking (from Tranco list, lower = more popular, null = unranked)
    trancoRank: integer('tranco_rank'),
    trancoRankUpdatedAt: timestamp('tranco_rank_updated_at', {
      withTimezone: true,
      mode: 'date',
    }),

    // Vote score (cached sum of upvotes - downvotes)
    voteScore: integer('vote_score').notNull().default(0),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index('showcases_user_id_idx').on(table.userId),
    statusIdx: index('showcases_status_idx').on(table.status),
    isFeaturedIdx: index('showcases_is_featured_idx').on(table.isFeatured),
    createdAtIdx: index('showcases_created_at_idx').on(table.createdAt),
    moderatedByIdx: index('showcases_moderated_by_idx').on(table.moderatedBy),
    trancoRankIdx: index('showcases_tranco_rank_idx').on(table.trancoRank),
    voteScoreIdx: index('showcases_vote_score_idx').on(table.voteScore),
    // Note: GIN indexes for libraries and useCases arrays created via SQL migration
  }),
)

export type Showcase = InferSelectModel<typeof showcases>
export type NewShowcase = InferInsertModel<typeof showcases>

// Showcase votes table (user votes on showcases)
export const showcaseVotes = pgTable(
  'showcase_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    showcaseId: uuid('showcase_id')
      .notNull()
      .references(() => showcases.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    value: integer('value').notNull(), // 1 for upvote, -1 for downvote
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    showcaseUserUnique: unique().on(table.showcaseId, table.userId),
    showcaseIdIdx: index('showcase_votes_showcase_id_idx').on(table.showcaseId),
    userIdIdx: index('showcase_votes_user_id_idx').on(table.userId),
  }),
)

export type ShowcaseVote = InferSelectModel<typeof showcaseVotes>
export type NewShowcaseVote = InferInsertModel<typeof showcaseVotes>

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  oauthAccounts: many(oauthAccounts),
  roleAssignments: many(roleAssignments),
  docFeedback: many(docFeedback),
  announcementDismissals: many(announcementDismissals),
  bannerDismissals: many(bannerDismissals),
  loginHistory: many(loginHistory),
  auditLogs: many(auditLogs),
  userActivity: many(userActivity),
  showcases: many(showcases),
  showcaseVotes: many(showcaseVotes),
}))

export const rolesRelations = relations(roles, ({ many }) => ({
  roleAssignments: many(roleAssignments),
}))

export const roleAssignmentsRelations = relations(
  roleAssignments,
  ({ one }) => ({
    user: one(users, {
      fields: [roleAssignments.userId],
      references: [users.id],
    }),
    role: one(roles, {
      fields: [roleAssignments.roleId],
      references: [roles.id],
    }),
  }),
)

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.userId],
    references: [users.id],
  }),
}))

export const docFeedbackRelations = relations(docFeedback, ({ one }) => ({
  user: one(users, {
    fields: [docFeedback.userId],
    references: [users.id],
  }),
  moderator: one(users, {
    fields: [docFeedback.moderatedBy],
    references: [users.id],
  }),
}))

export const announcementDismissalsRelations = relations(
  announcementDismissals,
  ({ one }) => ({
    user: one(users, {
      fields: [announcementDismissals.userId],
      references: [users.id],
    }),
  }),
)

export const bannersRelations = relations(banners, ({ many }) => ({
  dismissals: many(bannerDismissals),
}))

export const bannerDismissalsRelations = relations(
  bannerDismissals,
  ({ one }) => ({
    banner: one(banners, {
      fields: [bannerDismissals.bannerId],
      references: [banners.id],
    }),
    user: one(users, {
      fields: [bannerDismissals.userId],
      references: [users.id],
    }),
  }),
)

export const loginHistoryRelations = relations(loginHistory, ({ one }) => ({
  user: one(users, {
    fields: [loginHistory.userId],
    references: [users.id],
  }),
}))

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}))

export const userActivityRelations = relations(userActivity, ({ one }) => ({
  user: one(users, {
    fields: [userActivity.userId],
    references: [users.id],
  }),
}))

export const showcasesRelations = relations(showcases, ({ one, many }) => ({
  user: one(users, {
    fields: [showcases.userId],
    references: [users.id],
  }),
  moderator: one(users, {
    fields: [showcases.moderatedBy],
    references: [users.id],
  }),
  votes: many(showcaseVotes),
}))

export const showcaseVotesRelations = relations(showcaseVotes, ({ one }) => ({
  showcase: one(showcases, {
    fields: [showcaseVotes.showcaseId],
    references: [showcases.id],
  }),
  user: one(users, {
    fields: [showcaseVotes.userId],
    references: [users.id],
  }),
}))

// MCP API Keys table (for authenticating MCP server requests)
export const mcpApiKeys = pgTable(
  'mcp_api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // The hashed API key (SHA-256)
    keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
    // First 8 chars of key for identification (e.g., "mcp_abc1...")
    keyPrefix: varchar('key_prefix', { length: 12 }).notNull(),
    // Human-readable name for the key
    name: varchar('name', { length: 255 }).notNull(),
    // Optional user association
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    // Rate limit tier (requests per minute)
    rateLimitPerMinute: integer('rate_limit_per_minute').notNull().default(200),
    // Key state
    isActive: boolean('is_active').notNull().default(true),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    keyHashIdx: index('mcp_api_keys_key_hash_idx').on(table.keyHash),
    userIdIdx: index('mcp_api_keys_user_id_idx').on(table.userId),
    isActiveIdx: index('mcp_api_keys_is_active_idx').on(table.isActive),
  }),
)

export type McpApiKey = InferSelectModel<typeof mcpApiKeys>
export type NewMcpApiKey = InferInsertModel<typeof mcpApiKeys>

// MCP Rate Limits table (sliding window rate limiting)
export const mcpRateLimits = pgTable(
  'mcp_rate_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Identifier for rate limiting (API key ID or IP address)
    identifier: varchar('identifier', { length: 255 }).notNull(),
    // Type of identifier
    identifierType: varchar('identifier_type', { length: 20 }).notNull(), // 'api_key' or 'ip'
    // Window start (minute granularity)
    windowStart: timestamp('window_start', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    // Request count in this window
    requestCount: integer('request_count').notNull().default(1),
  },
  (table) => ({
    identifierWindowUnique: uniqueIndex(
      'mcp_rate_limits_identifier_window_unique',
    ).on(table.identifier, table.windowStart),
    identifierIdx: index('mcp_rate_limits_identifier_idx').on(table.identifier),
    windowStartIdx: index('mcp_rate_limits_window_start_idx').on(
      table.windowStart,
    ),
  }),
)

export type McpRateLimit = InferSelectModel<typeof mcpRateLimits>
export type NewMcpRateLimit = InferInsertModel<typeof mcpRateLimits>

// MCP relations
export const mcpApiKeysRelations = relations(mcpApiKeys, ({ one }) => ({
  user: one(users, {
    fields: [mcpApiKeys.userId],
    references: [users.id],
  }),
}))

// ============================================================================
// OAuth MCP Tables
// ============================================================================

// OAuth MCP Authorization Codes (short-lived, 10 min)
export const oauthMcpAuthorizationCodes = pgTable(
  'oauth_mcp_authorization_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    codeHash: varchar('code_hash', { length: 64 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: varchar('client_id', { length: 255 }).notNull(),
    redirectUri: text('redirect_uri').notNull(),
    codeChallenge: varchar('code_challenge', { length: 128 }).notNull(),
    codeChallengeMethod: varchar('code_challenge_method', { length: 8 })
      .notNull()
      .default('S256'),
    scope: text('scope').notNull().default('mcp'),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    codeHashIdx: index('oauth_mcp_auth_codes_hash_idx').on(table.codeHash),
    expiresAtIdx: index('oauth_mcp_auth_codes_expires_idx').on(table.expiresAt),
  }),
)

export type OAuthMcpAuthorizationCode = InferSelectModel<
  typeof oauthMcpAuthorizationCodes
>
export type NewOAuthMcpAuthorizationCode = InferInsertModel<
  typeof oauthMcpAuthorizationCodes
>

// OAuth MCP Access Tokens (1 hour TTL)
export const oauthMcpAccessTokens = pgTable(
  'oauth_mcp_access_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: varchar('client_id', { length: 255 }).notNull(),
    scope: text('scope').notNull().default('mcp'),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tokenHashIdx: index('oauth_mcp_access_tokens_hash_idx').on(table.tokenHash),
    userIdIdx: index('oauth_mcp_access_tokens_user_idx').on(table.userId),
    expiresAtIdx: index('oauth_mcp_access_tokens_expires_idx').on(
      table.expiresAt,
    ),
  }),
)

export type OAuthMcpAccessToken = InferSelectModel<typeof oauthMcpAccessTokens>
export type NewOAuthMcpAccessToken = InferInsertModel<
  typeof oauthMcpAccessTokens
>

// OAuth MCP Refresh Tokens (30 day TTL)
export const oauthMcpRefreshTokens = pgTable(
  'oauth_mcp_refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: varchar('client_id', { length: 255 }).notNull(),
    accessTokenId: uuid('access_token_id').references(
      () => oauthMcpAccessTokens.id,
      { onDelete: 'set null' },
    ),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tokenHashIdx: index('oauth_mcp_refresh_tokens_hash_idx').on(
      table.tokenHash,
    ),
    userIdIdx: index('oauth_mcp_refresh_tokens_user_idx').on(table.userId),
  }),
)

export type OAuthMcpRefreshToken = InferSelectModel<
  typeof oauthMcpRefreshTokens
>
export type NewOAuthMcpRefreshToken = InferInsertModel<
  typeof oauthMcpRefreshTokens
>

// OAuth MCP relations
export const oauthMcpAuthorizationCodesRelations = relations(
  oauthMcpAuthorizationCodes,
  ({ one }) => ({
    user: one(users, {
      fields: [oauthMcpAuthorizationCodes.userId],
      references: [users.id],
    }),
  }),
)

export const oauthMcpAccessTokensRelations = relations(
  oauthMcpAccessTokens,
  ({ one, many }) => ({
    user: one(users, {
      fields: [oauthMcpAccessTokens.userId],
      references: [users.id],
    }),
    refreshTokens: many(oauthMcpRefreshTokens),
  }),
)

export const oauthMcpRefreshTokensRelations = relations(
  oauthMcpRefreshTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [oauthMcpRefreshTokens.userId],
      references: [users.id],
    }),
    accessToken: one(oauthMcpAccessTokens, {
      fields: [oauthMcpRefreshTokens.accessTokenId],
      references: [oauthMcpAccessTokens.id],
    }),
  }),
)
