---
title: "Announcing TanStack Table V9"
published: 2026-08-04
draft: true
excerpt: TanStack Table V9 is here with a tree-shakable feature architecture, fine-grained reactivity, improved performance, and first-class support for more frameworks.
library: table
authors:
  - Kevin Van Cott
---

![A wooden table on a beach at sunset](/blog-assets/announcing-tanstack-table-v9/header.png)

After more than two years of work (on and off), TanStack Table V9 is finally here and stable. It has turned out to be quite a major release, with not only a new internal architecture but also lots of new features, improvements, and fixes.

Back when we [announced the beta](/blog/tanstack-table-v9-taking-form) two months ago, we said that most of the development up to that point had focused on refactoring the internal architecture to support the new tree-shakable plugin system and the new state management system built on top of TanStack Store. But this new architecture turned out to be flexible enough to let us grow the library quickly during the beta. So here is a new, much fuller list of the improvements that TanStack Table V9 has to offer.

## What's New in TanStack Table V9

TanStack Table V9 is a major release, but the table logic and headless rendering model you already know are still here. Most of the changes are in the architecture underneath that model and in the new capabilities it makes possible. The main improvements fall into seven areas.

### 1. A Record Number of Framework Adapters Supported

Every framework adapter's reactivity system was completely overhauled in Table V9. With table state now built on TanStack Store, each adapter can connect the framework-agnostic core to its framework's native reactive model instead of working around assumptions inherited from React. This is especially significant for signal-based frameworks because table atoms now connect much more directly to signals, refs, runes, and tracked values, making those adapters more performant overall and bringing them much closer to true signal-based rendering. TanStack Table V9 now ships ten dedicated framework adapters, plus the framework-agnostic `@tanstack/table-core`. Read [Inside TanStack Table V9 Reactivity](/blog/tanstack-table-v9-reactivity) for a deeper look at how this new system works.

- [React Table](/table/latest/docs/framework/react/quick-start) supports React 18 and newer, works correctly under the React Compiler, and offers fine-grained reads through atoms, selectors, and `table.Subscribe`.
- [Preact Table](/table/latest/docs/framework/preact/quick-start) supports Preact 10 and newer with the same TanStack Store-backed atoms and fine-grained subscription model.
- [Vue Table](/table/latest/docs/framework/vue/quick-start) supports Vue 3.2 and newer, bridging table atoms to Vue refs and computed values while unwrapping reactive options such as `data`.
- [Solid Table](/table/latest/docs/framework/solid/quick-start) supports Solid 1.3 through the latest Solid 1.x releases, with table atom reads participating directly in Solid tracking inside JSX, memos, effects, and `table.Subscribe`. Solid 2 is not supported yet, but we plan to support it in TanStack Table V10 in the near future.
- [Svelte Table](/table/latest/docs/framework/svelte/quick-start) is built specifically for Svelte 5 and newer, with runes, Svelte-aware atom bindings, and native `$derived` projections.
- [Angular Table](/table/latest/docs/framework/angular/quick-start) supports Angular 19 and newer, bridging table atoms into Angular signals and `computed()` derivations.
- [Lit Table](/table/latest/docs/framework/lit/quick-start) supports Lit 3.1 and newer through a `TableController` reactive controller that can narrow host updates with selectors.
- [Alpine Table](/table/latest/docs/framework/alpine/quick-start) supports Alpine 3, automatically bridging TanStack Store updates into bindings that read table state and APIs.
- [Ember Table](/table/latest/docs/framework/ember/quick-start) supports Ember 5.8 and newer as a v2 addon, with Glimmer tracking, `.gts` and `.gjs` template tags, Glint, and Embroider support.
- [Octane Table](/table/latest/docs/framework/octane/quick-start) supports Octane 0.1 with TanStack Store-backed reactivity, `.tsrx` components, keyed rendering, and adapter-native subscription helpers.

### 2. Better Performance

Table V9 uses shared prototypes for row, column, cell, and header APIs instead of recreating the same methods for every object instance. That change can produce [dramatically lower memory usage at large scales](/blog/tanstack-table-v9-memory-performance). In our latest benchmark report, Table V9 used up to 86% less retained JavaScript heap than Table V8, reducing retained heap in the one-million-row, eight-column paginated cases from about 2.71 GB to about 380 MB. We also revisited the full client-side processing pipeline with better algorithms, more deliberate memoization, fewer unnecessary allocations, and faster paths for sorting, filtering, grouping, aggregation, expansion, selection, faceting, and column resizing. These improvements make client-side tables faster while allowing them to process substantially more data before memory becomes the limiting factor.

Our latest benchmark suite compares equivalent Table V8 and Table V9 client-side row-model operations over the same deterministic data. The summary below covers comparable runs at 20,000 rows and above, where durations are large enough to measure reliably. Table V9 reduced average processing time by 79% for the core row model, 52% for grouping and aggregation, 37% for sorting, and 34% for filtering. Across the measured categories, row processing ran roughly 1.5x to 3.9x faster.

| Category                 | n   | Avg improvement | Median | Min | Max | Total-time speedup            |
| ------------------------ | --- | --------------- | ------ | --- | --- | ----------------------------- |
| **Core row model**       | 3   | **79%**         | 80%    | 73% | 85% | 3.9x                          |
| **Grouping/aggregation** | 27  | **52%**         | 52%    | 29% | 84% | 1.7x                          |
| **Sorting**              | 36  | **37%**         | 37%    | 5%  | 60% | 1.6x                          |
| **Filtering**            | 23  | **34%**         | 35%    | 7%  | 52% | 1.5x                          |
| Expanding                | 2   | 74%             | —      | 72% | 76% | 3.7x                          |
| Faceting                 | 9   | 44%             | 36%    | 15% | 77% | 1.7x                          |
| Selection                | 5   | 43%             | 46%    | 18% | 52% | 1.6x                          |
| Pagination               | 0   | —               | —      | —   | —   | both versions < 5ms (instant) |

We should have a full write-up on the performance improvements soon, but that blog post is taking much longer to write than expected.

### 3. State Management Overhaul

Table state is now backed by [TanStack Store](/store/latest), whose fine-grained reactivity is built on the `alien-signals` architecture. Each framework adapter connects that state to its own reactive model, so components can subscribe to only the slices they use through table atoms, selectors, or framework-specific subscription helpers. You can still control state with the familiar `state` and `on[State]Change` options, or hand individual slices to external writable atoms when your table needs to share ownership with the rest of your application. We covered the design and its rendering benefits in more detail in [Inside TanStack Table V9 Reactivity](/blog/tanstack-table-v9-reactivity).

### 4. Type-Safety Improvements

Table V9 adds and revamps type helpers for columns, custom filtering, sorting, and aggregation functions, table options, shared components, and metadata. Table, column, and filter metadata can now be typed per table instead of requiring global declaration merging. The type system also understands which features a table has registered, so feature APIs only exist when they are actually available and feature prerequisites can be validated before runtime. We put substantial work into keeping that more capable type system fast, which we documented in [TypeScript Performance in TanStack Table V9](/blog/tanstack-table-v9-typescript-performance).

### 5. Tree Shaking and Extensibility

Features are explicit, modular, and tree-shakeable in Table V9. A table that only registers sorting does not need to ship filtering, pagination, grouping, or the rest of the built-in feature set. Row model factories and registered filter, sort, and aggregation functions are defined alongside features with `tableFeatures()`, allowing unused processing code to be removed too. Custom features now use this same system, giving your own plugins the same typed access to state, options, defaults, and APIs as the features maintained in Table core.

A table that only needs client-side pagination can declare exactly that feature and row model:

```tsx
import {
  createPaginatedRowModel,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";

const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(), // Only if client-side pagination is needed
});

const table = useTable({
  features,
  columns,
  data,
});
```

No other features will be included in the bundle, unless you add them explicitly. This should mean that the average table in an application will be smaller by using TanStack Table V9 compared to Table V8, even though the total package size has increased from 14kb to 25kb at the time of writing. TanStack Table V9 is able to offer more while staying lean for your use-cases.

### 6. Composability

The new architecture makes it easier to move from configuring one table to building a consistent table system for an entire product. `tableOptions()` lets you compose reusable features, row models, functions, defaults, and other configuration while preserving inference. `createTableHook()` can take that composition further by creating an app-specific table hook or factory with features and component conventions already bound. Individual tables can stay concise without giving up the ability to customize what makes each one unique.

### 7. New and Refreshed Features

Table V9 introduces [Cell Selection](/table/latest/docs/framework/react/guide/cell-selection), including rectangular ranges, drag selection, Shift extension, and multiple disjoint ranges. It also adds [Cell Spanning](/table/latest/docs/framework/react/guide/cell-spanning) across rows and columns, span-aware cell selection, and computed header row spans for complex header layouts. Existing features received meaningful upgrades as well: columns can define multiple aggregations, row selection supports Shift range selection, and column resizing has been expanded and optimized. New table and row APIs such as `table.getMaxSubRowDepth()` and `row.getDisplayIndex()` round out the refreshed feature set.

## Where Does TanStack Table Go From Here?

TanStack Table V9 is a foundational release. More than any one feature, its most important contribution is the foundation it provides for everything that comes next. The tree-shakable plugin architecture lets us add features without adding all of that code or API surface to every table. We can grow TanStack Table in more ambitious directions while keeping each application focused on only the capabilities it chooses to use.

Table V8 and Table V9 were released more than four years apart, and we do not anticipate waiting that long for Table V10. One reason TanStack Table V9 took so long was a changing of the guard. Over the past few years, I (Kevin Van Cott) have taken over the project from Tanner, with Riccardo Perra joining more recently. We are already exploring further state management improvements and larger optional features, including Solid 2 support, full pivoting, advanced filter expressions, and more. Table V9 gives us the architecture to build those capabilities as composable features instead of making every user carry the cost of the entire roadmap.

## Migrate to TanStack Table V9

Choose your framework's migration guide to get started. For adapters without a dedicated migration guide, use the Table V9 Quick Start guide.

- [React Table Migration Guide](/table/latest/docs/framework/react/guide/migrating)
- [Preact Table Migration Guide](/table/latest/docs/framework/preact/guide/migrating)
- [Vue Table Migration Guide](/table/latest/docs/framework/vue/guide/migrating)
- [Solid Table Migration Guide](/table/latest/docs/framework/solid/guide/migrating)
- [Svelte Table Migration Guide](/table/latest/docs/framework/svelte/guide/migrating)
- [Angular Table Migration Guide](/table/latest/docs/framework/angular/guide/migrating)
- [Lit Table Migration Guide](/table/latest/docs/framework/lit/guide/migrating)
- [Alpine Table Quick Start](/table/latest/docs/framework/alpine/quick-start)
- [Ember Table Quick Start](/table/latest/docs/framework/ember/quick-start)
- [Octane Table Quick Start](/table/latest/docs/framework/octane/quick-start)
