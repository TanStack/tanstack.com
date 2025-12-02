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
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'

// Enums
export const capabilityEnum = pgEnum('capability', [
  'admin',
  'disableAds',
  'builder',
  'feed',
])
export const feedCategoryEnum = pgEnum('feed_category', [
  'release',
  'announcement',
  'blog',
  'partner',
  'update',
  'other',
])
export const oauthProviderEnum = pgEnum('oauth_provider', ['github', 'google'])

// Type exports
export type Capability = 'admin' | 'disableAds' | 'builder' | 'feed'
export type FeedCategory =
  | 'release'
  | 'announcement'
  | 'blog'
  | 'partner'
  | 'update'
  | 'other'
export type OAuthProvider = 'github' | 'google'

// Constants
export const VALID_CAPABILITIES: readonly Capability[] = [
  'admin',
  'disableAds',
  'builder',
  'feed',
] as const
export const RELEASE_LEVELS = ['major', 'minor', 'patch'] as const
export type ReleaseLevel = (typeof RELEASE_LEVELS)[number]

// Users table
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }),
    displayUsername: varchar('display_username', { length: 255 }),
    image: text('image'),
    capabilities: capabilityEnum('capabilities').array().notNull().default([]),
    adsDisabled: boolean('ads_disabled').default(false),
    interestedInHidingAds: boolean('interested_in_hiding_ads').default(false),
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
  })
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
  })
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
      table.roleId
    ),
  })
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
  })
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
      'oauth_accounts_provider_account_unique'
    ).on(table.provider, table.providerAccountId),
    providerAccountIdx: index('oauth_accounts_provider_account_idx').on(
      table.provider,
      table.providerAccountId
    ),
  })
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
    source: varchar('source', { length: 50 }).notNull(), // e.g., "github", "blog", "manual"
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
    category: feedCategoryEnum('category').notNull(),
    // Display control
    isVisible: boolean('is_visible').notNull().default(true),
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
      table.publishedAt
    ),
    sourceIdx: index('feed_entries_source_idx').on(table.source),
    categoryIdx: index('feed_entries_category_idx').on(table.category),
    visiblePublishedIdx: index('feed_entries_visible_published_idx').on(
      table.isVisible,
      table.publishedAt
    ),
    // GIN indexes for array columns (created via SQL migration)
    // libraryIdsGin: index('feed_entries_library_ids_gin_idx').using('gin', table.libraryIds),
    // tagsGin: index('feed_entries_tags_gin_idx').using('gin', table.tags),
  })
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
  })
)

export type FeedConfig = InferSelectModel<typeof feedConfig>
export type NewFeedConfig = InferInsertModel<typeof feedConfig>

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  oauthAccounts: many(oauthAccounts),
  roleAssignments: many(roleAssignments),
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
  })
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
