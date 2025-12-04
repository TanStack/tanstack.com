import * as React from 'react'
import { useIsDark } from '~/hooks/useIsDark'

type AILibraryHeroCardProps = {
  x: number
  y: number
  width: number
  height: number
  label: string
  opacity: number
  textColor: string
  strokeColor: string
  fontSize?: number
  fontWeight?: number
  rx?: number
  isDashed?: boolean
  logoLight?: string
  logoDark?: string
  logo?: string
  logoSize?: number
  transform?: string
  fill?: string
}

export function AILibraryHeroCard({
  x,
  y,
  width,
  height,
  label,
  opacity,
  textColor,
  strokeColor,
  fontSize = 18,
  fontWeight = 700,
  rx = 9,
  isDashed = false,
  logoLight,
  logoDark,
  logo,
  logoSize = 20,
  transform,
  fill = 'url(#glassGradient)',
}: AILibraryHeroCardProps) {
  const isDark = useIsDark()

  // Determine which logo to use
  const logoToUse =
    logo || (isDark && logoDark ? logoDark : logoLight) || logoLight || logoDark

  const centerY = y + height / 2
  // Position logo to the left of text, both centered vertically
  const logoX = logoToUse ? x + 12 : 0
  const logoY = centerY - logoSize / 2
  const textX = logoToUse ? x + logoSize + 20 : x + width / 2
  // Better vertical alignment: text baseline should align with logo center
  const textY = centerY + fontSize * 0.35

  return (
    <g className="transition-all duration-300" transform={transform}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={rx}
        fill={fill}
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeDasharray={isDashed ? '8 8' : undefined}
        filter="url(#glass)"
        opacity={opacity}
      />
      {logoToUse && (
        <image
          href={logoToUse}
          x={logoX}
          y={logoY}
          width={logoSize}
          height={logoSize}
          opacity={opacity}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      <text
        x={textX}
        y={textY}
        fill={textColor}
        fontFamily="Helvetica"
        fontSize={fontSize}
        fontWeight={fontWeight}
        textAnchor={logoToUse ? 'start' : 'middle'}
        opacity={opacity}
      >
        {label}
      </text>
    </g>
  )
}
