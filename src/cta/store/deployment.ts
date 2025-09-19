import { create } from 'zustand'

export type DeploymentStatus =
  | 'idle'
  | 'building'
  | 'deploying'
  | 'success'
  | 'error'

export interface DeploymentState {
  status: DeploymentStatus
  message: string | null
  terminalOutput: string[]
  deployedUrl: string | null
  claimUrl: string | null
  errorMessage: string | null

  // Actions
  setStatus: (status: DeploymentStatus) => void
  setMessage: (message: string | null) => void
  addTerminalOutput: (line: string) => void
  clearTerminalOutput: () => void
  setDeployedUrl: (url: string | null) => void
  setClaimUrl: (url: string | null) => void
  setErrorMessage: (message: string | null) => void
  reset: () => void
}

export const useDeploymentStore = create<DeploymentState>((set) => ({
  status: 'idle',
  message: null,
  terminalOutput: [],
  deployedUrl: null,
  claimUrl: null,
  errorMessage: null,

  setStatus: (status) => set({ status }),
  setMessage: (message) => set({ message }),
  addTerminalOutput: (line) =>
    set((state) => ({
      terminalOutput: [...state.terminalOutput, line].slice(-100), // Keep last 100 lines
    })),
  clearTerminalOutput: () => set({ terminalOutput: [] }),
  setDeployedUrl: (url) => set({ deployedUrl: url }),
  setClaimUrl: (url) => set({ claimUrl: url }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  reset: () =>
    set({
      status: 'idle',
      message: null,
      terminalOutput: [],
      deployedUrl: null,
      claimUrl: null,
      errorMessage: null,
    }),
}))
