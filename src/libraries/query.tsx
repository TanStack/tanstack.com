import { handleRedirects } from '~/utils/handleRedirects.server'
import { Library } from '.'
import { FaGithub, FaBolt, FaCogs } from 'react-icons/fa'
import { VscPreview, VscWand } from 'react-icons/vsc'
import { BiBookAlt } from 'react-icons/bi'
import { twMerge } from 'tailwind-merge'

const repo = 'tanstack/query'

const textStyles = 'text-red-500 dark:text-red-400'

export const queryProject = {
  id: 'query',
  name: 'TanStack Query',
  cardStyles: `shadow-xl shadow-red-700/20 dark:shadow-lg dark:shadow-red-500/30 text-red-500 border-2 border-transparent hover:border-current`,
  to: '/query',
  tagline: `Powerful asynchronous state management, server-state utilities and data fetching`,
  description:
    'Powerful asynchronous state management, server-state utilities and data fetching. Fetch, cache, update, and wrangle all forms of async data in your TS/JS, React, Vue, Solid, Svelte & Angular applications all without touching any "global state"',
  ogImage: 'https://github.com/tanstack/query/raw/main/media/repo-header.png',
  badge: undefined,
  bgStyle: 'bg-red-500',
  textStyle: 'text-red-500',
  repo,
  latestBranch: 'main',
  latestVersion: 'v5',
  availableVersions: ['v5', 'v4', 'v3'],
  colorFrom: 'from-red-500',
  colorTo: 'to-amber-500',
  textColor: 'text-amber-500',
  frameworks: ['react', 'solid', 'vue', 'svelte', 'angular'],
  scarfId: '53afb586-3934-4624-a37a-e680c1528e17',
  defaultDocs: 'framework/react/overview',
  handleRedirects: (href: string) => {
    handleRedirects(
      reactQueryV3List,
      href,
      '/query/v3',
      '/query/latest',
      'from=reactQueryV3'
    )

    handleRedirects(
      reactQueryV3RemovedInV5List,
      href,
      '/query/v3',
      '/query/v5',
      'from=reactQueryV3'
    )
  },
  menu: [
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/query/latest/docs/framework/react/overview',
    },
    {
      icon: <VscPreview />,
      label: 'Examples',
      to: '/query/latest/docs/framework/react/examples/basic',
    },
    {
      icon: <FaGithub />,
      label: 'GitHub',
      to: `https://github.com/${repo}`,
    },
  ],
  featureHighlights: [
    {
      title: 'Declarative & Automatic',
      icon: (
        <VscWand
          className={twMerge('motion-safe:animate-pulse', textStyles)}
          style={{
            animationDuration: '5s',
            animationTimingFunction: 'ease-in-out',
          }}
        />
      ),
      description: (
        <div>
          Writing your data fetching logic by hand is over. Tell TanStack Query
          where to get your data and how fresh you need it to be and the rest is
          automatic. It handles{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            caching, background updates and stale data out of the box with
            zero-configuration
          </span>
          .
        </div>
      ),
    },
    {
      title: 'Simple & Familiar',
      icon: (
        <FaBolt
          className={twMerge('motion-safe:animate-bounce', textStyles)}
          style={{
            animationDuration: '2s',
            animationTimingFunction: 'ease-in-out',
          }}
        />
      ),
      description: (
        <div>
          If you know how to work with promises or async/await, then you already
          know how to use TanStack Query. There's{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            no global state to manage, reducers, normalization systems or heavy
            configurations to understand
          </span>
          . Simply pass a function that resolves your data (or throws an error)
          and the rest is history.
        </div>
      ),
    },
    {
      title: 'Extensible',
      icon: (
        <FaCogs
          className={twMerge('motion-safe:animate-spin', textStyles)}
          style={{
            animationDuration: '10s',
            animationTimingFunction: 'ease-in-out',
          }}
        />
      ),
      description: (
        <div>
          TanStack Query is configurable down to each observer instance of a
          query with knobs and options to fit every use-case. It comes wired up
          with{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            dedicated devtools, infinite-loading APIs, and first class mutation
            tools that make updating your data a breeze
          </span>
          . Don't worry though, everything is pre-configured for success!
        </div>
      ),
    },
  ],
} satisfies Library

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
