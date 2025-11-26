import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { Link, LinkProps } from '@tanstack/react-router'
import type { Library } from '~/libraries'
import { useIsDark } from '~/hooks/useIsDark'

type AILibraryHeroProps = {
  project: Library
  cta?: {
    linkProps: LinkProps
    label: string
    className?: string
  }
  actions?: React.ReactNode
}

export function AILibraryHero({ project, cta, actions }: AILibraryHeroProps) {
  const [hoveredBox, setHoveredBox] = React.useState<string | null>(null)
  const isDark = useIsDark()
  const strokeColor = isDark ? '#ffffff' : '#000000'
  const fillColor = isDark ? '#121212' : '#ffffff'
  const textColor = isDark ? '#ffffff' : '#000000'

  return (
    <div className="relative flex flex-col items-center gap-8 text-center px-4 min-h-[600px] md:min-h-[800px] overflow-hidden">
      {/* Background dimmed text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <h1 className="font-black text-[120px] md:text-[180px] lg:text-[240px] xl:text-[300px] uppercase [letter-spacing:-.05em] leading-none opacity-10 dark:opacity-5 text-pink-500 dark:text-pink-400">
          TANSTACK
        </h1>
      </div>

      {/* SVG Diagram */}
      <div className="relative z-10 w-full max-w-6xl mx-auto mt-16">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto"
          viewBox="0 0 632 432"
        >
          {/* Lines from frameworks to ai-client */}
          <path
            d="M 60 60 Q 60 80 151.26 80 Q 242.52 80 242.5 100"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeMiterlimit="10"
          />
          <path
            d="M 220 60 Q 220 80 257.5 80 Q 295 80 295 100"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeMiterlimit="10"
          />
          <path
            d="M 380 60 Q 380 80 337.5 80 Q 295 80 295 100"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeMiterlimit="10"
          />
          <path
            d="M 540 60 Q 540 80 443.76 80 Q 347.52 80 347.5 100"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeMiterlimit="10"
          />

          {/* Line from ai-client to @tanstack/ai */}
          <path
            d="M 295 160 L 295 210"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeMiterlimit="10"
          />

          {/* Lines from @tanstack/ai to providers */}
          <path
            d="M 60 370 Q 60 350 151.26 350 Q 242.52 350 242.5 320"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeMiterlimit="10"
          />
          <path
            d="M 220 370 Q 220 345 257.5 345 Q 295 345 295 320"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeMiterlimit="10"
          />
          <path
            d="M 380 370 Q 380 345 337.5 345 Q 295 345 295 320"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeMiterlimit="10"
          />
          <path
            d="M 540 370 Q 540 350 443.76 350 Q 347.52 350 347.5 320"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeMiterlimit="10"
          />

          {/* Top layer: Frameworks */}
          <g
            transform={
              hoveredBox === 'vanilla'
                ? 'translate(60, 30) scale(1.05) translate(-60, -30)'
                : ''
            }
            onMouseEnter={() => setHoveredBox('vanilla')}
            onMouseLeave={() => setHoveredBox(null)}
            className="cursor-pointer transition-transform duration-300"
          >
            <rect
              x="0"
              y="0"
              width="120"
              height="60"
              rx="9"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="2"
            />
            <text
              x="60"
              y="34"
              fill={textColor}
              fontFamily="Helvetica"
              fontSize="12"
              textAnchor="middle"
            >
              Vanilla
            </text>
          </g>

          <g
            transform={
              hoveredBox === 'react'
                ? 'translate(220, 30) scale(1.05) translate(-220, -30)'
                : ''
            }
            onMouseEnter={() => setHoveredBox('react')}
            onMouseLeave={() => setHoveredBox(null)}
            className="cursor-pointer transition-transform duration-300"
          >
            <rect
              x="160"
              y="0"
              width="120"
              height="60"
              rx="9"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="2"
            />
            <text
              x="220"
              y="34"
              fill={textColor}
              fontFamily="Helvetica"
              fontSize="12"
              textAnchor="middle"
            >
              React
            </text>
          </g>

          <rect
            x="320"
            y="0"
            width="120"
            height="60"
            rx="9"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="2"
            onMouseEnter={() => setHoveredBox('solid')}
            onMouseLeave={() => setHoveredBox(null)}
            className="cursor-pointer transition-all"
            style={{
              transform: hoveredBox === 'solid' ? 'scale(1.05)' : 'scale(1)',
              transformOrigin: '380px 30px',
            }}
          />
          <text
            x="380"
            y="34"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
          >
            Solid
          </text>

          <rect
            x="480"
            y="0"
            width="120"
            height="60"
            rx="9"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="2"
            strokeDasharray="8 8"
            onMouseEnter={() => setHoveredBox('future')}
            onMouseLeave={() => setHoveredBox(null)}
            className="cursor-pointer transition-all"
            style={{
              transform: hoveredBox === 'future' ? 'scale(1.05)' : 'scale(1)',
              transformOrigin: '540px 30px',
            }}
          />
          <text
            x="540"
            y="34"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
          >
            ?
          </text>

          {/* @tanstack/ai-client box */}
          <rect
            x="190"
            y="100"
            width="210"
            height="60"
            rx="9"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="5"
            onMouseEnter={() => setHoveredBox('ai-client')}
            onMouseLeave={() => setHoveredBox(null)}
            className="cursor-pointer transition-all"
            style={{
              transform:
                hoveredBox === 'ai-client' ? 'scale(1.05)' : 'scale(1)',
              transformOrigin: '295px 130px',
            }}
          />
          <text
            x="295"
            y="135"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="16"
            fontWeight="bold"
            textAnchor="middle"
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
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="5"
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
          >
            @tanstack/ai
          </text>

          {/* Provider layer */}
          <rect
            x="110"
            y="260"
            width="120"
            height="40"
            rx="6"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="2"
            onMouseEnter={() => setHoveredBox('ollama')}
            onMouseLeave={() => setHoveredBox(null)}
            className="cursor-pointer transition-all"
            style={{
              transform: hoveredBox === 'ollama' ? 'scale(1.05)' : 'scale(1)',
              transformOrigin: '170px 280px',
            }}
          />
          <text
            x="170"
            y="284"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
          >
            Ollama
          </text>

          <rect
            x="240"
            y="260"
            width="120"
            height="40"
            rx="6"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="2"
            onMouseEnter={() => setHoveredBox('openai')}
            onMouseLeave={() => setHoveredBox(null)}
            className="cursor-pointer transition-all"
            style={{
              transform: hoveredBox === 'openai' ? 'scale(1.05)' : 'scale(1)',
              transformOrigin: '300px 280px',
            }}
          />
          <text
            x="300"
            y="284"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
          >
            OpenAI
          </text>

          <rect
            x="375"
            y="260"
            width="120"
            height="40"
            rx="6"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="2"
            onMouseEnter={() => setHoveredBox('anthropic')}
            onMouseLeave={() => setHoveredBox(null)}
            className="cursor-pointer transition-all"
            style={{
              transform:
                hoveredBox === 'anthropic' ? 'scale(1.05)' : 'scale(1)',
              transformOrigin: '435px 280px',
            }}
          />
          <text
            x="435"
            y="284"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
          >
            Anthropic
          </text>

          <rect
            x="510"
            y="260"
            width="120"
            height="40"
            rx="6"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="2"
            onMouseEnter={() => setHoveredBox('gemini')}
            onMouseLeave={() => setHoveredBox(null)}
            className="cursor-pointer transition-all"
            style={{
              transform: hoveredBox === 'gemini' ? 'scale(1.05)' : 'scale(1)',
              transformOrigin: '570px 280px',
            }}
          />
          <text
            x="570"
            y="284"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
          >
            Gemini
          </text>

          {/* Server layer */}
          <rect
            x="0"
            y="370"
            width="120"
            height="60"
            rx="9"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="2"
            onMouseEnter={() => setHoveredBox('typescript')}
            onMouseLeave={() => setHoveredBox(null)}
            className="cursor-pointer transition-all"
            style={{
              transform:
                hoveredBox === 'typescript' ? 'scale(1.05)' : 'scale(1)',
              transformOrigin: '60px 400px',
            }}
          />
          <text
            x="60"
            y="404"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
          >
            TypeScript
          </text>

          <rect
            x="160"
            y="370"
            width="120"
            height="60"
            rx="9"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="2"
            onMouseEnter={() => setHoveredBox('php')}
            onMouseLeave={() => setHoveredBox(null)}
            className="cursor-pointer transition-all"
            style={{
              transform: hoveredBox === 'php' ? 'scale(1.05)' : 'scale(1)',
              transformOrigin: '220px 400px',
            }}
          />
          <text
            x="220"
            y="404"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
          >
            PHP
          </text>

          <rect
            x="320"
            y="370"
            width="120"
            height="60"
            rx="9"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="2"
            onMouseEnter={() => setHoveredBox('python')}
            onMouseLeave={() => setHoveredBox(null)}
            className="cursor-pointer transition-all"
            style={{
              transform: hoveredBox === 'python' ? 'scale(1.05)' : 'scale(1)',
              transformOrigin: '380px 400px',
            }}
          />
          <text
            x="380"
            y="404"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
          >
            Python
          </text>

          <rect
            x="480"
            y="370"
            width="120"
            height="60"
            rx="9"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="2"
            strokeDasharray="8 8"
            onMouseEnter={() => setHoveredBox('future-server')}
            onMouseLeave={() => setHoveredBox(null)}
            className="cursor-pointer transition-all"
            style={{
              transform:
                hoveredBox === 'future-server' ? 'scale(1.05)' : 'scale(1)',
              transformOrigin: '540px 400px',
            }}
          />
          <text
            x="540"
            y="404"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
          >
            ?
          </text>
        </svg>
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
  )
}
