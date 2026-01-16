type AILibraryHeroServiceCardProps = {
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
  logoLight?: string
  logoDark?: string
  logo?: string
  logoSize?: number
  transform?: string
  fill?: string
}

export function AILibraryHeroServiceCard({
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
  rx = 6,
  logoLight,
  logoDark,
  logo,
  logoSize = 20,
  transform,
  fill = 'url(#glassGradient)',
}: AILibraryHeroServiceCardProps) {
  const hasLogo = logo || logoLight || logoDark
  const hasSeparateLogos = !logo && logoLight && logoDark

  const centerX = x + width / 2
  const centerY = y + height / 2
  const logoX = hasLogo ? x + 12 : 0
  const logoY = centerY - logoSize / 2
  const textX = hasLogo ? x + logoSize + 20 : centerX
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
        filter="url(#glass)"
        opacity={opacity}
      />
      {logo && (
        <image
          href={logo}
          x={logoX}
          y={logoY}
          width={logoSize}
          height={logoSize}
          opacity={opacity}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      {hasSeparateLogos && (
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
      )}
      {!logo && !hasSeparateLogos && (logoLight || logoDark) && (
        <image
          href={logoLight || logoDark}
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
        textAnchor={hasLogo ? 'start' : 'middle'}
        opacity={opacity}
      >
        {label}
      </text>
    </g>
  )
}
