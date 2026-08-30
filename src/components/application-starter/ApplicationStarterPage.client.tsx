import { ApplicationStarterProvider } from './ApplicationStarterProvider'
import { ApplicationStarterWorkspace } from './ApplicationStarterWorkspace'

export function ApplicationStarterPage() {
  return (
    <ApplicationStarterProvider>
      <ApplicationStarterWorkspace />
    </ApplicationStarterProvider>
  )
}
