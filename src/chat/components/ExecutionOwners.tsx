import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ExecutionOwners } from '../client/execution-owner'
import { openExecutionBrowserBridge } from '../client/execution-browser-bridge'
import { ExecutionOwnerContext } from './execution-context'

const mountedOwners = new Set<ExecutionOwners>()

// This effect dependency binds each owner to one version of its executable code.
function createOwners(getContainer: () => HTMLDivElement | null) {
  return new ExecutionOwners({
    openBridge: (connect, onEvent, signal) => {
      const container = getContainer()
      if (!container)
        return Promise.reject(new Error('The workspace host is unavailable.'))
      return openExecutionBrowserBridge(connect, onEvent, signal, container)
    },
  })
}

if (import.meta.hot) {
  // This React refresh boundary also receives owner/bridge dependency changes.
  // Revoke old authority before refresh can preserve state or run new effects.
  import.meta.hot.dispose(() => {
    for (const owners of mountedOwners) {
      owners.dispose(
        'Workspace code changed. Check the saved session before starting again.',
      )
    }
    mountedOwners.clear()
  })
}

/** This provider belongs above route components, never inside a workspace pane. */
export function ExecutionOwnersProvider({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null)
  const [owners, setOwners] = useState<ExecutionOwners | null>(null)
  useEffect(() => {
    // A service captures executable code, so it cannot be preserved like React
    // UI state across refresh. Strict Mode also gets a fresh second setup.
    // Route and pane changes only subscribe; they never replace this service.
    const owners = createOwners(() => container.current)
    mountedOwners.add(owners)
    setOwners(owners)
    const pagehide = () => owners.pageHidden()
    window.addEventListener('pagehide', pagehide)
    return () => {
      window.removeEventListener('pagehide', pagehide)
      mountedOwners.delete(owners)
      owners.dispose()
    }
  }, [createOwners])
  return (
    <ExecutionOwnerContext.Provider value={owners}>
      {children}
      <div
        ref={container}
        // Each permanent iframe controls its own geometry and accessibility.
        // A hidden ancestor would also block the one selected visible preview.
        style={{ display: 'contents' }}
      />
    </ExecutionOwnerContext.Provider>
  )
}
