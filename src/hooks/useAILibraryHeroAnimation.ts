import { useEffect, useCallback, useRef } from 'react'
import {
  useAILibraryHeroAnimationStore,
  AnimationPhase,
  SERVICE_WIDTH,
  SERVICE_GUTTER,
} from '~/stores/aiLibraryHeroAnimation'

const FRAMEWORKS_COUNT = 4
const SERVICES_COUNT = 4
const SERVERS_COUNT = 4

const MESSAGES = [
  {
    user: 'What makes TanStack AI different?',
    assistant:
      'TanStack AI is completely agnostic - server agnostic, client agnostic, and service agnostic. Use any backend (TypeScript, PHP, Python), any client (vanilla JS, React, Solid), and any AI service (OpenAI, Anthropic, Gemini, Ollama). We provide the libraries and standards, you choose your stack.',
  },
  {
    user: 'Do you support tools?',
    assistant:
      'Yes! We have full support for both client and server tooling, including tool approvals. You can execute tools on either side with complete type safety and control.',
  },
  {
    user: 'What about thinking models?',
    assistant:
      "We fully support thinking and reasoning models. All thinking and reasoning tokens are sent to the client, giving you complete visibility into the model's reasoning process.",
  },
  {
    user: 'How type-safe is it?',
    assistant:
      'We have total type safety across providers, models, and model options. Every interaction is fully typed from end to end, catching errors at compile time.',
  },
  {
    user: 'What about developer experience?',
    assistant:
      'We have next-generation dev tools that show you everything happening with your AI connection in real-time. Debug, inspect, and optimize with complete visibility.',
  },
  {
    user: 'Is this a service I have to pay for?',
    assistant:
      "No! TanStack AI is pure open source software. We don't have a service to promote or charge for. This is an ecosystem of libraries and standards connecting you with the services you choose - completely community supported.",
  },
]

// Animation timing configuration
const TIMING = {
  phaseTransition: 500,
  rotationFast: 100,
  rotationSlowBase: 150,
  rotationSlowIncrement: 50,
  serviceRotationFast: 120,
  serviceRotationSlowBase: 180,
  serviceRotationSlowIncrement: 60,
  afterSelection: 800,
  afterServiceSelection: 1000,
  typingCharBase: 30,
  typingCharVariance: 40,
  pulsingDuration: 2000,
  streamingChunkBase: 20,
  streamingChunkVariance: 60,
  afterStreamComplete: 500,
  holdDuration: 2000,
  restartDelay: 1000,
}

function getRandomIndex(length: number, exclude?: number): number {
  let index
  do {
    index = Math.floor(Math.random() * length)
  } while (exclude !== undefined && index === exclude)
  return index
}

function getRandomRotationCount(base: number, variance: number): number {
  return base + Math.floor(Math.random() * variance)
}

export function useAILibraryHeroAnimation() {
  const timeoutsRef = useRef<NodeJS.Timeout[]>([])
  const store = useAILibraryHeroAnimationStore()

  const addTimeout = useCallback((fn: () => void, delay: number) => {
    const timeout = setTimeout(fn, delay)
    timeoutsRef.current.push(timeout)
    return timeout
  }, [])

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  // Rotation animation runner
  const runRotation = useCallback(
    (opts: {
      count: number
      setRotating: (index: number | null) => void
      setSelected: (index: number) => void
      targetIndex: number
      itemCount: number
      getDelay: (iteration: number, total: number) => number
      onComplete: () => void
    }) => {
      let currentIndex = Math.floor(Math.random() * opts.itemCount)

      const rotate = (iteration: number) => {
        if (iteration < opts.count - 1) {
          opts.setRotating(currentIndex)
          currentIndex = (currentIndex + 1) % opts.itemCount
          addTimeout(
            () => rotate(iteration + 1),
            opts.getDelay(iteration, opts.count),
          )
        } else {
          opts.setRotating(opts.targetIndex)
          addTimeout(() => {
            opts.setSelected(opts.targetIndex)
            opts.setRotating(null)
            addTimeout(opts.onComplete, TIMING.afterSelection)
          }, TIMING.afterSelection)
        }
      }

      rotate(0)
    },
    [addTimeout],
  )

  // Select framework, service, and server in sequence
  const selectStackCombination = useCallback(
    (onComplete: () => void) => {
      store.setPhase(AnimationPhase.DESELECTING)

      addTimeout(() => {
        // Phase: Select framework
        store.setPhase(AnimationPhase.SELECTING_FRAMEWORK)
        const targetFramework = getRandomIndex(FRAMEWORKS_COUNT)
        const frameworkRotations = getRandomRotationCount(8, 4)

        runRotation({
          count: frameworkRotations,
          setRotating: store.setRotatingFramework,
          setSelected: store.setSelectedFramework,
          targetIndex: targetFramework,
          itemCount: FRAMEWORKS_COUNT,
          getDelay: (i, total) =>
            i < total - 4
              ? TIMING.rotationFast
              : TIMING.rotationSlowBase +
                (i - (total - 4)) * TIMING.rotationSlowIncrement,
          onComplete: () => {
            // Phase: Select service
            store.setPhase(AnimationPhase.SELECTING_SERVICE)
            const currentService =
              useAILibraryHeroAnimationStore.getState().selectedService
            const targetService = getRandomIndex(
              SERVICES_COUNT,
              currentService ?? undefined,
            )
            const serviceRotations = getRandomRotationCount(6, 3)

            let currentServiceIndex = Math.floor(Math.random() * SERVICES_COUNT)

            const rotateService = (iteration: number) => {
              if (iteration < serviceRotations - 1) {
                store.setRotatingService(currentServiceIndex)
                currentServiceIndex = (currentServiceIndex + 1) % SERVICES_COUNT
                const delay =
                  iteration < serviceRotations - 3
                    ? TIMING.serviceRotationFast
                    : TIMING.serviceRotationSlowBase +
                      (iteration - (serviceRotations - 3)) *
                        TIMING.serviceRotationSlowIncrement
                addTimeout(() => rotateService(iteration + 1), delay)
              } else {
                store.setRotatingService(targetService)
                addTimeout(() => {
                  store.setSelectedService(targetService)
                  store.setRotatingService(null)
                  const targetX = -(
                    SERVICE_WIDTH / 2 +
                    SERVICE_GUTTER / 2 +
                    targetService * (SERVICE_WIDTH + SERVICE_GUTTER)
                  )
                  store.setServiceOffset(targetX)

                  addTimeout(() => {
                    // Phase: Select server
                    store.setPhase(AnimationPhase.SELECTING_SERVER)
                    const targetServer = getRandomIndex(SERVERS_COUNT)
                    const serverRotations = getRandomRotationCount(8, 4)

                    runRotation({
                      count: serverRotations,
                      setRotating: store.setRotatingServer,
                      setSelected: store.setSelectedServer,
                      targetIndex: targetServer,
                      itemCount: SERVERS_COUNT,
                      getDelay: (i, total) =>
                        i < total - 4
                          ? TIMING.rotationFast
                          : TIMING.rotationSlowBase +
                            (i - (total - 4)) * TIMING.rotationSlowIncrement,
                      onComplete,
                    })
                  }, TIMING.afterServiceSelection)
                }, TIMING.afterSelection)
              }
            }

            rotateService(0)
          },
        })
      }, TIMING.phaseTransition)
    },
    [addTimeout, runRotation, store],
  )

  // Type user message character by character
  const typeUserMessage = useCallback(
    (message: string, onComplete: () => void) => {
      store.clearTypingUserMessage()
      let index = 0

      const typeChar = () => {
        if (index < message.length) {
          store.setTypingUserMessage(message.slice(0, index + 1))
          index++
          const delay =
            TIMING.typingCharBase +
            Math.floor(Math.random() * TIMING.typingCharVariance)
          addTimeout(typeChar, delay)
        } else {
          addTimeout(() => {
            store.clearTypingUserMessage()
            store.addMessage(message)
            onComplete()
          }, 300)
        }
      }

      typeChar()
    },
    [addTimeout, store],
  )

  // Stream assistant response
  const streamResponse = useCallback(
    (response: string, onComplete: () => void) => {
      store.setCurrentMessageStreaming(true)
      let currentIndex = 0

      const streamChunk = () => {
        if (currentIndex < response.length) {
          const chunkSize = 2 + Math.floor(Math.random() * 7)
          const nextIndex = Math.min(currentIndex + chunkSize, response.length)
          store.updateCurrentAssistantMessage(response.slice(0, nextIndex))
          currentIndex = nextIndex
          const delay =
            TIMING.streamingChunkBase +
            Math.floor(Math.random() * TIMING.streamingChunkVariance)
          addTimeout(streamChunk, delay)
        } else {
          store.setCurrentMessageStreaming(false)
          addTimeout(onComplete, TIMING.afterStreamComplete)
        }
      }

      streamChunk()
    },
    [addTimeout, store],
  )

  // Process a single message in the conversation
  const processMessage = useCallback(
    (messageIndex: number, onAllComplete: () => void) => {
      if (messageIndex >= MESSAGES.length) {
        // All messages shown, restart
        store.clearMessages()
        addTimeout(() => {
          store.setPhase(AnimationPhase.STARTING)
          addTimeout(() => {
            selectStackCombination(() => processMessage(0, onAllComplete))
          }, TIMING.restartDelay)
        }, TIMING.restartDelay)
        return
      }

      const message = MESSAGES[messageIndex]
      store.setPhase(AnimationPhase.SHOWING_CHAT)

      typeUserMessage(message.user, () => {
        addTimeout(() => {
          // Pulsing phase
          store.setPhase(AnimationPhase.PULSING_CONNECTIONS)
          store.setConnectionPulseDirection('down')

          addTimeout(() => {
            // Streaming phase
            store.setPhase(AnimationPhase.STREAMING_RESPONSE)
            store.setConnectionPulseDirection('up')

            streamResponse(message.assistant, () => {
              store.setPhase(AnimationPhase.HOLDING)
              addTimeout(() => {
                selectStackCombination(() =>
                  processMessage(messageIndex + 1, onAllComplete),
                )
              }, TIMING.holdDuration)
            })
          }, TIMING.pulsingDuration)
        }, 500)
      })
    },
    [
      addTimeout,
      store,
      selectStackCombination,
      typeUserMessage,
      streamResponse,
    ],
  )

  // Start the animation sequence
  const startAnimation = useCallback(() => {
    store.setPhase(AnimationPhase.STARTING)
    addTimeout(() => {
      selectStackCombination(() => processMessage(0, () => {}))
    }, TIMING.restartDelay)
  }, [addTimeout, store, selectStackCombination, processMessage])

  // Effect to run animation on mount
  useEffect(() => {
    startAnimation()
    return clearAllTimeouts
  }, [startAnimation, clearAllTimeouts])

  return { store }
}
