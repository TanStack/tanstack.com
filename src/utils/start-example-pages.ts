const startExamplePages = [
  {
    slug: 'start-basic',
    title: 'TanStack Start routing and server functions example',
    description:
      'Explore file-based routes, nested layouts, server functions, and server-rendered pages in a runnable React application.',
    details:
      'Browse posts and users, open a detail URL directly, and follow links between nested layouts. The post loaders call server functions, so you can follow the request from a route to the server and back to the page.',
    files: [
      {
        path: 'src/router.tsx',
        description:
          'Creates the router and configures shared loading and error behavior.',
      },
      {
        path: 'src/routes/posts.tsx',
        description: 'Loads the post list for the route.',
      },
      {
        path: 'src/utils/posts.tsx',
        description: 'Fetches sample posts inside server functions.',
      },
    ],
    guide: 'routing',
    guideTitle: 'Routing guide',
    note: 'Open the local URL printed by Vite. Try a post detail URL in a new tab to see a direct server-rendered request.',
  },
  {
    slug: 'start-basic-react-query',
    title: 'TanStack Start with React Query example',
    description:
      'Connect React Query to TanStack Start for server rendering, route preloading, hydration, and cached client navigation.',
    details:
      'Route loaders prepare query data before rendering. Components read the same query options, while the Router integration transfers server-fetched query data to the browser. Follow the post list into a detail page to see how route loading and query caching work together.',
    files: [
      {
        path: 'src/router.tsx',
        description:
          'Creates a QueryClient for the router and connects the SSR query integration.',
      },
      {
        path: 'src/utils/posts.tsx',
        description: 'Shares query keys and server-function query options.',
      },
      {
        path: 'src/routes/posts.$postId.tsx',
        description:
          'Preloads and renders a post using the shared query options.',
      },
    ],
    guide: 'tanstack-query',
    guideTitle: 'React Query integration guide',
    note: 'Open the local URL printed by Vite. Visit a post directly, navigate back to the list, and inspect query state with the included devtools.',
  },
  {
    slug: 'start-basic-static',
    title: 'TanStack Start static rendering example',
    description:
      'Explore SPA mode, prerendered routes, and static server-function results in a React application built with TanStack Start.',
    details:
      'This example combines SPA mode with link crawling during prerendering. Its post functions use static-function middleware to capture results for static output. Use it to understand the build configuration before adapting it to your own public content.',
    files: [
      {
        path: 'vite.config.ts',
        description:
          'Configures the /test/ base path, SPA prerendering, link crawling, and sitemap host.',
      },
      {
        path: 'src/utils/posts.tsx',
        description: 'Uses static-function middleware for public sample posts.',
      },
      {
        path: 'src/routes/posts.$postId.tsx',
        description: 'Loads and displays an individual post.',
      },
    ],
    guide: 'static-prerendering',
    guideTitle: 'Static prerendering guide',
    note: 'Visit http://localhost:3000/test/ in development. Before publishing, replace the sample sitemap host and base path. The example sets failOnError to false, so inspect build output for failed pages. Static output is a build-time snapshot, not a live database.',
  },
]

export function getStartExamplePage(params: {
  libraryId: string
  version: string
  framework: string
  _splat?: string
}) {
  if (
    params.libraryId !== 'start' ||
    params.framework !== 'react' ||
    params.version !== 'latest'
  )
    return undefined
  return startExamplePages.find((page) => page.slug === params._splat)
}

export function getStartExampleSitemapEntries() {
  return startExamplePages.map((page) => ({
    path: `/start/latest/docs/framework/react/examples/${page.slug}`,
  }))
}
