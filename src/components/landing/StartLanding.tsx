import { GitBranch, HardDrives, Network, Stack } from '@phosphor-icons/react'

import { LibraryLanding, type LibraryLandingConfig } from './LibraryLanding'

const startLanding = {
  libraryId: 'start',
  headline: 'The full-stack framework for Router-first apps.',
  description:
    "Start takes TanStack Router's typed route tree, URL state, loaders, and prefetching, then adds full-document SSR, streaming, server functions, server routes, and output for the runtime you choose.",
  distinction: 'The client app and server share one route contract.',
  hero: {
    label: 'runtime map',
    actionLabel: 'Run route',
    detailTitle: 'Client-authored. Server-powered.',
    detailBody:
      'Routes keep their typed client model while Start adds explicit server boundaries and portable runtime output.',
    items: [
      {
        key: 'routes/_app.projects.$id.tsx',
        title: 'Route, params, search, loader',
        badge: 'route',
        activity: 91,
      },
      {
        key: 'createServerFn({ method: "GET" })',
        title: 'Database, auth, environment',
        badge: 'server',
        activity: 72,
      },
      {
        key: 'runtime adapter',
        title: 'Node, Workers, Netlify, Railway',
        badge: 'deploy',
        activity: 56,
      },
    ],
    facts: [
      { label: 'routing', value: 'TanStack Router' },
      { label: 'rendering', value: 'SSR + streaming' },
      { label: 'server calls', value: 'typed RPC' },
      { label: 'output', value: 'runtime portable' },
    ],
  },
  features: [
    {
      icon: Network,
      label: 'Router core',
      title: 'Built on TanStack Router.',
      body: 'Routes, params, search schemas, loaders, pending states, links, and navigation remain the foundation. Start adds the server around that app model.',
    },
    {
      icon: GitBranch,
      label: 'URL state',
      title: 'Search params stay first-class.',
      body: 'Filters, tabs, pagination, and deep app state are parsed, validated, inherited, and written through typed Router APIs.',
    },
    {
      icon: HardDrives,
      label: 'Server work',
      title: 'Server work stays explicit.',
      body: 'Server functions give routes and components access to database, auth, and environment work through validated, serializable boundaries.',
    },
    {
      icon: Stack,
      label: 'Rendering',
      title: 'SSR keeps the app model.',
      body: 'Render the document, stream useful UI, or select SPA and server-rendering modes without replacing the interactive Router experience.',
    },
  ],
  lifecycle: {
    label: 'Request lifecycle',
    title: 'One route tree from request to navigation.',
    body: 'The same contracts coordinate matching, data, server work, and rendering on the first request and every client navigation after it.',
    steps: [
      {
        label: 'Match route',
        body: 'Router narrows params, search, context, loader dependencies, and links.',
      },
      {
        label: 'Run loader',
        body: 'Start preloads on the server and reuses the same contract in the client.',
      },
      {
        label: 'Call server',
        body: 'Database, auth, and environment work stays behind an explicit boundary.',
      },
      {
        label: 'Stream document',
        body: 'The shell, head tags, route data, and pending UI leave as one response.',
      },
    ],
  },
  flow: {
    label: 'Portable deployment',
    title: 'Author once. Ship to the runtime you choose.',
    body: 'Runtime adapters change the deployment output without changing how routes, loaders, or server functions are authored.',
    steps: [
      { label: 'author', code: 'createFileRoute() + createServerFn()' },
      { label: 'build', code: 'vite build' },
      { label: 'adapt', code: 'runtime: cloudflare | node | netlify' },
      { label: 'hydrate', code: 'router.load() → client navigation' },
    ],
  },
  prompt:
    'Build a TanStack Start application with file-based TanStack Router routes, validated search params, route loaders, typed server functions, full-document SSR, streaming, and a deployment adapter for the target runtime. Keep server-only work behind explicit boundaries and preserve the same route model during client navigation.',
  promptLabel: 'Copy Start prompt',
} satisfies LibraryLandingConfig

export default function StartLanding() {
  return <LibraryLanding config={startLanding} />
}
