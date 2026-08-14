// Base library data - lightweight, stays in main bundle
// Extended library data (with React nodes, testimonials, etc.) is in individual library files

import { redirect } from '@tanstack/react-router'
import type { LibrarySlim, LibraryId } from './types'
import { categoryStyles } from './categories'
import { handleRedirects } from '~/utils/handleRedirects'
export { libraryIds, SIDEBAR_LIBRARY_IDS } from './ids'

export const query: LibrarySlim = {
  id: 'query',
  ...categoryStyles.data,
  name: 'TanStack Query',
  to: '/query/latest',
  tagline:
    'Powerful asynchronous state management, server-state utilities and data fetching',
  description:
    'Powerful asynchronous state management, server-state utilities and data fetching. Fetch, cache, update, and wrangle all forms of async data in your TS/JS, React, Vue, Solid, Svelte, Angular & Lit applications all without touching any "global state"',
  badge: undefined,
  repo: 'tanstack/query',
  frameworks: ['react', 'preact', 'solid', 'vue', 'svelte', 'angular', 'lit'],
  latestVersion: 'v5',
  latestBranch: 'main',
  corePackageName: '@tanstack/query-core',
  npmPackageNames: ['@tanstack/query-core', 'react-query'],
  availableVersions: ['v5', 'v4', 'v3'],
  scarfId: '53afb586-3934-4624-a37a-e680c1528e17',
  defaultDocs: 'framework/react/overview',
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
  installPath: 'framework/$framework/installation',
  legacyPackages: ['react-query'],
  handleRedirects: (href) => {
    handleRedirects(
      reactQueryV3List,
      href,
      '/query/v3',
      '/query/latest',
      'from=reactQueryV3',
    )

    handleRedirects(
      reactQueryV3RemovedInV5List,
      href,
      '/query/v3',
      '/query/v5',
      'from=reactQueryV3',
    )

    handleRedirects(
      queryCommunityLinks,
      href,
      '/query/latest',
      '/query/latest',
      'from=communityLinks',
    )
  },
}

// Redirect old query v3 docs
// prettier-ignore
const reactQueryV3List = [
    {from: "overview", to: "docs/framework/react/overview"},
    {from: "installation", to: "docs/framework/react/installation"},
    {from: "quick-start", to: "docs/framework/react/quick-start"},
    {from: "devtools", to: "docs/framework/react/devtools"},
    {from: "videos", to: "docs/framework/react/videos"},
    {from: "comparison", to: "docs/framework/react/comparison"},
    {from: "typescript", to: "docs/framework/react/typescript"},
    {from: "graphql", to: "docs/framework/react/graphql"},
    {from: "react-native", to: "docs/framework/react/react-native"},
    {from: "guides/important-defaults", to: "docs/framework/react/guides/important-defaults"},
    {from: "guides/queries", to: "docs/framework/react/guides/queries"},
    {from: "guides/query-keys", to: "docs/framework/react/guides/query-keys"},
    {from: "guides/query-functions", to: "docs/framework/react/guides/query-functions"},
    {from: "guides/network-mode", to: "docs/framework/react/guides/network-mode"},
    {from: "guides/parallel-queries", to: "docs/framework/react/guides/parallel-queries"},
    {from: "guides/dependent-queries", to: "docs/framework/react/guides/dependent-queries"},
    {from: "guides/background-fetching-indicators", to: "docs/framework/react/guides/background-fetching-indicators"},
    {from: "guides/window-focus-refetching", to: "docs/framework/react/guides/window-focus-refetching"},
    {from: "guides/disabling-queries", to: "docs/framework/react/guides/disabling-queries"},
    {from: "guides/query-retries", to: "docs/framework/react/guides/query-retries"},
    {from: "guides/paginated-queries", to: "docs/framework/react/guides/paginated-queries"},
    {from: "guides/infinite-queries", to: "docs/framework/react/guides/infinite-queries"},
    {from: "guides/placeholder-query-data", to: "docs/framework/react/guides/placeholder-query-data"},
    {from: "guides/initial-query-data", to: "docs/framework/react/guides/initial-query-data"},
    {from: "guides/prefetching", to: "docs/framework/react/guides/prefetching"},
    {from: "guides/mutations", to: "docs/framework/react/guides/mutations"},
    {from: "guides/query-invalidation", to: "docs/framework/react/guides/query-invalidation"},
    {from: "guides/invalidations-from-mutations", to: "docs/framework/react/guides/invalidations-from-mutations"},
    {from: "guides/updates-from-mutation-responses", to: "docs/framework/react/guides/updates-from-mutation-responses"},
    {from: "guides/optimistic-updates", to: "docs/framework/react/guides/optimistic-updates"},
    {from: "guides/query-cancellation", to: "docs/framework/react/guides/query-cancellation"},
    {from: "guides/scroll-restoration", to: "docs/framework/react/guides/scroll-restoration"},
    {from: "guides/filters", to: "docs/framework/react/guides/filters"},
    {from: "guides/ssr", to: "docs/framework/react/guides/ssr"},
    {from: "guides/caching", to: "docs/framework/react/guides/caching"},
    {from: "guides/default-query-function", to: "docs/framework/react/guides/default-query-function"},
    {from: "guides/suspense", to: "docs/framework/react/guides/suspense"},
    {from: "guides/testing", to: "docs/framework/react/guides/testing"},
    {from: "guides/does-this-replace-client-state", to: "docs/framework/react/guides/does-this-replace-client-state"},
    {from: "guides/migrating-to-react-query-3", to: "docs/framework/react/guides/migrating-to-react-query-3"},
    {from: "guides/migrating-to-react-query-4", to: "docs/framework/react/guides/migrating-to-react-query-4"},
    {from: "community/tkdodos-blog", to: "docs/framework/react/community/tkdodos-blog"},
    {from: "examples/simple", to: "docs/framework/react/examples/simple"},
    {from: "examples/basic-graphql-request", to: "docs/framework/react/examples/basic-graphql-request"},
    {from: "examples/custom-hooks", to: "docs/framework/react/examples/custom-hooks"},
    {from: "examples/auto-refetching", to: "docs/framework/react/examples/auto-refetching"},
    {from: "examples/focus-refetching", to: "docs/framework/react/examples/focus-refetching"},
    {from: "examples/optimistic-updates", to: "docs/framework/react/examples/optimistic-updates-typescript"},
    {from: "examples/optimistic-updates-typescript", to: "docs/framework/react/examples/optimistic-updates-typescript"},
    {from: "examples/pagination", to: "docs/framework/react/examples/pagination"},
    {from: "examples/load-more-infinite-scroll", to: "docs/framework/react/examples/load-more-infinite-scroll"},
    {from: "examples/suspense", to: "docs/framework/react/examples/suspense"},
    {from: "examples/default-query-function", to: "docs/framework/react/examples/default-query-function"},
    {from: "examples/playground", to: "docs/framework/react/examples/playground"},
    {from: "examples/prefetching", to: "docs/framework/react/examples/prefetching"},
    {from: "examples/star-wars", to: "docs/framework/react/examples/star-wars"},
    {from: "examples/rick-morty", to: "docs/framework/react/examples/rick-morty"},
    {from: "examples/nextjs", to: "docs/framework/react/examples/nextjs"},
    {from: "examples/react-native", to: "docs/framework/react/examples/react-native"},
    {from: "examples/offline", to: "docs/framework/react/examples/offline"},
    {from: "plugins/persistQueryClient", to: "docs/framework/react/plugins/persistQueryClient"},
    {from: "plugins/broadcastQueryClient", to: "docs/framework/react/plugins/broadcastQueryClient"},
    {from: "reference/useQueries", to: "docs/framework/react/reference/useQueries"},
    {from: "reference/useInfiniteQuery", to: "docs/framework/react/reference/useInfiniteQuery"},
    {from: "reference/useMutation", to: "docs/framework/react/reference/useMutation"},
    {from: "reference/useIsFetching", to: "docs/framework/react/reference/useIsFetching"},
    {from: "reference/useIsMutating", to: "docs/framework/react/reference/useIsMutating"},
    {from: "reference/QueryClientProvider", to: "docs/framework/react/reference/QueryClientProvider"},
    {from: "reference/useQueryClient", to: "docs/framework/react/reference/useQueryClient"},
    {from: "reference/QueryCache", to: "docs/reference/QueryCache"},
    {from: "reference/MutationCache", to: "docs/reference/MutationCache"},
    {from: "reference/QueryObserver", to: "docs/reference/QueryObserver"},
    {from: "reference/InfiniteQueryObserver", to: "docs/reference/InfiniteQueryObserver"},
    {from: "reference/QueriesObserver", to: "docs/reference/QueriesObserver"},
    {from: "reference/QueryErrorResetBoundary", to: "docs/framework/react/reference/QueryErrorResetBoundary"},
    {from: "reference/useQueryErrorResetBoundary", to: "docs/framework/react/reference/useQueryErrorResetBoundary"},
    {from: "reference/focusManager", to: "docs/reference/focusManager"},
    {from: "reference/onlineManager", to: "docs/reference/onlineManager"},
    {from: "reference/hydration", to: "docs/framework/react/reference/hydration"},
    {from: "reference/useQuery", to: "docs/framework/react/reference/useQuery"},
    {from: "reference/QueryClient", to: "docs/reference/QueryClient"},
    {from: "examples/basic", to: "docs/framework/react/examples/basic"},
    // {from: '',to: ''},
  ]

/**
  Features that have been removed in v5
*/
// prettier-ignore
const reactQueryV3RemovedInV5List = [
    {from: "guides/custom-logger", to: "docs/framework/react/guides/migrating-to-v5#the-deprecated-custom-logger-has-been-removed"},
    {from: "plugins/createWebStoragePersister", to: "docs/framework/react/guides/migrating-to-react-query-4#persistqueryclient-and-the-corresponding-persister-plugins-are-no-longer-experimental-and-have-been-renamed"},
    {from: "plugins/createAsyncStoragePersister", to: "docs/framework/react/guides/migrating-to-react-query-4#persistqueryclient-and-the-corresponding-persister-plugins-are-no-longer-experimental-and-have-been-renamed"},
]

/*
Community resources section to new location
*/
// prettier-ignore
const queryCommunityLinks = [
  {
    from: 'docs/framework/react/community/tkdodos-blog',
    to: 'docs/community-resources',
  },
  {
    from: 'docs/framework/react/community/community-projects',
    to: 'docs/community-resources',
  },
  {
    from: 'docs/framework/solid/community/tkdodos-blog',
    to: 'docs/community-resources',
  },
  {
    from: 'docs/framework/solid/community/community-projects',
    to: 'docs/community-resources',
  },
  {
    from: 'docs/framework/vue/community/tkdodos-blog',
    to: 'docs/community-resources',
  },
  {
    from: 'docs/framework/vue/community/community-projects',
    to: 'docs/community-resources',
  },
  {
    from: 'docs/framework/react/videos',
    to: 'docs/community-resources',
  },
]

export const router: LibrarySlim = {
  id: 'router',
  ...categoryStyles.framework,
  name: 'TanStack Router',
  installPath: 'framework/$framework/quick-start',
  to: '/router/latest',
  tagline: 'Type-safe Routing for React and Solid applications',
  description:
    'A powerful React router for client-side and full-stack react applications. Fully type-safe APIs, first-class search-params for managing state in the URL and seamless integration with the existing React ecosystem.',
  badge: undefined,
  repo: 'tanstack/router',
  frameworks: ['react', 'solid'],
  corePackageName: '@tanstack/router-core',
  npmPackageNames: ['@tanstack/router-core', 'react-location'],
  latestVersion: 'v1',
  latestBranch: 'main',
  availableVersions: ['v1'],
  scarfId: '3d14fff2-f326-4929-b5e1-6ecf953d24f4',
  docsRoot: 'docs/router',
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
  legacyPackages: ['react-location'],
  hideCodesandboxUrl: true,
  handleRedirects: (href) => {
    if (href.includes('router/latest/docs/framework/react/start')) {
      throw redirect({
        href: href.replace(
          'router/latest/docs/framework/react/start',
          'start/latest/docs/framework/react',
        ),
      })
    }

    if (href.includes('/router/latest/docs/framework/react/examples/start')) {
      throw redirect({
        href: href.replace(
          'router/latest/docs/framework/react/examples/start',
          'start/latest/docs/framework/react/examples/start',
        ),
      })
    }

    // Rewrite framework-specific guides to generic guides
    // e.g. /router/latest/docs/framework/react/overview -> /router/latest/docs/overview
    // e.g. /router/latest/docs/framework/react/xyz -> /router/latest/docs/xyz
    // e.g. /router/latest/docs/framework/react/xyz/ssr -> /router/latest/docs/xyz/ssr
    // However, examples should still point to the framework-specific examples
    // e.g. /router/latest/docs/framework/react/examples/ssr -> /router/latest/docs/framework/react/examples/ssr
    // e.g. /router/latest/docs/framework/react/examples/xyz -> /router/latest/docs/framework/react/examples/xyz
    const frameworkMatch = href.match(
      /\/router\/([^/]+)\/docs\/framework\/[^/]+\/(.+)/,
    )
    if (frameworkMatch && !href.includes('/examples/')) {
      const [, version, restPath] = frameworkMatch
      throw redirect({
        href: `/router/${version}/docs/${restPath}`,
      })
    }
  },
}

export const start: LibrarySlim = {
  id: 'start',
  ...categoryStyles.framework,
  name: 'TanStack Start',
  to: '/start/latest',
  tagline:
    'Full-stack Framework powered by TanStack Router for React and Solid',
  description:
    'Full-document SSR, Streaming, Server Functions, bundling and more, powered by TanStack Router and Vite - Ready to deploy to your favorite hosting provider.',
  badge: 'RC',
  repo: 'tanstack/router',
  frameworks: ['react', 'solid'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  corePackageName: '@tanstack/start-client-core',
  npmPackageNames: ['@tanstack/start-client-core'],
  scarfId: 'b6e2134f-e805-401d-95c3-2a7765d49a3d',
  docsRoot: 'docs/start',
  defaultDocs: 'framework/react/overview',
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
  installPath: 'framework/$framework/build-from-scratch',
  embedEditor: 'codesandbox',
  showNetlifyUrl: true,
  showCloudflareUrl: true,
  showRailwayUrl: true,
  hideStackblitzUrl: true,
}

export const table: LibrarySlim = {
  id: 'table',
  ...categoryStyles.ui,
  name: 'TanStack Table',
  to: '/table/latest',
  tagline: 'Headless, type-safe table and data-grid infrastructure',
  description:
    'Build tables and data grids with feature-level tree shaking, reactive state, fast row models, and complete control over markup and styles.',
  badge: 'fresh',
  repo: 'tanstack/table',
  frameworks: [
    'angular',
    'ember',
    'octane',
    'react',
    'preact',
    'solid',
    'svelte',
    'vue',
    'lit',
    'alpine',
    'vanilla',
  ],
  latestVersion: 'v9',
  latestBranch: 'main',
  availableVersions: ['v9', 'v8'],
  scarfId: 'dc8b39e1-3fe9-4f3a-8e56-d4e2cf420a9e',
  defaultDocs: 'overview',
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
  corePackageName: '@tanstack/table-core',
  npmPackageNames: ['@tanstack/table-core', 'react-table'],
  legacyPackages: ['react-table'],
  handleRedirects: (href) => {
    handleRedirects(
      reactTableV7List,
      href,
      '/table/v7',
      '/table/v8',
      'from=reactTableV7',
    )
  },
}

export const charts: LibrarySlim = {
  id: 'charts',
  ...categoryStyles.ui,
  name: 'TanStack Charts',
  to: '/charts/latest',
  tagline: "A chart grammar you don't have to outgrow.",
  description:
    'A typed, tree-shakable chart grammar for SVG and Canvas. Compose marks, views, scales, transforms, interactions, and motion with compact primitives or D3-compatible inputs.',
  repo: 'tanstack/charts',
  frameworks: [
    'react',
    'preact',
    'vue',
    'solid',
    'svelte',
    'angular',
    'lit',
    'alpine',
    'octane',
    'vanilla',
  ],
  corePackageName: '@tanstack/charts',
  npmPackageNames: ['@tanstack/charts'],
  frameworkPackageNames: {
    react: '@tanstack/charts',
    preact: '@tanstack/charts',
    vue: '@tanstack/charts',
    solid: '@tanstack/charts',
    svelte: '@tanstack/charts',
    angular: '@tanstack/charts',
    lit: '@tanstack/charts',
    alpine: '@tanstack/charts',
    octane: '@tanstack/charts',
    vanilla: '@tanstack/charts',
  },
  frameworkDocs: {
    react: 'framework/react/adapter',
    preact: 'framework/preact/adapter',
    vue: 'framework/vue/adapter',
    solid: 'framework/solid/adapter',
    svelte: 'framework/svelte/adapter',
    angular: 'framework/angular/adapter',
    lit: 'framework/lit/adapter',
    alpine: 'framework/alpine/adapter',
    octane: 'framework/octane/adapter',
    vanilla: 'quick-start',
  },
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  statsAvailable: false,
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
}

// prettier-ignore
const reactTableV7List = [
    {from: 'docs/api/overview',to: 'docs/overview',},
    {from: 'docs/api/useColumnOrder',to: 'docs/api/features/column-ordering',},
    {from: 'docs/api/useExpanded',to: 'docs/api/features/expanding',},
    {from: 'docs/api/useFilters',to: 'docs/api/features/filters',},
    {from: 'docs/api/useGlobalFilter',to: 'docs/api/features/filters',},
    {from: 'docs/api/useGroupBy',to: 'docs/api/features/grouping',},
    {from: 'docs/api/usePagination',to: 'docs/api/features/pagination',},
    {from: 'docs/api/useResizeColumns',to: 'docs/api/features/column-sizing',},
    {from: 'docs/api/useRowSelect',to: 'docs/api/features/row-selection',},
    {from: 'docs/api/useSortBy',to: 'docs/api/features/sorting',},
    {from: 'docs/api/useTable',to: 'docs/guide/tables',},
    {from: 'docs/examples/basic',to: 'docs/framework/react/examples/basic',},
    {from: 'docs/examples/filtering',to: 'docs/framework/react/examples/filters',},
    {from: 'docs/examples/footers',to: 'docs/framework/react/examples/basic',},
    {from: 'docs/examples/grouping',to: 'docs/framework/react/examples/grouping',},
    {from: 'docs/examples/pagination-controlled',to: 'docs/framework/react/examples/pagination-controlled',},
    {from: 'docs/examples/pagination',to: 'docs/framework/react/examples/pagination',},
    {from: 'docs/examples/sorting',to: 'docs/framework/react/examples/sorting',},
    {from: 'docs/examples/row-selection',to: 'docs/framework/react/examples/row-selection',},
    {from: 'docs/examples/row-selection-with-pagination',to: 'docs/framework/react/examples/row-selection',},
    {from: 'docs/examples/expanding',to: 'docs/framework/react/examples/expanding',},
    {from: 'docs/examples/editable-data',to: 'docs/framework/react/examples/editable-data',},
    {from: 'docs/examples/column-ordering',to: 'docs/framework/react/examples/column-ordering',},
    {from: 'docs/examples/column-hiding',to: 'docs/framework/react/examples/column-visibility',},
    {from: 'docs/examples/column-resizing',to: 'docs/framework/react/examples/column-sizing',},
    {from: 'docs/installation',to: 'docs/installation',},
    {from: 'docs/overview',to: 'docs/introduction',},
    {from: 'docs/quick-start',to: 'docs/overview',},
]

export const form: LibrarySlim = {
  id: 'form',
  ...categoryStyles.ui,
  name: 'TanStack Form',
  to: '/form/latest',
  tagline: 'Headless UI for building performant and type-safe forms',
  description:
    'Headless, performant, and type-safe form state management for TS/JS, React, Preact, Vue, Angular, Solid, Lit and Svelte.',
  badge: undefined,
  repo: 'tanstack/form',
  corePackageName: '@tanstack/form-core',
  npmPackageNames: ['@tanstack/form-core'],
  frameworks: ['react', 'preact', 'vue', 'angular', 'solid', 'lit', 'svelte'],
  latestVersion: 'v1',
  latestBranch: 'main',
  availableVersions: ['v1', 'alpha'],
  scarfId: '72ec4452-5d77-427c-b44a-57515d2d83aa',
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
}

export const virtual: LibrarySlim = {
  id: 'virtual',
  ...categoryStyles.performance,
  name: 'TanStack Virtual',
  to: '/virtual/latest',
  tagline: 'Headless UI for Virtualizing Large Element Lists',
  description:
    'Virtualize only the visible content for massive scrollable DOM nodes at 60FPS in TS/JS, React, Vue, Solid, Svelte, Lit, Angular & Marko while retaining 100% control over markup and styles.',
  badge: undefined,
  repo: 'tanstack/virtual',
  frameworks: ['react', 'solid', 'vue', 'svelte', 'lit', 'angular', 'marko'],
  corePackageName: '@tanstack/virtual-core',
  npmPackageNames: ['@tanstack/virtual-core', 'react-virtual'],
  latestVersion: 'v3',
  latestBranch: 'main',
  availableVersions: ['v3'],
  scarfId: '32372eb1-91e0-48e7-8df1-4808a7be6b94',
  defaultDocs: 'introduction',
  legacyPackages: ['react-virtual'],
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
}

export const ranger: LibrarySlim = {
  id: 'ranger',
  ...categoryStyles.tooling,
  name: 'TanStack Ranger',
  to: '/ranger',
  tagline: 'Headless range and multi-range slider utilities.',
  description:
    'Headless, lightweight, and extensible primitives for building range and multi-range sliders.',
  badge: undefined,
  repo: 'tanstack/ranger',
  frameworks: ['react'],
  corePackageName: '@tanstack/ranger',
  npmPackageNames: ['@tanstack/ranger', 'react-ranger'],
  legacyPackages: ['react-ranger'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  scarfId: 'dd278e06-bb3f-420c-85c6-6e42d14d8f61',
  visible: false,
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
}

export const store: LibrarySlim = {
  id: 'store',
  ...categoryStyles.data,
  name: 'TanStack Store',
  to: '/store/latest',
  tagline: 'Framework agnostic data store with reactive framework adapters',
  description:
    'The immutable-reactive data store that powers the core of TanStack libraries and their framework adapters.',
  badge: 'alpha',
  repo: 'tanstack/store',
  frameworks: [
    'react',
    'preact',
    'solid',
    'svelte',
    'vue',
    'angular',
    'lit',
    'octane',
  ],
  corePackageName: '@tanstack/store',
  npmPackageNames: ['@tanstack/store'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  scarfId: '302d0fef-cb3f-43c6-b45c-f055b9745edb',
  defaultDocs: 'overview',
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
}

export const pacer: LibrarySlim = {
  id: 'pacer',
  ...categoryStyles.performance,
  name: 'TanStack Pacer',
  to: '/pacer/latest',
  tagline:
    'Framework agnostic debouncing, throttling, rate limiting, queuing, and batching utilities',
  description:
    "Optimize your application's performance with TanStack Pacer's core primitives: Debouncing, Throttling, Rate Limiting, Queuing, and Batching.",
  badge: 'beta',
  repo: 'tanstack/pacer',
  frameworks: ['react', 'preact', 'solid', 'angular', 'vanilla'],
  corePackageName: '@tanstack/pacer',
  npmPackageNames: ['@tanstack/pacer', '@tanstack/pacer-lite'],
  legacyPackages: ['@tanstack/pacer-lite'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  scarfId: '302d0fef-cb3f-43c6-b45c-f055b9745edb',
  defaultDocs: 'overview',
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
  handleRedirects: (href) => {
    if (
      /\/pacer\/[^/]+\/docs\/framework\/angular\/examples\/injectAsyncRateLimitedCallback/.test(
        href,
      )
    ) {
      throw redirect({
        href: href.replace(
          'injectAsyncRateLimitedCallback',
          'injectAsyncRateLimiter',
        ),
      })
    }
  },
}

export const hotkeys: LibrarySlim = {
  id: 'hotkeys',
  ...categoryStyles.ui,
  name: 'TanStack Hotkeys',
  to: '/hotkeys/latest',
  tagline:
    'Type-safe keyboard shortcuts, sequences, and key state tracking for your apps',
  description:
    'A type-safe, cross-platform hotkey library with sequence detection, key state tracking, hotkey recording, and framework adapters for React and more.',
  badge: 'alpha',
  repo: 'tanstack/hotkeys',
  frameworks: [
    'vanilla',
    'react',
    'preact',
    'solid',
    'svelte',
    'vue',
    'angular',
    'lit',
  ],
  corePackageName: '@tanstack/hotkeys',
  npmPackageNames: ['@tanstack/hotkeys'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  defaultDocs: 'overview',
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
}

export const markdown: LibrarySlim = {
  id: 'markdown',
  name: 'TanStack Markdown',
  cardStyles: 'text-fuchsia-500 dark:text-fuchsia-400 hover:border-current',
  to: '/markdown/latest',
  tagline: 'A serializable document model for docs and AI streams',
  description:
    'A deliberately bounded Markdown parser with a public serializable AST, safe defaults, deterministic React, HTML, and Octane output, and a stateless profile for accumulated AI streams.',
  badge: 'alpha',
  bgStyle: 'bg-fuchsia-500',
  borderStyle: 'border-fuchsia-500/50',
  textStyle: 'text-fuchsia-500 dark:text-fuchsia-400',
  textColor: 'text-fuchsia-600 dark:text-fuchsia-400',
  colorFrom: 'from-fuchsia-500',
  colorTo: 'to-fuchsia-500',
  bgRadial: 'from-fuchsia-500 via-fuchsia-500/50 to-transparent',
  repo: 'tanstack/markdown',
  frameworks: ['react', 'vanilla'],
  corePackageName: '@tanstack/markdown',
  npmPackageNames: ['@tanstack/markdown'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  defaultDocs: 'overview',
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
}

export const highlight: LibrarySlim = {
  id: 'highlight',
  name: 'TanStack Highlight',
  cardStyles: 'text-amber-500 dark:text-amber-400 hover:border-current',
  to: '/highlight/latest',
  tagline: 'Web-first syntax highlighting with compact, themeable HTML',
  description:
    'A synchronous syntax highlighter with selective language imports, context-aware web scanners, semantic CSS themes, precise annotations, and compact deterministic output.',
  badge: 'alpha',
  bgStyle: 'bg-amber-500',
  borderStyle: 'border-amber-500/50',
  textStyle: 'text-amber-500 dark:text-amber-400',
  textColor: 'text-amber-600 dark:text-amber-400',
  colorFrom: 'from-amber-500',
  colorTo: 'to-amber-500',
  bgRadial: 'from-amber-500 via-amber-500/50 to-transparent',
  repo: 'tanstack/highlight',
  frameworks: ['react', 'vanilla'],
  corePackageName: '@tanstack/highlight',
  npmPackageNames: ['@tanstack/highlight'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  defaultDocs: 'overview',
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
}

export const db: LibrarySlim = {
  id: 'db',
  ...categoryStyles.data,
  name: 'TanStack DB',
  to: '/db/latest',
  tagline: 'The reactive client-first store for your API',
  description:
    'TanStack DB gives you a reactive, client-first store for your API data with collections, live queries and optimistic mutations that keep your UI reactive, consistent and blazing fast 🔥',
  badge: 'beta',
  repo: 'tanstack/db',
  frameworks: ['react', 'vue', 'solid', 'svelte', 'vanilla'],
  corePackageName: '@tanstack/db',
  npmPackageNames: ['@tanstack/db', '@tanstack/react-db'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  scarfId: '302d0fef-cb3f-43c6-b45c-f055b9745edb',
  defaultDocs: 'overview',
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
}

export const ai: LibrarySlim = {
  id: 'ai',
  ...categoryStyles.data,
  name: 'TanStack AI',
  to: '/ai/latest',
  tagline: 'The headless agent framework for TypeScript. Bring your own stack',
  description:
    'The headless agent framework for TypeScript. TanStack AI runs the agent loop as typed primitives you compose yourself: tool calls, reasoning, human-in-the-loop interrupts, memory, and streaming state. Eleven provider adapters, seven UI framework bindings, sandboxed code execution, MCP, and coding-agent harnesses behind one interface. Native AG-UI over the wire, MIT licensed, no hosted gateway and no platform to buy into.',
  badge: 'beta',
  repo: 'tanstack/ai',
  frameworks: [
    'react',
    'vue',
    'solid',
    'svelte',
    'preact',
    'angular',
    'vanilla',
  ],
  corePackageName: '@tanstack/ai-client',
  npmPackageNames: ['@tanstack/ai-client'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  defaultDocs: 'getting-started/overview',
  frameworkPackageNames: {
    react: '@tanstack/ai-react',
    vue: '@tanstack/ai-vue',
    solid: '@tanstack/ai-solid',
    svelte: '@tanstack/ai-svelte',
    preact: '@tanstack/ai-preact',
    angular: '@tanstack/ai-angular',
    vanilla: '@tanstack/ai-client',
  },
  frameworkDocs: {
    react: 'getting-started/quick-start',
    vue: 'getting-started/quick-start-vue',
    solid: 'api/ai-solid',
    svelte: 'getting-started/quick-start-svelte',
    preact: 'api/ai-preact',
    angular: 'getting-started/quick-start-angular',
    vanilla: 'api/ai-client',
  },
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
}

export const intent: LibrarySlim = {
  id: 'intent',
  ...categoryStyles.tooling,
  name: 'TanStack Intent',
  to: '/intent/latest',
  tagline: 'Ship Agent Skills with your npm Packages',
  description:
    "Generate, validate, and ship Agent Skills alongside your library — versioned knowledge that agents discover automatically from node_modules. Skills live in each library's repo and update when the package updates.",
  badge: 'alpha',
  repo: 'tanstack/intent',
  frameworks: [],
  corePackageName: '@tanstack/intent',
  npmPackageNames: ['@tanstack/intent'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  defaultDocs: 'overview',
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
}

export const config: LibrarySlim = {
  id: 'config',
  ...categoryStyles.tooling,
  name: 'TanStack Config',
  to: '/config/latest',
  tagline:
    'Configuration and tools for publishing and maintaining high-quality JavaScript packages',
  description:
    'Opinionated tooling to lint, build, test, version, and publish JS/TS packages — minimal config, consistent results.',
  badge: undefined,
  repo: 'tanstack/config',
  frameworks: [],
  corePackageName: '@tanstack/config',
  npmPackageNames: ['@tanstack/config'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
}

export const devtools: LibrarySlim = {
  id: 'devtools',
  ...categoryStyles.tooling,
  name: 'TanStack Devtools',
  to: '/devtools/latest',
  tagline:
    'Centralized devtools panel for TanStack libraries and other custom devtools',
  description:
    'A unified devtools panel that houses all TanStack devtools and allows you to create and integrate your own custom devtools.',
  badge: 'alpha',
  repo: 'tanstack/devtools',
  frameworks: [
    'react',
    'preact',
    'solid',
    'vue',
    'svelte',
    'angular',
    'vanilla',
  ],
  corePackageName: '@tanstack/devtools',
  npmPackageNames: ['@tanstack/devtools', '@tanstack/react-devtools'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
  handleRedirects: (href) => {
    if (/\/devtools\/[^/]+\/docs\/framework\/solif\//.test(href)) {
      throw redirect({
        href: href.replace(
          /\/devtools\/([^/]+)\/docs\/framework\/solif\//,
          '/devtools/$1/docs/framework/solid/',
        ),
      })
    }
  },
}

export const mcp: LibrarySlim = {
  id: 'mcp',
  ...categoryStyles.tooling,
  name: 'TanStack MCP',
  to: '/mcp',
  tagline: 'AI-powered access to TanStack documentation',
  description:
    'Connect your AI assistant to TanStack documentation. Search docs, fetch pages, and explore the ecosystem programmatically via the Model Context Protocol.',
  badge: 'alpha',
  repo: 'tanstack/tanstack.com',
  frameworks: [],
  latestVersion: 'v1',
  latestBranch: 'main',
  availableVersions: ['v1'],
  visible: false,
  handleRedirects: (href: string) => {
    // All /mcp routes redirect to the CLI MCP migration guide
    if (/\/mcp(\/|$)/.test(href)) {
      throw redirect({ href: '/cli/latest/docs/mcp-migration' })
    }
  },
}

export const cli: LibrarySlim = {
  id: 'cli',
  ...categoryStyles.tooling,
  name: 'TanStack CLI',
  to: '/cli/latest',
  tagline: 'CLI and project scaffolding toolkit for TanStack',
  description:
    'A CLI toolkit for TanStack. Create and customize TanStack Start apps, search docs, inspect add-ons, and generate project changes with current TanStack context.',
  badge: 'alpha',
  repo: 'tanstack/cli',
  frameworks: [],
  corePackageName: '@tanstack/cli',
  npmPackageNames: ['@tanstack/cli'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  defaultDocs: 'overview',
  sitemap: {
    includeLandingPage: true,
    includeDocsPages: true,
  },
}

export const workflow: LibrarySlim = {
  id: 'workflow',
  ...categoryStyles.tooling,
  name: 'TanStack Workflow',
  to: '/workflow',
  tagline: 'Durable, type-safe workflow orchestration for TypeScript',
  description:
    'Build resilient multi-step workflows with typed inputs, durable execution, retries, and observable state for long-running application processes.',
  badge: 'alpha',
  repo: 'tanstack/workflow',
  frameworks: [],
  corePackageName: '@tanstack/workflow',
  npmPackageNames: ['@tanstack/workflow'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  defaultDocs: 'overview',
  visible: false,
}

export const libraries: LibrarySlim[] = [
  start,
  router,
  query,
  table,
  charts,
  form,
  db,
  ai,
  intent,
  virtual,
  pacer,
  hotkeys,
  markdown,
  highlight,
  store,
  ranger,
  config,
  devtools,
  mcp,
  cli,
  workflow,
  {
    id: 'react-charts',
    ...categoryStyles.tooling,
    name: 'React Charts',
    repo: 'tanstack/react-charts',
    to: undefined,
    tagline: '',
    badge: undefined,
    frameworks: [],
    latestVersion: '',
    availableVersions: [],
  },
  {
    id: 'create-tsrouter-app',
    ...categoryStyles.tooling,
    name: 'Create TS Router App',
    repo: 'tanstack/create-tsrouter-app',
    to: undefined,
    tagline: '',
    badge: undefined,
    frameworks: [],
    latestVersion: '',
    availableVersions: [],
  },
]

export type PublicLibrarySlim = LibrarySlim & {
  to: string
}

export function isPublicLibrary(
  library: LibrarySlim,
): library is PublicLibrarySlim {
  return (
    typeof library.to === 'string' &&
    library.to.startsWith('/') &&
    library.visible !== false
  )
}

export const publicLibraries = libraries.filter(isPublicLibrary)

export const librariesByGroup = {
  framework: [start, router],
  state: [query, db, store, ai],
  headlessUI: [table, charts, form, hotkeys, markdown, highlight],
  performance: [virtual, pacer],
  tooling: [devtools, config, cli, intent],
}

export const librariesGroupNamesMap = {
  framework: 'Framework',
  state: 'Data & State Management',
  headlessUI: 'UI & UX',
  performance: 'Performance',
  tooling: 'Tooling',
}

export function findLibrary(id: string): LibrarySlim | undefined {
  return libraries.find((d) => d.id === id)
}

export function getLibrary(id: LibraryId): LibrarySlim {
  const library = libraries.find((d) => d.id === id)
  if (!library) {
    throw new Error(`Library with id "${id}" not found!`)
  }
  return library
}
