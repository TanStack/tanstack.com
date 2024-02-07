import reactLogo from '~/images/react-logo.svg'
import solidLogo from '~/images/solid-logo.svg'
import vueLogo from '~/images/vue-logo.svg'
import svelteLogo from '~/images/svelte-logo.svg'
import angularLogo from '~/images/angular-logo.svg'

export const repo = 'tanstack/query'

export const latestBranch = 'main'
export const latestVersion = 'v5'
export const availableVersions = ['v5', 'v4', 'v3']

export const colorFrom = 'from-red-500'
export const colorTo = 'to-amber-500'
export const textColor = 'text-amber-500'

export const frameworks = {
  react: { label: 'React', logo: reactLogo, value: 'react' },
  solid: { label: 'Solid', logo: solidLogo, value: 'solid' },
  vue: { label: 'Vue', logo: vueLogo, value: 'vue' },
  svelte: { label: 'Svelte', logo: svelteLogo, value: 'svelte' },
  angular: { label: 'Angular', logo: angularLogo, value: 'angular' },
} as const

export type Framework = keyof typeof frameworks

export function getBranch(argVersion?: string) {
  const version = argVersion || latestVersion

  return ['latest', latestVersion].includes(version) ? latestBranch : version
}

/* if (url.pathname.startsWith(`/query/v3/${item.from}`)) {
      throw redirect(`/query/latest/${item.to}?from=reactQueryV3`) */

// Redirect old query v3 docs
// prettier-ignore
export const reactQueryV3List = [
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
export const reactQueryV3RemovedInV5List = [
    {from: "guides/custom-logger", to: "docs/framework/react/guides/migrating-to-v5#the-deprecated-custom-logger-has-been-removed"},
    {from: "plugins/createWebStoragePersister", to: "docs/framework/react/guides/migrating-to-react-query-4#persistqueryclient-and-the-corresponding-persister-plugins-are-no-longer-experimental-and-have-been-renamed"},
    {from: "plugins/createAsyncStoragePersister", to: "docs/framework/react/guides/migrating-to-react-query-4#persistqueryclient-and-the-corresponding-persister-plugins-are-no-longer-experimental-and-have-been-renamed"},
]
