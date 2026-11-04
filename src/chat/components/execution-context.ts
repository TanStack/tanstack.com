import { createContext, useContext, useSyncExternalStore } from 'react'
import type {
  ExecutionOwners,
  ExecutionOwnerView,
} from '../client/execution-owner'

// Keep context identity outside the component refresh boundary.
export const ExecutionOwnerContext = createContext<ExecutionOwners | null>(null)
const empty: readonly ExecutionOwnerView[] = []
const noSubscription = () => () => {}
const emptySnapshot = () => empty

export function useExecutionOwners() {
  return useContext(ExecutionOwnerContext)
}

export function useExecutionOwnerViews() {
  const owners = useExecutionOwners()
  return useSyncExternalStore(
    owners?.subscribe ?? noSubscription,
    owners?.getSnapshot ?? emptySnapshot,
    emptySnapshot,
  )
}
