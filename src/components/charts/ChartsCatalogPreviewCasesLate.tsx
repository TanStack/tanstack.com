export const chartsCatalogPreviewLateCaseIds = Object.freeze([
  '70-composed-chart',
  '71-recharts-population-pyramid',
  '72-recharts-mixed-bars',
  '73-many-point-scatter',
  '74-recharts-treemap',
  '75-radar',
  '76-pie',
  '77-donut',
  '78-gauge',
  '80-echarts-axis-pointer',
  '81-recharts-interactive-legend',
  '82-chart-table-selection',
  '83-focus-context-window',
  '84-pinned-nested-chart-tooltip',
  '85-scrollable-resource-lanes',
  '86-streaming-window-preservation',
  '87-echarts-synchronized-cursors',
  '88-echarts-free-cursor',
  '89-brush-range-selection',
  '90-zoomable-time-window',
  '91-timeline-playback-scrubber',
  '92-editable-event-range',
  '93-labeled-pie',
  '94-center-donut',
  '95-rounded-donut',
  '96-nested-donut',
  '97-rose',
  '98-needle-gauge',
  '99-comparative-radar',
  '100-radial-bars',
  '101-sunburst',
  '102-world-choropleth',
  '103-bubble-map',
  '104-orthographic-globe',
  '105-route-map',
  '106-polar-line',
  '107-polar-scatter',
  '108-country-choropleth',
  '109-us-state-choropleth',
  '110-projection-gallery',
  '111-basic-sankey',
  '111-sankey-flow',
  '112-motion-entrance',
  '113-motion-updates',
  '114-spring-line-motion',
  '115-definition-motion',
  '116-geometry-morph',
  '117-focus-cursor-motion',
  '118-token-usage-calendar',
  '119-stacked-bar-band-cursor',
])

const worldLandPath =
  'M12 66L20 51L36 42L48 29L68 24L84 31L98 28L111 37L106 49L94 53L90 66L78 72L73 84L63 90L57 104L44 102L37 91L24 85ZM78 88L91 96L96 112L91 129L84 147L75 169L66 158L65 139L55 120L61 102ZM110 25L119 16L129 19L126 31L115 34ZM119 51L131 42L143 43L151 35L164 37L174 31L194 35L207 42L224 43L238 52L253 55L274 68L267 80L249 82L239 75L225 79L213 72L202 77L190 69L180 72L171 62L158 64L148 57L136 61ZM128 67L143 64L158 72L167 90L160 106L151 111L146 130L137 151L126 139L119 118L111 99L114 80ZM198 86L209 82L218 91L213 103L202 101ZM222 119L238 111L257 116L271 132L262 148L243 153L226 143L216 130ZM268 154L276 151L280 159L273 164Z'

const unitedStatesLandPath =
  'M31 50L48 39L69 37L86 43L105 41L123 45L143 42L161 48L181 47L198 54L215 57L226 67L244 65L257 76L267 74L271 88L262 97L255 110L245 111L239 126L228 137L214 135L204 143L188 140L177 148L160 143L144 150L127 146L110 151L95 141L78 137L67 126L54 125L49 110L40 101L43 89L34 79Z'

export function getChartsCatalogPreviewLate(caseId: string) {
  switch (caseId) {
    case '70-composed-chart':
      return (
        <g data-preview-geometry="composed-weather-bars-wind-temperature">
          <path
            d="M18 153V111L68 93L118 105L168 70L218 79L270 43V153Z"
            fill="var(--catalog-preview-3)"
            opacity=".22"
          />
          <path
            d="M18 111L68 93L118 105L168 70L218 79L270 43"
            fill="none"
            stroke="var(--catalog-preview-3)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          <path
            d="M28 153V126H48V153ZM72 153V110H92V153ZM116 153V132H136V153ZM160 153V100H180V153ZM204 153V117H224V153ZM248 153V88H268V153Z"
            fill="var(--catalog-preview-1)"
            opacity=".72"
          />
          <path
            d="M38 83L82 69L126 84L170 48L214 60L258 30"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          <path
            d="M38 78a5 5 0 1 1 0 10a5 5 0 1 1 0-10M82 64a5 5 0 1 1 0 10a5 5 0 1 1 0-10M126 79a5 5 0 1 1 0 10a5 5 0 1 1 0-10M170 43a5 5 0 1 1 0 10a5 5 0 1 1 0-10M214 55a5 5 0 1 1 0 10a5 5 0 1 1 0-10M258 25a5 5 0 1 1 0 10a5 5 0 1 1 0-10"
            fill="var(--catalog-preview-2)"
          />
        </g>
      )
    case '71-recharts-population-pyramid':
      return (
        <g data-preview-geometry="population-pyramid">
          <path
            d="M144 29V166"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="2"
          />
          <path
            d="M53 42H144V68H53ZM78 83H144V109H78ZM29 124H144V150H29Z"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M144 42H230V68H144ZM144 83H207V109H144ZM144 124H258V150H144Z"
            fill="var(--catalog-preview-2)"
          />
        </g>
      )
    case '72-recharts-mixed-bars':
      return (
        <g data-preview-geometry="mixed-stacked-grouped-bars">
          <path
            d="M16 158V134H31V158ZM54 158V144H69V158ZM92 158V60H107V158ZM130 158V119H145V158ZM168 158V110H183V158ZM206 158V120H221V158ZM244 158V115H259V158Z"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M16 134V110H31V134ZM54 144V122H69V144ZM92 60V37H107V60ZM130 119V99H145V119ZM168 110V88H183V110ZM206 120V95H221V120ZM244 115V94H259V115Z"
            fill="var(--catalog-preview-2)"
          />
          <path
            d="M33 158V118H48V158ZM71 158V128H86V158ZM109 158V138H124V158ZM147 158V130H162V158ZM185 158V139H200V158ZM223 158V134H238V158ZM261 158V123H276V158Z"
            fill="var(--catalog-preview-3)"
          />
        </g>
      )
    case '73-many-point-scatter':
      return (
        <g data-preview-geometry="dense-multicolor-car-scatter">
          <path
            d="M24 142a3 3 0 1 1 0 6a3 3 0 1 1 0-6M37 130a5 5 0 1 1 0 10a5 5 0 1 1 0-10M52 148a4 4 0 1 1 0 8a4 4 0 1 1 0-8M63 119a6 6 0 1 1 0 12a6 6 0 1 1 0-12M78 136a3 3 0 1 1 0 6a3 3 0 1 1 0-6M91 107a4 4 0 1 1 0 8a4 4 0 1 1 0-8M108 126a5 5 0 1 1 0 10a5 5 0 1 1 0-10M122 91a3 3 0 1 1 0 6a3 3 0 1 1 0-6M140 112a6 6 0 1 1 0 12a6 6 0 1 1 0-12M155 76a4 4 0 1 1 0 8a4 4 0 1 1 0-8M174 97a3 3 0 1 1 0 6a3 3 0 1 1 0-6M190 66a5 5 0 1 1 0 10a5 5 0 1 1 0-10M211 83a4 4 0 1 1 0 8a4 4 0 1 1 0-8M230 48a6 6 0 1 1 0 12a6 6 0 1 1 0-12M250 64a3 3 0 1 1 0 6a3 3 0 1 1 0-6M267 34a5 5 0 1 1 0 10a5 5 0 1 1 0-10"
            fill="var(--catalog-preview-1)"
            opacity=".76"
          />
          <path
            d="M29 111a5 5 0 1 1 0 10a5 5 0 1 1 0-10M48 98a3 3 0 1 1 0 6a3 3 0 1 1 0-6M70 83a4 4 0 1 1 0 8a4 4 0 1 1 0-8M97 80a6 6 0 1 1 0 12a6 6 0 1 1 0-12M119 64a4 4 0 1 1 0 8a4 4 0 1 1 0-8M145 54a3 3 0 1 1 0 6a3 3 0 1 1 0-6M168 42a5 5 0 1 1 0 10a5 5 0 1 1 0-10M195 36a4 4 0 1 1 0 8a4 4 0 1 1 0-8M220 26a6 6 0 1 1 0 12a6 6 0 1 1 0-12M245 39a3 3 0 1 1 0 6a3 3 0 1 1 0-6M261 91a5 5 0 1 1 0 10a5 5 0 1 1 0-10"
            fill="var(--catalog-preview-2)"
            opacity=".78"
          />
          <path
            d="M41 155a4 4 0 1 1 0 8a4 4 0 1 1 0-8M59 146a3 3 0 1 1 0 6a3 3 0 1 1 0-6M84 113a5 5 0 1 1 0 10a5 5 0 1 1 0-10M114 139a4 4 0 1 1 0 8a4 4 0 1 1 0-8M132 78a6 6 0 1 1 0 12a6 6 0 1 1 0-12M161 123a3 3 0 1 1 0 6a3 3 0 1 1 0-6M183 107a5 5 0 1 1 0 10a5 5 0 1 1 0-10M207 119a4 4 0 1 1 0 8a4 4 0 1 1 0-8M235 99a3 3 0 1 1 0 6a3 3 0 1 1 0-6M267 127a6 6 0 1 1 0 12a6 6 0 1 1 0-12"
            fill="var(--catalog-preview-3)"
            opacity=".72"
          />
        </g>
      )
    case '74-recharts-treemap':
      return (
        <g data-preview-geometry="flare-analytics-class-treemap">
          <path
            d="M14 20H118V104H14ZM121 20H202V65H121ZM205 20H274V65H205Z"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M121 68H166V172H121ZM169 68H226V119H169ZM229 68H274V119H229Z"
            fill="var(--catalog-preview-2)"
          />
          <path
            d="M14 107H68V172H14ZM71 107H118V172H71ZM169 122H219V172H169ZM222 122H274V172H222Z"
            fill="var(--catalog-preview-3)"
            opacity=".75"
          />
          <g fill="currentColor" fontSize="6.5" fontWeight="650" opacity=".78">
            <text x="19" y="34">
              AgglomerativeCluster
            </text>
            <text x="126" y="34">
              CommunityStructure
            </text>
            <text x="210" y="34">
              HierarchicalCluster
            </text>
            <text x="126" y="82">
              MergeEdge
            </text>
            <text x="174" y="82">
              BetweennessCentrality
            </text>
            <text x="234" y="82">
              LinkDistance
            </text>
            <text x="19" y="121">
              MaxFlowMinCut
            </text>
            <text x="76" y="121">
              ShortestPaths
            </text>
            <text x="174" y="137">
              SpanningTree
            </text>
            <text x="227" y="137">
              AspectRatioBanker
            </text>
          </g>
        </g>
      )
    case '75-radar':
      return (
        <g data-preview-geometry="four-event-radar-with-value-rings">
          <path
            d="M144 20L222 96L144 172L66 96ZM144 39L202 96L144 153L86 96ZM144 58L183 96L144 134L105 96ZM144 77L163 96L144 115L125 96ZM144 20V172M66 96H222"
            fill="none"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="1.5"
          />
          <path
            d="M144 31L194 96L144 146L83 96Z"
            fill="var(--catalog-preview-1)"
            fillOpacity=".28"
            stroke="var(--catalog-preview-1)"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <g fill="currentColor" fontSize="8" opacity=".68">
            <text textAnchor="middle" x="144" y="13">
              100m
            </text>
            <text x="226" y="99">
              Long jump
            </text>
            <text textAnchor="middle" x="144" y="186">
              Shot put
            </text>
            <text textAnchor="end" x="62" y="99">
              High jump
            </text>
            <text x="148" y="79">
              25
            </text>
            <text x="148" y="60">
              50
            </text>
            <text x="148" y="41">
              75
            </text>
          </g>
        </g>
      )
    case '76-pie':
      return (
        <g data-preview-geometry="pie">
          <circle
            cx="144"
            cy="96"
            fill="none"
            r="36"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="72"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="36"
            stroke="var(--catalog-preview-1)"
            strokeDasharray="38 62"
            strokeWidth="72"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="36"
            stroke="var(--catalog-preview-2)"
            strokeDasharray="27 73"
            strokeDashoffset="-38"
            strokeWidth="72"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="36"
            stroke="var(--catalog-preview-3)"
            strokeDasharray="18 82"
            strokeDashoffset="-65"
            strokeWidth="72"
            transform="rotate(-90 144 96)"
          />
        </g>
      )
    case '77-donut':
      return (
        <g data-preview-geometry="five-sector-donut">
          <circle
            cx="144"
            cy="96"
            fill="none"
            r="59"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="28"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="59"
            stroke="var(--catalog-preview-1)"
            strokeDasharray="30 70"
            strokeWidth="28"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="59"
            stroke="var(--catalog-preview-2)"
            strokeDasharray="24 76"
            strokeDashoffset="-30"
            strokeWidth="28"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="59"
            stroke="var(--catalog-preview-3)"
            strokeDasharray="19 81"
            strokeDashoffset="-54"
            strokeWidth="28"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="59"
            stroke="var(--catalog-preview-1)"
            strokeDasharray="16 84"
            strokeDashoffset="-73"
            strokeOpacity=".58"
            strokeWidth="28"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="59"
            stroke="var(--catalog-preview-2)"
            strokeDasharray="11 89"
            strokeDashoffset="-89"
            strokeOpacity=".58"
            strokeWidth="28"
            transform="rotate(-90 144 96)"
          />
        </g>
      )
    case '78-gauge':
      return (
        <g data-preview-geometry="two-segment-270-degree-gauge">
          <path
            d="M75 166A97 97 0 1 1 227 47"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeLinecap="round"
            strokeWidth="28"
          />
          <path
            d="M227 47A97 97 0 0 1 213 166"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeWidth="28"
          />
        </g>
      )
    case '80-echarts-axis-pointer':
      return (
        <g data-preview-geometry="three-series-eight-points-grouped-guide">
          <path
            d="M18 145L54 127L90 135L126 99L162 110L198 72L234 82L270 49M18 118L54 101L90 112L126 78L162 92L198 55L234 68L270 36M18 91L54 77L90 88L126 60L162 71L198 38L234 50L270 25"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeOpacity=".72"
            strokeWidth="3"
          />
          <path
            d="M18 141a4 4 0 1 1 0 8a4 4 0 1 1 0-8M54 123a4 4 0 1 1 0 8a4 4 0 1 1 0-8M90 131a4 4 0 1 1 0 8a4 4 0 1 1 0-8M126 95a4 4 0 1 1 0 8a4 4 0 1 1 0-8M162 106a4 4 0 1 1 0 8a4 4 0 1 1 0-8M198 68a4 4 0 1 1 0 8a4 4 0 1 1 0-8M234 78a4 4 0 1 1 0 8a4 4 0 1 1 0-8M270 45a4 4 0 1 1 0 8a4 4 0 1 1 0-8"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M18 114a4 4 0 1 1 0 8a4 4 0 1 1 0-8M54 97a4 4 0 1 1 0 8a4 4 0 1 1 0-8M90 108a4 4 0 1 1 0 8a4 4 0 1 1 0-8M126 74a4 4 0 1 1 0 8a4 4 0 1 1 0-8M162 88a4 4 0 1 1 0 8a4 4 0 1 1 0-8M198 51a4 4 0 1 1 0 8a4 4 0 1 1 0-8M234 64a4 4 0 1 1 0 8a4 4 0 1 1 0-8M270 32a4 4 0 1 1 0 8a4 4 0 1 1 0-8"
            fill="var(--catalog-preview-2)"
          />
          <path
            d="M18 87a4 4 0 1 1 0 8a4 4 0 1 1 0-8M54 73a4 4 0 1 1 0 8a4 4 0 1 1 0-8M90 84a4 4 0 1 1 0 8a4 4 0 1 1 0-8M126 56a4 4 0 1 1 0 8a4 4 0 1 1 0-8M162 67a4 4 0 1 1 0 8a4 4 0 1 1 0-8M198 34a4 4 0 1 1 0 8a4 4 0 1 1 0-8M234 46a4 4 0 1 1 0 8a4 4 0 1 1 0-8M270 21a4 4 0 1 1 0 8a4 4 0 1 1 0-8"
            fill="var(--catalog-preview-3)"
          />
          <rect
            fill="var(--catalog-preview-2)"
            fillOpacity=".08"
            height="150"
            width="18"
            x="153"
            y="18"
          />
          <path
            d="M162 18V168"
            stroke="var(--catalog-preview-muted)"
            strokeDasharray="4 4"
            strokeWidth="2"
          />
          <rect
            fill="Canvas"
            height="48"
            rx="7"
            stroke="var(--catalog-preview-muted)"
            width="76"
            x="181"
            y="111"
          />
          <path
            d="M191 124H245M191 136H251M191 148H238"
            stroke="currentColor"
            strokeLinecap="round"
            strokeOpacity=".6"
            strokeWidth="3"
          />
        </g>
      )
    case '81-recharts-interactive-legend':
      return (
        <g data-preview-geometry="manufacturing-construction-interactive-legend">
          <g fontSize="9" fontWeight="600">
            <rect
              fill="var(--catalog-preview-1)"
              height="20"
              rx="10"
              width="92"
              x="47"
              y="18"
            />
            <text fill="Canvas" textAnchor="middle" x="93" y="32">
              Manufacturing
            </text>
            <rect
              fill="var(--catalog-preview-2)"
              height="20"
              rx="10"
              width="88"
              x="149"
              y="18"
            />
            <text fill="Canvas" textAnchor="middle" x="193" y="32">
              Construction
            </text>
          </g>
          <path
            d="M18 144C47 128 65 80 94 94S136 132 164 86S211 65 270 38"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeLinecap="round"
            strokeWidth="4"
          />
          <path
            d="M18 112C49 93 72 122 101 105S149 55 180 74S224 119 270 82"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </g>
      )
    case '82-chart-table-selection':
      return (
        <g data-preview-geometry="five-point-scatter-table-selection">
          <path
            d="M35 73a6 6 0 1 1 0 12a6 6 0 1 1 0-12M77 44a7 7 0 1 1 0 14a7 7 0 1 1 0-14M122 66a5 5 0 1 1 0 10a5 5 0 1 1 0-10M169 31a8 8 0 1 1 0 16a8 8 0 1 1 0-16M232 53a6 6 0 1 1 0 12a6 6 0 1 1 0-12"
            fill="var(--catalog-preview-1)"
          />
          <circle
            cx="169"
            cy="39"
            fill="var(--catalog-preview-2)"
            r="10"
            stroke="Canvas"
            strokeWidth="3"
          />
          <path
            d="M18 111H270M18 136H270M18 161H270"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="1"
          />
          <rect
            fill="var(--catalog-preview-2)"
            fillOpacity=".18"
            height="24"
            rx="3"
            width="252"
            x="18"
            y="136"
          />
          <path
            d="M29 123H84M107 123H151M183 123H248M29 148H76M107 148H159M183 148H238M29 173H93M107 173H148M183 173H254"
            stroke="currentColor"
            strokeLinecap="round"
            strokeOpacity=".48"
            strokeWidth="3"
          />
        </g>
      )
    case '83-focus-context-window':
      return (
        <g data-preview-geometry="focus-context-brush">
          <path
            d="M16 109C37 84 58 100 78 68S117 48 137 75S173 101 195 59S234 70 272 28"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeWidth="4"
          />
          <path
            d="M16 168C43 157 65 164 89 150S132 163 156 146S203 160 272 135"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeOpacity=".7"
            strokeWidth="2.5"
          />
          <rect
            fill="var(--catalog-preview-1)"
            fillOpacity=".12"
            height="43"
            rx="3"
            stroke="var(--catalog-preview-1)"
            width="98"
            x="117"
            y="126"
          />
          <path
            d="M117 126V169M215 126V169"
            stroke="var(--catalog-preview-1)"
            strokeWidth="4"
          />
        </g>
      )
    case '84-pinned-nested-chart-tooltip':
      return (
        <g data-preview-geometry="consumption-generation-mix-pinned-tooltip">
          <path
            d="M14 158V102L27 92L40 108L53 75L66 87L79 63L92 79L105 53L118 68L131 45L144 59L158 35V158Z"
            fill="var(--catalog-preview-1)"
            fillOpacity=".16"
          />
          <path
            d="M14 102L27 92L40 108L53 75L66 87L79 63L92 79L105 53L118 68L131 45L144 59L158 35"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeWidth="3"
          />
          <path
            d="M15 158V143H22V158ZM28 158V137H35V158ZM41 158V146H48V158ZM54 158V132H61V158ZM67 158V140H74V158ZM80 158V128H87V158ZM93 158V137H100V158ZM106 158V123H113V158ZM119 158V133H126V158ZM132 158V119H139V158ZM145 158V129H152V158ZM158 158V114H165V158Z"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M15 143V130H22V143ZM28 137V123H35V137ZM41 146V134H48V146ZM54 132V115H61V132ZM67 140V122H74V140ZM80 128V109H87V128ZM93 137V119H100V137ZM106 123V102H113V123ZM119 133V112H126V133ZM132 119V98H139V119ZM145 129V106H152V129ZM158 114V91H165V114Z"
            fill="var(--catalog-preview-2)"
          />
          <path
            d="M15 130V121H22V130ZM28 123V113H35V123ZM41 134V126H48V134ZM54 115V104H61V115ZM67 122V111H74V122ZM80 109V96H87V109ZM93 119V108H100V119ZM106 102V89H113V102ZM119 112V99H126V112ZM132 98V84H139V98ZM145 106V92H152V106ZM158 91V77H165V91Z"
            fill="var(--catalog-preview-3)"
          />
          <circle
            cx="131"
            cy="45"
            fill="var(--catalog-preview-2)"
            r="6"
            stroke="Canvas"
            strokeWidth="3"
          />
          <rect
            fill="Canvas"
            height="126"
            rx="8"
            stroke="var(--catalog-preview-muted)"
            width="98"
            x="176"
            y="33"
          />
          <g fill="currentColor" fontSize="8">
            <text fontWeight="700" x="186" y="49">
              12:00
            </text>
            <text opacity=".65" x="186" y="65">
              Consumption
            </text>
            <text fontWeight="700" textAnchor="end" x="264" y="65">
              5.8 kW
            </text>
            <text fontWeight="700" x="186" y="84">
              Generation mix
            </text>
            <text opacity=".65" x="196" y="101">
              Solar
            </text>
            <text textAnchor="end" x="264" y="101">
              48%
            </text>
            <text opacity=".65" x="196" y="117">
              Wind
            </text>
            <text textAnchor="end" x="264" y="117">
              32%
            </text>
            <text opacity=".65" x="196" y="133">
              Grid
            </text>
            <text textAnchor="end" x="264" y="133">
              20%
            </text>
          </g>
          <path
            d="M186 98H191M186 114H191M186 130H191"
            stroke="var(--catalog-preview-2)"
            strokeWidth="4"
          />
        </g>
      )
    case '85-scrollable-resource-lanes':
      return (
        <g data-preview-geometry="five-named-resource-lanes-tasks">
          <rect
            fill="var(--catalog-preview-muted)"
            fillOpacity=".18"
            height="155"
            rx="5"
            width="52"
            x="12"
            y="18"
          />
          <path
            d="M64 49H276M64 80H276M64 111H276M64 142H276M64 173H276"
            stroke="var(--catalog-preview-muted)"
            strokeOpacity=".5"
          />
          <path
            d="M73 27H139V43H73ZM109 58H190V74H109ZM151 89H236V105H151ZM86 120H173V136H86ZM181 151H267V167H181Z"
            fill="var(--catalog-preview-1)"
            opacity=".78"
          />
          <path
            d="M109 58H190V74H109ZM86 120H173V136H86Z"
            fill="var(--catalog-preview-2)"
          />
          <g fill="currentColor" fontSize="6" fontWeight="650" opacity=".68">
            <text x="15" y="38">
              Design
            </text>
            <text x="15" y="69">
              Infrastructure
            </text>
            <text x="15" y="100">
              API
            </text>
            <text x="15" y="131">
              Quality
            </text>
            <text x="15" y="162">
              Docs
            </text>
          </g>
        </g>
      )
    case '86-streaming-window-preservation':
      return (
        <g data-preview-geometry="locked-streaming-window">
          <rect
            fill="var(--catalog-preview-1)"
            fillOpacity=".08"
            height="143"
            rx="6"
            stroke="var(--catalog-preview-muted)"
            width="219"
            x="16"
            y="24"
          />
          <path
            d="M18 142C39 128 57 148 76 117S111 125 130 91S165 103 185 68S216 77 233 49"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeWidth="4"
          />
          <path
            d="M18 138a4 4 0 1 1 0 8a4 4 0 1 1 0-8M49 130a4 4 0 1 1 0 8a4 4 0 1 1 0-8M76 113a4 4 0 1 1 0 8a4 4 0 1 1 0-8M108 117a4 4 0 1 1 0 8a4 4 0 1 1 0-8M130 87a4 4 0 1 1 0 8a4 4 0 1 1 0-8M164 91a4 4 0 1 1 0 8a4 4 0 1 1 0-8M185 64a4 4 0 1 1 0 8a4 4 0 1 1 0-8M233 45a4 4 0 1 1 0 8a4 4 0 1 1 0-8"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M235 24V167"
            stroke="var(--catalog-preview-2)"
            strokeDasharray="4 4"
            strokeWidth="2"
          />
          <path
            d="M246 116C256 102 264 108 274 88"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeWidth="4"
          />
          <path
            d="M250 39H271M264 32L272 39L264 46"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        </g>
      )
    case '87-echarts-synchronized-cursors':
      return (
        <g data-preview-geometry="synchronized-cursors">
          <path
            d="M16 76C45 63 67 81 93 50S137 69 165 39S219 57 272 25M16 168C47 149 70 167 98 137S143 159 172 126S222 142 272 112"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeWidth="3.5"
          />
          <path
            d="M16 96H272"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="1"
          />
          <path
            d="M16 72a4 4 0 1 1 0 8a4 4 0 1 1 0-8M52 60a4 4 0 1 1 0 8a4 4 0 1 1 0-8M88 50a4 4 0 1 1 0 8a4 4 0 1 1 0-8M124 56a4 4 0 1 1 0 8a4 4 0 1 1 0-8M160 38a4 4 0 1 1 0 8a4 4 0 1 1 0-8M196 48a4 4 0 1 1 0 8a4 4 0 1 1 0-8M232 42a4 4 0 1 1 0 8a4 4 0 1 1 0-8M272 21a4 4 0 1 1 0 8a4 4 0 1 1 0-8M16 164a4 4 0 1 1 0 8a4 4 0 1 1 0-8M52 149a4 4 0 1 1 0 8a4 4 0 1 1 0-8M88 137a4 4 0 1 1 0 8a4 4 0 1 1 0-8M124 148a4 4 0 1 1 0 8a4 4 0 1 1 0-8M160 126a4 4 0 1 1 0 8a4 4 0 1 1 0-8M196 136a4 4 0 1 1 0 8a4 4 0 1 1 0-8M232 129a4 4 0 1 1 0 8a4 4 0 1 1 0-8M272 108a4 4 0 1 1 0 8a4 4 0 1 1 0-8"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M179 17V176"
            stroke="var(--catalog-preview-2)"
            strokeDasharray="4 3"
            strokeWidth="2"
          />
          <path
            d="M179 32a6 6 0 1 1 0 12a6 6 0 1 1 0-12M179 119a6 6 0 1 1 0 12a6 6 0 1 1 0-12"
            fill="var(--catalog-preview-2)"
            stroke="Canvas"
            strokeWidth="2"
          />
        </g>
      )
    case '88-echarts-free-cursor':
      return (
        <g data-preview-geometry="six-car-scatter-free-crosshair">
          <path
            d="M40 132a6 6 0 1 1 0 12a6 6 0 1 1 0-12M82 109a7 7 0 1 1 0 14a7 7 0 1 1 0-14M124 88a5 5 0 1 1 0 10a5 5 0 1 1 0-10M169 72a8 8 0 1 1 0 16a8 8 0 1 1 0-16M218 54a6 6 0 1 1 0 12a6 6 0 1 1 0-12M257 29a5 5 0 1 1 0 10a5 5 0 1 1 0-10"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M169 23V167M16 78H272"
            stroke="var(--catalog-preview-muted)"
            strokeDasharray="4 4"
            strokeWidth="2"
          />
          <circle
            cx="169"
            cy="78"
            fill="Canvas"
            r="7"
            stroke="var(--catalog-preview-2)"
            strokeWidth="3"
          />
          <rect
            fill="Canvas"
            height="18"
            rx="4"
            stroke="var(--catalog-preview-muted)"
            width="60"
            x="139"
            y="19"
          />
          <rect
            fill="Canvas"
            height="18"
            rx="4"
            stroke="var(--catalog-preview-muted)"
            width="39"
            x="12"
            y="69"
          />
          <g fill="currentColor" fontSize="8" opacity=".72" textAnchor="middle">
            <text x="169" y="31">
              101.8 HP
            </text>
            <text x="31" y="81">
              20.8 MPG
            </text>
          </g>
        </g>
      )
    case '89-brush-range-selection':
      return (
        <g data-preview-geometry="brush-selection">
          <path
            d="M16 144C38 127 55 139 77 111S115 121 136 89S174 102 198 65S239 75 272 34"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeWidth="4"
          />
          <path
            d="M16 140a4 4 0 1 1 0 8a4 4 0 1 1 0-8M38 125a4 4 0 1 1 0 8a4 4 0 1 1 0-8M61 126a4 4 0 1 1 0 8a4 4 0 1 1 0-8M83 103a4 4 0 1 1 0 8a4 4 0 1 1 0-8M106 111a4 4 0 1 1 0 8a4 4 0 1 1 0-8M129 87a4 4 0 1 1 0 8a4 4 0 1 1 0-8M152 91a4 4 0 1 1 0 8a4 4 0 1 1 0-8M175 84a4 4 0 1 1 0 8a4 4 0 1 1 0-8M198 61a4 4 0 1 1 0 8a4 4 0 1 1 0-8M222 65a4 4 0 1 1 0 8a4 4 0 1 1 0-8M247 51a4 4 0 1 1 0 8a4 4 0 1 1 0-8M272 30a4 4 0 1 1 0 8a4 4 0 1 1 0-8"
            fill="var(--catalog-preview-1)"
          />
          <rect
            fill="var(--catalog-preview-1)"
            fillOpacity=".15"
            height="143"
            rx="3"
            stroke="var(--catalog-preview-1)"
            width="105"
            x="101"
            y="24"
          />
          <path
            d="M101 24V167M206 24V167"
            stroke="var(--catalog-preview-1)"
            strokeWidth="5"
          />
          <rect
            fill="Canvas"
            height="28"
            rx="5"
            stroke="var(--catalog-preview-1)"
            width="11"
            x="95.5"
            y="80"
          />
          <rect
            fill="Canvas"
            height="28"
            rx="5"
            stroke="var(--catalog-preview-1)"
            width="11"
            x="200.5"
            y="80"
          />
        </g>
      )
    case '90-zoomable-time-window':
      return (
        <g data-preview-geometry="zoom-pan-window">
          <path
            d="M17 147C35 127 47 141 65 104S96 123 112 82S143 102 161 62S193 83 213 48S246 57 272 27"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeWidth="4"
          />
          <path
            d="M17 143a4 4 0 1 1 0 8a4 4 0 1 1 0-8M40 127a4 4 0 1 1 0 8a4 4 0 1 1 0-8M64 100a4 4 0 1 1 0 8a4 4 0 1 1 0-8M88 111a4 4 0 1 1 0 8a4 4 0 1 1 0-8M112 78a4 4 0 1 1 0 8a4 4 0 1 1 0-8M136 88a4 4 0 1 1 0 8a4 4 0 1 1 0-8M160 58a4 4 0 1 1 0 8a4 4 0 1 1 0-8M184 69a4 4 0 1 1 0 8a4 4 0 1 1 0-8M208 46a4 4 0 1 1 0 8a4 4 0 1 1 0-8M232 48a4 4 0 1 1 0 8a4 4 0 1 1 0-8M252 38a4 4 0 1 1 0 8a4 4 0 1 1 0-8M272 23a4 4 0 1 1 0 8a4 4 0 1 1 0-8"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M72 165H216M72 165L84 156M72 165L84 174M216 165L204 156M216 165L204 174"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <circle
            cx="250"
            cy="42"
            fill="none"
            r="13"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="2"
          />
          <path
            d="M259 52L270 63M244 42H256M250 36V48"
            stroke="var(--catalog-preview-muted)"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </g>
      )
    case '91-timeline-playback-scrubber':
      return (
        <g data-preview-geometry="playback-scrubber">
          <path
            d="M17 120C40 104 58 116 79 88S116 101 138 69S177 84 199 50S240 62 272 28"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeWidth="4"
          />
          <path
            d="M17 116a4 4 0 1 1 0 8a4 4 0 1 1 0-8M54 105a4 4 0 1 1 0 8a4 4 0 1 1 0-8M91 84a4 4 0 1 1 0 8a4 4 0 1 1 0-8M128 71a4 4 0 1 1 0 8a4 4 0 1 1 0-8M165 70a4 4 0 1 1 0 8a4 4 0 1 1 0-8M202 46a4 4 0 1 1 0 8a4 4 0 1 1 0-8M239 56a4 4 0 1 1 0 8a4 4 0 1 1 0-8M272 24a4 4 0 1 1 0 8a4 4 0 1 1 0-8"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M180 22V137"
            stroke="var(--catalog-preview-2)"
            strokeWidth="3"
          />
          <circle
            cx="180"
            cy="61"
            fill="var(--catalog-preview-2)"
            r="7"
            stroke="Canvas"
            strokeWidth="2"
          />
          <path
            d="M46 163H255"
            stroke="var(--catalog-preview-muted)"
            strokeLinecap="round"
            strokeWidth="6"
          />
          <path
            d="M46 163H180"
            stroke="var(--catalog-preview-1)"
            strokeLinecap="round"
            strokeWidth="6"
          />
          <circle
            cx="180"
            cy="163"
            fill="Canvas"
            r="8"
            stroke="var(--catalog-preview-1)"
            strokeWidth="3"
          />
          <path d="M19 150L34 163L19 176Z" fill="var(--catalog-preview-2)" />
        </g>
      )
    case '92-editable-event-range':
      return (
        <g data-preview-geometry="four-named-editable-event-lanes">
          <path
            d="M64 51H274M64 89H274M64 127H274M64 165H274"
            stroke="var(--catalog-preview-muted)"
            strokeOpacity=".5"
          />
          <rect
            fill="var(--catalog-preview-1)"
            fillOpacity=".75"
            height="24"
            rx="5"
            width="87"
            x="78"
            y="21"
          />
          <rect
            fill="var(--catalog-preview-2)"
            height="24"
            rx="5"
            width="96"
            x="122"
            y="59"
          />
          <rect
            fill="var(--catalog-preview-3)"
            height="24"
            rx="5"
            width="72"
            x="91"
            y="97"
          />
          <rect
            fill="var(--catalog-preview-1)"
            fillOpacity=".72"
            height="24"
            rx="5"
            width="81"
            x="174"
            y="135"
          />
          <rect
            fill="Canvas"
            height="32"
            rx="5"
            stroke="var(--catalog-preview-1)"
            strokeWidth="2"
            width="9"
            x="86"
            y="93"
          />
          <rect
            fill="Canvas"
            height="32"
            rx="5"
            stroke="var(--catalog-preview-1)"
            strokeWidth="2"
            width="9"
            x="159"
            y="93"
          />
          <g fill="currentColor" fontSize="7.5" fontWeight="650" opacity=".7">
            <text x="14" y="36">
              Product
            </text>
            <text x="14" y="74">
              Design
            </text>
            <text x="14" y="112">
              Marketing
            </text>
            <text x="14" y="150">
              Engineering
            </text>
          </g>
          <g fill="Canvas" fontSize="7.5" fontWeight="700" textAnchor="middle">
            <text x="121" y="36">
              Discovery
            </text>
            <text x="170" y="74">
              Design system
            </text>
            <text x="127" y="112">
              Campaign
            </text>
            <text x="214" y="150">
              Release window
            </text>
          </g>
        </g>
      )
  }

  return getChartsCatalogPreviewLatePolarAndBeyond(caseId)
}

function getChartsCatalogPreviewLatePolarAndBeyond(caseId: string) {
  switch (caseId) {
    case '93-labeled-pie':
      return (
        <g data-preview-geometry="labeled-pie">
          <circle
            cx="144"
            cy="96"
            fill="none"
            r="29"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="58"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="29"
            stroke="var(--catalog-preview-1)"
            strokeDasharray="42 58"
            strokeWidth="58"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="29"
            stroke="var(--catalog-preview-2)"
            strokeDasharray="26 74"
            strokeDashoffset="-42"
            strokeWidth="58"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="29"
            stroke="var(--catalog-preview-3)"
            strokeDasharray="18 82"
            strokeDashoffset="-68"
            strokeWidth="58"
            transform="rotate(-90 144 96)"
          />
          <path
            d="M116 41L96 24H72M190 69L214 56H239M170 138L188 159H215M105 128L82 145H58"
            fill="none"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="1.5"
          />
          <g fill="currentColor" fontSize="10" fontWeight="650">
            <text textAnchor="end" x="68" y="27">
              E
            </text>
            <text x="243" y="59">
              T
            </text>
            <text x="219" y="163">
              A
            </text>
            <text textAnchor="end" x="54" y="149">
              O
            </text>
          </g>
        </g>
      )
    case '94-center-donut':
      return (
        <g data-preview-geometry="center-donut">
          <circle
            cx="144"
            cy="96"
            fill="none"
            r="58"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="27"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="58"
            stroke="var(--catalog-preview-1)"
            strokeDasharray="43 57"
            strokeWidth="27"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="58"
            stroke="var(--catalog-preview-2)"
            strokeDasharray="29 71"
            strokeDashoffset="-43"
            strokeWidth="27"
            transform="rotate(-90 144 96)"
          />
          <text
            fill="currentColor"
            fontSize="18"
            fontWeight="750"
            textAnchor="middle"
            x="144"
            y="101"
          >
            29.9%
          </text>
        </g>
      )
    case '95-rounded-donut':
      return (
        <g data-preview-geometry="five-rounded-gapped-donut-arcs">
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="58"
            stroke="var(--catalog-preview-1)"
            strokeDasharray="27 73"
            strokeLinecap="round"
            strokeWidth="25"
            transform="rotate(-86 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="58"
            stroke="var(--catalog-preview-2)"
            strokeDasharray="21 79"
            strokeDashoffset="-31"
            strokeLinecap="round"
            strokeWidth="25"
            transform="rotate(-86 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="58"
            stroke="var(--catalog-preview-3)"
            strokeDasharray="17 83"
            strokeDashoffset="-56"
            strokeLinecap="round"
            strokeWidth="25"
            transform="rotate(-86 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="58"
            stroke="var(--catalog-preview-muted)"
            strokeDasharray="13 87"
            strokeDashoffset="-77"
            strokeLinecap="round"
            strokeWidth="25"
            transform="rotate(-86 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="58"
            stroke="var(--catalog-preview-1)"
            strokeDasharray="8 92"
            strokeDashoffset="-94"
            strokeLinecap="round"
            strokeOpacity=".5"
            strokeWidth="25"
            transform="rotate(-86 144 96)"
          />
        </g>
      )
    case '96-nested-donut':
      return (
        <g data-preview-geometry="nested-donut">
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="38"
            stroke="var(--catalog-preview-1)"
            strokeDasharray="58 42"
            strokeWidth="22"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="38"
            stroke="var(--catalog-preview-2)"
            strokeDasharray="42 58"
            strokeDashoffset="-58"
            strokeWidth="22"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="71"
            stroke="var(--catalog-preview-1)"
            strokeDasharray="19 81"
            strokeWidth="20"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="71"
            stroke="var(--catalog-preview-2)"
            strokeDasharray="16 84"
            strokeDashoffset="-21"
            strokeWidth="20"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="71"
            stroke="var(--catalog-preview-3)"
            strokeDasharray="24 76"
            strokeDashoffset="-39"
            strokeWidth="20"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="71"
            stroke="var(--catalog-preview-muted)"
            strokeDasharray="33 67"
            strokeDashoffset="-65"
            strokeWidth="20"
            transform="rotate(-90 144 96)"
          />
        </g>
      )
    case '97-rose':
      return (
        <g data-preview-geometry="six-equal-angle-center-rose-wedges">
          <path
            d="M144 96L144 24A72 72 0 0 1 206 60Z"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M144 96L218 53A86 86 0 0 1 218 139Z"
            fill="var(--catalog-preview-2)"
          />
          <path
            d="M144 96L194 125A58 58 0 0 1 144 154Z"
            fill="var(--catalog-preview-3)"
          />
          <path
            d="M144 96L144 173A77 77 0 0 1 77 135Z"
            fill="var(--catalog-preview-1)"
            fillOpacity=".72"
          />
          <path
            d="M144 96L99 122A52 52 0 0 1 99 70Z"
            fill="var(--catalog-preview-2)"
            fillOpacity=".78"
          />
          <path
            d="M144 96L88 64A65 65 0 0 1 144 31Z"
            fill="var(--catalog-preview-3)"
            fillOpacity=".8"
          />
        </g>
      )
    case '98-needle-gauge':
      return (
        <g data-preview-geometry="needle-gauge">
          <path
            d="M57 142A97 97 0 0 1 91 48"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeLinecap="butt"
            strokeWidth="25"
          />
          <path
            d="M91 48A97 97 0 0 1 197 48"
            fill="none"
            stroke="var(--catalog-preview-3)"
            strokeWidth="25"
          />
          <path
            d="M197 48A97 97 0 0 1 231 142"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="butt"
            strokeWidth="25"
          />
          <path
            d="M67 164L78 153M51 126L66 121M49 81L64 83M66 40L79 50M104 14L110 29M144 5V21M184 14L178 29M222 40L209 50M239 81L224 83M237 126L222 121M221 164L210 153"
            stroke="Canvas"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path
            d="M144 141L78 153"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="5"
          />
          <circle cx="144" cy="141" fill="currentColor" r="9" />
          <text
            fill="currentColor"
            fontSize="14"
            fontWeight="750"
            textAnchor="middle"
            x="144"
            y="174"
          >
            5.1%
          </text>
        </g>
      )
    case '99-comparative-radar':
      return (
        <g data-preview-geometry="two-four-event-radars-with-rings">
          <path
            d="M144 20L222 96L144 172L66 96ZM144 39L202 96L144 153L86 96ZM144 58L183 96L144 134L105 96ZM144 77L163 96L144 115L125 96ZM144 20V172M66 96H222"
            fill="none"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="1.5"
          />
          <path
            d="M144 31L194 96L144 146L83 96Z"
            fill="var(--catalog-preview-1)"
            fillOpacity=".23"
            stroke="var(--catalog-preview-1)"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <path
            d="M144 53L210 96L144 129L100 96Z"
            fill="var(--catalog-preview-2)"
            fillOpacity=".2"
            stroke="var(--catalog-preview-2)"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <g fill="currentColor" fontSize="8" opacity=".62">
            <text textAnchor="middle" x="144" y="13">
              100m
            </text>
            <text x="226" y="99">
              Long jump
            </text>
            <text textAnchor="middle" x="144" y="186">
              Shot put
            </text>
            <text textAnchor="end" x="62" y="99">
              High jump
            </text>
          </g>
        </g>
      )
    case '100-radial-bars':
      return (
        <g data-preview-geometry="concentric-radial-bars">
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="23"
            stroke="var(--catalog-preview-1)"
            strokeDasharray="82 18"
            strokeLinecap="round"
            strokeWidth="10"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="37"
            stroke="var(--catalog-preview-2)"
            strokeDasharray="67 33"
            strokeLinecap="round"
            strokeWidth="10"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="51"
            stroke="var(--catalog-preview-3)"
            strokeDasharray="48 52"
            strokeLinecap="round"
            strokeWidth="10"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="65"
            stroke="var(--catalog-preview-1)"
            strokeDasharray="34 66"
            strokeLinecap="round"
            strokeOpacity=".7"
            strokeWidth="10"
            transform="rotate(-90 144 96)"
          />
        </g>
      )
    case '101-sunburst':
      return (
        <g data-preview-geometry="ten-hierarchical-sunburst-arcs">
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="24"
            stroke="var(--catalog-preview-1)"
            strokeDasharray="56 44"
            strokeWidth="18"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="24"
            stroke="var(--catalog-preview-2)"
            strokeDasharray="44 56"
            strokeDashoffset="-56"
            strokeWidth="18"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="48"
            stroke="var(--catalog-preview-1)"
            strokeDasharray="34 66"
            strokeWidth="20"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="48"
            stroke="var(--catalog-preview-3)"
            strokeDasharray="25 75"
            strokeDashoffset="-34"
            strokeWidth="20"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="48"
            stroke="var(--catalog-preview-2)"
            strokeDasharray="41 59"
            strokeDashoffset="-59"
            strokeWidth="20"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="73"
            stroke="var(--catalog-preview-muted)"
            strokeDasharray="17 83"
            strokeWidth="20"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="73"
            stroke="var(--catalog-preview-3)"
            strokeDasharray="21 79"
            strokeDashoffset="-18"
            strokeWidth="20"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="73"
            stroke="var(--catalog-preview-2)"
            strokeDasharray="13 87"
            strokeDashoffset="-40"
            strokeWidth="20"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="73"
            stroke="var(--catalog-preview-1)"
            strokeDasharray="25 75"
            strokeDashoffset="-54"
            strokeOpacity=".62"
            strokeWidth="20"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            pathLength="100"
            r="73"
            stroke="var(--catalog-preview-3)"
            strokeDasharray="20 80"
            strokeDashoffset="-80"
            strokeOpacity=".7"
            strokeWidth="20"
            transform="rotate(-90 144 96)"
          />
        </g>
      )
    case '102-world-choropleth':
      return (
        <g data-preview-geometry="equal-earth-country-threshold-choropleth">
          <path
            d={worldLandPath}
            fill="var(--catalog-preview-muted)"
            opacity=".38"
          />
          <path
            d="M21 52L38 42L50 30L67 25L82 32L75 43L60 47L52 58L38 61ZM79 47L98 29L109 38L105 49L94 53L90 66L78 72L73 61ZM63 90L76 87L90 97L95 112L90 128L82 146L73 132L67 113L57 104ZM132 43L143 43L151 35L163 38L157 50L146 57L136 61L126 54ZM128 67L143 65L157 73L165 89L158 103L149 110L144 129L134 145L126 137L120 118L112 99L115 81ZM176 32L194 36L206 43L196 53L181 51L171 61L159 63L158 50ZM207 43L224 44L238 53L252 56L273 69L265 79L249 81L238 74L226 78L215 71L202 76L194 66ZM223 119L238 112L256 117L270 132L261 147L243 152L227 142L217 130Z"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M13 67L21 52L37 61L32 75L24 84L15 79ZM39 62L58 55L72 63L72 83L62 90L48 98L38 90ZM76 89L90 96L95 112L88 129L78 120L69 105ZM119 52L131 43L142 44L136 61L126 64ZM160 64L171 62L180 72L171 82L162 89L151 80ZM181 72L191 69L201 77L190 87L176 88L171 82ZM204 77L214 72L225 79L218 91L207 99L198 88ZM222 120L237 112L245 124L238 139L227 142L217 130Z"
            fill="var(--catalog-preview-2)"
          />
          <path
            d="M50 30L68 24L84 32L78 45L61 47ZM48 98L62 90L76 89L68 106L58 118L55 106ZM143 43L151 35L164 38L158 51L146 57ZM172 31L193 36L181 51L171 61L160 63L158 51ZM226 79L239 75L249 82L239 94L221 101L214 91ZM238 112L256 117L270 132L260 147L244 151L238 139Z"
            fill="var(--catalog-preview-3)"
          />
        </g>
      )
    case '103-bubble-map':
      return (
        <g data-preview-geometry="dense-positioned-world-bubble-map">
          <path
            d={worldLandPath}
            fill="var(--catalog-preview-muted)"
            opacity=".4"
          />
          <g
            fill="var(--catalog-preview-1)"
            fillOpacity=".72"
            stroke="Canvas"
            strokeWidth="2"
          >
            <circle cx="39" cy="55" r="7" />
            <circle cx="58" cy="49" r="14" />
            <circle cx="76" cy="69" r="8" />
            <circle cx="88" cy="42" r="5" />
            <circle cx="72" cy="105" r="10" />
            <circle cx="83" cy="126" r="6" />
            <circle cx="137" cy="53" r="8" />
            <circle cx="151" cy="80" r="15" />
            <circle cx="171" cy="52" r="7" />
            <circle cx="191" cy="62" r="11" />
            <circle cx="224" cy="68" r="6" />
            <circle cx="244" cy="130" r="13" />
          </g>
          <g
            fill="var(--catalog-preview-2)"
            fillOpacity=".78"
            stroke="Canvas"
            strokeWidth="2"
          >
            <circle cx="28" cy="76" r="5" />
            <circle cx="64" cy="88" r="6" />
            <circle cx="91" cy="108" r="4" />
            <circle cx="123" cy="52" r="5" />
            <circle cx="136" cy="101" r="7" />
            <circle cx="151" cy="122" r="5" />
            <circle cx="183" cy="81" r="6" />
            <circle cx="207" cy="91" r="4" />
            <circle cx="235" cy="53" r="8" />
            <circle cx="262" cy="73" r="5" />
            <circle cx="227" cy="137" r="4" />
            <circle cx="260" cy="143" r="6" />
          </g>
        </g>
      )
    case '104-orthographic-globe':
      return (
        <g data-preview-geometry="orthographic-globe">
          <circle
            cx="144"
            cy="96"
            fill="var(--catalog-preview-1)"
            fillOpacity=".16"
            r="78"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="2"
          />
          <path
            d="M69 96H219M82 56C112 70 176 70 206 56M82 136C112 122 176 122 206 136M144 18C111 43 111 149 144 174M144 18C177 43 177 149 144 174"
            fill="none"
            stroke="var(--catalog-preview-muted)"
            strokeOpacity=".65"
          />
          <path
            d="M77 60L87 44L105 35L122 40L135 51L131 65L117 69L111 83L98 88L94 105L82 111L73 96L69 77ZM104 108L115 112L122 127L118 145L108 160L99 147L98 130L91 117ZM139 42L153 33L169 36L178 31L194 40L207 52L214 67L204 78L188 75L177 83L169 104L157 111L151 130L142 144L133 132L136 111L128 91L135 71ZM180 114L194 106L209 115L214 131L203 143L185 138L176 126Z"
            fill="var(--catalog-preview-1)"
          />
        </g>
      )
    case '105-route-map':
      return (
        <g data-preview-geometry="open-beagle-voyage-route-map">
          <path
            d={worldLandPath}
            fill="var(--catalog-preview-muted)"
            opacity=".36"
          />
          <path
            d="M136 47C114 54 98 69 83 84S72 115 81 143C90 164 110 158 122 136C135 113 118 99 99 94C80 89 54 77 38 61C55 45 85 39 116 45C151 51 182 69 204 89C222 105 239 116 254 130C240 145 211 151 189 139C166 127 157 100 171 78C181 62 195 53 211 47"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <path
            d="M136 43a4 4 0 1 1 0 8a4 4 0 1 1 0-8M83 80a4 4 0 1 1 0 8a4 4 0 1 1 0-8M81 139a4 4 0 1 1 0 8a4 4 0 1 1 0-8M122 132a4 4 0 1 1 0 8a4 4 0 1 1 0-8M99 90a4 4 0 1 1 0 8a4 4 0 1 1 0-8M38 57a4 4 0 1 1 0 8a4 4 0 1 1 0-8M116 41a4 4 0 1 1 0 8a4 4 0 1 1 0-8M204 85a4 4 0 1 1 0 8a4 4 0 1 1 0-8M254 126a4 4 0 1 1 0 8a4 4 0 1 1 0-8M189 135a4 4 0 1 1 0 8a4 4 0 1 1 0-8M171 74a4 4 0 1 1 0 8a4 4 0 1 1 0-8M211 43a4 4 0 1 1 0 8a4 4 0 1 1 0-8"
            fill="var(--catalog-preview-1)"
            stroke="Canvas"
            strokeWidth="2"
          />
        </g>
      )
    case '106-polar-line':
      return (
        <g data-preview-geometry="dense-irregular-daily-polar-line">
          <circle
            cx="144"
            cy="96"
            fill="none"
            r="25"
            stroke="var(--catalog-preview-muted)"
            strokeOpacity=".5"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            r="48"
            stroke="var(--catalog-preview-muted)"
            strokeOpacity=".5"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            r="73"
            stroke="var(--catalog-preview-muted)"
            strokeOpacity=".5"
          />
          <path
            d="M144 55L151 45L162 30L162 54L176 41L173 58L185 55L173 74L190 70L209 69L197 82L208 88L187 96L203 104L181 106L201 120L206 132L184 126L191 143L171 132L179 156L159 133L159 151L149 131L144 148L134 171L132 141L120 155L123 132L108 143L113 127L101 129L83 132L99 115L80 113L93 103L83 96L105 91L90 82L113 83L94 67L90 55L111 63L106 46L123 60L119 36L135 61L137 43Z"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        </g>
      )
    case '107-polar-scatter':
      return (
        <g data-preview-geometry="dense-eighty-point-polar-scatter">
          <circle
            cx="144"
            cy="96"
            fill="none"
            r="25"
            stroke="var(--catalog-preview-muted)"
            strokeOpacity=".5"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            r="49"
            stroke="var(--catalog-preview-muted)"
            strokeOpacity=".5"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            r="74"
            stroke="var(--catalog-preview-muted)"
            strokeOpacity=".5"
          />
          <path
            d="M144 84a2 2 0 1 1 0 4a2 2 0 1 1 0-4M169 75a2 2 0 1 1 0 4a2 2 0 1 1 0-4M194 108a2 2 0 1 1 0 4a2 2 0 1 1 0-4M172 161a2 2 0 1 1 0 4a2 2 0 1 1 0-4M130 118a2 2 0 1 1 0 4a2 2 0 1 1 0-4M95 100a2 2 0 1 1 0 4a2 2 0 1 1 0-4M95 44a2 2 0 1 1 0 4a2 2 0 1 1 0-4M147 69a2 2 0 1 1 0 4a2 2 0 1 1 0-4M184 71a2 2 0 1 1 0 4a2 2 0 1 1 0-4M206 120a2 2 0 1 1 0 4a2 2 0 1 1 0-4M150 115a2 2 0 1 1 0 4a2 2 0 1 1 0-4M118 128a2 2 0 1 1 0 4a2 2 0 1 1 0-4M80 94a2 2 0 1 1 0 4a2 2 0 1 1 0-4M133 79a2 2 0 1 1 0 4a2 2 0 1 1 0-4M155 55a2 2 0 1 1 0 4a2 2 0 1 1 0-4M201 71a2 2 0 1 1 0 4a2 2 0 1 1 0-4M158 102a2 2 0 1 1 0 4a2 2 0 1 1 0-4M149 131a2 2 0 1 1 0 4a2 2 0 1 1 0-4M103 135a2 2 0 1 1 0 4a2 2 0 1 1 0-4M131 92a2 2 0 1 1 0 4a2 2 0 1 1 0-4M127 64a2 2 0 1 1 0 4a2 2 0 1 1 0-4M165 43a2 2 0 1 1 0 4a2 2 0 1 1 0-4M154 92a2 2 0 1 1 0 4a2 2 0 1 1 0-4M168 113a2 2 0 1 1 0 4a2 2 0 1 1 0-4M143 146a2 2 0 1 1 0 4a2 2 0 1 1 0-4M86 138a2 2 0 1 1 0 4a2 2 0 1 1 0-4M117 86a2 2 0 1 1 0 4a2 2 0 1 1 0-4"
            fill="var(--catalog-preview-1)"
            opacity=".78"
          />
          <path
            d="M170 123a2 2 0 1 1 0 4a2 2 0 1 1 0-4M134 153a2 2 0 1 1 0 4a2 2 0 1 1 0-4M131 101a2 2 0 1 1 0 4a2 2 0 1 1 0-4M111 79a2 2 0 1 1 0 4a2 2 0 1 1 0-4M132 38a2 2 0 1 1 0 4a2 2 0 1 1 0-4M152 85a2 2 0 1 1 0 4a2 2 0 1 1 0-4M177 96a2 2 0 1 1 0 4a2 2 0 1 1 0-4M175 138a2 2 0 1 1 0 4a2 2 0 1 1 0-4M121 165a2 2 0 1 1 0 4a2 2 0 1 1 0-4M116 104a2 2 0 1 1 0 4a2 2 0 1 1 0-4M101 66a2 2 0 1 1 0 4a2 2 0 1 1 0-4M138 22a2 2 0 1 1 0 4a2 2 0 1 1 0-4M164 76a2 2 0 1 1 0 4a2 2 0 1 1 0-4M191 103a2 2 0 1 1 0 4a2 2 0 1 1 0-4M175 155a2 2 0 1 1 0 4a2 2 0 1 1 0-4M134 116a2 2 0 1 1 0 4a2 2 0 1 1 0-4M100 103a2 2 0 1 1 0 4a2 2 0 1 1 0-4M94 51a2 2 0 1 1 0 4a2 2 0 1 1 0-4M145 73a2 2 0 1 1 0 4a2 2 0 1 1 0-4M179 70a2 2 0 1 1 0 4a2 2 0 1 1 0-4M204 113a2 2 0 1 1 0 4a2 2 0 1 1 0-4M150 111a2 2 0 1 1 0 4a2 2 0 1 1 0-4M123 127a2 2 0 1 1 0 4a2 2 0 1 1 0-4M84 99a2 2 0 1 1 0 4a2 2 0 1 1 0-4M134 83a2 2 0 1 1 0 4a2 2 0 1 1 0-4M151 59a2 2 0 1 1 0 4a2 2 0 1 1 0-4M195 68a2 2 0 1 1 0 4a2 2 0 1 1 0-4"
            fill="var(--catalog-preview-2)"
            opacity=".8"
          />
          <path
            d="M76 88a2 2 0 1 1 0 4a2 2 0 1 1 0-4M132 75a2 2 0 1 1 0 4a2 2 0 1 1 0-4M159 53a2 2 0 1 1 0 4a2 2 0 1 1 0-4M206 75a2 2 0 1 1 0 4a2 2 0 1 1 0-4M160 106a2 2 0 1 1 0 4a2 2 0 1 1 0-4M146 135a2 2 0 1 1 0 4a2 2 0 1 1 0-4M96 134a2 2 0 1 1 0 4a2 2 0 1 1 0-4M127 90a2 2 0 1 1 0 4a2 2 0 1 1 0-4M128 60a2 2 0 1 1 0 4a2 2 0 1 1 0-4M171 42a2 2 0 1 1 0 4a2 2 0 1 1 0-4M158 92a2 2 0 1 1 0 4a2 2 0 1 1 0-4M170 118a2 2 0 1 1 0 4a2 2 0 1 1 0-4M139 150a2 2 0 1 1 0 4a2 2 0 1 1 0-4M135 100a2 2 0 1 1 0 4a2 2 0 1 1 0-4M114 83a2 2 0 1 1 0 4a2 2 0 1 1 0-4M128 43a2 2 0 1 1 0 4a2 2 0 1 1 0-4M187 34a2 2 0 1 1 0 4a2 2 0 1 1 0-4M173 93a2 2 0 1 1 0 4a2 2 0 1 1 0-4M176 133a2 2 0 1 1 0 4a2 2 0 1 1 0-4M128 163a2 2 0 1 1 0 4a2 2 0 1 1 0-4M120 105a2 2 0 1 1 0 4a2 2 0 1 1 0-4M103 72a2 2 0 1 1 0 4a2 2 0 1 1 0-4M133 27a2 2 0 1 1 0 4a2 2 0 1 1 0-4M160 77a2 2 0 1 1 0 4a2 2 0 1 1 0-4M188 98a2 2 0 1 1 0 4a2 2 0 1 1 0-4M178 149a2 2 0 1 1 0 4a2 2 0 1 1 0-4M137 113a2 2 0 1 1 0 4a2 2 0 1 1 0-4"
            fill="var(--catalog-preview-3)"
            opacity=".76"
          />
        </g>
      )
    case '108-country-choropleth':
      return (
        <g data-preview-geometry="country-topology-density-choropleth">
          <path
            d={worldLandPath}
            fill="var(--catalog-preview-1)"
            fillOpacity=".18"
            stroke="Canvas"
            strokeWidth="1"
          />
          <path
            d="M21 52L38 42L50 30L67 25L82 32L76 43L60 47L52 58L38 61ZM39 62L58 55L72 63L72 83L62 90L48 98L38 90ZM63 90L76 87L90 97L95 112L90 128L82 146L73 132L67 113L57 104ZM119 52L131 43L143 43L136 61L126 65ZM143 43L151 35L164 38L158 51L146 57L136 61ZM160 64L171 62L180 72L171 82L162 89L151 80ZM181 72L191 69L201 77L190 87L176 88L171 82ZM128 67L143 64L158 72L167 90L160 106L151 111L146 130L137 151L126 139L119 118L111 99L114 80ZM203 77L214 72L225 79L218 91L207 99L198 88ZM226 79L239 75L249 82L239 94L221 101L214 91ZM223 119L238 112L257 116L271 132L262 148L243 153L226 143L216 130Z"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M13 67L21 52L37 61L32 75L24 84L15 79ZM50 30L68 24L84 32L78 45L61 47ZM76 89L90 96L95 112L88 129L78 120L69 105ZM132 43L143 43L151 35L146 57L136 61L126 54ZM172 31L194 35L207 42L196 53L181 51L171 61L160 63L158 51ZM207 43L224 43L238 52L253 55L274 68L267 80L249 82L239 75L225 79L213 72L202 77L194 66ZM128 68L143 65L158 73L165 89L158 103L149 110L143 129L134 145L126 137L120 118L112 99L115 81ZM222 120L238 112L246 124L238 139L227 142L217 130Z"
            fill="var(--catalog-preview-2)"
          />
          <path
            d="M38 61L58 55M52 58L72 63M60 47L78 45M67 25L68 45M76 87L69 105M90 97L78 120M131 43L136 61M151 35L158 51M171 62L176 88M191 69L190 87M214 72L214 91M239 75L239 94M143 64L143 129M119 98L160 106M238 112L238 139M257 116L246 147"
            fill="none"
            stroke="Canvas"
            strokeOpacity=".72"
            strokeWidth="1"
          />
        </g>
      )
    case '109-us-state-choropleth':
      return (
        <g data-preview-geometry="albers-usa-dense-county-choropleth">
          <path
            d={unitedStatesLandPath}
            fill="var(--catalog-preview-1)"
            fillOpacity=".32"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="2"
          />
          <path
            d="M50 46V118M62 41V128M74 40V134M86 44V139M98 43V143M110 45V147M122 46V146M134 44V148M146 44V146M158 48V143M170 49V143M182 50V139M194 53V139M206 56V136M218 59V134M230 66V128M242 68V113M254 77V108M42 55H205M37 66H250M34 77H268M43 88H269M40 99H260M49 110H254M54 121H240M72 132H228M96 143H188M40 61L72 84L96 65L125 86L153 63L183 87L210 69L244 91M49 103L76 81L109 104L141 83L174 106L205 84L240 108M65 128L94 110L127 132L159 111L190 134L222 115"
            fill="none"
            stroke="Canvas"
            strokeOpacity=".72"
            strokeWidth=".8"
          />
          <path
            d="M44 66H63V77H44ZM76 44H98V55H76ZM112 66H123V77H112ZM149 44H160V55H149ZM175 77H196V88H175ZM214 55H232V66H214ZM61 110H74V121H61ZM98 99H111V110H98ZM136 121H149V132H136ZM188 110H201V121H188ZM227 88H244V99H227ZM123 143H136V154H123Z"
            fill="var(--catalog-preview-2)"
            fillOpacity=".82"
          />
          <path
            d="M53 77H64V88H53ZM88 55H100V66H88ZM123 88H136V99H123ZM160 66H175V77H160ZM201 99H214V110H201ZM240 77H256V88H240ZM74 121H87V132H74ZM111 110H124V121H111ZM149 99H162V110H149ZM188 132H201V143H188ZM214 121H228V132H214Z"
            fill="var(--catalog-preview-3)"
            fillOpacity=".78"
          />
          <path
            d="M18 146L33 137L48 143L50 156L34 164L20 157ZM64 151L76 146L86 153L80 162L68 161ZM93 164L99 160L105 164L99 168Z"
            fill="var(--catalog-preview-1)"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="1"
          />
        </g>
      )
    case '110-projection-gallery':
      return (
        <g data-preview-geometry="four-recognizable-world-projections">
          <g
            fill="var(--catalog-preview-1)"
            fillOpacity=".08"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="1.2"
          >
            <path d="M9 18Q74 7 139 18V84Q74 95 9 84Z" />
            <ellipse cx="218" cy="52" rx="61" ry="42" />
            <path d="M9 108Q74 94 139 108V177Q74 188 9 177Z" />
            <rect height="75" rx="2" width="123" x="156" y="103" />
          </g>
          <g fill="var(--catalog-preview-1)" opacity=".72">
            <path d={worldLandPath} transform="translate(4 6) scale(.47 .45)" />
            <path
              d={worldLandPath}
              transform="translate(164 5) scale(.39 .46)"
            />
            <path
              d={worldLandPath}
              transform="translate(4 96) scale(.47 .43)"
            />
            <path
              d={worldLandPath}
              transform="translate(153 94) scale(.45 .44)"
            />
          </g>
        </g>
      )
    case '111-basic-sankey':
      return (
        <g data-preview-geometry="basic-sankey-six-to-four-ratio">
          <path
            d="M49 80C91 80 98 56 137 56M151 56C190 56 197 75 239 75"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".3"
            strokeWidth="48"
          />
          <path
            d="M49 128C91 128 98 136 137 136M151 136C190 136 197 123 239 123"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeOpacity=".38"
            strokeWidth="32"
          />
          <path
            d="M35 56H49V152H35ZM137 32H151V80H137ZM137 120H151V152H137ZM239 51H253V147H239Z"
            fill="currentColor"
            opacity=".72"
          />
          <g fill="currentColor" fontSize="9" fontWeight="650">
            <text textAnchor="end" x="30" y="99">
              Input
            </text>
            <text x="157" y="58">
              Path A
            </text>
            <text x="157" y="140">
              Path B
            </text>
            <text x="258" y="99">
              Output
            </text>
          </g>
        </g>
      )
    case '111-sankey-flow':
      return (
        <g data-preview-geometry="apple-fy22-income-statement-sankey">
          <path
            d="M26 40C45 40 51 45 70 45M26 73C45 73 51 60 70 60M26 86C45 86 51 68 70 68M26 99C45 99 51 76 70 76M82 56C94 56 100 58 112 58M26 140C62 140 76 84 112 84"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".28"
            strokeWidth="8"
          />
          <path
            d="M124 60C139 60 145 43 160 43M172 43C184 43 190 35 202 35M214 35C231 35 241 27 258 27"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeOpacity=".48"
            strokeWidth="22"
          />
          <path
            d="M124 82C139 82 145 106 160 106M172 106C184 106 190 109 202 109M172 43C184 43 190 66 202 66M214 35C231 35 241 46 258 46M214 35C231 35 241 54 258 54M214 66C231 66 241 69 258 69M214 66C231 66 241 78 258 78M172 106C184 106 190 136 202 136"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeOpacity=".46"
            strokeWidth="7"
          />
          <path
            d="M14 20H26V60H14ZM14 68H26V78H14ZM14 82H26V90H14ZM14 94H26V104H14ZM14 132H26V148H14ZM70 24H82V91H70ZM112 34H124V100H112ZM160 25H172V61H160ZM160 86H172V133H160ZM202 22H214V49H202ZM202 60H214V72H202ZM202 88H214V129H202ZM202 133H214V140H202ZM258 16H270V38H258ZM258 43H270V49H258ZM258 52H270V56H258ZM258 65H270V71H258ZM258 74H270V80H258Z"
            fill="currentColor"
            opacity=".76"
          />
          <g fill="currentColor" fontSize="6.5" fontWeight="650">
            <text x="7" y="17">
              iPhone
            </text>
            <text x="7" y="129">
              Services
            </text>
            <text x="67" y="20">
              Products
            </text>
            <text x="106" y="30">
              Revenue
            </text>
            <text x="151" y="21">
              Gross profit
            </text>
            <text x="150" y="145">
              Cost of rev.
            </text>
            <text x="195" y="18">
              Op. profit
            </text>
            <text x="251" y="13">
              Net profit
            </text>
            <text x="251" y="64">
              R&amp;D
            </text>
            <text x="251" y="87">
              SG&amp;A
            </text>
          </g>
        </g>
      )
    case '112-motion-entrance':
      return (
        <g data-preview-geometry="eight-bar-line-entrance-motion">
          <path
            d="M14 158V127H33V158ZM48 158V105H67V158ZM82 158V119H101V158ZM116 158V76H135V158ZM150 158V94H169V158ZM184 158V57H203V158ZM218 158V82H237V158ZM252 158V35H271V158Z"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M24 121L58 99L92 113L126 70L160 88L194 51L228 76L262 29"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          <path
            d="M24 117a4 4 0 1 1 0 8a4 4 0 1 1 0-8M58 95a4 4 0 1 1 0 8a4 4 0 1 1 0-8M92 109a4 4 0 1 1 0 8a4 4 0 1 1 0-8M126 66a4 4 0 1 1 0 8a4 4 0 1 1 0-8M160 84a4 4 0 1 1 0 8a4 4 0 1 1 0-8M194 47a4 4 0 1 1 0 8a4 4 0 1 1 0-8M228 72a4 4 0 1 1 0 8a4 4 0 1 1 0-8M262 25a4 4 0 1 1 0 8a4 4 0 1 1 0-8"
            fill="var(--catalog-preview-2)"
          />
        </g>
      )
    case '113-motion-updates':
      return (
        <g data-preview-geometry="eight-bar-line-keyed-updates">
          <path
            d="M14 158V104H33V158ZM48 158V68H67V158ZM82 158V123H101V158ZM116 158V83H135V158ZM150 158V47H169V158ZM184 158V97H203V158ZM218 158V62H237V158ZM252 158V34H271V158Z"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M24 98L58 62L92 117L126 77L160 41L194 91L228 56L262 28"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          <path
            d="M24 94a4 4 0 1 1 0 8a4 4 0 1 1 0-8M58 58a4 4 0 1 1 0 8a4 4 0 1 1 0-8M92 113a4 4 0 1 1 0 8a4 4 0 1 1 0-8M126 73a4 4 0 1 1 0 8a4 4 0 1 1 0-8M160 37a4 4 0 1 1 0 8a4 4 0 1 1 0-8M194 87a4 4 0 1 1 0 8a4 4 0 1 1 0-8M228 52a4 4 0 1 1 0 8a4 4 0 1 1 0-8M262 24a4 4 0 1 1 0 8a4 4 0 1 1 0-8"
            fill="var(--catalog-preview-2)"
          />
        </g>
      )
    case '114-spring-line-motion':
      return (
        <g data-preview-geometry="spring-line-transition">
          <path
            d="M18 142C46 128 64 88 92 102S128 136 154 93S200 68 230 85S255 66 272 41"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeWidth="4"
          />
          <path
            d="M18 119C45 93 66 124 94 88S137 55 165 73S206 119 235 95S255 82 272 72"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeWidth="4"
          />
        </g>
      )
    case '115-definition-motion':
      return (
        <g data-preview-geometry="six-bar-line-definition-motion">
          <path
            d="M19 158V120H49V158ZM63 158V83H93V158ZM107 158V105H137V158ZM151 158V52H181V158ZM195 158V72H225V158ZM239 158V37H269V158Z"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M34 114L78 77L122 99L166 46L210 66L254 31"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeWidth="4"
          />
        </g>
      )
    case '116-geometry-morph':
      return (
        <g data-preview-geometry="six-values-bars-rose-donut-packed-morph">
          <g data-preview-mode="bars">
            <path
              d="M13 82V61H21V82ZM24 82V42H32V82ZM35 82V55H43V82ZM46 82V28H54V82ZM57 82V49H65V82ZM68 82V36H76V82Z"
              fill="var(--catalog-preview-1)"
            />
          </g>
          <g data-preview-mode="rose" transform="translate(111 52)">
            <path
              d="M0 0V-32L18-10ZM0 0L28-16V16ZM0 0L21 12L0 24ZM0 0V38L-22 13ZM0 0L-25 14V-14ZM0 0L-31-18L0-27Z"
              fill="var(--catalog-preview-2)"
            />
          </g>
          <g data-preview-mode="donut">
            <circle
              cx="190"
              cy="52"
              fill="none"
              pathLength="100"
              r="31"
              stroke="var(--catalog-preview-1)"
              strokeDasharray="16 84"
              strokeWidth="12"
              transform="rotate(-90 190 52)"
            />
            <circle
              cx="190"
              cy="52"
              fill="none"
              pathLength="100"
              r="31"
              stroke="var(--catalog-preview-2)"
              strokeDasharray="16 84"
              strokeDashoffset="-17"
              strokeWidth="12"
              transform="rotate(-90 190 52)"
            />
            <circle
              cx="190"
              cy="52"
              fill="none"
              pathLength="100"
              r="31"
              stroke="var(--catalog-preview-3)"
              strokeDasharray="16 84"
              strokeDashoffset="-34"
              strokeWidth="12"
              transform="rotate(-90 190 52)"
            />
            <circle
              cx="190"
              cy="52"
              fill="none"
              pathLength="100"
              r="31"
              stroke="var(--catalog-preview-1)"
              strokeDasharray="16 84"
              strokeDashoffset="-51"
              strokeOpacity=".62"
              strokeWidth="12"
              transform="rotate(-90 190 52)"
            />
            <circle
              cx="190"
              cy="52"
              fill="none"
              pathLength="100"
              r="31"
              stroke="var(--catalog-preview-2)"
              strokeDasharray="16 84"
              strokeDashoffset="-68"
              strokeOpacity=".62"
              strokeWidth="12"
              transform="rotate(-90 190 52)"
            />
            <circle
              cx="190"
              cy="52"
              fill="none"
              pathLength="100"
              r="31"
              stroke="var(--catalog-preview-3)"
              strokeDasharray="15 85"
              strokeDashoffset="-85"
              strokeOpacity=".62"
              strokeWidth="12"
              transform="rotate(-90 190 52)"
            />
          </g>
          <g
            data-preview-mode="packed-bubbles"
            fill="var(--catalog-preview-3)"
            fillOpacity=".72"
          >
            <circle cx="76" cy="137" r="25" />
            <circle cx="112" cy="129" r="18" />
            <circle cx="142" cy="143" r="14" />
            <circle cx="170" cy="128" r="21" />
            <circle cx="203" cy="143" r="16" />
            <circle cx="229" cy="124" r="11" />
          </g>
        </g>
      )
    case '117-focus-cursor-motion':
      return (
        <g data-preview-geometry="three-seven-point-series-animated-crosshair">
          <path
            d="M18 143L60 122L102 132L144 91L186 104L228 67L270 78"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeWidth="3.5"
          />
          <path
            d="M18 118L60 98L102 110L144 70L186 82L228 48L270 59"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeWidth="3.5"
          />
          <path
            d="M18 91L60 74L102 86L144 50L186 62L228 31L270 42"
            fill="none"
            stroke="var(--catalog-preview-3)"
            strokeWidth="3.5"
          />
          <path
            d="M18 139a4 4 0 1 1 0 8a4 4 0 1 1 0-8M60 118a4 4 0 1 1 0 8a4 4 0 1 1 0-8M102 128a4 4 0 1 1 0 8a4 4 0 1 1 0-8M144 87a4 4 0 1 1 0 8a4 4 0 1 1 0-8M186 100a4 4 0 1 1 0 8a4 4 0 1 1 0-8M228 63a4 4 0 1 1 0 8a4 4 0 1 1 0-8M270 74a4 4 0 1 1 0 8a4 4 0 1 1 0-8"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M18 114a4 4 0 1 1 0 8a4 4 0 1 1 0-8M60 94a4 4 0 1 1 0 8a4 4 0 1 1 0-8M102 106a4 4 0 1 1 0 8a4 4 0 1 1 0-8M144 66a4 4 0 1 1 0 8a4 4 0 1 1 0-8M186 78a4 4 0 1 1 0 8a4 4 0 1 1 0-8M228 44a4 4 0 1 1 0 8a4 4 0 1 1 0-8M270 55a4 4 0 1 1 0 8a4 4 0 1 1 0-8"
            fill="var(--catalog-preview-2)"
          />
          <path
            d="M18 87a4 4 0 1 1 0 8a4 4 0 1 1 0-8M60 70a4 4 0 1 1 0 8a4 4 0 1 1 0-8M102 82a4 4 0 1 1 0 8a4 4 0 1 1 0-8M144 46a4 4 0 1 1 0 8a4 4 0 1 1 0-8M186 58a4 4 0 1 1 0 8a4 4 0 1 1 0-8M228 27a4 4 0 1 1 0 8a4 4 0 1 1 0-8M270 38a4 4 0 1 1 0 8a4 4 0 1 1 0-8"
            fill="var(--catalog-preview-3)"
          />
          <path
            d="M144 20V168M16 70H272"
            stroke="var(--catalog-preview-muted)"
            strokeDasharray="4 4"
            strokeWidth="2"
          />
          <circle
            cx="144"
            cy="70"
            fill="var(--catalog-preview-2)"
            r="8"
            stroke="Canvas"
            strokeWidth="3"
          />
          <circle
            cx="144"
            cy="70"
            fill="var(--catalog-preview-1)"
            fillOpacity=".18"
            r="15"
          />
          <rect
            fill="Canvas"
            height="18"
            rx="4"
            stroke="var(--catalog-preview-muted)"
            width="36"
            x="126"
            y="18"
          />
          <rect
            fill="Canvas"
            height="18"
            rx="4"
            stroke="var(--catalog-preview-muted)"
            width="32"
            x="12"
            y="61"
          />
          <g fill="currentColor" fontSize="8" opacity=".7" textAnchor="middle">
            <text x="144" y="30">
              Apr
            </text>
            <text x="28" y="73">
              64
            </text>
          </g>
        </g>
      )
    case '118-token-usage-calendar':
      return (
        <g data-preview-geometry="fifty-three-week-seven-day-token-calendar">
          <g
            fill="currentColor"
            fontSize="6.5"
            opacity=".62"
            textAnchor="middle"
          >
            <text x="20" y="28">
              J
            </text>
            <text x="42" y="28">
              F
            </text>
            <text x="63" y="28">
              M
            </text>
            <text x="85" y="28">
              A
            </text>
            <text x="107" y="28">
              M
            </text>
            <text x="128" y="28">
              J
            </text>
            <text x="150" y="28">
              J
            </text>
            <text x="172" y="28">
              A
            </text>
            <text x="193" y="28">
              S
            </text>
            <text x="215" y="28">
              O
            </text>
            <text x="237" y="28">
              N
            </text>
            <text x="259" y="28">
              D
            </text>
          </g>
          <path
            d="M17 48H271M17 66H271M17 84H271M17 102H271M17 120H271M17 138H271M17 156H271"
            stroke="var(--catalog-preview-muted)"
            strokeDasharray="3 1.79"
            strokeLinecap="butt"
            strokeOpacity=".35"
            strokeWidth="12"
          />
          <path
            d="M26 42H29V54H26ZM36 60H39V72H36ZM55 78H58V90H55ZM65 96H68V108H65ZM79 42H82V54H79ZM93 114H96V126H93ZM108 60H111V72H108ZM122 132H125V144H122ZM137 78H140V90H137ZM151 96H154V108H151ZM165 42H168V54H165ZM180 114H183V126H180ZM194 60H197V72H194ZM208 132H211V144H208ZM223 78H226V90H223ZM237 96H240V108H237ZM251 42H254V54H251ZM265 114H268V126H265Z"
            fill="var(--catalog-preview-1)"
            opacity=".68"
          />
          <path
            d="M41 42H44V54H41ZM60 60H63V72H60ZM84 78H87V90H84ZM98 96H101V108H98ZM113 42H116V54H113ZM127 114H130V126H127ZM142 60H145V72H142ZM156 132H159V144H156ZM170 78H173V90H170ZM184 96H187V108H184ZM199 42H202V54H199ZM213 114H216V126H213ZM228 60H231V72H228ZM242 132H245V144H242ZM256 78H259V90H256ZM266 150H269V162H266Z"
            fill="var(--catalog-preview-2)"
          />
          <path
            d="M17 168H66M70 168H119M123 168H172M176 168H225M229 168H271"
            stroke="var(--catalog-preview-3)"
            strokeLinecap="round"
            strokeWidth="3"
          />
        </g>
      )
    case '119-stacked-bar-band-cursor':
      return (
        <g data-preview-geometry="eight-three-stack-bars-band-dotted-rule">
          <rect
            fill="var(--catalog-preview-1)"
            fillOpacity=".13"
            height="145"
            rx="4"
            width="31"
            x="119"
            y="21"
          />
          <path
            d="M16 158V128H38V158ZM50 158V112H72V158ZM84 158V121H106V158ZM118 158V96H140V158ZM152 158V115H174V158ZM186 158V82H208V158ZM220 158V103H242V158ZM254 158V73H276V158Z"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M16 128V101H38V128ZM50 112V86H72V112ZM84 121V94H106V121ZM118 96V68H140V96ZM152 115V87H174V115ZM186 82V54H208V82ZM220 103V75H242V103ZM254 73V45H276V73Z"
            fill="var(--catalog-preview-2)"
          />
          <path
            d="M16 101V83H38V101ZM50 86V63H72V86ZM84 94V76H106V94ZM118 68V44H140V68ZM152 87V67H174V87ZM186 54V32H208V54ZM220 75V54H242V75ZM254 45V24H276V45Z"
            fill="var(--catalog-preview-3)"
          />
          <path
            d="M16 68H272"
            stroke="var(--catalog-preview-3)"
            strokeDasharray="4 4"
            strokeWidth="2.5"
          />
          <rect
            fill="Canvas"
            height="18"
            rx="4"
            stroke="var(--catalog-preview-muted)"
            width="37"
            x="108"
            y="166"
          />
          <rect
            fill="Canvas"
            height="18"
            rx="4"
            stroke="var(--catalog-preview-muted)"
            width="31"
            x="12"
            y="59"
          />
          <g fill="currentColor" fontSize="8" opacity=".72" textAnchor="middle">
            <text x="126" y="178">
              Mar
            </text>
            <text x="27" y="71">
              42
            </text>
          </g>
        </g>
      )
  }

  return undefined
}
