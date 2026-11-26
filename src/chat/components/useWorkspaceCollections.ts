import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { useMutation } from '@tanstack/react-query'
import {
  createWorkspaceCollections,
  isWorkspaceMutation,
} from '../client/workspace-collections'
import type { Bootstrap } from './App'
import { useWorkspaceApi } from './WorkspaceApi'

export function useWorkspaceCollections(
  seed: Bootstrap | undefined,
  _updatedAt: number,
) {
  const { request, url } = useWorkspaceApi()
  const workspaceId = seed?.workspace.id
  const userId = seed?.user.id
  // Bootstrap seeds a scope once. Committed changes arrive through the workspace stream.
  const store = useMemo(
    () =>
      seed
        ? createWorkspaceCollections({
            request,
            initial: {
              workspaceId: seed.workspace.id,
              userId: seed.user.id,
              bots: seed.bots,
              sections: seed.sections,
            },
            initialActivity: seed.activity,
            streamUrl: url('workspace-sync/stream'),
          })
        : undefined,
    [request, url, workspaceId, userId],
  )
  const rows = useLiveQuery({
    client: store?.db,
    query: (q) => (store ? q.from({ row: store.entities }) : undefined),
  })
  useEffect(
    () => store?.retain(() => Promise.resolve(rows.collection?.cleanup())),
    [store, rows.collection],
  )
  const fallback = useMemo(
    () => ({ error: null, isPending: true, isError: false }),
    [],
  )
  const syncStatus = useSyncExternalStore(
    store?.subscribeStatus ?? (() => () => {}),
    store?.getStatus ?? (() => fallback),
    () => fallback,
  )
  const indexQuery = { ...syncStatus, refetch: () => store?.refresh() }
  const activityQuery = indexQuery
  const projection = useMemo(() => {
    // One query notification contains the complete commit across all row types.
    void rows.data
    return store?.read()
  }, [store, rows.data])
  const data = useMemo(
    () =>
      seed && projection
        ? { ...seed, bots: projection.bots, sections: projection.sections }
        : seed,
    [seed, projection],
  )
  const activityById = projection?.activity ?? {}
  // Keep errors visible even when an optimistic archive removes its menu row.
  const mutation = useMutation({
    networkMode: 'always',
    retry: false,
    mutationFn: async (command: {
      store: NonNullable<typeof store>
      path: string
      body?: unknown
      method: string
      errorDisplay?: 'local' | 'workspace'
    }) => command.store.request(command.path, command.body, command.method),
  })
  return {
    store,
    data,
    ready: !!store && rows.isReady,
    indexQuery,
    activityQuery,
    activity: activityById,
    request: (
      path: string,
      body?: unknown,
      method = body === undefined ? 'GET' : 'POST',
      options?: { errorDisplay?: 'local' | 'workspace' },
    ) =>
      store && isWorkspaceMutation(path, method)
        ? mutation.mutateAsync({
            store,
            path,
            body,
            method,
            errorDisplay: options?.errorDisplay,
          })
        : request(path, body, method),
    mutationError:
      mutation.variables?.store === store &&
      mutation.variables?.errorDisplay !== 'local'
        ? mutation.error
        : null,
    clearMutationError: mutation.reset,
  }
}
