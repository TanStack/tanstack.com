# Agent Guidelines

## Typesafety

**Typesafety is of utmost importance.**

### Avoid Type Casting

We **never ever** cast types unless it's absolutely necessary. This includes:

- Manual generic type parameters (e.g., `<Type>`)
- Type assertions using `as`
- Type assertions using `satisfies`
- Any other form of type casting

### Prefer Type Inference

Always infer types and go up the logical chain as far as we can control to determine types. The preferred approach is:

1. **Schema validation** - Use schema definitions (e.g., Convex schema, Zod, etc.) as the source of truth
2. **Type inference from concrete sources** - Let TypeScript infer types from function return types, API responses, etc.
3. **Go up the chain** - Trace types back to their source rather than casting at the point of use

### Example

❌ **Bad:**

```typescript
const result = api.getData() as MyType
const value = getValue<MyType>()
```

✅ **Good:**

```typescript
// Infer from schema or API definition
const result = api.getData() // Type inferred from api.getData return type
const value = getValue() // Type inferred from function implementation
```

If types need to be fixed, fix them at the source (schema, API definition, function signature) rather than casting at the point of use.

### Generic Type Parameter Naming

**All generic type parameters must be prefixed with `T`.**

This convention makes it immediately clear that a name refers to a type parameter rather than a concrete type or value.

❌ **Bad:**

```typescript
function withCapability<Args extends unknown[], R>(
  handler: (user: AuthUser, ...args: Args) => R,
) { ... }
```

✅ **Good:**

```typescript
function withCapability<TArgs extends unknown[], TReturn>(
  handler: (user: AuthUser, ...args: TArgs) => TReturn,
) { ... }
```

Common examples:

- `T` for a single generic type
- `TArgs` for argument types
- `TReturn` for return types
- `TData` for data types
- `TError` for error types
- `TKey` for key types
- `TValue` for value types

## Route Loaders

### loaderDeps Must Be Specific

**loaderDeps must always be specific to what's actually used in the loader.**

Only include the properties from `search` (or other sources) that are actually used in the loader function. This ensures proper cache invalidation and prevents unnecessary re-runs when unrelated search params change.

❌ **Bad:**

```typescript
loaderDeps: ({ search }) => search, // Includes everything, even unused params
loader: async ({ deps }) => {
  // Only uses deps.page and deps.pageSize
  await fetchData({ page: deps.page, pageSize: deps.pageSize })
}
```

✅ **Good:**

```typescript
loaderDeps: ({ search }) => ({
  page: search.page,
  pageSize: search.pageSize,
  // Only include what's actually used in the loader
}),
loader: async ({ deps }) => {
  await fetchData({ page: deps.page, pageSize: deps.pageSize })
}
```

This ensures the loader only re-runs when the specific dependencies change, not when unrelated search params (like `expanded`, `viewMode`, etc.) change.

### Loaders Are Isomorphic

**Loaders in TanStack Start/Router are isomorphic and cannot call server logic unless via a call to a server function.**

Loaders run on both the server and client, so they cannot directly access server-only APIs (like file system, database connections, etc.). To perform server-side operations, loaders must call server functions (e.g., TanStack server functions created via `createServerFn()`, API routes, or other server functions).

❌ **Bad:**

```typescript
loader: async () => {
  // This won't work - direct server API access
  const data = await fs.readFile('data.json')
  return { data }
}
```

✅ **Good:**

```typescript
loader: async () => {
  // Call a server function instead
  // TanStack server functions created via createServerFn() can be called directly
  const data = await serverFn({ data: { id: '123' } })
  return { data }
}
```

## Server-Only Code and Environment Shaking

### TanStack Start Environment Shaking

**TanStack Start performs environment shaking - any code not referenced by a `createServerFn` handler is stripped from the client build.**

This means:

- Server-only code (database, file system, etc.) is automatically excluded from client bundles
- Only code inside `createServerFn` handlers is included in server bundles
- Code outside handlers is included in both server and client bundles

### Importing Server Functions

**Server functions wrapped in `createServerFn` can be safely imported statically in route files.**

❌ **Bad - Dynamic imports in component code:**

```typescript
// In a route component
const rolesQuery = useQuery({
  queryFn: async () => {
    const { listRoles } = await import('~/utils/roles.server')
    return listRoles({ data: {} })
  },
})
```

This causes bundler issues because dynamic imports can't be properly tree-shaken, potentially pulling server-only code (like `Buffer`, `drizzle`, `postgres`) into the client bundle.

✅ **Good - Static imports:**

```typescript
// At the top of the route file
import { listRoles } from '~/utils/roles.server'

// In component code
const rolesQuery = useQuery({
  queryFn: async () => {
    return listRoles({ data: {} })
  },
})
```

Since `listRoles` is wrapped in `createServerFn`, TanStack Start will properly handle environment shaking and exclude server-only dependencies from the client bundle.

### Rules for Server-Only Imports

1. **Server functions** (`createServerFn` wrappers) can be imported statically anywhere
2. **Direct server-only code** (database clients, file system, etc.) must ONLY be imported:
   - Inside `createServerFn` handlers
   - In separate server-only files (e.g., `*.server.ts`)
   - Never use dynamic imports (`await import()`) for server-only code in component code

## Development & Build Commands

### Don't Build After Every Change

**Do not run builds after every change, especially for visual changes.**

This is a visual website, not a library. Assume changes work unless the user reports otherwise. Running builds after every change wastes time and context.

### Run Linting After Code Changes

**After making code changes, always run `pnpm lint` to verify the code passes linting.**

Do NOT run tests after every change. Tests are run automatically by the pre-commit hook and CI. Linting is fast and catches most issues immediately.

### Debugging Visual Issues

When the user reports something doesn't work or look right:

1. Use the Playwright MCP to view the page and debug visually
2. Use builds (`pnpm build`) only when investigating build/bundler issues
3. Use linting (`pnpm lint`) to check for code issues

### Use `build` for Build-Specific Issues

**The `dev` command does not end, it runs indefinitely in watch mode.**

Only use `build` when:

- Investigating bundler or build-time errors
- Verifying production output
- The user specifically asks to verify the build

### Testing with Playwright

**Use the Playwright MCP for visual debugging and verification.**

When debugging issues or verifying visual changes work correctly:

- Navigate to the relevant page using Playwright
- Take snapshots or screenshots to verify the UI
- Interact with elements to test functionality

This is the preferred method for verifying visual changes since this is a visual site.

## UI Style Guide 2026

### Core Principles

- Prioritize clarity, hierarchy, and calm
- Use depth to communicate structure, not decoration
- Favor warmth and approachability over stark minimalism

### Layout

- Prefer fewer, well defined containers over many small sections
- Use generous spacing to create separation before adding visual effects
- Cards are acceptable when they express grouping or hierarchy

### Corners

- Rounded corners are standard
- Use subtle radius values that feel intentional, not playful
- Avoid sharp 90 degree corners unless intentionally industrial

### Shadows and Depth

- Shadows should be soft, low contrast, and diffused
- Use shadows to imply separation, not elevation theatrics
- Avoid heavy drop shadows or strong directional lighting
- One to two shadow layers max

### Cards

- Cards should feel grounded, not floating
- Prefer light elevation, border plus shadow, or surface contrast
- Avoid overusing cards as a default layout primitive

### Color and Surfaces

- Favor soft neutrals, off whites, and warm grays
- Use surface contrast or translucency instead of strong outlines
- Glass or frosted effects are acceptable when subtle and accessible

### Interaction

- Use micro transitions to reinforce spatial relationships
- Hover and focus states should feel responsive, not animated
- Avoid excessive motion or springy effects

### Typography

- Let type hierarchy do most of the work
- Strong headings, calm body text
- Avoid visual noise around content

### What to Avoid

- Chunky shadows
- Overly flat, sterile layouts
- Neumorphism as a primary style
- Over designed card grids

### Summary Rule

**If depth does not improve comprehension, remove it.**

## Writing Style

### Avoid Emdashes

**Never use emdashes (—) in writing. They make content smell like AI-generated text.**

Use these alternatives instead:

- Commas for parenthetical phrases
- Colons to introduce lists or explanations
- Periods to break into separate sentences
- Parentheses when appropriate

❌ **Bad:**

```
RSCs aren't about replacing client interactivity — they're about choosing where work happens.
```

✅ **Good:**

```
RSCs aren't about replacing client interactivity. They're about choosing where work happens.
```

❌ **Bad:**

```
Heavy dependencies — markdown parsers, syntax highlighters — stay on the server.
```

✅ **Good:**

```
Heavy dependencies (markdown parsers, syntax highlighters) stay on the server.
```
