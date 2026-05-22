import * as React from 'react'
import { LinkProps } from '@tanstack/react-router'
import type { Library } from '~/libraries'
import { ChatPanel } from './ChatPanel'
import { AnimationPhase } from '~/stores/aiLibraryHeroAnimation'
import { useAILibraryHeroAnimation } from '~/hooks/useAILibraryHeroAnimation'
import { AILibraryHeroCard } from './AILibraryHeroCard'
import { AILibraryHeroBox } from './AILibraryHeroBox'
import { AILibraryHeroServiceCard } from './AILibraryHeroServiceCard'
import jsLogo from '~/images/js-logo.svg'
import tsLogo from '~/images/ts-logo.svg'
import reactLogo from '~/images/react-logo.svg'
import vueLogo from '~/images/vue-logo.svg'
import solidLogo from '~/images/solid-logo.svg'
import svelteLogo from '~/images/svelte-logo.svg'
import preactLogo from '~/images/preact-logo.svg'
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
import openrouterBlackLogo from '~/images/openrouter-black.svg'
import openrouterWhiteLogo from '~/images/openrouter-white.svg'
import agUiLightLogo from '~/images/ag-ui-light.svg'
import agUiDarkLogo from '~/images/ag-ui-dark.svg'
import xaiLightLogo from '~/images/xai-light.svg'
import xaiDarkLogo from '~/images/xai-dark.svg'
import falAiLightLogo from '~/images/fal-ai-light.svg'
import falAiDarkLogo from '~/images/fal-ai-dark.svg'
import elevenLabsLightLogo from '~/images/elevenlabs-light.svg'
import elevenLabsDarkLogo from '~/images/elevenlabs-dark.svg'
import groqLightLogo from '~/images/groq-light.svg'
import groqDarkLogo from '~/images/groq-dark.svg'

import {
  SVG_WIDTH,
  SVG_HEIGHT,
  BOX_FONT_SIZE,
  BOX_FONT_WEIGHT,
  SERVICE_WIDTH,
  SERVICE_LOCATIONS,
  SERVICE_Y_OFFSET,
  SERVICE_Y_CENTER,
  SERVICE_HEIGHT,
  LIBRARY_CARD_WIDTH,
  LIBRARY_CARD_HEIGHT,
  LIBRARY_CARD_Y_OFFSET,
  LIBRARY_CARD_LOCATIONS,
  SERVER_CARD_Y_OFFSET,
  SERVER_CARD_LOCATIONS,
  SERVER_CARD_WIDTH,
  SERVER_CARD_HEIGHT,
} from '~/stores/aiLibraryHeroAnimation'

type AILibraryHeroProps = {
  project: Library
  cta?: {
    linkProps: LinkProps
    label: string
    className?: string
  }
  actions?: React.ReactNode
}

type HeroCardDefinition = {
  label: string
  logo?: string
  logoLight?: string
  logoDark?: string
  fontSize?: number
  logoSize?: number
}

const HIGHLIGHT_COLOR = 'var(--hero-active-stroke)'
const TANSTACK_LOGO = '/images/logos/logo-color-100.png'

const CLIENT_FRAMEWORKS: Array<HeroCardDefinition> = [
  { label: 'Vanilla', logo: jsLogo, fontSize: 13, logoSize: 16 },
  { label: 'React', logo: reactLogo, fontSize: 13, logoSize: 16 },
  { label: 'Vue', logo: vueLogo, fontSize: 13, logoSize: 16 },
  { label: 'Solid', logo: solidLogo, fontSize: 13, logoSize: 16 },
  { label: 'Svelte', logo: svelteLogo, fontSize: 13, logoSize: 16 },
  { label: 'Preact', logo: preactLogo, fontSize: 13, logoSize: 16 },
]

const SERVER_LANGUAGES: Array<HeroCardDefinition> = [
  { label: 'TypeScript', logo: tsLogo, fontSize: 15 },
  { label: 'Python', logo: pythonLogo },
  { label: 'PHP', logoLight: phpLightLogo, logoDark: phpDarkLogo },
]

const AI_PROVIDERS: Array<HeroCardDefinition> = [
  {
    label: 'OpenRouter',
    logoLight: openrouterBlackLogo,
    logoDark: openrouterWhiteLogo,
    fontSize: 15,
  },
  {
    label: 'OpenAI',
    logoLight: openaiLightLogo,
    logoDark: openaiDarkLogo,
    fontSize: 15,
  },
  {
    label: 'Anthropic',
    logoLight: anthropicLightLogo,
    logoDark: anthropicDarkLogo,
    fontSize: 15,
  },
  { label: 'Gemini', logo: geminiLogo, fontSize: 15 },
  {
    label: 'Ollama',
    logoLight: ollamaLightLogo,
    logoDark: ollamaDarkLogo,
    fontSize: 15,
  },
  {
    label: 'Groq',
    logoLight: groqLightLogo,
    logoDark: groqDarkLogo,
    fontSize: 15,
  },
  {
    label: 'Grok/xAI',
    logoLight: xaiLightLogo,
    logoDark: xaiDarkLogo,
    fontSize: 15,
  },
  {
    label: 'ElevenLabs',
    logoLight: elevenLabsLightLogo,
    logoDark: elevenLabsDarkLogo,
    fontSize: 15,
  },
  {
    label: 'fal.ai',
    logoLight: falAiLightLogo,
    logoDark: falAiDarkLogo,
    fontSize: 15,
  },
]

const CLIENT_BOX = { x: 156, y: 134, width: 320, height: 56 }
const AG_UI_BOX = { x: 226, y: 240, width: 180, height: 48 }
const TANSTACK_AI_BOX = { x: 156, y: 344, width: 320, height: 56 }

export function AILibraryHero(_props: AILibraryHeroProps) {
  const strokeColor = 'var(--hero-stroke)'
  const textColor = 'var(--hero-text)'
  const glassGradientStart = 'var(--hero-glass-start)'
  const glassGradientEnd = 'var(--hero-glass-end)'
  const { store } = useAILibraryHeroAnimation()

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
  } = store

  const isHighlighting =
    phase === AnimationPhase.SHOWING_CHAT ||
    phase === AnimationPhase.PULSING_CONNECTIONS ||
    phase === AnimationPhase.STREAMING_RESPONSE

  const hasActivePath =
    isHighlighting &&
    selectedFramework !== null &&
    selectedServer !== null &&
    selectedService !== null

  const clientCenterX = CLIENT_BOX.x + CLIENT_BOX.width / 2
  const serverBoxCenterX = TANSTACK_AI_BOX.x + TANSTACK_AI_BOX.width / 2

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

  const getConnectionPulse = () => {
    if (
      phase === AnimationPhase.PULSING_CONNECTIONS ||
      phase === AnimationPhase.STREAMING_RESPONSE
    ) {
      return connectionPulseDirection === 'down' ? 'down' : 'up'
    }
    return null
  }

  const getPathOpacity = (isActive: boolean) => {
    if (!hasActivePath) {
      return 0.42
    }
    return isActive ? 1 : 0.22
  }

  const getPathStrokeColor = (isActive: boolean) => {
    if (hasActivePath && isActive) {
      return HIGHLIGHT_COLOR
    }
    return strokeColor
  }

  const getPulseClass = (isActive: boolean) => {
    const pulse = getConnectionPulse()

    if (!pulse || !hasActivePath || !isActive) {
      return ''
    }

    return pulse === 'down' ? 'animate-pulse-down' : 'animate-pulse-up'
  }

  const getProviderOpacity = (index: number) => {
    return getServiceOpacity(index)
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
            :root {
              --hero-stroke: rgba(24, 24, 27, 0.36);
              --hero-active-stroke: rgba(236, 72, 153, 0.95);
              --hero-text: #18181b;
              --hero-glass-start: rgba(255, 255, 255, 0.98);
              --hero-glass-end: rgba(253, 242, 248, 0.9);
            }
            :root.dark {
              --hero-stroke: rgba(255, 255, 255, 0.32);
              --hero-active-stroke: rgba(255, 255, 255, 0.95);
              --hero-text: #ffffff;
              --hero-glass-start: rgba(24, 24, 27, 0.92);
              --hero-glass-end: rgba(39, 39, 42, 0.78);
            }
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
      <div className="relative flex flex-col items-center gap-8 text-center px-4 overflow-hidden">
        <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center lg:items-stretch gap-8 lg:gap-12">
          <div
            className="relative w-full lg:flex-1 overflow-hidden"
            style={{ height: SVG_HEIGHT }}
          >
            <svg
              key={`${phase}-${selectedFramework}-${selectedServer}-${selectedService}`}
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              style={{ overflow: 'hidden' }}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
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

                <filter
                  id="lineGlow"
                  x="-32"
                  y="-32"
                  width={SVG_WIDTH + 64}
                  height={SVG_HEIGHT + 64}
                  filterUnits="userSpaceOnUse"
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

                <linearGradient
                  id="glassGradient"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    style={{ stopColor: glassGradientStart }}
                    stopOpacity="1"
                  />
                  <stop
                    offset="100%"
                    style={{ stopColor: glassGradientEnd }}
                    stopOpacity="1"
                  />
                </linearGradient>

                <linearGradient
                  id="glassGradientLarge"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    style={{ stopColor: glassGradientStart }}
                    stopOpacity="1"
                  />
                  <stop
                    offset="100%"
                    style={{ stopColor: glassGradientEnd }}
                    stopOpacity="1"
                  />
                </linearGradient>

                <clipPath id="providerClip">
                  <rect
                    x="0"
                    y={SERVICE_Y_OFFSET - 16}
                    width={SVG_WIDTH}
                    height={SERVICE_HEIGHT + 32}
                  />
                </clipPath>
              </defs>

              {CLIENT_FRAMEWORKS.map((framework, index) => {
                const startX =
                  LIBRARY_CARD_LOCATIONS[index] + LIBRARY_CARD_WIDTH / 2
                const isActive = selectedFramework === index

                return (
                  <path
                    key={`framework-line-${framework.label}`}
                    d={`M ${startX} ${LIBRARY_CARD_Y_OFFSET + LIBRARY_CARD_HEIGHT} Q ${startX} 96 ${clientCenterX} ${CLIENT_BOX.y}`}
                    fill="none"
                    stroke={getPathStrokeColor(isActive)}
                    strokeWidth="1.5"
                    strokeMiterlimit="10"
                    filter="url(#lineGlow)"
                    opacity={getPathOpacity(isActive)}
                    className={getPulseClass(isActive)}
                  />
                )
              })}

              <path
                id="client-to-ag-ui-line"
                d={`M ${clientCenterX} ${CLIENT_BOX.y + CLIENT_BOX.height} L ${clientCenterX} ${AG_UI_BOX.y}`}
                fill="none"
                stroke={getPathStrokeColor(true)}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getPathOpacity(true)}
                className={getPulseClass(true)}
              />

              <path
                id="ag-ui-to-tanstack-ai-line"
                d={`M ${serverBoxCenterX} ${AG_UI_BOX.y + AG_UI_BOX.height} L ${serverBoxCenterX} ${TANSTACK_AI_BOX.y}`}
                fill="none"
                stroke={getPathStrokeColor(true)}
                strokeWidth="1.5"
                strokeMiterlimit="10"
                filter="url(#lineGlow)"
                opacity={getPathOpacity(true)}
                className={getPulseClass(true)}
              />

              {SERVER_LANGUAGES.map((server, index) => {
                const endX =
                  SERVER_CARD_LOCATIONS[index] + SERVER_CARD_WIDTH / 2
                const isActive = selectedServer === index

                return (
                  <path
                    key={`server-line-${server.label}`}
                    d={`M ${serverBoxCenterX} ${TANSTACK_AI_BOX.y + TANSTACK_AI_BOX.height} Q ${serverBoxCenterX} 456 ${endX} ${SERVER_CARD_Y_OFFSET}`}
                    fill="none"
                    stroke={getPathStrokeColor(isActive)}
                    strokeWidth="1.5"
                    strokeMiterlimit="10"
                    filter="url(#lineGlow)"
                    opacity={getPathOpacity(isActive)}
                    className={getPulseClass(isActive)}
                  />
                )
              })}

              {SERVER_LANGUAGES.map((server, index) => {
                const startX =
                  SERVER_CARD_LOCATIONS[index] + SERVER_CARD_WIDTH / 2
                const isActive = selectedServer === index

                return (
                  <path
                    key={`provider-line-${server.label}`}
                    d={`M ${startX} ${SERVER_CARD_Y_OFFSET + SERVER_CARD_HEIGHT} Q ${startX} 618 ${SVG_WIDTH / 2} ${SERVICE_Y_OFFSET}`}
                    fill="none"
                    stroke={getPathStrokeColor(isActive)}
                    strokeWidth="1.5"
                    strokeMiterlimit="10"
                    filter="url(#lineGlow)"
                    opacity={getPathOpacity(isActive)}
                    className={getPulseClass(isActive)}
                  />
                )
              })}

              {CLIENT_FRAMEWORKS.map((framework, index) => (
                <AILibraryHeroCard
                  key={framework.label}
                  x={LIBRARY_CARD_LOCATIONS[index]}
                  y={LIBRARY_CARD_Y_OFFSET}
                  width={LIBRARY_CARD_WIDTH}
                  height={LIBRARY_CARD_HEIGHT}
                  label={framework.label}
                  opacity={getOpacity(
                    index,
                    selectedFramework,
                    rotatingFramework,
                  )}
                  textColor={textColor}
                  strokeColor={strokeColor}
                  fontSize={framework.fontSize ?? 14}
                  fontWeight={BOX_FONT_WEIGHT}
                  logo={framework.logo}
                  logoLight={framework.logoLight}
                  logoDark={framework.logoDark}
                  logoSize={framework.logoSize ?? 18}
                  transform={getScaleTransform(
                    index,
                    selectedFramework,
                    LIBRARY_CARD_LOCATIONS[index] + LIBRARY_CARD_WIDTH / 2,
                    LIBRARY_CARD_Y_OFFSET + LIBRARY_CARD_HEIGHT / 2,
                  )}
                />
              ))}

              <AILibraryHeroBox
                x={CLIENT_BOX.x}
                y={CLIENT_BOX.y}
                width={CLIENT_BOX.width}
                height={CLIENT_BOX.height}
                label="@tanstack/ai-client"
                textColor={textColor}
                strokeColor={strokeColor}
                fontSize={23}
                fontWeight={900}
                opacity={0.9}
                logo={TANSTACK_LOGO}
                logoSize={30}
              />

              <AILibraryHeroBox
                x={AG_UI_BOX.x}
                y={AG_UI_BOX.y}
                width={AG_UI_BOX.width}
                height={AG_UI_BOX.height}
                label="AG-UI"
                textColor={textColor}
                strokeColor={strokeColor}
                fontSize={24}
                fontWeight={900}
                opacity={0.9}
                logoLight={agUiLightLogo}
                logoDark={agUiDarkLogo}
                logoSize={24}
              />

              <AILibraryHeroBox
                x={TANSTACK_AI_BOX.x}
                y={TANSTACK_AI_BOX.y}
                width={TANSTACK_AI_BOX.width}
                height={TANSTACK_AI_BOX.height}
                label="TanStack AI"
                textColor={textColor}
                strokeColor={strokeColor}
                fontSize={24}
                fontWeight={900}
                rx={16.5}
                opacity={0.85}
                logo={TANSTACK_LOGO}
                logoSize={30}
              />

              {SERVER_LANGUAGES.map((server, index) => (
                <AILibraryHeroCard
                  key={server.label}
                  x={SERVER_CARD_LOCATIONS[index]}
                  y={SERVER_CARD_Y_OFFSET}
                  width={SERVER_CARD_WIDTH}
                  height={SERVER_CARD_HEIGHT}
                  label={server.label}
                  opacity={getOpacity(index, selectedServer, rotatingServer)}
                  textColor={textColor}
                  strokeColor={strokeColor}
                  fontSize={server.fontSize ?? BOX_FONT_SIZE}
                  fontWeight={BOX_FONT_WEIGHT}
                  logo={server.logo}
                  logoLight={server.logoLight}
                  logoDark={server.logoDark}
                  transform={getScaleTransform(
                    index,
                    selectedServer,
                    SERVER_CARD_LOCATIONS[index] + SERVER_CARD_WIDTH / 2,
                    SERVER_CARD_Y_OFFSET + SERVER_CARD_HEIGHT / 2,
                  )}
                />
              ))}

              <g clipPath="url(#providerClip)">
                <g
                  transform={`translate(${serviceOffset}, 0)`}
                  className="transition-transform duration-500 ease-out"
                >
                  {AI_PROVIDERS.map((provider, index) => (
                    <AILibraryHeroServiceCard
                      key={provider.label}
                      x={SERVICE_LOCATIONS[index]}
                      y={SERVICE_Y_OFFSET}
                      width={SERVICE_WIDTH}
                      height={SERVICE_HEIGHT}
                      label={provider.label}
                      opacity={getProviderOpacity(index)}
                      textColor={textColor}
                      strokeColor={strokeColor}
                      fontSize={provider.fontSize ?? 15}
                      fontWeight={BOX_FONT_WEIGHT}
                      logo={provider.logo}
                      logoLight={provider.logoLight}
                      logoDark={provider.logoDark}
                      transform={getScaleTransform(
                        index,
                        selectedService,
                        SERVICE_LOCATIONS[index] + SERVICE_WIDTH / 2,
                        SERVICE_Y_CENTER,
                      )}
                    />
                  ))}
                </g>
              </g>
            </svg>
          </div>

          <div
            className="w-full max-w-[400px] lg:w-[400px] flex-shrink-0"
            style={{ height: SVG_HEIGHT }}
          >
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
