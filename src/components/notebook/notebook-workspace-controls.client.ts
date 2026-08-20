import * as React from 'react'

export type NotebookWorkspaceControls = {
  controlsId: string
  open: boolean
  toggle(): void
}

export const NotebookWorkspaceControlsContext =
  React.createContext<NotebookWorkspaceControls | null>(null)

export function useNotebookWorkspaceControls() {
  return React.useContext(NotebookWorkspaceControlsContext)
}
