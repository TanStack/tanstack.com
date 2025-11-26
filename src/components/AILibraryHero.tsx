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
  const isDark = useIsDark()
  const strokeColor = isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.6)'
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
              <feComposite in="SourceGraphic" in2="glassBlur" operator="over" />
            </filter>

            {/* Subtle glow for lines */}
            <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
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
            d="M 60 60 Q 60 80 151.26 80 Q 242.52 80 242.5 100"
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeMiterlimit="10"
            filter="url(#lineGlow)"
            opacity="0.7"
          />
          <path
            d="M 220 60 Q 220 80 257.5 80 Q 295 80 295 100"
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeMiterlimit="10"
            filter="url(#lineGlow)"
            opacity="0.7"
          />
          <path
            d="M 380 60 Q 380 80 337.5 80 Q 295 80 295 100"
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeMiterlimit="10"
            filter="url(#lineGlow)"
            opacity="0.7"
          />
          <path
            d="M 540 60 Q 540 80 443.76 80 Q 347.52 80 347.5 100"
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeMiterlimit="10"
            filter="url(#lineGlow)"
            opacity="0.7"
          />

          {/* Lines from @tanstack/ai to providers */}
          <path
            d="M 60 370 Q 60 350 151.26 350 Q 242.52 350 242.5 320"
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeMiterlimit="10"
            filter="url(#lineGlow)"
            opacity="0.7"
          />
          <path
            d="M 220 370 Q 220 345 257.5 345 Q 295 345 295 320"
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeMiterlimit="10"
            filter="url(#lineGlow)"
            opacity="0.7"
          />
          <path
            d="M 380 370 Q 380 345 337.5 345 Q 295 345 295 320"
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeMiterlimit="10"
            filter="url(#lineGlow)"
            opacity="0.7"
          />
          <path
            d="M 540 370 Q 540 350 443.76 350 Q 347.52 350 347.5 320"
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeMiterlimit="10"
            filter="url(#lineGlow)"
            opacity="0.7"
          />

          {/* Top layer: Frameworks */}
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
            opacity="0.9"
          />
          <text
            x="60"
            y="34"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
            opacity="0.95"
          >
            Vanilla
          </text>

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
            opacity="0.9"
          />
          <text
            x="220"
            y="34"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
            opacity="0.95"
          >
            React
          </text>

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
            opacity="0.9"
          />
          <text
            x="380"
            y="34"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
            opacity="0.95"
          >
            Solid
          </text>

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
            opacity="0.9"
          />
          <text
            x="540"
            y="34"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
            opacity="0.95"
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
            d="M 295 160 L 295 210"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeMiterlimit="10"
            opacity="0.9"
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
            opacity="0.9"
          />
          <text
            x="170"
            y="284"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
            opacity="0.95"
          >
            Ollama
          </text>

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
            opacity="0.9"
          />
          <text
            x="300"
            y="284"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
            opacity="0.95"
          >
            OpenAI
          </text>

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
            opacity="0.9"
          />
          <text
            x="435"
            y="284"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
            opacity="0.95"
          >
            Anthropic
          </text>

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
            opacity="0.9"
          />
          <text
            x="570"
            y="284"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
            opacity="0.95"
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
            fill="url(#glassGradient)"
            stroke={strokeColor}
            strokeWidth="1.5"
            filter="url(#glass)"
            opacity="0.9"
          />
          <text
            x="60"
            y="404"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
            opacity="0.95"
          >
            TypeScript
          </text>

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
            opacity="0.9"
          />
          <text
            x="220"
            y="404"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
            opacity="0.95"
          >
            PHP
          </text>

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
            opacity="0.9"
          />
          <text
            x="380"
            y="404"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
            opacity="0.95"
          >
            Python
          </text>

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
            opacity="0.9"
          />
          <text
            x="540"
            y="404"
            fill={textColor}
            fontFamily="Helvetica"
            fontSize="12"
            textAnchor="middle"
            opacity="0.95"
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
