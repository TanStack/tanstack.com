import { redirect } from "@remix-run/node";
import type { LoaderArgs } from "@remix-run/node";

export const loader = (context: LoaderArgs) => {
  handleRedirectsFromV3(context);

  return redirect(`/query/latest`, 301);
};

export function handleRedirectsFromV3(context: LoaderArgs) {
  const url = new URL(context.request.url);

  // Redirect old query v3 docs
  // prettier-ignore
  const reactQueryv3List = [
    // {from: 'api/overview',to: 'docs/guide/overview',},
    {from: "overview", to: "docs/overview"},
    {from: "installation", to: "docs/installation"},
    {from: "quick-start", to: "docs/quick-start"},
    {from: "devtools", to: "docs/devtools"},
    {from: "videos", to: "docs/videos"},
    {from: "comparison", to: "docs/comparison"},
    {from: "typescript", to: "docs/typescript"},
    {from: "graphql", to: "docs/graphql"},
    {from: "react-native", to: "docs/react-native"},
    {from: "guides/important-defaults", to: "docs/guides/important-defaults"},
    {from: "guides/queries", to: "docs/guides/queries"},
    {from: "guides/query-keys", to: "docs/guides/query-keys"},
    {from: "guides/query-functions", to: "docs/guides/query-functions"},
    {from: "guides/network-mode", to: "docs/guides/network-mode"},
    {from: "guides/parallel-queries", to: "docs/guides/parallel-queries"},
    {from: "guides/dependent-queries", to: "docs/guides/dependent-queries"},
    {from: "guides/background-fetching-indicators", to: "docs/guides/background-fetching-indicators"},
    {from: "guides/window-focus-refetching", to: "docs/guides/window-focus-refetching"},
    {from: "guides/disabling-queries", to: "docs/guides/disabling-queries"},
    {from: "guides/query-retries", to: "docs/guides/query-retries"},
    {from: "guides/paginated-queries", to: "docs/guides/paginated-queries"},
    {from: "guides/infinite-queries", to: "docs/guides/infinite-queries"},
    {from: "guides/placeholder-query-data", to: "docs/guides/placeholder-query-data"},
    {from: "guides/initial-query-data", to: "docs/guides/initial-query-data"},
    {from: "guides/prefetching", to: "docs/guides/prefetching"},
    {from: "guides/mutations", to: "docs/guides/mutations"},
    {from: "guides/query-invalidation", to: "docs/guides/query-invalidation"},
    {from: "guides/invalidations-from-mutations", to: "docs/guides/invalidations-from-mutations"},
    {from: "guides/updates-from-mutation-responses", to: "docs/guides/updates-from-mutation-responses"},
    {from: "guides/optimistic-updates", to: "docs/guides/optimistic-updates"},
    {from: "guides/query-cancellation", to: "docs/guides/query-cancellation"},
    {from: "guides/scroll-restoration", to: "docs/guides/scroll-restoration"},
    {from: "guides/filters", to: "docs/guides/filters"},
    {from: "guides/ssr", to: "docs/guides/ssr"},
    {from: "guides/caching", to: "docs/guides/caching"},
    {from: "guides/default-query-function", to: "docs/guides/default-query-function"},
    {from: "guides/suspense", to: "docs/guides/suspense"},
    {from: "guides/custom-logger", to: "docs/guides/custom-logger"},
    {from: "guides/testing", to: "docs/guides/testing"},
    {from: "guides/does-this-replace-client-state", to: "docs/guides/does-this-replace-client-state"},
    {from: "guides/migrating-to-react-query-3", to: "docs/guides/migrating-to-react-query-3"},
    {from: "guides/migrating-to-react-query-4", to: "docs/guides/migrating-to-react-query-4"},
    {from: "community/tkdodos-blog", to: "docs/community/tkdodos-blog"},
    {from: "examples/simple", to: "docs/examples/react/simple"},
    {from: "examples/basic", to: "docs/examples/react/basic"},
    {from: "examples/basic-graphql-request", to: "docs/examples/react/basic-graphql-request"},
    {from: "examples/custom-hooks", to: "docs/examples/react/custom-hooks"},
    {from: "examples/auto-refetching", to: "docs/examples/react/auto-refetching"},
    {from: "examples/focus-refetching", to: "docs/examples/react/focus-refetching"},
    {from: "examples/optimistic-updates", to: "docs/examples/react/optimistic-updates-typescript"},
    {from: "examples/optimistic-updates-typescript", to: "docs/examples/react/optimistic-updates-typescript"},
    {from: "examples/pagination", to: "docs/examples/react/pagination"},
    {from: "examples/load-more-infinite-scroll", to: "docs/examples/react/load-more-infinite-scroll"},
    {from: "examples/suspense", to: "docs/examples/react/suspense"},
    {from: "examples/default-query-function", to: "docs/examples/react/default-query-function"},
    {from: "examples/playground", to: "docs/examples/react/playground"},
    {from: "examples/prefetching", to: "docs/examples/react/prefetching"},
    {from: "examples/star-wars", to: "docs/examples/react/star-wars"},
    {from: "examples/rick-morty", to: "docs/examples/react/rick-morty"},
    {from: "examples/nextjs", to: "docs/examples/react/nextjs"},
    {from: "examples/react-native", to: "docs/examples/react/react-native"},
    {from: "examples/offline", to: "docs/examples/react/offline"},
    {from: "plugins/persistQueryClient", to: "docs/plugins/persistQueryClient"},
    {from: "plugins/createWebStoragePersister", to: "docs/plugins/createWebStoragePersister"},
    {from: "plugins/createAsyncStoragePersister", to: "docs/plugins/createAsyncStoragePersister"},
    {from: "plugins/broadcastQueryClient", to: "docs/plugins/broadcastQueryClient"},
    {from: "reference/useQuery", to: "docs/reference/useQuery"},
    {from: "reference/useQueries", to: "docs/reference/useQueries"},
    {from: "reference/useInfiniteQuery", to: "docs/reference/useInfiniteQuery"},
    {from: "reference/useMutation", to: "docs/reference/useMutation"},
    {from: "reference/useIsFetching", to: "docs/reference/useIsFetching"},
    {from: "reference/useIsMutating", to: "docs/reference/useIsMutating"},
    {from: "reference/QueryClient", to: "docs/reference/QueryClient"},
    {from: "reference/QueryClientProvider", to: "docs/reference/QueryClientProvider"},
    {from: "reference/useQueryClient", to: "docs/reference/useQueryClient"},
    {from: "reference/QueryCache", to: "docs/reference/QueryCache"},
    {from: "reference/MutationCache", to: "docs/reference/MutationCache"},
    {from: "reference/QueryObserver", to: "docs/reference/QueryObserver"},
    {from: "reference/InfiniteQueryObserver", to: "docs/reference/InfiniteQueryObserver"},
    {from: "reference/QueriesObserver", to: "docs/reference/QueriesObserver"},
    {from: "reference/QueryErrorResetBoundary", to: "docs/reference/QueryErrorResetBoundary"},
    {from: "reference/useQueryErrorResetBoundary", to: "docs/reference/useQueryErrorResetBoundary"},
    {from: "reference/focusManager", to: "docs/reference/focusManager"},
    {from: "reference/onlineManager", to: "docs/reference/onlineManager"},
    {from: "reference/hydration", to: "docs/reference/hydration"},
    // {from: '',to: ''},
  ]

  reactQueryv3List.forEach((item) => {
    if (url.pathname.startsWith(`/query/v3/${item.from}`)) {
      throw redirect(
        `/query/latest/${item.to}?from=reactQueryV3&original=https://tanstack.com/query/v3/${item.to}`,
        301
      );
    }
  });
}
