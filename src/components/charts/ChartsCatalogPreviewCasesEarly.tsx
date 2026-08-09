import type { ReactNode } from 'react'

type PreviewPoint = readonly [x: number, y: number, radius?: number]

function Dots({
  fill = 'var(--catalog-preview-1)',
  opacity,
  points,
  stroke,
}: {
  fill?: string
  opacity?: number
  points: ReadonlyArray<PreviewPoint>
  stroke?: string
}) {
  return points.map(([x, y, radius], index) => (
    <circle
      cx={x}
      cy={y}
      fill={fill}
      key={`${x}-${y}-${index}`}
      opacity={opacity}
      r={radius ?? 3.5}
      stroke={stroke}
      strokeWidth={stroke ? 1.25 : undefined}
    />
  ))
}

function Arrow({
  color,
  strokeWidth = 3,
  x1,
  x2,
  y1,
  y2,
}: {
  color: string
  strokeWidth?: number
  x1: number
  x2: number
  y1: number
  y2: number
}) {
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
  return (
    <g>
      <path
        d={`M${x1} ${y1}L${x2} ${y2}`}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <path
        d="M0 0L-7 -4V4Z"
        fill={color}
        transform={`translate(${x2} ${y2}) rotate(${angle})`}
      />
    </g>
  )
}

function StackedAreaLayers({
  variant,
}: {
  variant: 'stacked' | 'normalized' | 'stream'
}) {
  const xs = [7, 52, 98, 144, 190, 236, 281]
  const colors = [
    '#4e79a7',
    '#f28e2c',
    '#e15759',
    '#76b7b2',
    '#59a14f',
    '#edc949',
    '#af7aa1',
    '#ff9da7',
    '#9c755f',
    '#bab0ab',
  ]
  const layers = Array.from({ length: 14 }, (_, layer) => {
    const thickness = variant === 'stacked' ? 9 : 12.5
    const centerOffset = variant === 'stream' ? -87 : 0
    const lower = xs.map((_, index) => {
      const wave = ((index * 7 + layer * 5) % 13) - 6
      if (variant === 'stream')
        return 96 + centerOffset + (layer + 1) * thickness + wave
      return 181 - layer * thickness + wave
    })
    const upper = lower.map((value, index) => {
      const variation =
        variant === 'normalized' ? 0 : ((index * 3 + layer) % 5) - 2
      return value - thickness - variation
    })
    const lowerPath = xs.map((x, index) => `${x} ${lower[index]}`).join('L')
    const upperPath = [...xs]
      .reverse()
      .map((x, reversedIndex) => {
        const index = xs.length - 1 - reversedIndex
        return `${x} ${upper[index]}`
      })
      .join('L')
    const fill = colors[layer % colors.length]
    return (
      <path
        d={`M${lowerPath}L${upperPath}Z`}
        fill={fill}
        key={layer}
        opacity={
          variant === 'stacked' ? 0.78 : variant === 'normalized' ? 0.82 : 0.85
        }
      />
    )
  })
  return (
    <>
      {layers}
      {variant === 'stream' ? null : (
        <path d="M7 181H281" stroke="var(--catalog-preview-muted)" />
      )}
    </>
  )
}

export const chartsCatalogPreviewEarlyCaseIds = [
  '01-line-gaps',
  '02-multi-line-end-labels',
  '03-temperature-range-band',
  '04-stacked-time-area',
  'bar-vertical-sorted',
  'bar-horizontal-ranking',
  'bar-grouped',
  'bar-stacked',
  'scatter-bubble',
  'histogram',
  'heatmap-labeled',
  'facets-anscombe',
  '13-interval-timeline',
  '14-error-bars',
  '15-boxplot',
  '16-lollipop',
  '17-dumbbell',
  '18-cumulative-histogram',
  '19-moving-average-line',
  '20-normalized-stacked-area',
  '21-streamgraph',
  '22-bollinger-band',
  '24-quantitative-binned-heatmap',
  '25-calendar-heatmap',
  '26-diverging-likert',
  '27-parallel-coordinates',
  '28-candlestick',
  '29-waterfall',
  '30-slopegraph',
  '31-linear-regression',
  '32-change-arrows',
  '33-difference-chart',
  '34-pointer-tooltip',
  '35-grouped-tooltip',
  '36-hierarchy-tree',
  '37-delaunay-network',
  '38-contour-topography',
  '39-density-contours',
  '40-geojson-map',
  '40-force-directed-network',
  '41-waffle-unit-chart',
  '42-vector-field',
  '43-hexbin-density',
  '44-framed-scatter',
  '50-empirical-cdf',
  '51-faceted-distributions',
  '52-beeswarm-dodge',
  '53-log-scale-scatter',
  '54-bump-ranking',
  '55-indexed-multi-line',
  '56-connected-scatter',
  '57-scatter-marginal-histograms',
  '58-select-extrema',
  '59-grouped-reducer-bars',
  '60-lag-autocorrelation',
  '61-quantile-ribbon',
  '62-ridgeline-density',
  '63-violin-distributions',
  '64-marimekko-mosaic',
  '65-voronoi-nearest-tooltip',
] as const

export function getChartsCatalogPreviewEarly(
  caseId: string,
): ReactNode | undefined {
  const geometry = getChartsCatalogPreviewEarlyGeometry(caseId)
  return geometry === undefined ? undefined : (
    <g data-preview-geometry={previewGeometryName(caseId)}>{geometry}</g>
  )
}

function previewGeometryName(caseId: string) {
  if (caseId === 'bar-grouped') return 'grouped-bars'
  if (caseId === 'heatmap-labeled') return 'labeled-heatmap'
  return caseId.replace(/^\d+-/, '')
}

function getChartsCatalogPreviewEarlyGeometry(
  caseId: string,
): ReactNode | undefined {
  switch (caseId) {
    case '01-line-gaps':
      return (
        <g
          fill="none"
          stroke="var(--catalog-preview-1)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="5"
        >
          <path d="M7 153C18 145 27 118 38 126S47 135 52 123" />
          <path d="M64 135C75 126 84 101 95 109S104 118 109 104" />
          <path d="M121 116C132 105 141 80 152 90S161 97 166 82" />
          <path d="M178 94C189 82 198 59 209 68S218 74 223 58" />
          <path d="M235 71C246 58 255 37 266 45S275 37 281 24" />
        </g>
      )

    case '02-multi-line-end-labels':
      return (
        <>
          <path
            d="M8 150C41 139 63 91 91 101S139 69 174 82S216 47 252 39"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeWidth="3"
          />
          <path
            d="M8 127C39 100 64 128 94 113S143 121 177 92S221 104 252 84"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeWidth="3"
          />
          <path
            d="M8 93C42 111 65 70 100 83S145 44 181 57S220 59 252 61"
            fill="none"
            stroke="var(--catalog-preview-3)"
            strokeWidth="3"
          />
          <text
            fill="var(--catalog-preview-1)"
            fontSize="7"
            textAnchor="end"
            x="280"
            y="42"
          >
            Manufacturing
          </text>
          <text
            fill="var(--catalog-preview-3)"
            fontSize="7"
            textAnchor="end"
            x="280"
            y="64"
          >
            Finance
          </text>
          <text
            fill="var(--catalog-preview-2)"
            fontSize="7"
            textAnchor="end"
            x="280"
            y="87"
          >
            Construction
          </text>
        </>
      )

    case '03-temperature-range-band':
      return (
        <>
          <path
            d="M7 128C35 105 56 117 83 91S130 83 157 58S204 72 232 43S259 40 281 25L281 83C254 93 234 80 207 103S158 111 130 132S82 139 54 151S25 157 7 165Z"
            fill="var(--catalog-preview-1)"
            opacity=".22"
          />
          <path
            d="M7 165C32 155 53 158 83 143S130 134 158 114S204 107 232 87S259 91 281 83"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeLinecap="round"
            strokeWidth="3.5"
          />
          <path
            d="M7 128C35 105 56 117 83 91S130 83 157 58S204 72 232 43S259 40 281 25"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeWidth="3.5"
          />
        </>
      )

    case '04-stacked-time-area':
      return <StackedAreaLayers variant="stacked" />

    case 'bar-vertical-sorted':
      return (
        <g fill="var(--catalog-preview-1)">
          {Array.from({ length: 26 }, (_, index) => 158 - index * 5).map(
            (top, index) => (
              <rect
                height={166 - top}
                key={top}
                rx="1.5"
                width="8"
                x={7 + index * 10.7}
                y={top}
              />
            ),
          )}
        </g>
      )

    case 'bar-horizontal-ranking':
      return (
        <>
          <g fill="var(--catalog-preview-3)">
            {[174, 158, 142, 127, 111, 94, 75, 55].map((width, index) => (
              <rect
                height="13"
                key={width}
                rx="3"
                width={width}
                x="103"
                y={12 + index * 21}
              />
            ))}
          </g>
          {[
            'New York–Newark',
            'Los Angeles–Long Beach',
            'Chicago–Naperville',
            'Dallas–Fort Worth',
            'Houston–The Woodlands',
            'Philadelphia–Camden',
            'Washington–Arlington',
            'Miami–Fort Lauderdale',
          ].map((label, index) => (
            <text
              fill="currentColor"
              fontSize="6.5"
              key={label}
              textAnchor="end"
              x="98"
              y={22 + index * 21}
            >
              {label}
            </text>
          ))}
        </>
      )

    case 'bar-grouped':
      return (
        <>
          <g fill="var(--catalog-preview-1)">
            <rect height="91" rx="3" width="30" x="24" y="75" />
            <rect height="126" rx="3" width="30" x="110" y="40" />
            <rect height="104" rx="3" width="30" x="196" y="62" />
          </g>
          <g fill="var(--catalog-preview-2)">
            <rect height="68" rx="3" width="30" x="57" y="98" />
            <rect height="101" rx="3" width="30" x="143" y="65" />
            <rect height="82" rx="3" width="30" x="229" y="84" />
          </g>
        </>
      )

    case 'bar-stacked':
      return (
        <>
          {[54, 82, 69, 105, 91, 125, 110, 137, 119, 149, 132, 156].map(
            (height, index) => {
              const first = Math.round(height * 0.42)
              const second = Math.round(height * 0.34)
              const x = 7 + index * 23
              return (
                <g key={`${height}-${index}`}>
                  <rect
                    fill="var(--catalog-preview-1)"
                    height={first}
                    width="17"
                    x={x}
                    y={166 - first}
                  />
                  <rect
                    fill="var(--catalog-preview-2)"
                    height={second}
                    width="17"
                    x={x}
                    y={166 - first - second}
                  />
                  <rect
                    fill="var(--catalog-preview-3)"
                    height={height - first - second}
                    width="17"
                    x={x}
                    y={166 - height}
                  />
                </g>
              )
            },
          )}
        </>
      )

    case 'scatter-bubble':
      return (
        <>
          <Dots
            fill="var(--catalog-preview-1)"
            opacity={0.78}
            points={[
              [32, 62, 6],
              [47, 74, 9],
              [61, 55, 5],
              [71, 84, 7],
              [83, 67, 10],
              [95, 92, 6],
              [106, 72, 8],
              [116, 101, 5],
            ]}
            stroke="currentColor"
          />
          <Dots
            fill="var(--catalog-preview-2)"
            opacity={0.78}
            points={[
              [105, 128, 7],
              [120, 143, 10],
              [135, 119, 6],
              [149, 137, 8],
              [161, 111, 5],
              [174, 130, 9],
              [186, 104, 7],
            ]}
            stroke="currentColor"
          />
          <Dots
            fill="var(--catalog-preview-3)"
            opacity={0.78}
            points={[
              [167, 54, 6],
              [182, 73, 8],
              [197, 48, 10],
              [211, 66, 5],
              [225, 42, 7],
              [239, 60, 9],
              [255, 35, 6],
            ]}
            stroke="currentColor"
          />
        </>
      )

    case 'histogram':
      return (
        <g fill="var(--catalog-preview-1)">
          {[18, 43, 84, 132, 154, 127, 82, 41, 17].map((height, index) => (
            <rect
              height={height}
              key={`${height}-${index}`}
              width="29"
              x={9 + index * 30}
              y={167 - height}
            />
          ))}
        </g>
      )

    case 'heatmap-labeled': {
      const values = Array.from(
        { length: 84 },
        (_, index) => 7 + ((index * 7 + Math.floor(index / 12) * 3) % 25) / 10,
      )
      return (
        <>
          {values.map((value, index) => {
            const column = index % 12
            const row = Math.floor(index / 12)
            const x = 7 + column * 23
            const y = 8 + row * 25
            return (
              <g key={`${value}-${index}`}>
                <rect
                  fill={
                    value >= 8.5
                      ? 'var(--catalog-preview-1)'
                      : value >= 8
                        ? 'var(--catalog-preview-3)'
                        : 'var(--catalog-preview-2)'
                  }
                  height="23"
                  opacity={0.38 + (value - 7) * 0.24}
                  rx="2"
                  width="21"
                  x={x}
                  y={y}
                />
                <text
                  fill="currentColor"
                  fontSize="5.5"
                  fontWeight="600"
                  textAnchor="middle"
                  x={x + 10.5}
                  y={y + 14.5}
                >
                  {value.toFixed(1)}
                </text>
              </g>
            )
          })}
        </>
      )
    }

    case 'facets-anscombe':
      return (
        <>
          <path
            d="M144 7V185M7 96H281"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="1.5"
          />
          <Dots
            points={[
              [20, 82],
              [31, 74],
              [43, 69],
              [54, 62],
              [67, 57],
              [80, 49],
              [93, 44],
              [106, 36],
              [115, 35],
              [120, 31],
              [132, 23],
              [156, 27],
              [168, 39],
              [180, 52],
              [193, 64],
              [206, 72],
              [219, 76],
              [232, 72],
              [245, 63],
              [258, 48],
              [264, 36],
              [272, 27],
              [20, 178],
              [33, 169],
              [46, 161],
              [59, 153],
              [72, 145],
              [85, 137],
              [98, 129],
              [111, 121],
              [118, 117],
              [124, 113],
              [130, 101],
              [156, 174],
              [213, 169],
              [217, 158],
              [215, 147],
              [219, 136],
              [216, 125],
              [220, 114],
              [224, 110],
              [217, 103],
              [214, 180],
              [270, 105],
            ]}
          />
        </>
      )

    case '13-interval-timeline':
      return (
        <>
          {[34, 83, 48, 112, 68, 129, 91, 145].map((x, index) => {
            const width = [68, 55, 91, 49, 76, 64, 83, 52][index] ?? 50
            return (
              <rect
                fill={
                  index % 3 === 0
                    ? 'var(--catalog-preview-2)'
                    : 'var(--catalog-preview-1)'
                }
                height="14"
                key={`${x}-${index}`}
                rx="7"
                width={width}
                x={x}
                y={12 + index * 21}
              />
            )
          })}
        </>
      )

    case '14-error-bars':
      return (
        <>
          <path
            d="M55 39V145M37 39H73M37 145H73M144 62V133M126 62H162M126 133H162M233 28V119M215 28H251M215 119H251"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeWidth="4"
          />
          <Dots
            points={[
              [55, 92, 8],
              [144, 98, 8],
              [233, 74, 8],
            ]}
          />
        </>
      )

    case '15-boxplot':
      return (
        <>
          {[34, 89, 144, 199, 254].map((x, index) => {
            const top = [43, 60, 35, 72, 49][index] ?? 50
            const bottom = [139, 153, 128, 158, 143][index] ?? 140
            const boxTop = top + 25
            const boxBottom = bottom - 22
            return (
              <g key={`${x}-${index}`}>
                <path
                  d={`M${x} ${top}V${bottom}M${x - 9} ${top}H${x + 9}M${x - 9} ${bottom}H${x + 9}`}
                  stroke="var(--catalog-preview-1)"
                  strokeWidth="2"
                />
                <rect
                  fill="var(--catalog-preview-1)"
                  fillOpacity=".2"
                  height={boxBottom - boxTop}
                  stroke="var(--catalog-preview-1)"
                  strokeWidth="2"
                  width="26"
                  x={x - 13}
                  y={boxTop}
                />
                <path
                  d={`M${x - 13} ${(boxTop + boxBottom) / 2}H${x + 13}`}
                  stroke="var(--catalog-preview-1)"
                  strokeWidth="3"
                />
              </g>
            )
          })}
          <Dots
            fill="var(--catalog-preview-2)"
            points={[
              [34, 27, 3],
              [144, 151, 3],
              [199, 31, 3],
              [254, 164, 3],
            ]}
          />
        </>
      )

    case '16-lollipop':
      return (
        <>
          {Array.from(
            { length: 26 },
            (_, index) => 30 + Math.abs(13 - index) * 6 + ((index * 11) % 17),
          ).map((top, index) => (
            <g key={`${top}-${index}`}>
              <path
                d={`M${10 + index * 10.7} 167V${top}`}
                stroke="var(--catalog-preview-muted)"
                strokeWidth="2"
              />
              <circle
                cx={10 + index * 10.7}
                cy={top}
                fill="var(--catalog-preview-1)"
                r="4"
              />
            </g>
          ))}
        </>
      )

    case '17-dumbbell':
      return (
        <>
          {[38, 88, 55, 112, 72, 129, 44, 96].map((left, index) => {
            const right = [195, 244, 177, 224, 201, 260, 159, 231][index] ?? 200
            const y = 12 + index * 23
            return (
              <g key={`${left}-${index}`}>
                <path
                  d={`M${left} ${y}H${right}`}
                  stroke="var(--catalog-preview-muted)"
                  strokeLinecap="round"
                  strokeWidth="4"
                />
                <circle
                  cx={left}
                  cy={y}
                  fill="var(--catalog-preview-1)"
                  r="6"
                />
                <circle
                  cx={right}
                  cy={y}
                  fill="var(--catalog-preview-2)"
                  r="6"
                />
              </g>
            )
          })}
        </>
      )

    case '18-cumulative-histogram':
      return (
        <g fill="var(--catalog-preview-1)">
          {Array.from({ length: 20 }, (_, index) =>
            Math.round(8 + 158 * (1 - Math.exp(-index / 5.2))),
          ).map((height, index) => (
            <rect
              height={height}
              key={`${height}-${index}`}
              width="12"
              x={8 + index * 13.7}
              y={170 - height}
            />
          ))}
        </g>
      )

    case '19-moving-average-line':
      return (
        <>
          <path
            d="M7 119C23 120 34 82 52 82S78 120 98 120S126 82 145 82S174 119 192 119S220 81 239 81S264 119 281 118"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeLinecap="round"
            strokeWidth="4"
          />
          <path
            d="M7 77C23 78 34 37 52 37S78 76 98 76S126 36 145 36S174 75 192 75S220 35 239 35S264 74 281 73"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeWidth="4"
          />
          <path
            d="M7 169H281"
            stroke="var(--catalog-preview-muted)"
            strokeDasharray="6 6"
            strokeWidth="2"
          />
        </>
      )

    case '20-normalized-stacked-area':
      return <StackedAreaLayers variant="normalized" />

    case '21-streamgraph':
      return <StackedAreaLayers variant="stream" />

    case '22-bollinger-band':
      return (
        <>
          <path
            d="M7 139C37 109 63 129 91 93S140 104 171 67S224 86 281 38L281 91C229 116 207 99 176 128S124 119 94 153S36 148 7 171Z"
            fill="var(--catalog-preview-3)"
            opacity=".2"
          />
          <path
            d="M7 155C37 129 63 142 92 119S141 116 173 97S225 101 281 65"
            fill="none"
            stroke="var(--catalog-preview-3)"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </>
      )

    case '24-quantitative-binned-heatmap': {
      const occupied = [
        0, 2, 4, 7, 10, 11, 14, 16, 18, 21, 23, 25, 27, 30, 32, 33, 35, 38, 40,
        43, 45, 47, 49, 52, 54, 55, 58, 60, 62, 65, 67, 69, 71, 74, 76, 77, 78,
        80, 82, 84, 86, 87,
      ]
      return (
        <>
          {occupied.map((cell) => {
            const column = cell % 11
            const row = Math.floor(cell / 11)
            const intensity = (column * 3 + row * 2) % 5
            return (
              <rect
                fill={
                  intensity > 2
                    ? 'var(--catalog-preview-1)'
                    : 'var(--catalog-preview-2)'
                }
                fillOpacity={0.2 + intensity * 0.17}
                height="19"
                key={cell}
                rx="2"
                width="22"
                x={8 + column * 25}
                y={8 + row * 22}
              />
            )
          })}
        </>
      )
    }

    case '25-calendar-heatmap':
      return (
        <>
          {Array.from({ length: 98 }, (_, index) => {
            const column = Math.floor(index / 7)
            const row = index % 7
            const intensity = (column * 5 + row * 3) % 6
            return (
              <rect
                fill={
                  intensity >= 3
                    ? 'var(--catalog-preview-1)'
                    : 'var(--catalog-preview-2)'
                }
                fillOpacity={0.18 + intensity * 0.13}
                height="20"
                key={index}
                rx="2"
                width="17"
                x={8 + column * 19.2}
                y={17 + row * 23}
              />
            )
          })}
        </>
      )

    case '26-diverging-likert': {
      const rows = [
        [20, 30, 74, 36, 42],
        [46, 10, 56, 54, 24],
        [16, 14, 98, 44, 34],
        [12, 102, 42, 10, 34],
        [22, 24, 42, 34, 80],
      ]
      return (
        <>
          <path
            d="M144 8V184"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="2"
          />
          {[22, 56, 90, 124, 158].map((y, index) => {
            const [
              negativeStrong,
              negative,
              neutral,
              positive,
              positiveStrong,
            ] = rows[index] ?? rows[0]
            const neutralX = 144 - neutral / 2
            return (
              <g key={y}>
                <rect
                  fill="#991b1b"
                  height="20"
                  rx="3"
                  width={negativeStrong}
                  x={neutralX - negative - negativeStrong}
                  y={y}
                />
                <rect
                  fill="#ef4444"
                  height="20"
                  width={negative}
                  x={neutralX - negative}
                  y={y}
                />
                <rect
                  fill="#cbd5e1"
                  height="20"
                  width={neutral}
                  x={neutralX}
                  y={y}
                />
                <rect
                  fill="#60a5fa"
                  height="20"
                  width={positive}
                  x={neutralX + neutral}
                  y={y}
                />
                <rect
                  fill="#1d4ed8"
                  height="20"
                  rx="3"
                  width={positiveStrong}
                  x={neutralX + neutral + positive}
                  y={y}
                />
              </g>
            )
          })}
        </>
      )
    }

    case '27-parallel-coordinates': {
      const xs = [24, 104, 184, 264]
      const profiles = [
        [31, 79, 142, 58],
        [54, 128, 75, 153],
        [82, 45, 116, 94],
        [112, 157, 39, 131],
        [143, 96, 164, 44],
        [165, 61, 88, 118],
        [68, 145, 57, 171],
      ]
      const colors = [
        'var(--catalog-preview-1)',
        'var(--catalog-preview-2)',
        'var(--catalog-preview-3)',
      ]
      return (
        <>
          <path
            d="M24 13V179M104 13V179M184 13V179M264 13V179"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="1.5"
          />
          {profiles.map((profile, profileIndex) => (
            <g key={profileIndex}>
              <path
                d={profile
                  .map(
                    (y, index) => `${index === 0 ? 'M' : 'L'}${xs[index]} ${y}`,
                  )
                  .join('')}
                fill="none"
                stroke={colors[profileIndex % colors.length]}
                strokeLinejoin="round"
                strokeWidth="2.5"
              />
              {profile.map((y, index) => (
                <circle
                  cx={xs[index]}
                  cy={y}
                  fill={colors[profileIndex % colors.length]}
                  key={index}
                  r="3"
                />
              ))}
            </g>
          ))}
        </>
      )
    }

    case '28-candlestick':
      return (
        <>
          {Array.from({ length: 30 }, (_, index) => 8 + index * 9.35).map(
            (x, index) => {
              const high = 17 + ((index * 17) % 53)
              const low = Math.min(178, high + 72 + ((index * 7) % 29))
              const gain = index % 4 !== 1
              const open = gain ? high + 48 : high + 25
              const close = gain ? high + 25 : high + 48
              return (
                <g key={x}>
                  <path
                    d={`M${x} ${high}V${low}`}
                    stroke="var(--catalog-preview-muted)"
                    strokeWidth="2"
                  />
                  <path
                    d={`M${x} ${open}V${close}`}
                    stroke={
                      gain
                        ? 'var(--catalog-preview-1)'
                        : 'var(--catalog-preview-2)'
                    }
                    strokeLinecap="butt"
                    strokeWidth="5"
                  />
                </g>
              )
            },
          )}
        </>
      )

    case '29-waterfall': {
      const bars = [
        [8, 119, 31],
        [45, 93, 26],
        [82, 72, 21],
        [119, 47, 25],
        [156, 47, 34],
        [193, 28, 19],
        [230, 28, 122],
      ]
      return (
        <>
          {bars.map(([x, y, height], index) => (
            <rect
              fill={
                index === bars.length - 1
                  ? 'var(--catalog-preview-3)'
                  : index === 4
                    ? 'var(--catalog-preview-2)'
                    : 'var(--catalog-preview-1)'
              }
              height={height}
              key={x}
              rx="2"
              width="29"
              x={x}
              y={y}
            />
          ))}
          <path
            d="M37 119H45M74 93H82M111 72H119M148 47H156M185 81H193M222 28H230"
            stroke="var(--catalog-preview-muted)"
            strokeDasharray="3 3"
          />
        </>
      )
    }

    case '30-slopegraph': {
      const metros = [
        { color: '#2563eb', name: 'New York', start: 149, end: 31 },
        { color: '#f97316', name: 'Los Angeles', start: 145, end: 39 },
        { color: '#10b981', name: 'Chicago', start: 171, end: 70 },
        { color: '#8b5cf6', name: 'Dallas', start: 145, end: 59 },
        { color: '#ec4899', name: 'Houston', start: 149, end: 23 },
        { color: '#06b6d4', name: 'Philadelphia', start: 158, end: 78 },
        { color: '#ca8a04', name: 'Washington, D.C.', start: 140, end: 49 },
        { color: '#64748b', name: 'Miami', start: 140, end: 86 },
      ]
      return (
        <>
          {metros.map(({ color, end, name, start }) => (
            <g key={name}>
              <path
                d={`M30 ${start}L207 ${end}`}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
              />
              <circle cx="30" cy={start} fill={color} r="3.5" />
              <circle cx="207" cy={end} fill={color} r="3.5" />
              <text fill={color} fontSize="6.5" x="215" y={end + 2.5}>
                {name}
              </text>
            </g>
          ))}
        </>
      )
    }

    case '31-linear-regression':
      return (
        <>
          <Dots
            fill="var(--catalog-preview-1)"
            opacity={0.62}
            points={[
              [24, 31],
              [37, 46],
              [52, 38],
              [66, 59],
              [81, 53],
              [96, 72],
              [112, 64],
              [128, 86],
              [145, 78],
              [161, 101],
              [178, 92],
              [195, 118],
              [213, 108],
              [231, 137],
              [250, 126],
              [266, 157],
            ]}
          />
          <path
            d="M12 27L276 164"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </>
      )

    case '32-change-arrows':
      return (
        <>
          {[
            [18, 48, 53, 23],
            [73, 27, 110, 56],
            [132, 52, 169, 19],
            [192, 24, 230, 49],
            [246, 54, 277, 31],
            [20, 104, 57, 75],
            [77, 79, 112, 113],
            [132, 111, 169, 80],
            [191, 82, 229, 116],
            [245, 111, 278, 80],
            [46, 164, 83, 131],
            [176, 137, 213, 166],
          ].map(([x1, y1, x2, y2]) => (
            <Arrow
              color={
                y2 < y1
                  ? 'var(--catalog-preview-1)'
                  : 'var(--catalog-preview-2)'
              }
              key={`${x1}-${y1}`}
              strokeWidth={4}
              x1={x1}
              x2={x2}
              y1={y1}
              y2={y2}
            />
          ))}
        </>
      )

    case '33-difference-chart':
      return (
        <>
          <path
            d="M7 124C34 85 58 123 83 92S126 91 145 107L145 127C122 111 105 120 83 111S34 117 7 142Z"
            fill="#059669"
            opacity=".42"
          />
          <path
            d="M145 107C165 123 183 89 204 105S246 80 281 95L281 68C247 49 225 89 204 76S165 95 145 127Z"
            fill="#dc2626"
            opacity=".42"
          />
          <path
            d="M7 142C34 117 58 133 83 111S122 111 145 127S183 89 204 76S247 49 281 68"
            fill="none"
            stroke="#059669"
            strokeWidth="3"
          />
          <path
            d="M7 124C34 85 58 123 83 92S126 91 145 107S183 89 204 105S247 80 281 95"
            fill="none"
            stroke="#dc2626"
            strokeWidth="3"
          />
        </>
      )

    case '34-pointer-tooltip':
      return (
        <>
          <path
            d="M7 148C38 132 61 88 91 102S142 121 174 74S226 95 281 34"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeWidth="4"
          />
          <path
            d="M174 12V181"
            stroke="var(--catalog-preview-muted)"
            strokeDasharray="4 4"
          />
          <circle
            cx="174"
            cy="74"
            fill="var(--catalog-preview-1)"
            r="8"
            stroke="white"
            strokeWidth="2"
          />
          <rect
            fill="var(--color-ds-neutral-900)"
            height="34"
            opacity=".84"
            rx="5"
            width="82"
            x="185"
            y="42"
          />
          <path
            d="M185 58L177 68L185 69Z"
            fill="var(--color-ds-neutral-900)"
            opacity=".84"
          />
          <text fill="var(--color-ds-neutral-50)" fontSize="7" x="193" y="55">
            Jun 5
          </text>
          <text
            fill="var(--color-ds-neutral-50)"
            fontSize="9"
            fontWeight="700"
            x="193"
            y="69"
          >
            $142.11
          </text>
        </>
      )

    case '35-grouped-tooltip':
      return (
        <>
          <rect
            fill="var(--catalog-preview-muted)"
            height="174"
            opacity=".14"
            rx="4"
            width="24"
            x="168"
            y="9"
          />
          <path
            d="M7 148C39 134 61 105 91 113S143 82 174 91S227 64 281 77"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeOpacity=".72"
            strokeWidth="3"
          />
          <path
            d="M7 114C38 90 64 124 94 96S143 111 174 70S227 95 281 51"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeOpacity=".72"
            strokeWidth="3"
          />
          <path
            d="M7 78C38 102 63 69 94 80S142 49 174 59S226 30 281 42"
            fill="none"
            stroke="var(--catalog-preview-3)"
            strokeOpacity=".72"
            strokeWidth="3"
          />
          <Dots
            fill="var(--catalog-preview-1)"
            points={[[180, 89, 6]]}
            stroke="white"
          />
          <Dots
            fill="var(--catalog-preview-2)"
            points={[[180, 68, 6]]}
            stroke="white"
          />
          <Dots
            fill="var(--catalog-preview-3)"
            points={[[180, 57, 6]]}
            stroke="white"
          />
          <rect
            fill="var(--color-ds-neutral-900)"
            height="72"
            opacity=".86"
            rx="5"
            width="91"
            x="190"
            y="62"
          />
          {[
            ['var(--catalog-preview-1)', 'Manufacturing', '$142'],
            ['var(--catalog-preview-2)', 'Construction', '$126'],
            ['var(--catalog-preview-3)', 'Finance', '$118'],
          ].map(([color, label, value], index) => (
            <g key={label}>
              <circle cx="198" cy={82 + index * 17} fill={color} r="3" />
              <text
                fill="var(--color-ds-neutral-50)"
                fontSize="5.5"
                x="205"
                y={84 + index * 17}
              >
                {label}
              </text>
              <text
                fill="var(--color-ds-neutral-50)"
                fontSize="6"
                fontWeight="700"
                textAnchor="end"
                x="275"
                y={84 + index * 17}
              >
                {value}
              </text>
            </g>
          ))}
        </>
      )

    case '36-hierarchy-tree':
      return (
        <>
          <path
            d="M22 96L68 56M22 96L68 136M68 56L120 30M68 56L120 76M68 136L120 116M68 136L120 158M120 30L184 20M120 76L184 68M120 158L184 151"
            fill="none"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="2"
          />
          <Dots
            points={[
              [22, 96, 5],
              [68, 56, 5],
              [68, 136, 5],
              [120, 30, 4],
              [120, 76, 4],
              [120, 116, 4],
              [120, 158, 4],
              [184, 20, 3],
              [184, 68, 3],
              [184, 151, 3],
            ]}
          />
          {[
            ['analytics', 5, 91],
            ['data', 73, 53],
            ['display', 73, 139],
            ['query', 125, 27],
            ['transform', 125, 73],
            ['axis', 125, 113],
            ['marks', 125, 164],
            ['filter', 190, 18],
            ['group', 190, 66],
            ['scale', 190, 154],
          ].map(([label, x, y]) => (
            <text fill="currentColor" fontSize="6" key={label} x={x} y={y}>
              {label}
            </text>
          ))}
        </>
      )

    case '37-delaunay-network': {
      const points: ReadonlyArray<PreviewPoint> = [
        [18, 25],
        [67, 18],
        [112, 29],
        [162, 16],
        [211, 27],
        [269, 20],
        [28, 72],
        [75, 64],
        [124, 79],
        [171, 61],
        [221, 74],
        [260, 66],
        [16, 119],
        [58, 131],
        [111, 113],
        [157, 128],
        [207, 109],
        [273, 123],
        [30, 170],
        [80, 158],
        [132, 176],
        [180, 156],
        [229, 172],
        [266, 154],
      ]
      const horizontalLinks = points.flatMap((_, index) =>
        index % 6 < 5 ? [[index, index + 1]] : [],
      )
      const verticalLinks = points.flatMap((_, index) =>
        index < 18 ? [[index, index + 6]] : [],
      )
      const diagonalLinks = points.flatMap((_, index) =>
        index < 18 && index % 6 < 5 ? [[index, index + 7]] : [],
      )
      const extraLinks = [
        [1, 6],
        [2, 7],
        [3, 8],
        [4, 9],
        [7, 12],
        [8, 13],
        [9, 14],
        [13, 18],
        [14, 19],
        [15, 20],
      ]
      const links = [
        ...horizontalLinks,
        ...verticalLinks,
        ...diagonalLinks,
        ...extraLinks,
      ]
      return (
        <>
          {links.map(([from, to], index) => {
            const start = points[from]
            const end = points[to]
            if (!start || !end) return null
            return (
              <path
                d={`M${start[0]} ${start[1]}L${end[0]} ${end[1]}`}
                key={index}
                stroke="var(--catalog-preview-muted)"
                strokeWidth="1"
              />
            )
          })}
          <Dots points={points} stroke="white" />
        </>
      )
    }

    case '38-contour-topography':
      return (
        <>
          <path
            d="M15 101C7 58 40 18 92 11S198 20 246 47S287 117 262 157S181 188 110 181S24 149 15 101Z"
            fill="var(--catalog-preview-1)"
            opacity=".18"
            stroke="white"
          />
          <path
            d="M42 103C35 70 59 39 101 31S186 38 224 59S256 111 237 141S172 169 118 160S49 138 42 103Z"
            fill="var(--catalog-preview-1)"
            opacity=".33"
            stroke="white"
          />
          <path
            d="M69 104C64 80 83 58 113 52S175 57 202 73S225 109 210 132S162 151 124 144S74 130 69 104Z"
            fill="var(--catalog-preview-1)"
            opacity=".49"
            stroke="white"
          />
          <path
            d="M96 104C93 88 106 73 127 69S169 73 187 83S202 108 192 123S158 136 133 132S100 121 96 104Z"
            fill="var(--catalog-preview-1)"
            opacity=".67"
            stroke="white"
          />
          <path
            d="M121 104C119 96 127 88 140 86S164 88 175 95S184 108 177 116S157 123 143 120S123 114 121 104Z"
            fill="var(--catalog-preview-1)"
            opacity=".9"
            stroke="white"
          />
        </>
      )

    case '39-density-contours':
      return (
        <>
          <path
            d="M22 139C28 99 57 72 92 77S140 111 129 143S82 176 48 163S17 151 22 139Z"
            fill="var(--catalog-preview-1)"
            fillOpacity=".12"
            stroke="var(--catalog-preview-1)"
            strokeWidth="2"
          />
          <path
            d="M57 134C62 106 79 94 99 100S121 124 113 143S82 157 66 149S54 141 57 134Z"
            fill="var(--catalog-preview-1)"
            fillOpacity=".18"
            stroke="var(--catalog-preview-1)"
            strokeWidth="2"
          />
          <path
            d="M76 132C79 117 88 111 99 115S111 129 106 139S90 147 81 142S74 136 76 132Z"
            fill="var(--catalog-preview-1)"
            fillOpacity=".3"
            stroke="var(--catalog-preview-1)"
            strokeWidth="2"
          />
          <path
            d="M142 89C147 47 182 22 220 34S271 78 258 112S207 146 172 130S137 105 142 89Z"
            fill="var(--catalog-preview-1)"
            fillOpacity=".12"
            stroke="var(--catalog-preview-1)"
            strokeWidth="2"
          />
          <path
            d="M177 87C182 60 199 50 220 57S243 82 233 101S204 116 188 107S174 96 177 87Z"
            fill="var(--catalog-preview-1)"
            fillOpacity=".2"
            stroke="var(--catalog-preview-1)"
            strokeWidth="2"
          />
          <path
            d="M196 86C199 71 209 66 220 70S232 84 227 94S211 102 202 97S194 90 196 86Z"
            fill="var(--catalog-preview-1)"
            fillOpacity=".3"
            stroke="var(--catalog-preview-1)"
            strokeWidth="2"
          />
        </>
      )

    case '40-geojson-map':
      return (
        <g
          fill="none"
          stroke="var(--catalog-preview-1)"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          <path d="M20 27L104 14L143 33L222 21L271 47L260 160L198 176L145 162L88 178L17 147Z" />
          <path d="M104 14L99 69L143 73L143 33M222 21L216 68L143 73M20 27L53 77L99 69M17 147L61 124L53 77M61 124L104 115L99 69M104 115L145 112L143 73M145 112L198 119L216 68M198 119L260 160M145 112V162M104 115L88 178" />
          <path d="M53 77L29 94M61 124L34 134M99 69L101 92M104 115L103 143M143 73L168 69M145 112L171 113M216 68L245 72M198 119L229 133M198 119V149M145 162L168 139L198 149" />
          <path d="M61 37L59 65M79 31L77 55M118 24L119 50M160 29L161 55M187 25L188 52M235 32L233 56M42 105H60M78 93H99M115 83H143M164 84H216M174 101H198M113 128H145M158 132H198M214 145H256" />
          <path d="M111 82H137V105H111ZM153 81H185V105H153ZM68 84H94V111H68ZM205 79H232V106H205ZM114 124H137V151H114ZM158 123H187V151H158Z" />
        </g>
      )

    case '40-force-directed-network':
      return (
        <>
          <path
            d="M25 100L63 49M25 100L68 132M63 49L106 75M63 49L122 28M68 132L109 157M68 132L126 116M106 75L158 70M122 28L171 36M126 116L158 70M126 116L178 130M109 157L178 130M158 70L212 53M158 70L224 91M178 130L224 91M178 130L249 150"
            fill="none"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="1.5"
          />
          <Dots
            fill="var(--catalog-preview-1)"
            points={[
              [25, 100, 6],
              [63, 49, 6],
              [68, 132, 5],
              [106, 75, 5],
              [122, 28, 7],
            ]}
            stroke="white"
          />
          <Dots
            fill="var(--catalog-preview-2)"
            points={[
              [109, 157, 5],
              [126, 116, 6],
              [158, 70, 7],
              [171, 36, 5],
            ]}
            stroke="white"
          />
          <Dots
            fill="var(--catalog-preview-3)"
            points={[
              [178, 130, 6],
              [212, 53, 5],
              [224, 91, 6],
              [249, 150, 5],
            ]}
            stroke="white"
          />
          <text fill="currentColor" fontSize="7" x="139" y="24">
            Valjean
          </text>
          <text fill="currentColor" fontSize="7" x="216" y="48">
            Marius
          </text>
          <text fill="currentColor" fontSize="7" x="184" y="128">
            Cosette
          </text>
          <text fill="currentColor" fontSize="7" x="231" y="89">
            Javert
          </text>
        </>
      )

    case '41-waffle-unit-chart':
      return (
        <>
          {Array.from({ length: 100 }, (_, index) => {
            const column = index % 20
            const row = Math.floor(index / 20)
            const colors = [
              'var(--catalog-preview-1)',
              'var(--catalog-preview-2)',
              'var(--catalog-preview-3)',
              'var(--color-ds-green-500)',
              'var(--color-ds-amber-500)',
              'var(--color-ds-neutral-500)',
            ]
            const fill = colors[Math.min(5, Math.floor(index / 17))]
            return (
              <rect
                fill={fill}
                height="25"
                key={index}
                rx="3"
                width="11"
                x={8 + column * 13.7}
                y={20 + row * 31}
              />
            )
          })}
        </>
      )

    case '42-vector-field':
      return (
        <>
          {Array.from({ length: 30 }, (_, index) => {
            const column = index % 6
            const row = Math.floor(index / 6)
            const x = 18 + column * 49
            const y = 23 + row * 36
            const dx = 8 + ((row + column) % 3) * 3
            const dy = (column - 2.5) * 2 + (row - 2) * 1.5
            return (
              <Arrow
                color="var(--catalog-preview-1)"
                key={index}
                strokeWidth={2}
                x1={x}
                x2={x + dx}
                y1={y}
                y2={y + dy}
              />
            )
          })}
        </>
      )

    case '43-hexbin-density':
      return (
        <>
          {Array.from({ length: 20 }, (_, index) => {
            const column = index % 5
            const row = Math.floor(index / 5)
            const x = 30 + column * 55 + (row % 2) * 12
            const y = 28 + row * 44
            const intensity = (column * 2 + row * 3) % 5
            return (
              <path
                d={`M${x} ${y - 13}L${x + 12} ${y - 6}V${y + 7}L${x} ${y + 14}L${x - 12} ${y + 7}V${y - 6}Z`}
                fill={
                  intensity > 2
                    ? 'var(--catalog-preview-1)'
                    : 'var(--catalog-preview-2)'
                }
                fillOpacity={0.26 + intensity * 0.16}
                key={index}
                stroke="white"
              />
            )
          })}
        </>
      )

    case '44-framed-scatter':
      return (
        <>
          <rect
            fill="var(--catalog-preview-1)"
            fillOpacity=".08"
            height="166"
            rx="14"
            stroke="var(--catalog-preview-1)"
            strokeWidth="3"
            width="270"
            x="9"
            y="13"
          />
          <Dots
            fill="var(--catalog-preview-1)"
            opacity={0.7}
            points={[
              [24, 30],
              [38, 48],
              [53, 39],
              [68, 61],
              [84, 54],
              [100, 75],
              [117, 66],
              [134, 89],
              [151, 80],
              [169, 104],
              [187, 95],
              [205, 121],
              [224, 111],
              [243, 141],
              [263, 156],
            ]}
          />
        </>
      )

    case '50-empirical-cdf':
      return (
        <path
          d="M8 170H28V160H47V151H67V139H87V124H106V110H126V93H146V76H165V61H185V48H205V37H224V28H244V21H280"
          fill="none"
          stroke="var(--catalog-preview-1)"
          strokeLinejoin="round"
          strokeWidth="5"
        />
      )

    case '51-faceted-distributions': {
      const facets = [
        { label: 'Adelie', top: 5, bins: [0, 7, 23, 42, 21, 7, 0, 0] },
        {
          label: 'Chinstrap',
          top: 65,
          bins: [0, 0, 5, 25, 42, 23, 5, 0],
        },
        { label: 'Gentoo', top: 125, bins: [0, 0, 2, 8, 20, 32, 42, 12] },
      ]
      return (
        <>
          <path
            d="M7 62H281M7 122H281"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="1"
          />
          {facets.map(({ bins, label, top }) => (
            <g fill="#8b5cf6" key={label}>
              <text fill="currentColor" fontSize="7" x="8" y={top + 13}>
                {label}
              </text>
              {bins.map((height, index) =>
                height === 0 ? null : (
                  <rect
                    height={height}
                    key={`${height}-${index}`}
                    opacity=".82"
                    width="24"
                    x={66 + index * 26.5}
                    y={top + 52 - height}
                  />
                ),
              )}
            </g>
          ))}
        </>
      )
    }

    case '52-beeswarm-dodge':
      return (
        <>
          <path d="M8 99H280" stroke="var(--catalog-preview-muted)" />
          <Dots
            fill="var(--catalog-preview-1)"
            points={[
              [24, 99, 5],
              [34, 91, 5],
              [34, 107, 5],
              [44, 83, 5],
              [44, 99, 5],
              [44, 115, 5],
              [55, 91, 5],
              [55, 107, 5],
              [67, 75, 5],
              [67, 91, 5],
              [67, 107, 5],
              [67, 123, 5],
              [79, 83, 5],
              [79, 99, 5],
              [79, 115, 5],
              [92, 67, 5],
              [92, 83, 5],
              [92, 99, 5],
              [92, 115, 5],
              [92, 131, 5],
              [105, 75, 5],
              [105, 91, 5],
              [105, 107, 5],
              [105, 123, 5],
              [119, 83, 5],
              [119, 99, 5],
              [119, 115, 5],
              [134, 75, 5],
              [134, 91, 5],
              [134, 107, 5],
              [134, 123, 5],
              [150, 83, 5],
              [150, 99, 5],
              [150, 115, 5],
              [167, 91, 5],
              [167, 107, 5],
              [185, 83, 5],
              [185, 99, 5],
              [185, 115, 5],
              [204, 91, 5],
              [204, 107, 5],
              [224, 99, 5],
              [245, 91, 5],
              [245, 107, 5],
              [266, 99, 5],
            ]}
            stroke="white"
          />
        </>
      )

    case '53-log-scale-scatter':
      return (
        <>
          <Dots
            fill="var(--catalog-preview-2)"
            opacity={0.72}
            points={[
              [18, 158],
              [24, 129],
              [31, 99],
              [39, 69],
              [48, 39],
              [59, 158],
              [68, 129],
              [78, 99],
              [89, 69],
              [102, 39],
              [116, 158],
              [130, 129],
              [145, 99],
              [161, 69],
              [178, 39],
              [196, 158],
              [216, 129],
              [238, 99],
              [263, 69],
            ]}
            stroke="currentColor"
          />
        </>
      )

    case '54-bump-ranking': {
      const series: ReadonlyArray<{
        color: string
        label: string
        points: ReadonlyArray<PreviewPoint>
      }> = [
        {
          color: '#2563eb',
          label: 'Wholesale and Retail Trade',
          points: [
            [8, 31],
            [47, 61],
            [86, 91],
            [125, 121],
            [164, 91],
            [203, 61],
            [241, 31],
          ],
        },
        {
          color: '#ea580c',
          label: 'Manufacturing',
          points: [
            [8, 61],
            [47, 31],
            [86, 61],
            [125, 91],
            [164, 121],
            [203, 91],
            [241, 61],
          ],
        },
        {
          color: '#059669',
          label: 'Leisure and hospitality',
          points: [
            [8, 91],
            [47, 91],
            [86, 31],
            [125, 31],
            [164, 61],
            [203, 121],
            [241, 91],
          ],
        },
        {
          color: '#7c3aed',
          label: 'Business services',
          points: [
            [8, 121],
            [47, 151],
            [86, 151],
            [125, 61],
            [164, 31],
            [203, 31],
            [241, 121],
          ],
        },
        {
          color: '#db2777',
          label: 'Construction',
          points: [
            [8, 151],
            [47, 121],
            [86, 121],
            [125, 151],
            [164, 151],
            [203, 151],
            [241, 151],
          ],
        },
      ]
      return (
        <>
          {series.map(({ color, label, points }) => (
            <g key={label}>
              <path
                d={points.reduce((path, [x, y], index) => {
                  if (index === 0) return `M${x} ${y}`
                  const previous = points[index - 1]
                  if (!previous) return path
                  const midpoint = (previous[0] + x) / 2
                  return `${path}C${midpoint} ${previous[1]} ${midpoint} ${y} ${x} ${y}`
                }, '')}
                fill="none"
                stroke={color}
                strokeLinejoin="round"
                strokeWidth="2.5"
              />
              <Dots fill={color} points={points} />
              <text
                fill={color}
                fontSize="4.5"
                textAnchor="end"
                x="282"
                y={points.at(-1)?.[1]}
              >
                {label}
              </text>
            </g>
          ))}
        </>
      )
    }

    case '55-indexed-multi-line':
      return (
        <>
          <path
            d="M7 97H281"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="2"
          />
          <text fill="var(--catalog-preview-muted)" fontSize="6" x="8" y="92">
            1.0
          </text>
          <path
            d="M7 97C37 77 60 89 91 55S141 69 173 43S224 51 245 31"
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
          />
          <path
            d="M7 97C37 115 61 103 92 128S143 112 173 143S225 126 245 151"
            fill="none"
            stroke="#ea580c"
            strokeWidth="3"
          />
          <path
            d="M7 97C38 92 62 117 92 86S141 98 173 76S223 93 245 72"
            fill="none"
            stroke="#059669"
            strokeWidth="3"
          />
          <path
            d="M7 97C36 66 63 74 92 42S143 35 173 60S222 55 245 48"
            fill="none"
            stroke="#7c3aed"
            strokeWidth="3"
          />
          <text fill="#2563eb" fontSize="5.5" x="249" y="34">
            Construction
          </text>
          <text fill="#7c3aed" fontSize="5.5" x="249" y="51">
            Finance
          </text>
          <text fill="#059669" fontSize="5.5" x="249" y="75">
            Government
          </text>
          <text fill="#ea580c" fontSize="5.5" x="249" y="154">
            Manufacturing
          </text>
        </>
      )

    case '56-connected-scatter':
      return (
        <>
          <path
            d="M40 139C52 101 81 69 115 82S153 139 190 124S243 70 236 40S177 27 154 54S129 116 94 128"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeWidth="4"
          />
          <Arrow
            color="var(--catalog-preview-1)"
            x1={67}
            x2={83}
            y1={86}
            y2={73}
          />
          <Arrow
            color="var(--catalog-preview-1)"
            x1={167}
            x2={185}
            y1={131}
            y2={125}
          />
          <Arrow
            color="var(--catalog-preview-1)"
            x1={188}
            x2={168}
            y1={35}
            y2={43}
          />
          <Dots
            points={[
              [40, 139],
              [70, 83],
              [115, 82],
              [151, 135],
              [190, 124],
              [236, 40],
              [184, 32],
              [154, 54],
              [94, 128],
            ]}
          />
          <text fill="currentColor" fontSize="7" x="28" y="151">
            1956
          </text>
          <text fill="currentColor" fontSize="7" x="232" y="32">
            1973
          </text>
          <text fill="currentColor" fontSize="7" x="147" y="48">
            1980
          </text>
        </>
      )

    case '57-scatter-marginal-histograms':
      return (
        <>
          <g fill="var(--catalog-preview-1)" opacity=".72">
            {[18, 30, 45, 38, 26, 14, 8].map((height, index) => (
              <rect
                height={height}
                key={index}
                width="25"
                x={28 + index * 27}
                y={48 - height}
              />
            ))}
          </g>
          <g fill="var(--catalog-preview-2)" opacity=".72">
            {[9, 17, 28, 39, 44, 36, 24, 12].map((width, index) => (
              <rect
                height="13"
                key={index}
                width={width}
                x="232"
                y={57 + index * 15}
              />
            ))}
          </g>
          <Dots
            fill="var(--catalog-preview-1)"
            opacity={0.76}
            points={[
              [35, 143],
              [49, 128],
              [63, 151],
              [78, 118],
              [92, 135],
              [108, 101],
              [123, 115],
              [139, 89],
              [154, 104],
              [171, 77],
              [187, 91],
              [205, 64],
            ]}
          />
          <Dots
            fill="var(--catalog-preview-2)"
            opacity={0.76}
            points={[
              [44, 92],
              [67, 81],
              [99, 74],
              [129, 138],
              [158, 128],
              [193, 117],
            ]}
          />
          <Dots
            fill="var(--catalog-preview-3)"
            opacity={0.76}
            points={[
              [58, 108],
              [85, 96],
              [116, 145],
              [145, 119],
              [177, 108],
              [211, 86],
            ]}
          />
        </>
      )

    case '58-select-extrema':
      return (
        <>
          <path
            d="M7 132C34 121 55 146 82 111S128 97 151 119S196 83 221 99S257 64 281 76"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeWidth="4"
          />
          <Dots
            fill="var(--catalog-preview-2)"
            points={[
              [55, 146, 7],
              [257, 64, 7],
            ]}
            stroke="white"
          />
          <text
            fill="var(--catalog-preview-2)"
            fontSize="9"
            fontWeight="600"
            x="34"
            y="165"
          >
            Low $56.25
          </text>
          <text
            fill="var(--catalog-preview-2)"
            fontSize="9"
            fontWeight="600"
            textAnchor="end"
            x="276"
            y="52"
          >
            High $190.04
          </text>
        </>
      )

    case '59-grouped-reducer-bars':
      return (
        <>
          <rect
            fill="var(--catalog-preview-1)"
            height="100"
            rx="4"
            width="58"
            x="28"
            y="67"
          />
          <rect
            fill="var(--catalog-preview-2)"
            height="101"
            rx="4"
            width="58"
            x="115"
            y="66"
          />
          <rect
            fill="var(--catalog-preview-3)"
            height="139"
            rx="4"
            width="58"
            x="202"
            y="28"
          />
          <text
            fill="currentColor"
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            x="57"
            y="59"
          >
            3,700.662
          </text>
          <text
            fill="currentColor"
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            x="144"
            y="58"
          >
            3,733.088
          </text>
          <text
            fill="currentColor"
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            x="231"
            y="20"
          >
            5,076.016
          </text>
          <text
            fill="white"
            fontSize="7"
            fontWeight="700"
            textAnchor="middle"
            x="57"
            y="158"
          >
            Adelie
          </text>
          <text
            fill="white"
            fontSize="7"
            fontWeight="700"
            textAnchor="middle"
            x="144"
            y="158"
          >
            Chinstrap
          </text>
          <text
            fill="white"
            fontSize="7"
            fontWeight="700"
            textAnchor="middle"
            x="231"
            y="158"
          >
            Gentoo
          </text>
        </>
      )

    case '60-lag-autocorrelation':
      return (
        <>
          <path
            d="M18 166L272 20"
            stroke="var(--catalog-preview-muted)"
            strokeDasharray="6 5"
            strokeWidth="2"
          />
          <Dots
            fill="var(--catalog-preview-3)"
            opacity={0.78}
            points={[
              [35, 145],
              [46, 151],
              [57, 133],
              [69, 141],
              [81, 122],
              [94, 129],
              [105, 109],
              [118, 116],
              [130, 96],
              [142, 104],
              [154, 84],
              [167, 92],
              [178, 71],
              [190, 80],
              [203, 59],
              [215, 67],
              [228, 47],
              [240, 55],
              [252, 35],
              [263, 42],
            ]}
          />
        </>
      )

    case '61-quantile-ribbon':
      return (
        <>
          <path
            d="M7 140C35 115 59 130 88 101S138 113 169 78S222 90 281 43L281 102C225 126 201 113 172 141S120 133 91 158S35 149 7 170Z"
            fill="var(--catalog-preview-1)"
            opacity=".24"
          />
          <path
            d="M7 155C35 134 60 143 89 127S139 126 171 108S224 108 281 72"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeWidth="4"
          />
        </>
      )

    case '62-ridgeline-density':
      return (
        <>
          {[55, 105, 155].map((baseline, index) => (
            <g key={baseline}>
              <path
                d={`M8 ${baseline}C34 ${baseline} 49 ${baseline - 38} 80 ${baseline - 38}S121 ${baseline - 2} 151 ${baseline - 2}S191 ${baseline - 29} 220 ${baseline - 29}S256 ${baseline} 280 ${baseline}Z`}
                fill={['#2563eb', '#0d9488', '#d97706'][index]}
                fillOpacity=".55"
                stroke={['#2563eb', '#0d9488', '#d97706'][index]}
                strokeWidth="1.5"
              />
              <path
                d={`M8 ${baseline}H280`}
                stroke="var(--catalog-preview-muted)"
                strokeOpacity=".55"
              />
            </g>
          ))}
        </>
      )

    case '63-violin-distributions':
      return (
        <>
          <path
            d="M62 19C45 45 48 69 36 95S43 144 62 173C81 144 88 121 79 95S79 45 62 19Z"
            fill="var(--catalog-preview-1)"
            fillOpacity=".55"
            stroke="var(--catalog-preview-1)"
            strokeWidth="2"
          />
          <path
            d="M144 27C125 49 130 75 115 99S124 148 144 166C164 148 173 123 159 99S163 49 144 27Z"
            fill="var(--catalog-preview-2)"
            fillOpacity=".55"
            stroke="var(--catalog-preview-2)"
            strokeWidth="2"
          />
          <path
            d="M226 15C207 43 213 73 198 101S207 150 226 177C245 150 254 127 239 101S245 43 226 15Z"
            fill="var(--catalog-preview-3)"
            fillOpacity=".55"
            stroke="var(--catalog-preview-3)"
            strokeWidth="2"
          />
          <path
            d="M49 96H75M131 104H157M213 92H239"
            stroke="currentColor"
            strokeWidth="3"
          />
          <Dots
            fill="var(--catalog-preview-1)"
            points={[[62, 96, 5]]}
            stroke="white"
          />
          <Dots
            fill="var(--catalog-preview-2)"
            points={[[144, 104, 5]]}
            stroke="white"
          />
          <Dots
            fill="var(--catalog-preview-3)"
            points={[[226, 92, 5]]}
            stroke="white"
          />
        </>
      )

    case '64-marimekko-mosaic': {
      const columns = [
        { label: 'Q1', x: 7, width: 55, heights: [15, 22, 55, 27, 31] },
        { label: 'Q2', x: 62, width: 52, heights: [36, 8, 44, 43, 19] },
        { label: 'Q3', x: 114, width: 56, heights: [12, 10, 71, 32, 25] },
        { label: 'Q4', x: 170, width: 55, heights: [9, 76, 32, 8, 25] },
        { label: 'Q5', x: 225, width: 56, heights: [16, 18, 31, 25, 60] },
      ]
      const responseColors = [
        '#991b1b',
        '#ef4444',
        '#cbd5e1',
        '#60a5fa',
        '#1d4ed8',
      ]
      return (
        <>
          {columns.map(({ heights, label, width, x }) => (
            <g key={label}>
              {heights.map((height, index) => (
                <rect
                  fill={responseColors[index]}
                  height={height}
                  key={index}
                  stroke="white"
                  strokeWidth="1.5"
                  width={width}
                  x={x}
                  y={
                    29 +
                    heights
                      .slice(0, index)
                      .reduce((total, value) => total + value, 0)
                  }
                />
              ))}
              <text
                fill="currentColor"
                fontSize="8"
                textAnchor="middle"
                x={x + width / 2}
                y="19"
              >
                {label}
              </text>
            </g>
          ))}
        </>
      )
    }

    case '65-voronoi-nearest-tooltip': {
      const cells = [
        'M7 8L49 12L55 58L7 64Z',
        'M49 12L96 7L104 56L55 58Z',
        'M96 7L143 11L148 61L104 56Z',
        'M143 11L191 7L196 57L148 61Z',
        'M191 7L237 13L242 62L196 57Z',
        'M237 13L281 8V65L242 62Z',
        'M7 64L55 58L50 119L7 126Z',
        'M55 58L104 56L100 121L50 119Z',
        'M104 56L148 61L151 116L100 121Z',
        'M148 61L196 57L201 123L151 116Z',
        'M196 57L242 62L235 118L201 123Z',
        'M242 62L281 65V125L235 118Z',
        'M7 126L50 119L54 184H7Z',
        'M50 119L100 121L102 184H54Z',
        'M100 121L151 116L149 184H102Z',
        'M151 116L201 123L198 184H149Z',
        'M201 123L235 118L244 184H198Z',
        'M235 118L281 125V184H244Z',
      ]
      const points: ReadonlyArray<PreviewPoint> = [
        [29, 32],
        [76, 29],
        [123, 34],
        [171, 31],
        [218, 35],
        [262, 34],
        [28, 91],
        [76, 88],
        [126, 91],
        [175, 88],
        [220, 91],
        [260, 94],
        [29, 153],
        [77, 151],
        [124, 150],
        [174, 151],
        [220, 153],
        [262, 151],
      ]
      const colors = ['#2563eb', '#0d9488', '#d97706']
      return (
        <>
          {cells.map((path, index) => (
            <path
              d={path}
              fill={colors[index % colors.length]}
              fillOpacity=".14"
              key={path}
              stroke="white"
              strokeWidth="1.25"
            />
          ))}
          {colors.map((color, colorIndex) => (
            <Dots
              fill={color}
              key={color}
              points={points.filter(
                (_, index) => index % colors.length === colorIndex,
              )}
              stroke="white"
            />
          ))}
          <circle
            cx="175"
            cy="88"
            fill="#0d9488"
            r="7"
            stroke="white"
            strokeWidth="2"
          />
        </>
      )
    }
  }

  return undefined
}
