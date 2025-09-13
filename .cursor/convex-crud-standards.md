# Convex CRUD Standards for TanStack.com

This document outlines the established patterns and standards for implementing CRUD operations using Convex in the TanStack.com codebase.

## Table of Contents

1. [Schema Design](#schema-design)
2. [Backend Patterns](#backend-patterns)
3. [Frontend Patterns](#frontend-patterns)
4. [Authentication & Authorization](#authentication--authorization)
5. [Error Handling](#error-handling)
6. [Performance & Optimization](#performance--optimization)
7. [Testing Patterns](#testing-patterns)
8. [Code Organization](#code-organization)

## Schema Design

### Table Definition Standards

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const schema = defineSchema({
  // Always include auth tables for user management
  ...authTables,

  // User-defined tables follow this pattern:
  table_name: defineTable({
    // Required fields
    userId: v.id('users'), // Foreign key to users table
    createdAt: v.number(), // Unix timestamp
    updatedAt: v.number(), // Unix timestamp

    // Optional fields with explicit optional typing
    fieldName: v.optional(v.string()),

    // Array fields with proper validation
    capabilities: v.array(
      v.union(...validCapabilities.map((cap) => v.literal(cap)))
    ),
  })
    // Always add indexes for common query patterns
    .index('by_userId', ['userId'])
    .index('by_userId_field', ['userId', 'fieldName'])
    // Add search indexes for text search
    .searchIndex('search_field', {
      searchField: 'fieldName',
    }),
})
```

### Schema Validation Standards

- **Always validate capabilities** using Zod schemas:

```typescript
// Export capability schemas for reuse
export const VALID_CAPABILITIES = ['admin', 'disableAds', 'builder'] as const
export const CapabilitySchema = z.enum(VALID_CAPABILITIES)
export type Capability = z.infer<typeof CapabilitySchema>

// Helper function for validation
export function validateCapability(
  capability: string
): capability is Capability {
  return VALID_CAPABILITIES.includes(capability as Capability)
}
```

- **Use proper field validation** with Convex validators
- **Include timestamps** (`createdAt`, `updatedAt`) on all user-created records
- **Add indexes** for all common query patterns
- **Use search indexes** for text-based filtering

## Backend Patterns

### Function Organization

Organize Convex functions by domain in separate files:

```
convex/
├── schema.ts          # Database schema
├── auth.ts           # Authentication functions
├── users.ts          # User management CRUD
├── forge.ts          # Project management CRUD
├── llmKeys.ts        # API key management CRUD
└── netlifyDeploy.ts  # Deployment actions
```

### Query Functions

```typescript
// convex/users.ts
export const listUsers = query({
  args: {
    pagination: v.object({
      limit: v.number(),
      cursor: v.optional(v.union(v.string(), v.null())),
    }),
    emailFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Authentication/Authorization check first
    await requireCapability(ctx, 'admin')

    // 2. Extract and validate arguments
    const limit = args.pagination.limit
    const cursor = args.pagination.cursor ?? null
    const emailFilter = args.emailFilter ?? ''

    // 3. Build query with proper indexing
    if (emailFilter && emailFilter.length > 0) {
      return await ctx.db
        .query('users')
        .withSearchIndex('search_email', (q) => q.search('email', emailFilter))
        .paginate({
          numItems: limit,
          cursor,
        })
    }

    // 4. Return paginated results
    return await ctx.db.query('users').order('desc').paginate({
      numItems: limit,
      cursor,
    })
  },
})
```

### Mutation Functions

```typescript
export const createMyLLMKey = mutation({
  args: {
    provider: v.string(),
    keyName: v.string(),
    apiKey: v.string(),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // 1. Authentication check
    const { currentUser } = await requireAuthentication(ctx)

    // 2. Validate and transform data
    const now = Date.now()
    const encryptedApiKey = await encryptApiKey(args.apiKey)

    // 3. Perform database operations
    const keyId = await ctx.db.insert('llm_keys', {
      userId: currentUser.userId as Id<'users'>,
      provider: args.provider,
      keyName: args.keyName,
      apiKey: encryptedApiKey,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    })

    // 4. Return success response
    return { success: true, keyId }
  },
})
```

### Action Functions

```typescript
export const deployToNetlify = action({
  args: {
    zipBase64: v.string(),
    siteName: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Validate environment variables
    const netlifyToken = process.env.NETLIFY_TOKEN
    if (!netlifyToken) {
      throw new Error('NETLIFY_TOKEN not configured')
    }

    // 2. Perform external API calls
    try {
      const createSiteResponse = await fetch(/* ... */)
      if (!createSiteResponse.ok) {
        const error = await createSiteResponse.text()
        throw new Error(`Failed to create site: ${error}`)
      }

      // 3. Return structured response
      return {
        url: deploy.ssl_url || deploy.url,
        claimUrl: claimUrl,
        siteId: siteId,
        deployId: deploy.id,
        siteName: site.name,
      }
    } catch (error) {
      console.error('Netlify deployment error:', error)
      throw error
    }
  },
})
```

## Frontend Patterns

### React Query Integration

Use `@convex-dev/react-query` for seamless integration with TanStack Query:

```typescript
// hooks/useCurrentUser.ts
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'

export function useCurrentUserQuery() {
  return useQuery(convexQuery(api.auth.getCurrentUser, {}))
}
```

### Direct Convex Hooks

For simple queries without complex caching needs:

```typescript
// components/UserProfile.tsx
import { useQuery, useMutation } from 'convex/react'
import { api } from 'convex/_generated/api'

function UserProfile() {
  const user = useQuery(api.auth.getCurrentUser)
  const updateProfile = useMutation(api.users.updateProfile)

  if (user === undefined) {
    return <div>Loading...</div>
  }

  return <div>{user.name}</div>
}
```

### Optimistic Updates

Use optimistic updates for better UX:

```typescript
const updateAdPreferenceMutation = useMutation(
  api.users.updateAdPreference
).withOptimisticUpdate((localStore, args) => {
  const { adsDisabled } = args
  const currentValue = localStore.getQuery(api.auth.getCurrentUser)
  if (currentValue !== undefined) {
    localStore.setQuery(
      api.auth.getCurrentUser,
      {},
      {
        ...currentValue,
        adsDisabled,
      }
    )
  }
})
```

### Authentication Components

Use Convex auth components for conditional rendering:

```typescript
import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react'

function App() {
  return (
    <>
      <AuthLoading>
        <div>Loading...</div>
      </AuthLoading>
      <Unauthenticated>
        <LoginForm />
      </Unauthenticated>
      <Authenticated>
        <Dashboard />
      </Authenticated>
    </>
  )
}
```

## Authentication & Authorization

### User Authentication

```typescript
// convex/auth.ts
export async function getCurrentUserConvex(ctx: QueryCtx) {
  const user = await getBetterAuthUser(ctx)
  if (!user) {
    return null
  }

  const userMetaData = await ctx.db.get(user.userId as Id<'users'>)
  return {
    ...user,
    ...userMetaData,
  } as TanStackUser
}
```

### Capability-Based Authorization

```typescript
// Helper function for capability validation
async function requireCapability(ctx: QueryCtx, capability: Capability) {
  const currentUser = await getCurrentUserConvex(ctx)
  if (!currentUser) {
    throw new Error('Not authenticated')
  }

  if (!currentUser.capabilities.includes(capability)) {
    throw new Error(`${capability} capability required`)
  }

  return { currentUser }
}

// Usage in functions
export const adminFunction = mutation({
  args: {
    /* ... */
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, 'admin')
    // Function implementation
  },
})
```

### Resource-Level Authorization

```typescript
async function checkIfUserHasAccess(
  ctx: QueryCtx,
  projectId: Id<'forge_projects'>
) {
  const currentUser = await getCurrentUserConvex(ctx)
  if (!currentUser) {
    throw new Error('Not authenticated')
  }

  const project = await ctx.db.get(projectId)
  if (project?.userId !== currentUser.userId) {
    throw new Error('You do not have access to this project')
  }

  return true
}
```

## Error Handling

### Backend Error Patterns

```typescript
// Always validate inputs and throw descriptive errors
export const updateMyLLMKey = mutation({
  args: {
    keyId: v.id('llm_keys'),
    provider: v.optional(v.string()),
    keyName: v.optional(v.string()),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { currentUser } = await requireAuthentication(ctx)

    // Validate resource exists
    const existingKey = await ctx.db.get(args.keyId)
    if (!existingKey) {
      throw new Error('LLM key not found')
    }

    // Validate ownership
    if (existingKey.userId !== (currentUser.userId as Id<'users'>)) {
      throw new Error('You can only update your own LLM keys')
    }

    // Perform update
    await ctx.db.patch(args.keyId, updateData)
    return { success: true }
  },
})
```

### Frontend Error Handling

```typescript
// Handle errors in React components
function UserSettings() {
  const updateProfile = useMutation(api.users.updateProfile)
  const { notify } = useToast()

  const handleUpdate = async (data: ProfileData) => {
    try {
      await updateProfile(data)
      notify('Profile updated successfully')
    } catch (error) {
      notify(`Failed to update profile: ${error.message}`)
    }
  }

  return <form onSubmit={handleUpdate}>...</form>
}
```

## Performance & Optimization

### Database Indexing

Always create indexes for common query patterns:

```typescript
// In schema.ts
forge_projects: defineTable({
  userId: v.id('users'),
  name: v.string(),
  description: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_userId', ['userId'])
  .index('by_userId_createdAt', ['userId', 'createdAt']),

forge_projectFiles: defineTable({
  projectId: v.string(),
  path: v.string(),
  content: v.string(),
})
  .index('by_projectId_path', ['projectId', 'path'])
  .index('by_projectId', ['projectId']),
```

### Pagination Patterns

```typescript
export const listUsers = query({
  args: {
    pagination: v.object({
      limit: v.number(),
      cursor: v.optional(v.union(v.string(), v.null())),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .order('desc')
      .paginate({
        numItems: args.pagination.limit,
        cursor: args.pagination.cursor ?? null,
      })
  },
})
```

### Data Transformation

```typescript
// Separate functions for different data needs
export const listMyLLMKeys = query({
  // Returns full keys for server use
  handler: async (ctx) => {
    const keys = await ctx.db.query('llm_keys').collect()
    return await Promise.all(
      keys.map(async (key) => ({
        ...key,
        apiKey: await decryptApiKey(key.apiKey),
      }))
    )
  },
})

export const listMyLLMKeysForDisplay = query({
  // Returns masked keys for client display
  handler: async (ctx) => {
    const keys = await ctx.db.query('llm_keys').collect()
    return await Promise.all(
      keys.map(async (key) => {
        const decryptedKey = await decryptApiKey(key.apiKey)
        return {
          ...key,
          apiKey: formatKeyForDisplay(decryptedKey),
        }
      })
    )
  },
})
```

## Testing Patterns

### Backend Testing

```typescript
// Test authentication and authorization
describe('LLM Keys', () => {
  it('should require authentication', async () => {
    await expect(
      ctx.runMutation(api.llmKeys.createMyLLMKey, {
        provider: 'openai',
        keyName: 'test',
        apiKey: 'sk-test',
      })
    ).rejects.toThrow('Not authenticated')
  })

  it('should only allow users to access their own keys', async () => {
    const keyId = await ctx.runMutation(api.llmKeys.createMyLLMKey, {
      provider: 'openai',
      keyName: 'test',
      apiKey: 'sk-test',
    })

    // Switch to different user context
    await expect(
      ctx.runMutation(api.llmKeys.deleteMyLLMKey, { keyId })
    ).rejects.toThrow('You can only delete your own LLM keys')
  })
})
```

### Frontend Testing

```typescript
// Test React components with Convex
import { render, screen } from '@testing-library/react'
import { ConvexProvider } from 'convex/react'

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={mockConvexClient}>{children}</ConvexProvider>
}

test('renders user profile', () => {
  render(
    <TestWrapper>
      <UserProfile />
    </TestWrapper>
  )

  expect(screen.getByText('John Doe')).toBeInTheDocument()
})
```

## Code Organization

### File Structure

```
convex/
├── schema.ts              # Database schema and types
├── auth.ts               # Authentication functions
├── auth.config.ts        # Auth configuration
├── users.ts              # User CRUD operations
├── forge.ts              # Project management CRUD
├── llmKeys.ts            # API key management CRUD
├── netlifyDeploy.ts      # Deployment actions
├── encryption.ts         # Encryption utilities
└── _generated/           # Auto-generated files
    ├── api.d.ts
    ├── api.js
    ├── dataModel.d.ts
    └── server.d.ts
```

### Naming Conventions

- **Functions**: Use descriptive names with action prefixes

  - `createMyLLMKey`, `updateMyLLMKey`, `deleteMyLLMKey`
  - `listUsers`, `getUser`, `updateUserCapabilities`
  - `deployToNetlify`, `addChatMessage`

- **Tables**: Use snake_case with descriptive names

  - `forge_projects`, `forge_projectFiles`, `forge_chatMessages`
  - `llm_keys`, `users`

- **Indexes**: Use descriptive names indicating purpose
  - `by_userId`, `by_projectId_path`, `by_userId_provider`

### Helper Functions

Extract common patterns into reusable helper functions:

```typescript
// convex/users.ts
async function requireCapability(ctx: QueryCtx, capability: Capability) {
  const currentUser = await getCurrentUserConvex(ctx)
  if (!currentUser) {
    throw new Error('Not authenticated')
  }

  if (!currentUser.capabilities.includes(capability)) {
    throw new Error(`${capability} capability required`)
  }

  return { currentUser }
}

// convex/llmKeys.ts
async function requireAuthentication(ctx: QueryCtx) {
  const currentUser = await getCurrentUserConvex(ctx)
  if (!currentUser) {
    throw new Error('Not authenticated')
  }

  return { currentUser }
}
```

## Best Practices Summary

1. **Always validate authentication** before performing operations
2. **Use capability-based authorization** for role-based access control
3. **Implement resource-level authorization** for user-owned resources
4. **Create proper database indexes** for all query patterns
5. **Use pagination** for list operations
6. **Separate concerns** between data access and business logic
7. **Handle errors gracefully** with descriptive error messages
8. **Use optimistic updates** for better user experience
9. **Encrypt sensitive data** before storing in database
10. **Follow consistent naming conventions** across the codebase
11. **Extract common patterns** into reusable helper functions
12. **Use TypeScript** for type safety throughout the stack
13. **Test authentication and authorization** thoroughly
14. **Document complex business logic** with clear comments

This document should be updated as new patterns emerge and existing patterns evolve in the TanStack.com codebase.
