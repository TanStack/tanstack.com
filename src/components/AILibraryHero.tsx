import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { Link, LinkProps } from '@tanstack/react-router'
import type { Library } from '~/libraries'
import { useIsDark } from '~/hooks/useIsDark'
import { ChatPanel } from './ChatPanel'

type AILibraryHeroProps = {
  project: Library
  cta?: {
    linkProps: LinkProps
    label: string
    className?: string
  }
  actions?: React.ReactNode
}

enum AnimationPhase {
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

const FRAMEWORKS = ['vanilla', 'react', 'solid', '?'] as const
const SERVICES = ['ollama', 'openai', 'anthropic', 'gemini'] as const
const SERVERS = ['typescript', 'php', 'python', '?'] as const

const USER_MESSAGES = [
  'Hello!',
  'How does this work?',
  'Show me an example',
  'What can you do?',
  'Tell me more',
]

const ASSISTANT_MESSAGES = [
  'I can help you integrate AI into your application using TanStack AI. The selected framework connects to the client, which communicates with the service, and finally reaches your server.',
  'TanStack AI provides a unified interface across multiple AI providers. You can switch between providers at runtime without code changes.',
  'The architecture is framework-agnostic, working with React, Solid, or vanilla JavaScript. Choose your preferred stack and start building!',
  'With TanStack AI, you get type-safe AI interactions, automatic tool execution, and zero vendor lock-in. Perfect for modern applications.',
]

export function AILibraryHero({ project, cta, actions }: AILibraryHeroProps) {
  const isDark = useIsDark()
  const strokeColor = isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.6)'
  const textColor = isDark ? '#ffffff' : '#000000'

  const [phase, setPhase] = React.useState<AnimationPhase>(
    AnimationPhase.STARTING
  )
  const [selectedFramework, setSelectedFramework] = React.useState<number>(1) // React
  const [selectedService, setSelectedService] = React.useState<number>(1) // OpenAI
  const [selectedServer, setSelectedServer] = React.useState<number>(0) // TypeScript
  const [rotatingFramework, setRotatingFramework] = React.useState<
    number | null
  >(null)
  const [rotatingServer, setRotatingServer] = React.useState<number | null>(
    null
  )
  const [rotatingService, setRotatingService] = React.useState<number | null>(
    null
  )
  const [serviceOffset, setServiceOffset] = React.useState(0)
  const [userMessage, setUserMessage] = React.useState<string | null>(null)
  const [assistantMessage, setAssistantMessage] = React.useState<string | null>(
    null
  )
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [connectionPulseDirection, setConnectionPulseDirection] =
    React.useState<'down' | 'up'>('down')

  const timeoutRefs = React.useRef<NodeJS.Timeout[]>([])

  React.useEffect(() => {
    const clearTimeouts = () => {
      timeoutRefs.current.forEach(clearTimeout)
      timeoutRefs.current = []
    }

    const addTimeout = (fn: () => void, delay: number) => {
      const timeout = setTimeout(fn, delay)
      timeoutRefs.current.push(timeout)
      return timeout
    }

    const getRandomIndex = (length: number, exclude?: number) => {
      let index
      do {
        index = Math.floor(Math.random() * length)
      } while (exclude !== undefined && index === exclude)
      return index
    }

    const startAnimationSequence = () => {
      // Phase 1: STARTING (initial state)
      setPhase(AnimationPhase.STARTING)
      addTimeout(() => {
        // Phase 2: DESELECTING
        setPhase(AnimationPhase.DESELECTING)
        addTimeout(() => {
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
              addTimeout(() => rotateFramework(iteration + 1), delay)
            } else {
              // Final iteration - ensure we land on target
              setRotatingFramework(targetFramework)
              addTimeout(() => {
                setSelectedFramework(targetFramework)
                setRotatingFramework(null)
                addTimeout(() => {
                  // Phase 4: SELECTING_SERVICE
                  setPhase(AnimationPhase.SELECTING_SERVICE)
                  const targetService = getRandomIndex(SERVICES.length)
                  let currentServiceIndex = Math.floor(
                    Math.random() * SERVICES.length
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
                      addTimeout(() => rotateService(iteration + 1), delay)
                    } else {
                      // Final iteration - ensure we land on target
                      setRotatingService(targetService)
                      addTimeout(() => {
                        setSelectedService(targetService)
                        setRotatingService(null)
                        // Calculate offset to center the selected service
                        const centerX = 300 // Center position in SVG
                        const servicePositions = [170, 300, 435, 570] // x positions of services
                        const targetX = servicePositions[targetService]
                        setServiceOffset(centerX - targetX)

                        addTimeout(() => {
                          // Phase 5: SELECTING_SERVER
                          setPhase(AnimationPhase.SELECTING_SERVER)
                          const targetServer = getRandomIndex(SERVERS.length)
                          let currentServerIndex = Math.floor(
                            Math.random() * SERVERS.length
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
                              addTimeout(
                                () => rotateServer(iteration + 1),
                                delay
                              )
                            } else {
                              // Final iteration - ensure we land on target
                              setRotatingServer(targetServer)
                              addTimeout(() => {
                                setSelectedServer(targetServer)
                                setRotatingServer(null)
                                addTimeout(() => {
                                  // Phase 6: SHOWING_CHAT
                                  setPhase(AnimationPhase.SHOWING_CHAT)
                                  const randomUserMessage =
                                    USER_MESSAGES[
                                      Math.floor(
                                        Math.random() * USER_MESSAGES.length
                                      )
                                    ]
                                  setUserMessage(randomUserMessage)
                                  addTimeout(() => {
                                    // Phase 7: PULSING_CONNECTIONS
                                    setPhase(AnimationPhase.PULSING_CONNECTIONS)
                                    setConnectionPulseDirection('down')
                                    addTimeout(() => {
                                      // Phase 8: STREAMING_RESPONSE
                                      setPhase(
                                        AnimationPhase.STREAMING_RESPONSE
                                      )
                                      setConnectionPulseDirection('up')
                                      const randomAssistantMessage =
                                        ASSISTANT_MESSAGES[
                                          Math.floor(
                                            Math.random() *
                                              ASSISTANT_MESSAGES.length
                                          )
                                        ]
                                      setIsStreaming(true)
                                      let charIndex = 0

                                      const streamChar = () => {
                                        if (
                                          charIndex <
                                          randomAssistantMessage.length
                                        ) {
                                          setAssistantMessage(
                                            randomAssistantMessage.slice(
                                              0,
                                              charIndex + 1
                                            )
                                          )
                                          charIndex++
                                          addTimeout(streamChar, 30)
                                        } else {
                                          setIsStreaming(false)
                                          addTimeout(() => {
                                            // Phase 9: HOLDING
                                            setPhase(AnimationPhase.HOLDING)
                                            addTimeout(() => {
                                              // Reset and loop
                                              setUserMessage(null)
                                              setAssistantMessage(null)
                                              setServiceOffset(0)
                                              setConnectionPulseDirection(
                                                'down'
                                              )
                                              startAnimationSequence()
                                            }, 5000)
                                          }, 500)
                                        }
                                      }
                                      streamChar()
                                    }, 2000)
                                  }, 500)
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
      }, 1000)
    }

    startAnimationSequence()

    return () => {
      clearTimeouts()
    }
  }, [])

  const getOpacity = (
    index: number,
    selectedIndex: number,
    rotatingIndex: number | null
  ) => {
    if (rotatingIndex !== null && rotatingIndex === index) {
      return 1.0
    }
    if (selectedIndex === index) {
      return 1.0
    }
    return phase === AnimationPhase.STARTING ? 0.9 : 0.3
  }

  const getServiceOpacity = (index: number) => {
    if (rotatingService !== null && rotatingService === index) {
      return 1.0
    }
    if (selectedService === index) {
      return 1.0
    }
    return phase === AnimationPhase.STARTING ? 0.9 : 0.3
  }

  const getConnectionOpacity = (
    frameworkIndex: number,
    serverIndex: number
  ) => {
    const isFrameworkSelected = selectedFramework === frameworkIndex
    const isServerSelected = selectedServer === serverIndex
    const isHighlighting =
      phase === AnimationPhase.SHOWING_CHAT ||
      phase === AnimationPhase.PULSING_CONNECTIONS ||
      phase === AnimationPhase.STREAMING_RESPONSE

    if (isHighlighting && isFrameworkSelected && isServerSelected) {
      return 1.0
    }
    if (isFrameworkSelected || isServerSelected) {
      return 0.85
    }
    return 0.7
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

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes pulse-down {
              0% {
                stroke-opacity: 0.7;
                filter: brightness(1);
              }
              50% {
                stroke-opacity: 1;
                filter: brightness(1.5);
              }
              100% {
                stroke-opacity: 0.7;
                filter: brightness(1);
              }
            }
            @keyframes pulse-up {
              0% {
                stroke-opacity: 0.7;
                filter: brightness(1);
              }
              50% {
                stroke-opacity: 1;
                filter: brightness(1.5);
              }
              100% {
                stroke-opacity: 0.7;
                filter: brightness(1);
              }
            }
            .animate-pulse-down {
              animation: pulse-down 0.8s ease-in-out infinite;
            }
            .animate-pulse-up {
              animation: pulse-up 0.8s ease-in-out infinite;
            }
          `,
        }}
      />
      <div className="relative flex flex-col items-center gap-8 text-center px-4 min-h-[600px] md:min-h-[800px] overflow-hidden">
        {/* Background dimmed text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <h1 className="font-black text-[120px] md:text-[180px] lg:text-[240px] xl:text-[300px] uppercase [letter-spacing:-.05em] leading-none opacity-10 dark:opacity-5 text-pink-500 dark:text-pink-400">
            TANSTACK
          </h1>
        </div>

        {/* Diagram and Chat Panel Container */}
        <div className="relative z-10 w-full max-w-7xl mx-auto mt-16 flex flex-col lg:flex-row items-start gap-8 lg:gap-12">
          {/* SVG Diagram */}
          <div className="relative w-full lg:flex-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-auto"
              viewBox="0 0 632 432"
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
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'rgba(255, 255, 255, 0.8)'
                    }
                    stopOpacity="1"
                  />
                  <stop
                    offset="100%"
                    stopColor={
                      isDark
                        ? 'rgba(255, 255, 255, 0.06)'
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
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(255, 255, 255, 0.75)'
                    }
                    stopOpacity="1"
                  />
                  <stop
                    offset="100%"
                    stopColor={
                      isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(255, 255, 255, 0.55)'
                    }
                    stopOpacity="1"
                  />
                </linearGradient>
              </defs>

              {/* Lines from frameworks to ai-client */}
              <path
                id="framework-line-0"
                d="M 60 60 Q 60 80 151.26 80 Q 242.52 80 242.5 100"
                fill="none"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getConnectionOpacity(0, selectedServer)}
                className={
                  selectedFramework === 0 && getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />
              <path
                id="framework-line-1"
                d="M 220 60 Q 220 80 257.5 80 Q 295 80 295 100"
                fill="none"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getConnectionOpacity(1, selectedServer)}
                className={
                  selectedFramework === 1 && getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />
              <path
                id="framework-line-2"
                d="M 380 60 Q 380 80 337.5 80 Q 295 80 295 100"
                fill="none"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getConnectionOpacity(2, selectedServer)}
                className={
                  selectedFramework === 2 && getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />
              <path
                id="framework-line-3"
                d="M 540 60 Q 540 80 443.76 80 Q 347.52 80 347.5 100"
                fill="none"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getConnectionOpacity(3, selectedServer)}
                className={
                  selectedFramework === 3 && getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />

              {/* Lines from @tanstack/ai to servers */}
              <path
                id="server-line-0"
                d="M 60 370 Q 60 350 151.26 350 Q 242.52 350 242.5 320"
                fill="none"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getConnectionOpacity(selectedFramework, 0)}
                className={
                  selectedServer === 0 && getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />
              <path
                id="server-line-1"
                d="M 220 370 Q 220 345 257.5 345 Q 295 345 295 320"
                fill="none"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getConnectionOpacity(selectedFramework, 1)}
                className={
                  selectedServer === 1 && getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />
              <path
                id="server-line-2"
                d="M 380 370 Q 380 345 337.5 345 Q 295 345 295 320"
                fill="none"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getConnectionOpacity(selectedFramework, 2)}
                className={
                  selectedServer === 2 && getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />
              <path
                id="server-line-3"
                d="M 540 370 Q 540 350 443.76 350 Q 347.52 350 347.5 320"
                fill="none"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getConnectionOpacity(selectedFramework, 3)}
                className={
                  selectedServer === 3 && getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />

              {/* Top layer: Frameworks */}
              <g className="transition-opacity duration-300">
                <rect
                  x="0"
                  y="0"
                  width="120"
                  height="60"
                  rx="9"
                  fill="url(#glassGradient)"
                  stroke={strokeColor}
                  strokeWidth="1.5"
                  filter="url(#glass)"
                  opacity={getOpacity(0, selectedFramework, rotatingFramework)}
                />
                <text
                  x="60"
                  y="34"
                  fill={textColor}
                  fontFamily="Helvetica"
                  fontSize="12"
                  textAnchor="middle"
                  opacity={getOpacity(0, selectedFramework, rotatingFramework)}
                >
                  Vanilla
                </text>
              </g>

              <g className="transition-opacity duration-300">
                <rect
                  x="160"
                  y="0"
                  width="120"
                  height="60"
                  rx="9"
                  fill="url(#glassGradient)"
                  stroke={strokeColor}
                  strokeWidth="1.5"
                  filter="url(#glass)"
                  opacity={getOpacity(1, selectedFramework, rotatingFramework)}
                />
                <text
                  x="220"
                  y="34"
                  fill={textColor}
                  fontFamily="Helvetica"
                  fontSize="12"
                  textAnchor="middle"
                  opacity={getOpacity(1, selectedFramework, rotatingFramework)}
                >
                  React
                </text>
              </g>

              <g className="transition-opacity duration-300">
                <rect
                  x="320"
                  y="0"
                  width="120"
                  height="60"
                  rx="9"
                  fill="url(#glassGradient)"
                  stroke={strokeColor}
                  strokeWidth="1.5"
                  filter="url(#glass)"
                  opacity={getOpacity(2, selectedFramework, rotatingFramework)}
                />
                <text
                  x="380"
                  y="34"
                  fill={textColor}
                  fontFamily="Helvetica"
                  fontSize="12"
                  textAnchor="middle"
                  opacity={getOpacity(2, selectedFramework, rotatingFramework)}
                >
                  Solid
                </text>
              </g>

              <g className="transition-opacity duration-300">
                <rect
                  x="480"
                  y="0"
                  width="120"
                  height="60"
                  rx="9"
                  fill="url(#glassGradient)"
                  stroke={strokeColor}
                  strokeWidth="1.5"
                  strokeDasharray="8 8"
                  filter="url(#glass)"
                  opacity={getOpacity(3, selectedFramework, rotatingFramework)}
                />
                <text
                  x="540"
                  y="34"
                  fill={textColor}
                  fontFamily="Helvetica"
                  fontSize="12"
                  textAnchor="middle"
                  opacity={getOpacity(3, selectedFramework, rotatingFramework)}
                >
                  ?
                </text>
              </g>

              {/* @tanstack/ai-client box */}
              <rect
                x="190"
                y="100"
                width="210"
                height="60"
                rx="9"
                fill="url(#glassGradientLarge)"
                stroke={strokeColor}
                strokeWidth="3"
                filter="url(#glass)"
                opacity="0.9"
              />
              <text
                x="295"
                y="135"
                fill={textColor}
                fontFamily="Helvetica"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                opacity="0.95"
              >
                @tanstack/ai-client
              </text>

              {/* Large @tanstack/ai container box */}
              <rect
                x="190"
                y="210"
                width="210"
                height="110"
                rx="16.5"
                fill="url(#glassGradientLarge)"
                stroke={strokeColor}
                strokeWidth="3"
                filter="url(#glass)"
                opacity="0.85"
              />

              {/* Line from ai-client to @tanstack/ai - drawn after boxes to be on top */}
              <path
                id="client-to-ai-line"
                d="M 295 160 L 295 210"
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.5"
                strokeMiterlimit="10"
                opacity={
                  phase === AnimationPhase.SHOWING_CHAT ||
                  phase === AnimationPhase.PULSING_CONNECTIONS ||
                  phase === AnimationPhase.STREAMING_RESPONSE
                    ? 1.0
                    : 0.9
                }
                className={
                  getConnectionPulse()
                    ? getConnectionPulse() === 'down'
                      ? 'animate-pulse-down'
                      : 'animate-pulse-up'
                    : ''
                }
              />

              {/* @tanstack/ai label */}
              <text
                x="295"
                y="240"
                fill={textColor}
                fontFamily="Helvetica"
                fontSize="17"
                fontWeight="bold"
                textAnchor="middle"
                opacity="0.95"
              >
                @tanstack/ai
              </text>

              {/* Provider layer */}
              <g
                transform={`translate(${serviceOffset}, 0)`}
                className="transition-transform duration-500 ease-out"
              >
                <g className="transition-opacity duration-300">
                  <rect
                    x="110"
                    y="260"
                    width="120"
                    height="40"
                    rx="6"
                    fill="url(#glassGradient)"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    filter="url(#glass)"
                    opacity={getServiceOpacity(0)}
                  />
                  <text
                    x="170"
                    y="284"
                    fill={textColor}
                    fontFamily="Helvetica"
                    fontSize="12"
                    textAnchor="middle"
                    opacity={getServiceOpacity(0)}
                  >
                    Ollama
                  </text>
                </g>

                <g className="transition-opacity duration-300">
                  <rect
                    x="240"
                    y="260"
                    width="120"
                    height="40"
                    rx="6"
                    fill="url(#glassGradient)"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    filter="url(#glass)"
                    opacity={getServiceOpacity(1)}
                  />
                  <text
                    x="300"
                    y="284"
                    fill={textColor}
                    fontFamily="Helvetica"
                    fontSize="12"
                    textAnchor="middle"
                    opacity={getServiceOpacity(1)}
                  >
                    OpenAI
                  </text>
                </g>

                <g className="transition-opacity duration-300">
                  <rect
                    x="375"
                    y="260"
                    width="120"
                    height="40"
                    rx="6"
                    fill="url(#glassGradient)"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    filter="url(#glass)"
                    opacity={getServiceOpacity(2)}
                  />
                  <text
                    x="435"
                    y="284"
                    fill={textColor}
                    fontFamily="Helvetica"
                    fontSize="12"
                    textAnchor="middle"
                    opacity={getServiceOpacity(2)}
                  >
                    Anthropic
                  </text>
                </g>

                <g className="transition-opacity duration-300">
                  <rect
                    x="510"
                    y="260"
                    width="120"
                    height="40"
                    rx="6"
                    fill="url(#glassGradient)"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    filter="url(#glass)"
                    opacity={getServiceOpacity(3)}
                  />
                  <text
                    x="570"
                    y="284"
                    fill={textColor}
                    fontFamily="Helvetica"
                    fontSize="12"
                    textAnchor="middle"
                    opacity={getServiceOpacity(3)}
                  >
                    Gemini
                  </text>
                </g>
              </g>

              {/* Server layer */}
              <g className="transition-opacity duration-300">
                <rect
                  x="0"
                  y="370"
                  width="120"
                  height="60"
                  rx="9"
                  fill="url(#glassGradient)"
                  stroke={strokeColor}
                  strokeWidth="1.5"
                  filter="url(#glass)"
                  opacity={getOpacity(0, selectedServer, rotatingServer)}
                />
                <text
                  x="60"
                  y="404"
                  fill={textColor}
                  fontFamily="Helvetica"
                  fontSize="12"
                  textAnchor="middle"
                  opacity={getOpacity(0, selectedServer, rotatingServer)}
                >
                  TypeScript
                </text>
              </g>

              <g className="transition-opacity duration-300">
                <rect
                  x="160"
                  y="370"
                  width="120"
                  height="60"
                  rx="9"
                  fill="url(#glassGradient)"
                  stroke={strokeColor}
                  strokeWidth="1.5"
                  filter="url(#glass)"
                  opacity={getOpacity(1, selectedServer, rotatingServer)}
                />
                <text
                  x="220"
                  y="404"
                  fill={textColor}
                  fontFamily="Helvetica"
                  fontSize="12"
                  textAnchor="middle"
                  opacity={getOpacity(1, selectedServer, rotatingServer)}
                >
                  PHP
                </text>
              </g>

              <g className="transition-opacity duration-300">
                <rect
                  x="320"
                  y="370"
                  width="120"
                  height="60"
                  rx="9"
                  fill="url(#glassGradient)"
                  stroke={strokeColor}
                  strokeWidth="1.5"
                  filter="url(#glass)"
                  opacity={getOpacity(2, selectedServer, rotatingServer)}
                />
                <text
                  x="380"
                  y="404"
                  fill={textColor}
                  fontFamily="Helvetica"
                  fontSize="12"
                  textAnchor="middle"
                  opacity={getOpacity(2, selectedServer, rotatingServer)}
                >
                  Python
                </text>
              </g>

              <g className="transition-opacity duration-300">
                <rect
                  x="480"
                  y="370"
                  width="120"
                  height="60"
                  rx="9"
                  fill="url(#glassGradient)"
                  stroke={strokeColor}
                  strokeWidth="1.5"
                  strokeDasharray="8 8"
                  filter="url(#glass)"
                  opacity={getOpacity(3, selectedServer, rotatingServer)}
                />
                <text
                  x="540"
                  y="404"
                  fill={textColor}
                  fontFamily="Helvetica"
                  fontSize="12"
                  textAnchor="middle"
                  opacity={getOpacity(3, selectedServer, rotatingServer)}
                >
                  ?
                </text>
              </g>
            </svg>
          </div>

          {/* Chat Panel */}
          <div className="w-full lg:w-auto lg:flex-shrink-0">
            <ChatPanel
              userMessage={userMessage}
              assistantMessage={assistantMessage}
              isStreaming={isStreaming}
            />
          </div>
        </div>

        {/* Content overlay */}
        <div className="relative z-10 flex flex-col items-center gap-6 mt-8">
          <h2 className="font-bold text-2xl md:text-4xl max-w-xl xl:max-w-4xl text-balance [letter-spacing:-0.03em]">
            {project.tagline}
          </h2>
          {project.description ? (
            <p className="text opacity-90 max-w-lg xl:max-w-2xl lg:text-base text-balance">
              {project.description}
            </p>
          ) : null}
          {actions ? (
            <div>{actions}</div>
          ) : cta ? (
            <Link
              {...cta.linkProps}
              className={twMerge(
                'inline-block py-2 px-4 rounded uppercase font-extrabold transition-colors',
                cta.className
              )}
            >
              {cta.label}
            </Link>
          ) : null}
        </div>
      </div>
    </>
  )
}
