import * as React from 'react'

export type BuilderWorkspaceControls = {
  controlsId: string
  open: boolean
  toggle(): void
}

export const BuilderWorkspaceControlsContext =
  React.createContext<BuilderWorkspaceControls | null>(null)

export function useBuilderWorkspaceControls() {
  return React.useContext(BuilderWorkspaceControlsContext)
}
