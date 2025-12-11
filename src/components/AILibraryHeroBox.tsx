import * as React from 'react'

type AILibraryHeroBoxProps = {
  x: number
  y: number
  width: number
  height: number
  label?: string
  textColor: string
  strokeColor: string
  fontSize?: number
  fontWeight?: number
  rx?: number
  opacity?: number
  strokeWidth?: number
  fill?: string
  showLogo?: boolean
  logoSize?: number
  centerText?: boolean
}

export function AILibraryHeroBox({
  x,
  y,
  width,
  height,
  label,
  textColor,
  strokeColor,
  fontSize = 25,
  fontWeight = 900,
  rx = 9,
  opacity = 0.9,
  strokeWidth = 3,
  fill = 'url(#glassGradientLarge)',
  logoSize = 40,
}: AILibraryHeroBoxProps) {
  // For centerText, align logo and text higher up; otherwise use normal center
  const textX = 25 + logoSize
  const textY = 15 + fontSize

  // Position logo to the right of the text, centered vertically
  const logoX = 15
  const logoY = 15

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={width}
        height={height}
        rx={rx}
        fill={fill}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        filter="url(#glass)"
        opacity={opacity}
      />
      {label && (
        <text
          x={textX}
          y={textY}
          fill={textColor}
          fontFamily="Helvetica"
          fontSize={fontSize}
          fontWeight={fontWeight}
          textAnchor="start"
          opacity={opacity * 1.05}
        >
          {label}
        </text>
      )}
      <image
        href="/images/logos/logo-color-100.png"
        x={logoX}
        y={logoY}
        width={logoSize}
        height={logoSize}
        opacity={opacity}
        preserveAspectRatio="xMidYMid meet"
      />
    </g>
  )
}
