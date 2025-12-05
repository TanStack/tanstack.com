# TanStack Feed Feature - Implementation Plan

## Overview

The Feed feature will serve as a centralized hub for all TanStack updates, announcements, and content. It will aggregate GitHub releases, blog posts, and manual announcements into a unified, filterable feed that users can customize to their interests.

## Core Requirements

- **Data Sources**: GitHub releases, blog posts, manual posts
- **Storage**: Convex database
- **Content**: Markdown support, tagging/categorization
- **Frontend**: `/feed` page with filtering capabilities
- **Admin**: Interface for composing and editing feed entries
- **Defaults**: Smart defaults (e.g., hide patch releases)

---

## 1. Data Model (Convex Schema)

### Feed Entry Schema

```typescript
// convex/schema.ts additions

feedEntries: defineTable({
  // Identity
  id: v.string(), // Unique identifier (e.g., "github:tanstack/query:v5.0.0" or UUID for manual)
  source: v.union(v.literal('github'), v.literal('blog'), v.literal('manual')),

  // Content
  title: v.string(),
  content: v.string(), // Markdown content
  excerpt: v.optional(v.string()), // Auto-generated or manual

  // Metadata
  publishedAt: v.number(), // Timestamp
  createdAt: v.number(),
  updatedAt: v.number(),

  // Source-specific data
  sourceData: v.union(
    // GitHub release
    v.object({
      type: v.literal('github'),
      repo: v.string(), // e.g., "tanstack/query"
      releaseId: v.string(), // GitHub release ID
      version: v.string(), // e.g., "v5.0.0"
      releaseType: v.union(
        v.literal('major'),
        v.literal('minor'),
        v.literal('patch'),
        v.literal('prerelease'),
      ),
      url: v.string(), // GitHub release URL
      author: v.optional(v.string()), // GitHub username
    }),
    // Blog post
    v.object({
      type: v.literal('blog'),
      slug: v.string(), // Blog post slug
      url: v.string(), // Blog post URL
      authors: v.array(v.string()),
    }),
    // Manual post
    v.object({
      type: v.literal('manual'),
      createdBy: v.id('users'), // Admin user who created it
      editedBy: v.optional(v.id('users')), // Last editor
    }),
  ),

  // Categorization
  libraryIds: v.array(v.string()), // Library IDs (e.g., ['query', 'router'])
  partnerIds: v.optional(v.array(v.string())), // Partner IDs if applicable
  tags: v.array(v.string()), // Custom tags (e.g., ['announcement', 'breaking-change'])
  category: v.union(
    v.literal('release'),
    v.literal('announcement'),
    v.literal('blog'),
    v.literal('partner'),
    v.literal('update'),
    v.literal('other'),
  ),

  // Display control
  isVisible: v.boolean(), // Can hide entries without deleting
  priority: v.optional(v.number()), // For manual ordering (higher = more prominent)
  featured: v.optional(v.boolean()), // Featured entries

  // Auto-sync metadata
  autoSynced: v.boolean(), // Whether this was auto-created
  lastSyncedAt: v.optional(v.number()), // Last sync timestamp
})
  .index('by_published', ['publishedAt'])
  .index('by_source', ['source'])
  .index('by_category', ['category'])
  .index('by_library', ['libraryIds'])
  .index('by_visible', ['isVisible', 'publishedAt'])
  .searchIndex('search_content', {
    searchField: 'title',
  })
```

### Feed Configuration Schema (for defaults/preferences)

```typescript
feedConfig: defineTable({
  key: v.string(), // e.g., 'defaultFilters'
  value: v.any(), // JSON value
  updatedAt: v.number(),
}).index('by_key', ['key'])
```

---

## 2. Data Sources & Ingestion

### 2.1 GitHub Releases Sync

**Location**: `convex/feed/github.ts`

**Functions**:

- `syncGitHubReleases`: Scheduled action (runs periodically)
  - Fetches releases from all TanStack repos
  - Creates/updates feed entries
  - Handles deduplication by release ID
  - Auto-generates library associations from repo names

**Repos to monitor** (from `src/libraries/index.tsx`):

- tanstack/start
- tanstack/router
- tanstack/query
- tanstack/table
- tanstack/form
- tanstack/virtual
- tanstack/ranger
- tanstack/store
- tanstack/pacer
- tanstack/db
- tanstack/config
- tanstack/devtools
- tanstack/react-charts
- tanstack/create-tsrouter-app

**Implementation Notes**:

- Use GitHub API (requires token in Convex secrets)
- Parse version strings to determine release type (major/minor/patch)
- Default: Hide patch releases unless manually featured
- Store full release notes as markdown content

### 2.2 Blog Posts Sync

**Location**: `convex/feed/blog.ts`

**Functions**:

- `syncBlogPosts`: Scheduled action or manual trigger
  - Reads from `content-collections` (via server function)
  - Creates feed entries for new blog posts
  - Links to existing blog post pages

**Implementation Notes**:

- Use existing blog post structure from `src/blog/*.md`
- Extract frontmatter (title, published, authors)
- Use excerpt or generate from content
- Auto-tag with 'blog' category

### 2.3 Manual Posts

**Location**: `convex/feed/manual.ts`

**Functions**:

- `createFeedEntry`: Mutation (admin only)
- `updateFeedEntry`: Mutation (admin only)
- `deleteFeedEntry`: Mutation (admin only) - soft delete via `isVisible: false`

**Implementation Notes**:

- Full markdown editor in admin interface
- Rich tagging/categorization UI
- Library/partner selection
- Preview before publishing

---

## 3. Frontend Components

### 3.1 Feed Page Route

**Location**: `src/routes/_libraries/feed.tsx`

**Features**:

- Infinite scroll or pagination
- Filter sidebar:
  - By source (GitHub, Blog, Manual)
  - By library (multi-select)
  - By category
  - By partner
  - By tags
  - Date range
- Default filters:
  - Hide patch releases
  - Show featured items first
  - Sort by published date (newest first)
- Search functionality
- URL state management (filters in search params)

**Search Params Schema**:

```typescript
z.object({
  sources: z.array(z.enum(['github', 'blog', 'manual'])).optional(),
  libraries: z.array(librarySchema).optional(),
  categories: z
    .array(
      z.enum(['release', 'announcement', 'blog', 'partner', 'update', 'other']),
    )
    .optional(),
  partners: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  hidePatch: z.boolean().optional().default(true),
  featured: z.boolean().optional(),
  search: z.string().optional(),
  page: z.number().optional().default(1),
})
```

### 3.2 Feed Entry Component

**Location**: `src/components/FeedEntry.tsx`

**Displays**:

- Entry type badge (GitHub Release, Blog Post, Announcement)
- Title
- Library/partner badges
- Published date
- Excerpt/preview
- Tags
- "Read more" link (to release/blog post or expand inline)
- Markdown-rendered content

### 3.3 Feed Filters Component

**Location**: `src/components/FeedFilters.tsx`

**Features**:

- Collapsible filter groups
- Clear all filters
- Save filter preferences (localStorage or user account)
- Active filter chips with remove buttons

---

## 4. Admin Interface

### 4.1 Admin Feed Route

**Location**: `src/routes/admin/feed.tsx`

**Features**:

- List all feed entries (with filters)
- Create new manual entry
- Edit any entry (including auto-synced ones)
- Toggle visibility
- Set featured status
- Bulk operations

### 4.2 Feed Entry Editor

**Location**: `src/components/admin/FeedEntryEditor.tsx`

**Features**:

- Markdown editor (with preview)
- Title input
- Content editor (markdown)
- Excerpt input (optional, auto-generate option)
- Library selection (multi-select)
- Partner selection (optional, multi-select)
- Tag input (autocomplete from existing tags)
- Category dropdown
- Featured toggle
- Visibility toggle
- Priority slider
- Publish date picker
- Save/Draft/Publish buttons
- Preview mode

### 4.3 Feed Sync Status

**Location**: `src/components/admin/FeedSyncStatus.tsx`

**Features**:

- Last sync timestamps for each source
- Manual sync triggers
- Sync error logs
- Entry counts by source

---

## 5. Convex Functions

### 5.1 Queries

**Location**: `convex/feed/queries.ts`

- `listFeedEntries`: Paginated query with filters
- `getFeedEntry`: Single entry by ID
- `getFeedStats`: Counts by source/category/library
- `searchFeedEntries`: Full-text search

### 5.2 Mutations

**Location**: `convex/feed/mutations.ts`

- `createFeedEntry`: Create manual entry (admin only)
- `updateFeedEntry`: Update any entry (admin only)
- `deleteFeedEntry`: Soft delete (admin only)
- `toggleFeedEntryVisibility`: Quick toggle (admin only)
- `setFeedEntryFeatured`: Toggle featured (admin only)

### 5.3 Actions (for external API calls)

**Location**: `convex/feed/actions.ts`

- `syncGitHubReleases`: Fetch and sync GitHub releases
- `syncBlogPosts`: Sync blog posts from content-collections
- `syncAllSources`: Master sync function

### 5.4 Scheduled Functions

**Location**: `convex/feed/crons.ts`

- `syncGitHubReleasesCron`: Run every 6 hours
- `syncBlogPostsCron`: Run daily

---

## 6. Implementation Phases

### Phase 1: Foundation

1. ✅ Add feed schema to Convex
2. ✅ Create basic Convex functions (queries/mutations)
3. ✅ Create `/feed` route with basic list view
4. ✅ Create FeedEntry component
5. ✅ Test with manual entries

### Phase 2: GitHub Integration

1. ✅ Implement GitHub API integration
2. ✅ Create sync action for GitHub releases
3. ✅ Map repos to library IDs
4. ✅ Auto-categorize by release type
5. ✅ Set up scheduled sync

### Phase 3: Blog Integration

1. ✅ Implement blog post sync
2. ✅ Link to existing blog routes
3. ✅ Extract metadata from blog posts

### Phase 4: Filtering & Search

1. ✅ Implement filter sidebar
2. ✅ Add search functionality
3. ✅ URL state management
4. ✅ Default filter preferences

### Phase 5: Admin Interface

1. ✅ Create admin feed list page
2. ✅ Build feed entry editor
3. ✅ Add edit capabilities for auto-synced entries
4. ✅ Sync status dashboard

### Phase 6: Polish & Optimization

1. ✅ Infinite scroll or pagination
2. ✅ Loading states
3. ✅ Error handling
4. ✅ SEO optimization
5. ✅ Analytics tracking

---

## 7. Technical Considerations

### 7.1 GitHub API

- Store GitHub token in Convex secrets
- Rate limiting: Use appropriate intervals for syncs
- Handle rate limit errors gracefully
- Cache release data to avoid redundant API calls

### 7.2 Performance

- Index feed entries by common filter combinations
- Use Convex pagination for large result sets
- Consider caching popular queries
- Optimize markdown rendering (lazy load)

### 7.3 Content Management

- Allow editing auto-synced entries (mark as "edited")
- Preserve original content in sourceData
- Track edit history (optional enhancement)
- Version control for manual entries (optional)

### 7.4 User Experience

- Clear visual distinction between entry types
- Smooth filtering transitions
- Persistent filter preferences
- Keyboard shortcuts for power users
- RSS feed generation (future enhancement)

---

## 8. File Structure

```
convex/
  feed/
    schema.ts          # Feed-specific schema additions
    queries.ts         # Feed queries
    mutations.ts       # Feed mutations
    actions.ts         # External API calls (GitHub, etc.)
    crons.ts           # Scheduled functions
    github.ts          # GitHub-specific logic
    blog.ts            # Blog-specific logic
    manual.ts          # Manual entry logic
    utils.ts           # Shared utilities

src/
  routes/
    _libraries/
      feed.tsx         # Main feed page
    admin/
      feed.tsx         # Admin feed list
      feed.$id.tsx     # Admin feed editor
  components/
    FeedEntry.tsx      # Feed entry display
    FeedFilters.tsx    # Filter sidebar
    FeedList.tsx       # Feed list container
    admin/
      FeedEntryEditor.tsx
      FeedSyncStatus.tsx
```

---

## 9. Future Enhancements

- **RSS Feed**: Generate RSS/Atom feed from entries
- **Email Digest**: Weekly/monthly email summaries
- **User Preferences**: Save user filter preferences to account
- **Notifications**: Notify users of entries matching their interests
- **Analytics**: Track which entries are most viewed/clicked
- **Social Sharing**: Easy share buttons for entries
- **Related Entries**: Show related entries based on tags/libraries
- **Changelog View**: Special view for just releases
- **Timeline View**: Visual timeline of all entries
- **Export**: Export feed as JSON/CSV for external use

---

## 10. Dependencies

### New Packages Needed

- GitHub API client (or use fetch with GitHub REST API)
- Markdown editor component (e.g., `@uiw/react-md-editor` or similar)
- Date picker (if not already in use)

### Convex Configuration

- GitHub token secret: `GITHUB_TOKEN`
- Optional: GitHub webhook for real-time release notifications

---

## 11. Testing Strategy

1. **Unit Tests**: Convex functions (queries/mutations)
2. **Integration Tests**: GitHub sync, blog sync
3. **E2E Tests**: Feed page filtering, admin editor
4. **Manual Testing**: Various filter combinations, edge cases

---

## 12. Migration Strategy

1. Start with empty feed
2. Backfill GitHub releases (last N releases per repo)
3. Backfill recent blog posts
4. Announce feature to users
5. Monitor and iterate based on feedback
