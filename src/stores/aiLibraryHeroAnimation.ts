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

export const SVG_WIDTH = 632
export const SVG_HEIGHT = 432
export const BOX_FONT_SIZE = 18
export const BOX_FONT_WEIGHT = 700
export const SERVICE_WIDTH = 160
export const SERVICE_GUTTER = 20
export const SERVICE_LOCATIONS = [0, 1, 2, 3].map(
  (index) =>
    SERVICE_WIDTH * 2 +
    index * (SERVICE_WIDTH + SERVICE_GUTTER) +
    SERVICE_GUTTER / 2
)
export const SERVICE_Y_OFFSET = 265
export const SERVICE_HEIGHT = 40
export const SERVICE_Y_CENTER = SERVICE_Y_OFFSET + SERVICE_HEIGHT / 2

export type ChatMessage = {
  id: string
  user: string
  assistant: string | null
  isStreaming: boolean
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
  messages: ChatMessage[]
  currentMessageIndex: number
  typingUserMessage: string
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
  addMessage: (user: string) => string
  updateCurrentAssistantMessage: (text: string) => void
  setCurrentMessageStreaming: (streaming: boolean) => void
  setCurrentMessageIndex: (index: number) => void
  clearMessages: () => void
  setTypingUserMessage: (message: string) => void
  clearTypingUserMessage: () => void
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
  serviceOffset: 0 - SERVICE_WIDTH / 2 - SERVICE_GUTTER / 2,
  messages: [],
  currentMessageIndex: -1,
  typingUserMessage: '',
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
  addMessage: (user) => {
    const id = `${Date.now()}-${Math.random()}`
    set((state) => ({
      messages: [
        ...state.messages,
        { id, user, assistant: null, isStreaming: false },
      ],
      currentMessageIndex: state.messages.length,
    }))
    return id
  },
  updateCurrentAssistantMessage: (text) =>
    set((state) => {
      if (
        state.currentMessageIndex >= 0 &&
        state.currentMessageIndex < state.messages.length
      ) {
        const messages = [...state.messages]
        messages[state.currentMessageIndex] = {
          ...messages[state.currentMessageIndex],
          assistant: text,
        }
        return { messages }
      }
      return {}
    }),
  setCurrentMessageStreaming: (streaming) =>
    set((state) => {
      if (
        state.currentMessageIndex >= 0 &&
        state.currentMessageIndex < state.messages.length
      ) {
        const messages = [...state.messages]
        messages[state.currentMessageIndex] = {
          ...messages[state.currentMessageIndex],
          isStreaming: streaming,
        }
        return { messages }
      }
      return {}
    }),
  setCurrentMessageIndex: (index) => set({ currentMessageIndex: index }),
  clearMessages: () =>
    set({ messages: [], currentMessageIndex: -1, typingUserMessage: '' }),
  setTypingUserMessage: (message) => set({ typingUserMessage: message }),
  clearTypingUserMessage: () => set({ typingUserMessage: '' }),
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
      connectionPulseDirection: 'down',
      // Don't reset serviceOffset - keep service in place until new selection
      // Don't reset messages - they'll be cleared separately when all are shown
    }),
}))
