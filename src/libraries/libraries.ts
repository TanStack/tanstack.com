// Base library data - lightweight, stays in main bundle
// Extended library data (with React nodes, testimonials, etc.) is in individual library files

import { redirect } from '@tanstack/react-router'
import type { LibrarySlim, LibraryId } from './types'

export const query: LibrarySlim = {
  id: 'query',
  name: 'TanStack Query',
  cardStyles: 'text-red-500 hover:border-current',
  to: '/query',
  tagline:
    'Powerful asynchronous state management, server-state utilities and data fetching',
  description:
    'Powerful asynchronous state management, server-state utilities and data fetching. Fetch, cache, update, and wrangle all forms of async data in your TS/JS, React, Vue, Solid, Svelte & Angular applications all without touching any "global state"',
  bgStyle: 'bg-red-500',
  borderStyle: 'border-red-500/50',
  textStyle: 'text-red-500',
  textColor: 'text-amber-500',
  colorFrom: 'from-red-500',
  colorTo: 'to-amber-500',
  bgRadial: 'from-red-500 via-red-500/60 to-transparent',
  badge: undefined,
  repo: 'tanstack/query',
  frameworks: ['react', 'preact', 'solid', 'vue', 'svelte', 'angular'],
  latestVersion: 'v5',
  latestBranch: 'main',
  availableVersions: ['v5', 'v4', 'v3'],
  scarfId: '53afb586-3934-4624-a37a-e680c1528e17',
  ogImage: 'https://github.com/tanstack/query/raw/main/media/repo-header.png',
  defaultDocs: 'framework/react/overview',
  installPath: 'framework/$framework/installation',
  legacyPackages: ['react-query'],
}

export const router: LibrarySlim = {
  id: 'router',
  name: 'TanStack Router',
  cardStyles: 'text-emerald-500 dark:text-emerald-400 hover:border-current',
  to: '/router',
  tagline: 'Type-safe Routing for React and Solid applications',
  description:
    'A powerful React router for client-side and full-stack react applications. Fully type-safe APIs, first-class search-params for managing state in the URL and seamless integration with the existing React ecosystem.',
  bgStyle: 'bg-emerald-500',
  borderStyle: 'border-emerald-500/50',
  textStyle: 'text-emerald-500 dark:text-emerald-400',
  textColor: 'text-emerald-500 dark:text-emerald-400',
  colorFrom: 'from-emerald-500',
  colorTo: 'to-lime-600',
  bgRadial: 'from-emerald-500 via-lime-600/50 to-transparent',
  badge: undefined,
  repo: 'tanstack/router',
  frameworks: ['react', 'solid'],
  corePackageName: '@tanstack/router-core',
  latestVersion: 'v1',
  latestBranch: 'main',
  availableVersions: ['v1'],
  scarfId: '3d14fff2-f326-4929-b5e1-6ecf953d24f4',
  ogImage: 'https://github.com/tanstack/router/raw/main/media/header.png',
  docsRoot: 'docs/router',
  defaultDocs: 'framework/react/overview',
  installPath: 'framework/$framework/quick-start',
  legacyPackages: ['react-location'],
  hideCodesandboxUrl: true,
}

export const start: LibrarySlim = {
  id: 'start',
  name: 'TanStack Start',
  cardStyles: 'text-cyan-500 dark:text-white-400 hover:border-current',
  to: '/start',
  tagline:
    'Full-stack Framework powered by TanStack Router for React and Solid',
  description:
    'Full-document SSR, Streaming, Server Functions, bundling and more, powered by TanStack Router and Vite - Ready to deploy to your favorite hosting provider.',
  bgStyle: 'bg-cyan-500',
  borderStyle: 'border-cyan-500/50',
  textStyle: 'text-cyan-500',
  textColor: 'text-cyan-600',
  colorFrom: 'from-teal-500',
  colorTo: 'to-cyan-500',
  bgRadial: 'from-cyan-500 via-teal-600/50 to-transparent',
  badge: 'RC',
  repo: 'tanstack/router',
  frameworks: ['react', 'solid'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  scarfId: 'b6e2134f-e805-401d-95c3-2a7765d49a3d',
  docsRoot: 'docs/start',
  defaultDocs: 'framework/react/overview',
  installPath: 'framework/$framework/build-from-scratch',
  embedEditor: 'codesandbox',
  showNetlifyUrl: true,
  showCloudflareUrl: true,
  showRailwayUrl: true,
  hideStackblitzUrl: true,
}

export const table: LibrarySlim = {
  id: 'table',
  name: 'TanStack Table',
  cardStyles: 'text-blue-500 hover:border-current',
  to: '/table',
  tagline: 'Headless UI for building powerful tables & datagrids',
  description:
    'Supercharge your tables or build a datagrid from scratch for TS/JS, React, Vue, Solid, Svelte, Qwik, Angular, and Lit while retaining 100% control over markup and styles.',
  bgStyle: 'bg-blue-500',
  borderStyle: 'border-blue-500/50',
  textStyle: 'text-blue-500',
  textColor: 'text-blue-600',
  colorFrom: 'from-cyan-500',
  colorTo: 'to-blue-600',
  bgRadial: 'from-cyan-500 via-blue-600/50 to-transparent',
  badge: undefined,
  repo: 'tanstack/table',
  frameworks: [
    'angular',
    'lit',
    'qwik',
    'react',
    'solid',
    'svelte',
    'vue',
    'vanilla',
  ],
  latestVersion: 'v8',
  latestBranch: 'main',
  availableVersions: ['v8', 'alpha'],
  scarfId: 'dc8b39e1-3fe9-4f3a-8e56-d4e2cf420a9e',
  ogImage: 'https://github.com/tanstack/table/raw/main/media/repo-header.png',
  defaultDocs: 'introduction',
  corePackageName: '@tanstack/table-core',
  legacyPackages: ['react-table'],
}

export const form: LibrarySlim = {
  id: 'form',
  name: 'TanStack Form',
  cardStyles: 'text-yellow-500 hover:border-current',
  to: '/form',
  tagline: 'Headless UI for building performant and type-safe forms',
  description:
    'Headless, performant, and type-safe form state management for TS/JS, React, Vue, Angular, Solid, Lit and Svelte.',
  bgStyle: 'bg-yellow-500',
  borderStyle: 'border-yellow-500/50',
  textStyle: 'text-yellow-500',
  textColor: 'text-yellow-600',
  colorFrom: 'from-yellow-500',
  colorTo: 'to-yellow-600',
  bgRadial: 'from-yellow-500 via-yellow-600/50 to-transparent',
  badge: 'new',
  repo: 'tanstack/form',
  corePackageName: '@tanstack/form-core',
  frameworks: ['react', 'vue', 'angular', 'solid', 'lit', 'svelte'],
  latestVersion: 'v1',
  latestBranch: 'main',
  availableVersions: ['v1'],
  scarfId: '72ec4452-5d77-427c-b44a-57515d2d83aa',
  ogImage: 'https://github.com/tanstack/form/raw/main/media/repo-header.png',
}

export const virtual: LibrarySlim = {
  id: 'virtual',
  name: 'TanStack Virtual',
  cardStyles: 'text-purple-500 hover:border-current',
  to: '/virtual',
  tagline: 'Headless UI for Virtualizing Large Element Lists',
  description:
    'Virtualize only the visible content for massive scrollable DOM nodes at 60FPS in TS/JS, React, Vue, Solid, Svelte, Lit & Angular while retaining 100% control over markup and styles.',
  bgStyle: 'bg-purple-500',
  borderStyle: 'border-purple-500/50',
  textStyle: 'text-purple-500',
  textColor: 'text-purple-600',
  colorFrom: 'from-purple-500',
  colorTo: 'to-violet-600',
  bgRadial: 'from-purple-500 via-violet-600/50 to-transparent',
  badge: undefined,
  repo: 'tanstack/virtual',
  frameworks: ['react', 'solid', 'vue', 'svelte', 'lit', 'angular'],
  corePackageName: '@tanstack/virtual-core',
  latestVersion: 'v3',
  latestBranch: 'main',
  availableVersions: ['v3'],
  scarfId: '32372eb1-91e0-48e7-8df1-4808a7be6b94',
  ogImage: 'https://github.com/tanstack/query/raw/main/media/header.png',
  defaultDocs: 'introduction',
  legacyPackages: ['react-virtual'],
}

export const ranger: LibrarySlim = {
  id: 'ranger',
  name: 'TanStack Ranger',
  cardStyles: 'text-black dark:text-gray-100 hover:border-current',
  to: '/ranger',
  tagline: 'Headless range and multi-range slider utilities.',
  description:
    'Headless, lightweight, and extensible primitives for building range and multi-range sliders.',
  bgStyle: 'bg-black dark:bg-gray-100',
  borderStyle: 'border-black/50 dark:border-gray-100/50',
  textStyle: 'text-black dark:text-gray-100',
  textColor: 'text-black dark:text-gray-100',
  colorFrom: 'from-black dark:from-gray-100',
  colorTo: 'to-gray-600 dark:to-gray-400',
  accentColorFrom: 'from-blue-500',
  accentColorTo: 'to-blue-700',
  accentTextColor: 'text-blue-600 dark:text-blue-400',
  bgRadial:
    'from-black via-gray-600/50 to-transparent dark:from-gray-100 dark:via-gray-400/50',
  badge: undefined,
  repo: 'tanstack/ranger',
  frameworks: ['react'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  scarfId: 'dd278e06-bb3f-420c-85c6-6e42d14d8f61',
  ogImage: 'https://github.com/tanstack/ranger/raw/main/media/headerv1.png',
}

export const store: LibrarySlim = {
  id: 'store',
  name: 'TanStack Store',
  cardStyles: 'text-twine-500 dark:text-twine-400 hover:border-current',
  to: '/store',
  tagline: 'Framework agnostic data store with reactive framework adapters',
  description:
    'The immutable-reactive data store that powers the core of TanStack libraries and their framework adapters.',
  bgStyle: 'bg-twine-700',
  borderStyle: 'border-twine-700/50',
  textStyle: 'text-twine-500',
  textColor: 'text-twine-700',
  colorFrom: 'from-twine-500',
  colorTo: 'to-twine-700',
  bgRadial: 'from-twine-500 via-twine-700/50 to-transparent',
  badge: 'alpha',
  repo: 'tanstack/store',
  frameworks: ['react', 'preact', 'solid', 'svelte', 'vue', 'angular'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  scarfId: '302d0fef-cb3f-43c6-b45c-f055b9745edb',
  ogImage: 'https://github.com/tanstack/store/raw/main/media/repo-header.png',
  defaultDocs: 'overview',
}

export const pacer: LibrarySlim = {
  id: 'pacer',
  name: 'TanStack Pacer',
  cardStyles: 'text-lime-500 dark:text-lime-400 hover:border-current',
  to: '/pacer',
  tagline:
    'Framework agnostic debouncing, throttling, rate limiting, queuing, and batching utilities',
  description:
    "Optimize your application's performance with TanStack Pacer's core primitives: Debouncing, Throttling, Rate Limiting, Queuing, and Batching.",
  bgStyle: 'bg-lime-600',
  borderStyle: 'border-lime-700/50',
  textStyle: 'text-lime-500',
  textColor: 'text-lime-700',
  colorFrom: 'from-lime-500',
  colorTo: 'to-lime-700',
  bgRadial: 'from-lime-500 via-lime-700/50 to-transparent',
  badge: 'beta',
  repo: 'tanstack/pacer',
  frameworks: ['react', 'preact', 'solid', 'angular'],
  legacyPackages: ['@tanstack/pacer-lite'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  scarfId: '302d0fef-cb3f-43c6-b45c-f055b9745edb',
  ogImage: 'https://github.com/tanstack/pacer/raw/main/media/repo-header.png',
  defaultDocs: 'overview',
}

export const db: LibrarySlim = {
  id: 'db',
  name: 'TanStack DB',
  cardStyles: 'text-orange-500 dark:text-orange-400 hover:border-current',
  to: '/db',
  tagline: 'The reactive client-first store for your API',
  description:
    'TanStack DB gives you a reactive, client-first store for your API data with collections, live queries and optimistic mutations that keep your UI reactive, consistent and blazing fast 🔥',
  badge: 'beta',
  bgStyle: 'bg-orange-500',
  borderStyle: 'border-orange-700/50',
  textStyle: 'text-orange-500',
  textColor: 'text-orange-700',
  colorFrom: 'from-orange-500',
  colorTo: 'to-orange-700',
  bgRadial: 'from-orange-500 via-orange-700/50 to-transparent',
  repo: 'tanstack/db',
  frameworks: ['react', 'vue', 'solid', 'svelte', 'vanilla'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  scarfId: '302d0fef-cb3f-43c6-b45c-f055b9745edb',
  ogImage: 'https://github.com/tanstack/db/raw/main/media/repo-header.png',
  defaultDocs: 'overview',
}

export const ai: LibrarySlim = {
  id: 'ai',
  name: 'TanStack AI',
  cardStyles: 'text-pink-500 dark:text-pink-400 hover:border-current',
  to: '/ai',
  tagline:
    'A powerful, open-source AI SDK with a unified interface across multiple providers',
  description:
    'A powerful, open-source AI SDK with a unified interface across multiple providers. No vendor lock-in, no proprietary formats, just clean TypeScript and honest open source.',
  badge: 'alpha',
  bgStyle: 'bg-pink-500',
  borderStyle: 'border-pink-700/50',
  textStyle: 'text-pink-500',
  textColor: 'text-pink-700',
  colorFrom: 'from-pink-500',
  colorTo: 'to-pink-700',
  bgRadial: 'from-pink-500 via-pink-700/50 to-transparent',
  repo: 'tanstack/ai',
  frameworks: ['react', 'solid', 'vanilla'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  ogImage: 'https://github.com/tanstack/ai/raw/main/media/repo-header.png',
  defaultDocs: 'getting-started/overview',
}

export const config: LibrarySlim = {
  id: 'config',
  name: 'TanStack Config',
  cardStyles: 'text-black dark:text-gray-100 hover:border-current',
  to: '/config',
  tagline:
    'Configuration and tools for publishing and maintaining high-quality JavaScript packages',
  description:
    'Opinionated tooling to lint, build, test, version, and publish JS/TS packages — minimal config, consistent results.',
  bgStyle: 'bg-black dark:bg-gray-100',
  borderStyle: 'border-black/50 dark:border-gray-100/50',
  textStyle: 'text-black dark:text-gray-100',
  textColor: 'text-black dark:text-gray-100',
  colorFrom: 'from-black dark:from-gray-100',
  colorTo: 'to-gray-600 dark:to-gray-400',
  accentColorFrom: 'from-blue-500',
  accentColorTo: 'to-blue-700',
  accentTextColor: 'text-blue-600 dark:text-blue-400',
  bgRadial:
    'from-black via-gray-600/50 to-transparent dark:from-gray-100 dark:via-gray-400/50',
  badge: undefined,
  repo: 'tanstack/config',
  frameworks: [],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  ogImage: 'https://github.com/tanstack/config/raw/main/media/repo-header.png',
}

export const devtools: LibrarySlim = {
  id: 'devtools',
  name: 'TanStack Devtools',
  cardStyles: 'text-black dark:text-gray-100 hover:border-current',
  to: '/devtools',
  tagline:
    'Centralized devtools panel for TanStack libraries and other custom devtools',
  description:
    'A unified devtools panel that houses all TanStack devtools and allows you to create and integrate your own custom devtools.',
  badge: 'alpha',
  bgStyle: 'bg-black dark:bg-gray-100',
  borderStyle: 'border-black/50 dark:border-gray-100/50',
  textStyle: 'text-black dark:text-gray-100',
  textColor: 'text-black dark:text-gray-100',
  colorFrom: 'from-black dark:from-gray-100',
  colorTo: 'to-gray-600 dark:to-gray-400',
  accentColorFrom: 'from-blue-500',
  accentColorTo: 'to-blue-700',
  accentTextColor: 'text-blue-600 dark:text-blue-400',
  badgeTextStyle: 'text-white dark:text-gray-900',
  bgRadial:
    'from-black via-gray-600/50 to-transparent dark:from-gray-100 dark:via-gray-400/50',
  repo: 'tanstack/devtools',
  frameworks: ['react', 'preact', 'solid', 'vanilla'],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  ogImage:
    'https://github.com/tanstack/devtools/raw/main/media/repo-header.png',
}

export const mcp: LibrarySlim = {
  id: 'mcp',
  name: 'TanStack MCP',
  cardStyles: 'text-black dark:text-gray-100 hover:border-current',
  to: '/mcp',
  tagline: 'AI-powered access to TanStack documentation',
  description:
    'Connect your AI assistant to TanStack documentation. Search docs, fetch pages, and explore the ecosystem programmatically via the Model Context Protocol.',
  badge: 'alpha',
  bgStyle: 'bg-black dark:bg-gray-100',
  borderStyle: 'border-black/50 dark:border-gray-100/50',
  textStyle: 'text-black dark:text-gray-100',
  textColor: 'text-black dark:text-gray-100',
  colorFrom: 'from-black dark:from-gray-100',
  colorTo: 'to-gray-600 dark:to-gray-400',
  accentColorFrom: 'from-blue-500',
  accentColorTo: 'to-blue-700',
  accentTextColor: 'text-blue-600 dark:text-blue-400',
  badgeTextStyle: 'text-white dark:text-gray-900',
  bgRadial:
    'from-black via-gray-600/50 to-transparent dark:from-gray-100 dark:via-gray-400/50',
  repo: 'tanstack/tanstack.com',
  frameworks: [],
  latestVersion: 'v1',
  latestBranch: 'main',
  availableVersions: ['v1'],
  visible: false,
  handleRedirects: (href: string) => {
    // All /mcp routes redirect to CLI MCP docs
    if (/\/mcp(\/|$)/.test(href)) {
      throw redirect({ href: '/cli/latest/docs/mcp/overview' })
    }
  },
}

export const cli: LibrarySlim = {
  id: 'cli',
  name: 'TanStack CLI',
  cardStyles: 'text-indigo-500 dark:text-indigo-400 hover:border-current',
  to: '/cli',
  tagline: 'CLI, MCP server, and AI toolkit for TanStack',
  description:
    'A CLI, MCP server, and AI toolkit for TanStack. Create and customize TanStack Start apps, search docs, integrate with AI agents, and more.',
  badge: 'alpha',
  bgStyle: 'bg-indigo-500',
  borderStyle: 'border-indigo-500/50',
  textStyle: 'text-indigo-500 dark:text-indigo-400',
  textColor: 'text-indigo-600 dark:text-indigo-400',
  colorFrom: 'from-indigo-500',
  colorTo: 'to-violet-600',
  bgRadial: 'from-indigo-500 via-violet-600/50 to-transparent',
  repo: 'tanstack/cli',
  frameworks: [],
  latestVersion: 'v0',
  latestBranch: 'main',
  availableVersions: ['v0'],
  ogImage: 'https://github.com/tanstack/cli/raw/main/media/repo-header.png',
  defaultDocs: 'overview',
}

export const libraries: LibrarySlim[] = [
  start,
  router,
  query,
  table,
  form,
  db,
  ai,
  virtual,
  pacer,
  store,
  ranger,
  config,
  devtools,
  mcp,
  cli,
  {
    id: 'react-charts',
    name: 'React Charts',
    repo: 'tanstack/react-charts',
    to: undefined,
    tagline: '',
    cardStyles: '',
    bgStyle: '',
    borderStyle: '',
    textStyle: '',
    colorFrom: '',
    colorTo: '',
    badge: undefined,
    frameworks: [],
    latestVersion: '',
    availableVersions: [],
  },
  {
    id: 'create-tsrouter-app',
    name: 'Create TS Router App',
    repo: 'tanstack/create-tsrouter-app',
    to: undefined,
    tagline: '',
    cardStyles: '',
    bgStyle: '',
    borderStyle: '',
    textStyle: '',
    colorFrom: '',
    colorTo: '',
    badge: undefined,
    frameworks: [],
    latestVersion: '',
    availableVersions: [],
  },
]

export const librariesByGroup = {
  state: [start, router, query, db, store, ai],
  headlessUI: [table, form],
  performance: [virtual, pacer],
  tooling: [devtools, config, cli],
}

export const librariesGroupNamesMap = {
  state: 'Data and State Management',
  headlessUI: 'Headless UI',
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

// Library IDs for schema validation
export const libraryIds = libraries.map((lib) => lib.id) as readonly LibraryId[]

// Library IDs shown in the sidebar navigation
export const SIDEBAR_LIBRARY_IDS = [
  'start',
  'router',
  'query',
  'table',
  'db',
  'ai',
  'form',
  'virtual',
  'pacer',
  'store',
  'devtools',
  'cli',
] as const satisfies readonly LibraryId[]
