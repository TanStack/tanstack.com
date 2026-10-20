import { AppearanceSync } from './Appearance'
import { MobileRuntime } from './MobileRuntime'
import { AppUpdates } from './AppUpdates'
import { Outlet } from '@tanstack/react-router'
import { Tooltip } from '@base-ui/react/tooltip'
import { ExecutionOwnersProvider } from './ExecutionOwners'

/** Keep browser execution ownership above workspace and conversation routes. */
export function ChatShell() {
  return (
    <div className="tanchat-shell">
      <Tooltip.Provider delay={400}>
        <ExecutionOwnersProvider>
          <AppearanceSync />
          <MobileRuntime />
          <AppUpdates />
          <Outlet />
        </ExecutionOwnersProvider>
      </Tooltip.Provider>
    </div>
  )
}
