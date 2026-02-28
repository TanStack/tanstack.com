import { BuilderLayout } from './BuilderLayout'
import { BuilderProvider } from './BuilderProvider'

export function BuilderPage() {
  return (
    <BuilderProvider>
      <BuilderLayout />
    </BuilderProvider>
  )
}
