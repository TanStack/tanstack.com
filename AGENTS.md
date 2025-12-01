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
const result = api.getData() as MyType;
const value = getValue<MyType>();
```

✅ **Good:**
```typescript
// Infer from schema or API definition
const result = api.getData(); // Type inferred from api.getData return type
const value = getValue(); // Type inferred from function implementation
```

If types need to be fixed, fix them at the source (schema, API definition, function signature) rather than casting at the point of use.

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

