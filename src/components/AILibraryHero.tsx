import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { Link, LinkProps } from '@tanstack/react-router'
import type { Library } from '~/libraries'
import { useIsDark } from '~/hooks/useIsDark'
import { ChatPanel } from './ChatPanel'
import {
  useAILibraryHeroAnimationStore,
  AnimationPhase,
} from '~/stores/aiLibraryHeroAnimation'
import { AILibraryHeroCard } from './AILibraryHeroCard'
import { AILibraryHeroBox } from './AILibraryHeroBox'
import { AILibraryHeroServiceCard } from './AILibraryHeroServiceCard'
import tsLogo from '~/images/ts-logo.svg'
import reactLogo from '~/images/react-logo.svg'
import solidLogo from '~/images/solid-logo.svg'
import pythonLogo from '~/images/python.svg'
import phpLightLogo from '~/images/php-light.svg'
import phpDarkLogo from '~/images/php-dark.svg'
import ollamaLightLogo from '~/images/ollama-light.svg'
import ollamaDarkLogo from '~/images/ollama-dark.svg'
import openaiLightLogo from '~/images/openai-light.svg'
import openaiDarkLogo from '~/images/openai-dark.svg'
import anthropicLightLogo from '~/images/anthropic-light.svg'
import anthropicDarkLogo from '~/images/anthropic-dark.svg'
import geminiLogo from '~/images/gemini.svg'

import {
  SVG_WIDTH,
  SVG_HEIGHT,
  BOX_FONT_SIZE,
  BOX_FONT_WEIGHT,
  SERVICE_WIDTH,
  SERVICE_GUTTER,
  SERVICE_LOCATIONS,
  SERVICE_Y_OFFSET,
  SERVICE_Y_CENTER,
  SERVICE_HEIGHT,
  LIBRARY_CARD_WIDTH,
  LIBRARY_CARD_HEIGHT,
  LIBRARY_CARD_LOCATIONS,
  SERVER_CARD_Y_OFFSET,
  SERVER_CARD_LOCATIONS,
  SERVER_CARD_WIDTH,
  SERVER_CARD_HEIGHT,
} from '~/stores/aiLibraryHeroAnimation'

// Get the store instance for accessing getState in closures
const getStoreState = () => useAILibraryHeroAnimationStore.getState()

type AILibraryHeroProps = {
  project: Library
  cta?: {
    linkProps: LinkProps
    label: string
    className?: string
  }
  actions?: React.ReactNode
}

const FRAMEWORKS = ['vanilla', 'react', 'solid', '?'] as const
const SERVICES = ['ollama', 'openai', 'anthropic', 'gemini'] as const
const SERVERS = ['typescript', 'php', 'python', '?'] as const

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

export function AILibraryHero({ project, cta, actions }: AILibraryHeroProps) {
  const isDark = useIsDark()
  const strokeColor = isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.6)'
  const textColor = isDark ? '#ffffff' : '#000000'

  const {
    phase,
    selectedFramework,
    selectedService,
    selectedServer,
    rotatingFramework,
    rotatingServer,
    rotatingService,
    serviceOffset,
    messages,
    typingUserMessage,
    connectionPulseDirection,
    setPhase,
    setSelectedFramework,
    setSelectedService,
    setSelectedServer,
    setRotatingFramework,
    setRotatingServer,
    setRotatingService,
    setServiceOffset,
    addMessage,
    updateCurrentAssistantMessage,
    setCurrentMessageStreaming,
    clearMessages,
    setTypingUserMessage,
    clearTypingUserMessage,
    setConnectionPulseDirection,
    addTimeout,
    clearTimeouts,
  } = useAILibraryHeroAnimationStore()

  React.useEffect(() => {
    const addTimeoutHelper = (fn: () => void, delay: number) => {
      const timeout = setTimeout(fn, delay)
      addTimeout(timeout)
      return timeout
    }

    const getRandomIndex = (length: number, exclude?: number) => {
      let index
      do {
        index = Math.floor(Math.random() * length)
      } while (exclude !== undefined && index === exclude)
      return index
    }

    const selectFrameworkServiceServer = (onComplete: () => void) => {
      // Phase 2: DESELECTING
      setPhase(AnimationPhase.DESELECTING)
      addTimeoutHelper(() => {
        // Phase 3: SELECTING_FRAMEWORK
        setPhase(AnimationPhase.SELECTING_FRAMEWORK)
        const targetFramework = getRandomIndex(FRAMEWORKS.length)
        let currentIndex = Math.floor(Math.random() * FRAMEWORKS.length)
        const rotationCount = 8 + Math.floor(Math.random() * 4) // 8-11 rotations

        const rotateFramework = (iteration: number) => {
          if (iteration < rotationCount - 1) {
            setRotatingFramework(currentIndex)
            currentIndex = (currentIndex + 1) % FRAMEWORKS.length
            const delay =
              iteration < rotationCount - 4
                ? 100
                : 150 + (iteration - (rotationCount - 4)) * 50
            addTimeoutHelper(() => rotateFramework(iteration + 1), delay)
          } else {
            // Final iteration - ensure we land on target
            setRotatingFramework(targetFramework)
            addTimeoutHelper(() => {
              setSelectedFramework(targetFramework)
              setRotatingFramework(null)
              addTimeoutHelper(() => {
                // Phase 4: SELECTING_SERVICE
                setPhase(AnimationPhase.SELECTING_SERVICE)
                // Always pick a different service so it has to scroll
                const currentSelectedService = getStoreState().selectedService
                const targetService = getRandomIndex(
                  SERVICES.length,
                  currentSelectedService ?? undefined,
                )
                let currentServiceIndex = Math.floor(
                  Math.random() * SERVICES.length,
                )
                const serviceRotationCount = 6 + Math.floor(Math.random() * 3)

                const rotateService = (iteration: number) => {
                  if (iteration < serviceRotationCount - 1) {
                    setRotatingService(currentServiceIndex)
                    currentServiceIndex =
                      (currentServiceIndex + 1) % SERVICES.length
                    const delay =
                      iteration < serviceRotationCount - 3
                        ? 120
                        : 180 + (iteration - (serviceRotationCount - 3)) * 60
                    addTimeoutHelper(() => rotateService(iteration + 1), delay)
                  } else {
                    // Final iteration - ensure we land on target
                    setRotatingService(targetService)
                    addTimeoutHelper(() => {
                      setSelectedService(targetService)
                      setRotatingService(null)
                      const targetX =
                        0 -
                        SERVICE_WIDTH / 2 -
                        SERVICE_GUTTER / 2 -
                        targetService * (SERVICE_WIDTH + SERVICE_GUTTER)
                      setServiceOffset(targetX)

                      addTimeoutHelper(() => {
                        // Phase 5: SELECTING_SERVER
                        setPhase(AnimationPhase.SELECTING_SERVER)
                        const targetServer = getRandomIndex(SERVERS.length)
                        let currentServerIndex = Math.floor(
                          Math.random() * SERVERS.length,
                        )
                        const serverRotationCount =
                          8 + Math.floor(Math.random() * 4)

                        const rotateServer = (iteration: number) => {
                          if (iteration < serverRotationCount - 1) {
                            setRotatingServer(currentServerIndex)
                            currentServerIndex =
                              (currentServerIndex + 1) % SERVERS.length
                            const delay =
                              iteration < serverRotationCount - 4
                                ? 100
                                : 150 +
                                  (iteration - (serverRotationCount - 4)) * 50
                            addTimeoutHelper(
                              () => rotateServer(iteration + 1),
                              delay,
                            )
                          } else {
                            // Final iteration - ensure we land on target
                            setRotatingServer(targetServer)
                            addTimeoutHelper(() => {
                              setSelectedServer(targetServer)
                              setRotatingServer(null)
                              addTimeoutHelper(() => {
                                // Selection complete, call callback
                                onComplete()
                              }, 800)
                            }, 1000)
                          }
                        }
                        rotateServer(0)
                      }, 1000)
                    }, 800)
                  }
                }
                rotateService(0)
              }, 800)
            }, 500)
          }
        }
        rotateFramework(0)
      }, 500)
    }

    const processNextMessage = (messageIndex: number) => {
      if (messageIndex >= MESSAGES.length) {
        // All messages shown, clear and restart
        clearMessages()
        addTimeoutHelper(() => {
          // Phase 1: STARTING (initial state)
          setPhase(AnimationPhase.STARTING)
          addTimeoutHelper(() => {
            // Start first message with selection
            selectFrameworkServiceServer(() => {
              processNextMessage(0)
            })
          }, 1000)
        }, 1000)
        return
      }

      const message = MESSAGES[messageIndex]

      // Phase 6: SHOWING_CHAT - Type user message in input field first
      setPhase(AnimationPhase.SHOWING_CHAT)
      clearTypingUserMessage()

      // Type the user message character by character in the input field
      let typingIndex = 0
      const typeUserMessage = () => {
        if (typingIndex < message.user.length) {
          setTypingUserMessage(message.user.slice(0, typingIndex + 1))
          typingIndex++
          const delay = 30 + Math.floor(Math.random() * 40) // 30-70ms per character
          addTimeoutHelper(typeUserMessage, delay)
        } else {
          // Typing complete, wait a moment then clear input and show as bubble
          addTimeoutHelper(() => {
            clearTypingUserMessage()
            addMessage(message.user)
            addTimeoutHelper(() => {
              // Phase 7: PULSING_CONNECTIONS
              setPhase(AnimationPhase.PULSING_CONNECTIONS)
              setConnectionPulseDirection('down')
              addTimeoutHelper(() => {
                // Phase 8: STREAMING_RESPONSE
                setPhase(AnimationPhase.STREAMING_RESPONSE)
                setConnectionPulseDirection('up')
                const fullMessage = message.assistant
                setCurrentMessageStreaming(true)
                let currentIndex = 0

                const streamChunk = () => {
                  if (currentIndex < fullMessage.length) {
                    // Random chunk size between 2 and 8 characters
                    const chunkSize = 2 + Math.floor(Math.random() * 7)
                    const nextIndex = Math.min(
                      currentIndex + chunkSize,
                      fullMessage.length,
                    )
                    updateCurrentAssistantMessage(
                      fullMessage.slice(0, nextIndex),
                    )
                    currentIndex = nextIndex
                    // Random delay between 20ms and 80ms
                    const delay = 20 + Math.floor(Math.random() * 60)
                    addTimeoutHelper(streamChunk, delay)
                  } else {
                    setCurrentMessageStreaming(false)
                    addTimeoutHelper(() => {
                      // Phase 9: HOLDING - brief pause before next message
                      setPhase(AnimationPhase.HOLDING)
                      addTimeoutHelper(() => {
                        // Select new combination for next message
                        selectFrameworkServiceServer(() => {
                          // Move to next message
                          processNextMessage(messageIndex + 1)
                        })
                      }, 2000)
                    }, 500)
                  }
                }
                streamChunk()
              }, 2000)
            }, 500)
          }, 300)
        }
      }
      typeUserMessage()
    }

    const startAnimationSequence = () => {
      // Phase 1: STARTING (initial state)
      setPhase(AnimationPhase.STARTING)
      addTimeoutHelper(() => {
        // Start first message with selection
        selectFrameworkServiceServer(() => {
          processNextMessage(0)
        })
      }, 1000)
    }

    startAnimationSequence()

    return () => {
      clearTimeouts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getOpacity = (
    index: number,
    selectedIndex: number | null,
    rotatingIndex: number | null,
  ) => {
    if (rotatingIndex !== null && rotatingIndex === index) {
      return 1.0
    }
    if (selectedIndex !== null && selectedIndex === index) {
      return 1.0
    }
    return 0.3
  }

  const getServiceOpacity = (index: number) => {
    if (rotatingService !== null && rotatingService === index) {
      return 1.0
    }
    if (selectedService !== null && selectedService === index) {
      return 1.0
    }
    return 0.3
  }

  const getConnectionOpacity = (
    frameworkIndex: number,
    serverIndex: number,
  ) => {
    const isFrameworkSelected =
      selectedFramework !== null && selectedFramework === frameworkIndex
    const isServerSelected =
      selectedServer !== null && selectedServer === serverIndex
    const isHighlighting =
      phase === AnimationPhase.SHOWING_CHAT ||
      phase === AnimationPhase.PULSING_CONNECTIONS ||
      phase === AnimationPhase.STREAMING_RESPONSE

    // Active path: selected framework -> client -> ai -> selected server
    if (isHighlighting && isFrameworkSelected && isServerSelected) {
      return 1.0
    }
    // Unused lines should be low opacity
    return 0.3
  }

  const getConnectionStrokeColor = (
    frameworkIndex: number,
    serverIndex: number,
  ) => {
    // If no selections, ALWAYS return original stroke color (highest priority check)
    if (selectedFramework === null || selectedServer === null) {
      return strokeColor
    }

    // Only highlight during specific phases
    const isHighlighting =
      phase === AnimationPhase.SHOWING_CHAT ||
      phase === AnimationPhase.PULSING_CONNECTIONS ||
      phase === AnimationPhase.STREAMING_RESPONSE

    // If not in a highlighting phase, always return original stroke color
    if (!isHighlighting) {
      return strokeColor
    }

    // Now check if this is the active path
    const isFrameworkSelected = selectedFramework === frameworkIndex
    const isServerSelected = selectedServer === serverIndex

    // Active path: selected framework -> client -> ai -> selected server
    // Only return off-white if we're in a highlighting phase AND this is the active path
    if (isFrameworkSelected && isServerSelected) {
      // Off-white color when active
      return isDark ? 'rgba(255, 255, 240, 0.95)' : 'rgba(255, 255, 240, 0.95)'
    }

    // Not the active path, return original color
    return strokeColor
  }

  const getConnectionPulse = () => {
    if (
      phase === AnimationPhase.PULSING_CONNECTIONS ||
      phase === AnimationPhase.STREAMING_RESPONSE
    ) {
      return connectionPulseDirection === 'down' ? 'down' : 'up'
    }
    return null
  }

  const getScaleTransform = (
    index: number,
    selectedIndex: number | null,
    centerX: number,
    centerY: number,
  ) => {
    if (selectedIndex === index) {
      return `translate(${centerX}, ${centerY}) scale(1.1) translate(-${centerX}, -${centerY})`
    }
    return ''
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes pulse-down {
              0% {
                opacity: 0.6;
                filter: brightness(1) drop-shadow(0 0 2px currentColor);
              }
              50% {
                opacity: 1;
                filter: brightness(1.8) drop-shadow(0 0 8px currentColor);
              }
              100% {
                opacity: 0.6;
                filter: brightness(1) drop-shadow(0 0 2px currentColor);
              }
            }
            @keyframes pulse-up {
              0% {
                opacity: 0.6;
                filter: brightness(1) drop-shadow(0 0 2px currentColor);
              }
              50% {
                opacity: 1;
                filter: brightness(1.8) drop-shadow(0 0 8px currentColor);
              }
              100% {
                opacity: 0.6;
                filter: brightness(1) drop-shadow(0 0 2px currentColor);
              }
            }
            .animate-pulse-down {
              animation: pulse-down 1s ease-in-out infinite;
              stroke-width: 5;
            }
            .animate-pulse-up {
              animation: pulse-up 1s ease-in-out infinite;
              stroke-width: 5;
            }
          `,
        }}
      />
      <div className="relative flex flex-col items-center gap-8 text-center px-4 overflow-visible">
        {/* Diagram and Chat Panel Container */}
        <div
          className="relative z-10 w-full max-w-7xl mx-auto flex flex-row flex-wrap gap-8 lg:gap-12"
          style={{ height: SVG_HEIGHT }}
        >
          {/* SVG Diagram */}
          <div className="relative w-full lg:flex-1 overflow-visible h-full">
            <svg
              key={`${phase}-${selectedFramework}-${selectedServer}`}
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              style={{ overflow: 'visible' }}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                {/* Glass effect filter with blur and opacity */}
                <filter id="glass" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur
                    in="SourceGraphic"
                    stdDeviation="3"
                    result="blur"
                  />
                  <feColorMatrix
                    in="blur"
                    type="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.4 0"
                    result="glassBlur"
                  />
                  <feComposite
                    in="SourceGraphic"
                    in2="glassBlur"
                    operator="over"
                  />
                </filter>

                {/* Subtle glow for lines */}
                <filter
                  id="lineGlow"
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur
                    in="SourceGraphic"
                    stdDeviation="1.5"
                    result="coloredBlur"
                  />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Glass gradient */}
                <linearGradient
                  id="glassGradient"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    stopColor={
                      isDark
                        ? 'rgba(255, 255, 255, 0.55)'
                        : 'rgba(255, 255, 255, 0.8)'
                    }
                    stopOpacity="1"
                  />
                  <stop
                    offset="100%"
                    stopColor={
                      isDark
                        ? 'rgba(255, 255, 255, 0.55)'
                        : 'rgba(255, 255, 255, 0.6)'
                    }
                    stopOpacity="1"
                  />
                </linearGradient>

                {/* Glass gradient for larger boxes */}
                <linearGradient
                  id="glassGradientLarge"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    stopColor={
                      isDark
                        ? 'rgba(255, 255, 255, 0.55)'
                        : 'rgba(255, 255, 255, 0.75)'
                    }
                    stopOpacity="1"
                  />
                  <stop
                    offset="100%"
                    stopColor={
                      isDark
                        ? 'rgba(255, 255, 255, 0.55)'
                        : 'rgba(255, 255, 255, 0.55)'
                    }
                    stopOpacity="1"
                  />
                </linearGradient>
              </defs>

              {/* Lines from frameworks to ai-client */}
              <path
                id="framework-line-0"
                d="M 60 60 Q 60 80 151.26 80 Q 262.52 80 310 100"
                fill="none"
                stroke={getConnectionStrokeColor(0, selectedServer ?? -1)}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getConnectionOpacity(0, selectedServer ?? -1)}
                className={
                  selectedFramework === 0 &&
                  selectedServer !== null &&
                  getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />
              <path
                id="framework-line-1"
                d="M 220 60 Q 220 80 265 80 Q 310 80 310 100"
                fill="none"
                stroke={getConnectionStrokeColor(1, selectedServer ?? -1)}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getConnectionOpacity(1, selectedServer ?? -1)}
                className={
                  selectedFramework === 1 &&
                  selectedServer !== null &&
                  getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />
              <path
                id="framework-line-2"
                d="M 380 60 Q 380 80 355 80 Q 310 80 310 100"
                fill="none"
                stroke={getConnectionStrokeColor(2, selectedServer ?? -1)}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getConnectionOpacity(2, selectedServer ?? -1)}
                className={
                  selectedFramework === 2 &&
                  selectedServer !== null &&
                  getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />
              <path
                id="framework-line-3"
                d="M 540 60 Q 540 80 450 80 Q 358 80 310 100"
                fill="none"
                stroke={getConnectionStrokeColor(3, selectedServer ?? -1)}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getConnectionOpacity(3, selectedServer ?? -1)}
                className={
                  selectedFramework === 3 &&
                  selectedServer !== null &&
                  getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />

              {/* Lines from TanStack AI to servers */}
              <path
                id="server-line-0"
                d="M 60 370 Q 60 350 151.26 350 Q 262.52 350 310 320"
                fill="none"
                stroke={getConnectionStrokeColor(selectedFramework ?? -1, 0)}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getConnectionOpacity(selectedFramework ?? -1, 0)}
                className={
                  selectedServer === 0 &&
                  selectedFramework !== null &&
                  getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />
              <path
                id="server-line-1"
                d="M 220 370 Q 220 345 265 345 Q 310 345 310 320"
                fill="none"
                stroke={getConnectionStrokeColor(selectedFramework ?? -1, 1)}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getConnectionOpacity(selectedFramework ?? -1, 1)}
                className={
                  selectedServer === 1 &&
                  selectedFramework !== null &&
                  getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />
              <path
                id="server-line-2"
                d="M 380 370 Q 380 345 355 345 Q 310 345 310 320"
                fill="none"
                stroke={getConnectionStrokeColor(selectedFramework ?? -1, 2)}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getConnectionOpacity(selectedFramework ?? -1, 2)}
                className={
                  selectedServer === 2 &&
                  selectedFramework !== null &&
                  getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />
              <path
                id="server-line-3"
                d="M 540 370 Q 540 350 450 350 Q 358 350 310 320"
                fill="none"
                stroke={getConnectionStrokeColor(selectedFramework ?? -1, 3)}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getConnectionOpacity(selectedFramework ?? -1, 3)}
                className={
                  selectedServer === 3 &&
                  selectedFramework !== null &&
                  getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />

              {/* Top layer: Frameworks */}
              <AILibraryHeroCard
                x={LIBRARY_CARD_LOCATIONS[0]}
                y={0}
                width={LIBRARY_CARD_WIDTH}
                height={LIBRARY_CARD_HEIGHT}
                label="Vanilla"
                opacity={getOpacity(0, selectedFramework, rotatingFramework)}
                textColor={textColor}
                strokeColor={strokeColor}
                fontSize={BOX_FONT_SIZE}
                fontWeight={BOX_FONT_WEIGHT}
                logo={tsLogo}
                transform={getScaleTransform(
                  0,
                  selectedFramework,
                  LIBRARY_CARD_LOCATIONS[0] + LIBRARY_CARD_WIDTH / 2,
                  LIBRARY_CARD_HEIGHT / 2,
                )}
              />

              <AILibraryHeroCard
                x={LIBRARY_CARD_LOCATIONS[1]}
                y={0}
                width={LIBRARY_CARD_WIDTH}
                height={LIBRARY_CARD_HEIGHT}
                label="React"
                opacity={getOpacity(1, selectedFramework, rotatingFramework)}
                textColor={textColor}
                strokeColor={strokeColor}
                fontSize={BOX_FONT_SIZE}
                fontWeight={BOX_FONT_WEIGHT}
                logo={reactLogo}
                transform={getScaleTransform(
                  1,
                  selectedFramework,
                  LIBRARY_CARD_LOCATIONS[1] + LIBRARY_CARD_WIDTH / 2,
                  LIBRARY_CARD_HEIGHT / 2,
                )}
              />

              <AILibraryHeroCard
                x={LIBRARY_CARD_LOCATIONS[2]}
                y={0}
                width={LIBRARY_CARD_WIDTH}
                height={LIBRARY_CARD_HEIGHT}
                label="Solid"
                opacity={getOpacity(2, selectedFramework, rotatingFramework)}
                textColor={textColor}
                strokeColor={strokeColor}
                fontSize={BOX_FONT_SIZE}
                fontWeight={BOX_FONT_WEIGHT}
                logo={solidLogo}
                transform={getScaleTransform(
                  2,
                  selectedFramework,
                  LIBRARY_CARD_LOCATIONS[2] + LIBRARY_CARD_WIDTH / 2,
                  LIBRARY_CARD_HEIGHT / 2,
                )}
              />

              <AILibraryHeroCard
                x={LIBRARY_CARD_LOCATIONS[3]}
                y={0}
                width={LIBRARY_CARD_WIDTH}
                height={LIBRARY_CARD_HEIGHT}
                label="?"
                opacity={getOpacity(3, selectedFramework, rotatingFramework)}
                textColor={textColor}
                strokeColor={strokeColor}
                fontSize={BOX_FONT_SIZE}
                fontWeight={BOX_FONT_WEIGHT}
                isDashed={true}
                transform={getScaleTransform(
                  3,
                  selectedFramework,
                  LIBRARY_CARD_LOCATIONS[3] + LIBRARY_CARD_WIDTH / 2,
                  LIBRARY_CARD_HEIGHT / 2,
                )}
              />

              {/* @tanstack/ai-client box */}
              <AILibraryHeroBox
                x={150}
                y={100}
                width={320}
                height={60}
                label="@tanstack/ai-client"
                textColor={textColor}
                strokeColor={strokeColor}
                fontSize={25}
                fontWeight={900}
                opacity={0.9}
                logoSize={32}
              />

              {/* Large TanStack AI container box */}
              <AILibraryHeroBox
                x={150}
                y={210}
                width={320}
                height={110}
                label="TanStack AI"
                textColor={textColor}
                strokeColor={strokeColor}
                fontSize={25}
                fontWeight={900}
                rx={16.5}
                opacity={0.85}
                logoSize={32}
              />

              {/* Line from ai-client to @tanstack/ai - drawn after boxes to be on top */}
              <path
                id="client-to-ai-line"
                d="M 310 160 L 310 210"
                fill="none"
                stroke={
                  // If no selections, ALWAYS return original stroke color (highest priority check)
                  selectedFramework === null || selectedServer === null
                    ? strokeColor
                    : // Only highlight during specific phases
                    phase === AnimationPhase.SHOWING_CHAT ||
                      phase === AnimationPhase.PULSING_CONNECTIONS ||
                      phase === AnimationPhase.STREAMING_RESPONSE
                    ? isDark
                      ? 'rgba(255, 255, 240, 0.95)'
                      : 'rgba(255, 255, 240, 0.95)'
                    : strokeColor
                }
                strokeWidth={
                  phase === AnimationPhase.PULSING_CONNECTIONS ||
                  phase === AnimationPhase.STREAMING_RESPONSE ||
                  phase === AnimationPhase.SHOWING_CHAT
                    ? 5
                    : 2.5
                }
                strokeMiterlimit="10"
                opacity={
                  // Explicitly check for non-highlighting phases first
                  phase === AnimationPhase.STARTING ||
                  phase === AnimationPhase.DESELECTING ||
                  phase === AnimationPhase.SELECTING_FRAMEWORK ||
                  phase === AnimationPhase.SELECTING_SERVICE ||
                  phase === AnimationPhase.SELECTING_SERVER ||
                  phase === AnimationPhase.HOLDING ||
                  selectedFramework === null ||
                  selectedServer === null
                    ? 0.3
                    : phase === AnimationPhase.SHOWING_CHAT ||
                      phase === AnimationPhase.PULSING_CONNECTIONS ||
                      phase === AnimationPhase.STREAMING_RESPONSE
                    ? 1.0
                    : 0.3
                }
                className={
                  getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />

              {/* Provider layer */}
              <g
                transform={`translate(${serviceOffset}, 0)`}
                className="transition-transform duration-500 ease-out"
              >
                <AILibraryHeroServiceCard
                  x={SERVICE_LOCATIONS[0]}
                  y={SERVICE_Y_OFFSET}
                  width={SERVICE_WIDTH}
                  height={SERVICE_HEIGHT}
                  label="Ollama"
                  opacity={getServiceOpacity(0)}
                  textColor={textColor}
                  strokeColor={strokeColor}
                  fontSize={BOX_FONT_SIZE}
                  fontWeight={BOX_FONT_WEIGHT}
                  logoLight={ollamaLightLogo}
                  logoDark={ollamaDarkLogo}
                  transform={getScaleTransform(
                    0,
                    selectedService,
                    SERVICE_LOCATIONS[0] + SERVICE_WIDTH / 2,
                    SERVICE_Y_CENTER,
                  )}
                />

                <AILibraryHeroServiceCard
                  x={SERVICE_LOCATIONS[1]}
                  y={SERVICE_Y_OFFSET}
                  width={SERVICE_WIDTH}
                  height={SERVICE_HEIGHT}
                  label="OpenAI"
                  opacity={getServiceOpacity(1)}
                  textColor={textColor}
                  strokeColor={strokeColor}
                  fontSize={BOX_FONT_SIZE}
                  fontWeight={BOX_FONT_WEIGHT}
                  logoLight={openaiLightLogo}
                  logoDark={openaiDarkLogo}
                  transform={getScaleTransform(
                    1,
                    selectedService,
                    SERVICE_LOCATIONS[1] + SERVICE_WIDTH / 2,
                    SERVICE_Y_CENTER,
                  )}
                />

                <AILibraryHeroServiceCard
                  x={SERVICE_LOCATIONS[2]}
                  y={SERVICE_Y_OFFSET}
                  width={SERVICE_WIDTH}
                  height={SERVICE_HEIGHT}
                  label="Anthropic"
                  opacity={getServiceOpacity(2)}
                  textColor={textColor}
                  strokeColor={strokeColor}
                  fontSize={BOX_FONT_SIZE}
                  fontWeight={BOX_FONT_WEIGHT}
                  logoLight={anthropicLightLogo}
                  logoDark={anthropicDarkLogo}
                  transform={getScaleTransform(
                    2,
                    selectedService,
                    SERVICE_LOCATIONS[2] + SERVICE_WIDTH / 2,
                    SERVICE_Y_CENTER,
                  )}
                />

                <AILibraryHeroServiceCard
                  x={SERVICE_LOCATIONS[3]}
                  y={SERVICE_Y_OFFSET}
                  width={SERVICE_WIDTH}
                  height={SERVICE_HEIGHT}
                  label="Gemini"
                  opacity={getServiceOpacity(3)}
                  textColor={textColor}
                  strokeColor={strokeColor}
                  fontSize={BOX_FONT_SIZE}
                  fontWeight={BOX_FONT_WEIGHT}
                  logo={geminiLogo}
                  transform={getScaleTransform(
                    3,
                    selectedService,
                    SERVICE_LOCATIONS[3] + SERVICE_WIDTH / 2,
                    SERVICE_Y_CENTER,
                  )}
                />
              </g>

              {/* Server layer */}
              <AILibraryHeroCard
                x={SERVER_CARD_LOCATIONS[0]}
                y={SERVER_CARD_Y_OFFSET}
                width={SERVER_CARD_WIDTH}
                height={SERVER_CARD_HEIGHT}
                label="TypeScript"
                opacity={getOpacity(0, selectedServer, rotatingServer)}
                textColor={textColor}
                strokeColor={strokeColor}
                fontSize={16}
                fontWeight={BOX_FONT_WEIGHT}
                logo={tsLogo}
                transform={getScaleTransform(
                  0,
                  selectedServer,
                  SERVER_CARD_LOCATIONS[0] + SERVER_CARD_WIDTH / 2,
                  SERVER_CARD_Y_OFFSET + SERVER_CARD_HEIGHT / 2,
                )}
              />

              <AILibraryHeroCard
                x={SERVER_CARD_LOCATIONS[1]}
                y={SERVER_CARD_Y_OFFSET}
                width={SERVER_CARD_WIDTH}
                height={SERVER_CARD_HEIGHT}
                label="PHP"
                opacity={getOpacity(1, selectedServer, rotatingServer)}
                textColor={textColor}
                strokeColor={strokeColor}
                fontSize={BOX_FONT_SIZE}
                fontWeight={BOX_FONT_WEIGHT}
                logoLight={phpLightLogo}
                logoDark={phpDarkLogo}
                transform={getScaleTransform(
                  1,
                  selectedServer,
                  SERVER_CARD_LOCATIONS[1] + SERVER_CARD_WIDTH / 2,
                  SERVER_CARD_Y_OFFSET + SERVER_CARD_HEIGHT / 2,
                )}
              />

              <AILibraryHeroCard
                x={SERVER_CARD_LOCATIONS[2]}
                y={SERVER_CARD_Y_OFFSET}
                width={SERVER_CARD_WIDTH}
                height={SERVER_CARD_HEIGHT}
                label="Python"
                opacity={getOpacity(2, selectedServer, rotatingServer)}
                textColor={textColor}
                strokeColor={strokeColor}
                fontSize={BOX_FONT_SIZE}
                fontWeight={BOX_FONT_WEIGHT}
                logo={pythonLogo}
                transform={getScaleTransform(
                  2,
                  selectedServer,
                  SERVER_CARD_LOCATIONS[2] + SERVER_CARD_WIDTH / 2,
                  SERVER_CARD_Y_OFFSET + SERVER_CARD_HEIGHT / 2,
                )}
              />

              <AILibraryHeroCard
                x={SERVER_CARD_LOCATIONS[3]}
                y={SERVER_CARD_Y_OFFSET}
                width={SERVER_CARD_WIDTH}
                height={SERVER_CARD_HEIGHT}
                label="?"
                opacity={getOpacity(3, selectedServer, rotatingServer)}
                textColor={textColor}
                strokeColor={strokeColor}
                fontSize={BOX_FONT_SIZE}
                fontWeight={BOX_FONT_WEIGHT}
                isDashed={true}
                transform={getScaleTransform(
                  3,
                  selectedServer,
                  SERVER_CARD_LOCATIONS[3] + SERVER_CARD_WIDTH / 2,
                  SERVER_CARD_Y_OFFSET + SERVER_CARD_HEIGHT / 2,
                )}
              />
            </svg>
          </div>

          {/* Chat Panel */}
          <div className="w-full md:w-[400px] flex-shrink-0 h-full">
            <ChatPanel
              messages={messages}
              typingUserMessage={typingUserMessage}
            />
          </div>
        </div>
      </div>
    </>
  )
}
