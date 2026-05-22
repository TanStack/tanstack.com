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
  logoLight?: string
  logoDark?: string
  logo?: string
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
  showLogo = true,
  logoLight,
  logoDark,
  logo,
  logoSize = 40,
  centerText = false,
}: AILibraryHeroBoxProps) {
  const hasCustomLogo = logo || logoLight || logoDark
  const hasSeparateLogos = !logo && logoLight && logoDark
  const textX = centerText ? width / 2 : 25 + logoSize
  const textY = height / 2 + fontSize * 0.35

  // Position logo to the right of the text, centered vertically
  const logoX = 15
  const logoY = height / 2 - logoSize / 2

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
          textAnchor={centerText ? 'middle' : 'start'}
          opacity={opacity * 1.05}
        >
          {label}
        </text>
      )}
      {showLogo && logo ? (
        <image
          href={logo}
          x={logoX}
          y={logoY}
          width={logoSize}
          height={logoSize}
          opacity={opacity}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : null}
      {showLogo && hasSeparateLogos ? (
        <>
          <image
            href={logoLight}
            x={logoX}
            y={logoY}
            width={logoSize}
            height={logoSize}
            opacity={opacity}
            preserveAspectRatio="xMidYMid meet"
            className="dark:hidden"
          />
          <image
            href={logoDark}
            x={logoX}
            y={logoY}
            width={logoSize}
            height={logoSize}
            opacity={opacity}
            preserveAspectRatio="xMidYMid meet"
            className="hidden dark:block"
          />
        </>
      ) : null}
      {showLogo && !logo && !hasSeparateLogos && (logoLight || logoDark) ? (
        <image
          href={logoLight || logoDark}
          x={logoX}
          y={logoY}
          width={logoSize}
          height={logoSize}
          opacity={opacity}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : null}
      {showLogo && !hasCustomLogo ? (
        <image
          href="/images/logos/logo-color-100.png"
          x={logoX}
          y={logoY}
          width={logoSize}
          height={logoSize}
          opacity={opacity}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : null}
    </g>
  )
}
