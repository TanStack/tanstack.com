import { create } from 'zustand'

interface DevServerState {
  devProcess: any | null
  isRunning: boolean
  setDevProcess: (process: any | null) => void
  setIsRunning: (running: boolean) => void
  stopDevServer: () => Promise<void>
}

export const useDevServerStore = create<DevServerState>((set, get) => ({
  devProcess: null,
  isRunning: false,

  setDevProcess: (process) => set({ devProcess: process }),
  setIsRunning: (running) => set({ isRunning: running }),

  stopDevServer: async () => {
    const { devProcess } = get()
    if (devProcess) {
      console.log('Stopping dev server...')
      try {
        await devProcess.kill()
        set({ devProcess: null, isRunning: false })
        // Wait a bit for the process to fully terminate
        await new Promise((resolve) => setTimeout(resolve, 1000))
        console.log('Dev server stopped')
      } catch (error) {
        console.warn('Error stopping dev server:', error)
      }
    }
  },
}))
