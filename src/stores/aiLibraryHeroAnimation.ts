import { create } from 'zustand'

export enum AnimationPhase {
  STARTING = 'STARTING',
  DESELECTING = 'DESELECTING',
  SELECTING_FRAMEWORK = 'SELECTING_FRAMEWORK',
  SELECTING_SERVICE = 'SELECTING_SERVICE',
  SELECTING_SERVER = 'SELECTING_SERVER',
  SHOWING_CHAT = 'SHOWING_CHAT',
  PULSING_CONNECTIONS = 'PULSING_CONNECTIONS',
  STREAMING_RESPONSE = 'STREAMING_RESPONSE',
  HOLDING = 'HOLDING',
}

type AILibraryHeroAnimationState = {
  phase: AnimationPhase
  selectedFramework: number | null
  selectedService: number | null
  selectedServer: number | null
  rotatingFramework: number | null
  rotatingServer: number | null
  rotatingService: number | null
  serviceOffset: number
  userMessage: string | null
  assistantMessage: string | null
  isStreaming: boolean
  connectionPulseDirection: 'down' | 'up'
  timeoutRefs: NodeJS.Timeout[]
}

type AILibraryHeroAnimationActions = {
  setPhase: (phase: AnimationPhase) => void
  setSelectedFramework: (framework: number | null) => void
  setSelectedService: (service: number | null) => void
  setSelectedServer: (server: number | null) => void
  setRotatingFramework: (framework: number | null) => void
  setRotatingServer: (server: number | null) => void
  setRotatingService: (service: number | null) => void
  setServiceOffset: (offset: number) => void
  setUserMessage: (message: string | null) => void
  setAssistantMessage: (message: string | null) => void
  setIsStreaming: (streaming: boolean) => void
  setConnectionPulseDirection: (direction: 'down' | 'up') => void
  addTimeout: (timeout: NodeJS.Timeout) => void
  clearTimeouts: () => void
  reset: () => void
}

export const useAILibraryHeroAnimationStore = create<
  AILibraryHeroAnimationState & AILibraryHeroAnimationActions
>()((set, get) => ({
  // State
  phase: AnimationPhase.STARTING,
  selectedFramework: null,
  selectedService: null,
  selectedServer: null,
  rotatingFramework: null,
  rotatingServer: null,
  rotatingService: null,
  serviceOffset: 0,
  userMessage: null,
  assistantMessage: null,
  isStreaming: false,
  connectionPulseDirection: 'down',
  timeoutRefs: [],

  // Actions
  setPhase: (phase) => set({ phase }),
  setSelectedFramework: (framework) => set({ selectedFramework: framework }),
  setSelectedService: (service) => set({ selectedService: service }),
  setSelectedServer: (server) => set({ selectedServer: server }),
  setRotatingFramework: (framework) => set({ rotatingFramework: framework }),
  setRotatingServer: (server) => set({ rotatingServer: server }),
  setRotatingService: (service) => set({ rotatingService: service }),
  setServiceOffset: (offset) => set({ serviceOffset: offset }),
  setUserMessage: (message) => set({ userMessage: message }),
  setAssistantMessage: (message) => set({ assistantMessage: message }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  setConnectionPulseDirection: (direction) =>
    set({ connectionPulseDirection: direction }),
  addTimeout: (timeout) =>
    set((state) => ({ timeoutRefs: [...state.timeoutRefs, timeout] })),
  clearTimeouts: () => {
    const { timeoutRefs } = get()
    timeoutRefs.forEach(clearTimeout)
    set({ timeoutRefs: [] })
  },
  reset: () =>
    set({
      phase: AnimationPhase.STARTING,
      selectedFramework: null,
      selectedService: null,
      selectedServer: null,
      rotatingFramework: null,
      rotatingServer: null,
      rotatingService: null,
      userMessage: null,
      assistantMessage: null,
      connectionPulseDirection: 'down',
      // Don't reset serviceOffset - keep service in place until new selection
    }),
}))
