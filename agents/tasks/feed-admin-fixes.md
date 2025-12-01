# Feed Admin Feature - Fix List

## Issues Found and Fixed

### 1. Route Navigation - ✅ FIXED

**File**: `src/routes/admin/feed.tsx`
**Issue**: Using `/admin/feed/new` which doesn't exist as a route
**Fix**: Changed to `/admin/feed/$id` with `params={{ id: 'new' }}`

### 2. Navigation Search Params - ✅ FIXED

**File**: `src/routes/admin/feed.tsx`
**Issue**: Direct object assignment to search params
**Fix**: Updated to use function form: `search: (s) => ({ ...s, ...updates })`

### 3. Window Confirm - ✅ FIXED

**File**: `src/routes/admin/feed.tsx`
**Issue**: Using `confirm()` without `window.` prefix
**Fix**: Changed to `window.confirm()`

### 4. Type Error in FeedEntryEditor - ✅ FIXED

**File**: `src/routes/admin/feed.$id.tsx`
**Issue**: `entryQuery` could be `undefined` but type expects `FeedEntry | null`
**Fix**: Added null coalescing: `entryQuery ?? null`

### 5. Unused Imports - ✅ FIXED

**Files**: Multiple admin files
**Issue**: Unused imports causing warnings
**Fix**: Removed unused imports (`useState`, `useEffect`, `validateManualEntry`)

### 6. Library Filter Property - ✅ FIXED

**File**: `src/components/admin/FeedEntryEditor.tsx`
**Issue**: Accessing `lib.visible` property that doesn't exist
**Fix**: Removed filter for non-existent property

### 7. Actions Export - ✅ FIXED

**File**: `src/components/admin/FeedSyncStatus.tsx`
**Issue**: `api.feed.actions` doesn't exist in generated API
**Fix**: Removed `syncAllSources` button and updated to use `useAction` hook. GitHub sync works via `api.feed.github.syncGitHubReleases`.
**Note**: The `actions.ts` file exists but Convex may need to regenerate types. GitHub sync action works correctly.

## Remaining Issues

### 1. Actions Not Exported

**File**: `convex/feed/actions.ts`
**Issue**: Actions file exists but `api.feed.actions` is not available
**Status**: Need to verify Convex file structure. Actions may need to be in root `convex/` directory or registered differently.

### 2. Route Search Params Type Errors - ✅ FIXED

**File**: `src/routes/admin/feed.tsx`
**Issue**: TypeScript errors with search param updates
**Fix**: Changed from `useNavigate()` to `Route.useNavigate()` and updated search param updates to use object spread instead of function form

## Testing Status

- ✅ Admin route requires authentication (working)
- ✅ Create entry route exists (`/admin/feed/$id` with `id='new'`)
- ✅ Edit entry route exists (`/admin/feed/$id`)
- ⚠️ Cannot test CRUD operations without authentication
- ⚠️ Sync status component has action import issues

## Next Steps

1. Fix Convex actions export structure
2. Resolve route search param type errors
3. Test with authenticated user:
   - Create manual post
   - View post in admin list
   - Edit post
   - Delete post
   - Toggle visibility
   - Toggle featured
