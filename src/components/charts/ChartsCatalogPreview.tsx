import {
  chartsCatalogPreviewEarlyCaseIds,
  getChartsCatalogPreviewEarly,
} from './ChartsCatalogPreviewCasesEarly'
import {
  chartsCatalogPreviewLateCaseIds,
  getChartsCatalogPreviewLate,
} from './ChartsCatalogPreviewCasesLate'

export type ChartsCatalogPreviewKind =
  | 'area'
  | 'bars'
  | 'calendar'
  | 'candlestick'
  | 'comparison'
  | 'facets'
  | 'gauge'
  | 'grouped-bars'
  | 'heatmap'
  | 'hierarchy'
  | 'histogram'
  | 'interval'
  | 'line'
  | 'line-gaps'
  | 'map'
  | 'network'
  | 'parallel'
  | 'polar'
  | 'radar'
  | 'range'
  | 'sankey'
  | 'scatter'
  | 'waffle'

const casePreviewKinds: Readonly<Record<string, ChartsCatalogPreviewKind>> = {
  '01-line-gaps': 'line-gaps',
  '03-temperature-range-band': 'range',
  '04-stacked-time-area': 'area',
  '13-interval-timeline': 'interval',
  '14-error-bars': 'range',
  '15-boxplot': 'range',
  '16-lollipop': 'comparison',
  '17-dumbbell': 'comparison',
  '21-streamgraph': 'area',
  '22-bollinger-band': 'range',
  '25-calendar-heatmap': 'calendar',
  '27-parallel-coordinates': 'parallel',
  '28-candlestick': 'candlestick',
  '36-hierarchy-tree': 'hierarchy',
  '37-delaunay-network': 'network',
  '40-force-directed-network': 'network',
  '40-geojson-map': 'map',
  '41-waffle-unit-chart': 'waffle',
  '64-marimekko-mosaic': 'waffle',
  '74-recharts-treemap': 'waffle',
  '75-radar': 'radar',
  '76-pie': 'polar',
  '77-donut': 'polar',
  '78-gauge': 'gauge',
  '93-labeled-pie': 'polar',
  '94-center-donut': 'polar',
  '95-rounded-donut': 'polar',
  '96-nested-donut': 'polar',
  '97-rose': 'polar',
  '98-needle-gauge': 'gauge',
  '99-comparative-radar': 'radar',
  '100-radial-bars': 'polar',
  '101-sunburst': 'polar',
  '102-world-choropleth': 'map',
  '103-bubble-map': 'map',
  '104-orthographic-globe': 'map',
  '105-route-map': 'map',
  '108-country-choropleth': 'map',
  '109-us-state-choropleth': 'map',
  '110-projection-gallery': 'facets',
  '111-basic-sankey': 'sankey',
  '111-sankey-flow': 'sankey',
  '118-token-usage-calendar': 'calendar',
  'bar-grouped': 'grouped-bars',
  'bar-horizontal-ranking': 'bars',
  'bar-stacked': 'bars',
  'bar-vertical-sorted': 'bars',
  'facets-anscombe': 'facets',
  'heatmap-labeled': 'heatmap',
  histogram: 'histogram',
  'scatter-bubble': 'scatter',
}

const familyPreviewKinds: Readonly<Record<string, ChartsCatalogPreviewKind>> = {
  bar: 'bars',
  change: 'line',
  comparison: 'comparison',
  composition: 'area',
  decoration: 'scatter',
  distribution: 'histogram',
  financial: 'candlestick',
  geography: 'map',
  hierarchy: 'hierarchy',
  interaction: 'line',
  interval: 'interval',
  matrix: 'heatmap',
  motion: 'line',
  multivariate: 'parallel',
  network: 'network',
  'part-to-whole': 'waffle',
  performance: 'scatter',
  polar: 'polar',
  range: 'range',
  ranking: 'line',
  relationship: 'scatter',
  'small multiples': 'facets',
  spatial: 'network',
  survey: 'bars',
  time: 'calendar',
  trend: 'line',
  uncertainty: 'range',
}

export function getChartsCatalogPreviewKind(
  caseId: string,
  family: string,
): ChartsCatalogPreviewKind {
  return casePreviewKinds[caseId] ?? familyPreviewKinds[family] ?? 'line'
}

export function ChartsCatalogPreview({
  caseId,
  className,
  family,
}: {
  caseId: string
  className?: string
  family: string
}) {
  const kind = getChartsCatalogPreviewKind(caseId, family)
  const exactGraphic =
    getChartsCatalogPreviewEarly(caseId) ?? getChartsCatalogPreviewLate(caseId)

  return (
    <svg
      aria-hidden="true"
      className={`charts-catalog-preview ${className ?? ''}`}
      data-catalog-preview-case={caseId}
      data-catalog-preview-kind={exactGraphic === undefined ? kind : 'case'}
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
      viewBox="0 0 288 192"
    >
      {exactGraphic ?? <PreviewGraphic kind={kind} />}
    </svg>
  )
}

export const chartsCatalogPreviewCaseIds = [
  ...chartsCatalogPreviewEarlyCaseIds,
  ...chartsCatalogPreviewLateCaseIds,
] as const

function PreviewGraphic({ kind }: { kind: ChartsCatalogPreviewKind }) {
  switch (kind) {
    case 'area':
      return (
        <>
          <path
            d="M18 160L18 112C49 86 76 123 108 91S171 78 202 54S246 60 270 28V160Z"
            fill="var(--catalog-preview-3)"
            opacity=".28"
          />
          <path
            d="M18 160L18 132C51 113 80 145 111 118S169 106 203 82S247 88 270 61V160Z"
            fill="var(--catalog-preview-1)"
            opacity=".7"
          />
          <path
            d="M18 111C49 86 76 123 108 91S171 78 202 54S246 60 270 28"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </>
      )
    case 'bars':
      return (
        <>
          <path
            d="M24 124H54V164H24ZM72 79H102V164H72ZM120 103H150V164H120ZM168 43H198V164H168ZM216 67H246V164H216Z"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M24 124H54V139H24ZM72 79H102V100H72ZM120 103H150V118H120ZM168 43H198V69H168ZM216 67H246V85H216Z"
            fill="var(--catalog-preview-2)"
          />
        </>
      )
    case 'calendar':
      return (
        <>
          <path
            d="M22 35H54V60H22ZM58 35H90V60H58ZM94 35H126V60H94ZM130 35H162V60H130ZM166 35H198V60H166ZM202 35H234V60H202ZM238 35H270V60H238ZM22 64H54V89H22ZM94 64H126V89H94ZM130 64H162V89H130ZM202 64H234V89H202ZM238 64H270V89H238ZM58 93H90V118H58ZM94 93H126V118H94ZM166 93H198V118H166ZM202 93H234V118H202ZM22 122H54V147H22ZM58 122H90V147H58ZM130 122H162V147H130ZM166 122H198V147H166ZM238 122H270V147H238Z"
            fill="var(--catalog-preview-1)"
            opacity=".35"
          />
          <path
            d="M58 64H90V89H58ZM166 64H198V89H166ZM22 93H54V118H22ZM130 93H162V118H130ZM238 93H270V118H238ZM94 122H126V147H94ZM202 122H234V147H202Z"
            fill="var(--catalog-preview-2)"
          />
        </>
      )
    case 'candlestick':
      return (
        <>
          <path
            d="M38 44V145M80 67V161M122 34V123M164 53V153M206 30V114M248 65V150"
            fill="none"
            stroke="var(--catalog-preview-muted)"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path
            d="M27 78H49V126H27ZM111 53H133V99H111ZM195 48H217V87H195Z"
            fill="var(--catalog-preview-2)"
          />
          <path
            d="M69 91H91V137H69ZM153 79H175V124H153ZM237 87H259V127H237Z"
            fill="var(--catalog-preview-1)"
          />
        </>
      )
    case 'comparison':
      return (
        <>
          <path
            d="M51 48H198M83 88H246M38 128H176M105 163H235"
            fill="none"
            stroke="var(--catalog-preview-muted)"
            strokeLinecap="round"
            strokeWidth="5"
          />
          <path
            d="M51 38a10 10 0 1 1 0 20a10 10 0 1 1 0-20M83 78a10 10 0 1 1 0 20a10 10 0 1 1 0-20M38 118a10 10 0 1 1 0 20a10 10 0 1 1 0-20M105 153a10 10 0 1 1 0 20a10 10 0 1 1 0-20"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M198 38a10 10 0 1 1 0 20a10 10 0 1 1 0-20M246 78a10 10 0 1 1 0 20a10 10 0 1 1 0-20M176 118a10 10 0 1 1 0 20a10 10 0 1 1 0-20M235 153a10 10 0 1 1 0 20a10 10 0 1 1 0-20"
            fill="var(--catalog-preview-2)"
          />
        </>
      )
    case 'facets':
      return (
        <>
          <path
            d="M20 83C39 73 50 39 76 51S102 69 125 29M163 78C187 44 210 69 230 46S254 56 268 25M20 166C43 133 65 159 89 123S113 142 125 109M163 166C183 142 205 149 223 119S252 137 268 98"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          <path
            d="M144 18V174M12 96H276"
            fill="none"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="2"
          />
        </>
      )
    case 'gauge':
      return (
        <>
          <path
            d="M50 145a98 98 0 0 1 188 0"
            fill="none"
            stroke="var(--catalog-preview-muted)"
            strokeLinecap="round"
            strokeWidth="23"
          />
          <path
            d="M50 145a98 98 0 0 1 152-81"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeLinecap="round"
            strokeWidth="23"
          />
          <path
            d="M144 144L202 76"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeWidth="7"
          />
          <circle cx="144" cy="144" fill="var(--catalog-preview-2)" r="11" />
        </>
      )
    case 'grouped-bars':
      return (
        <>
          <path
            d="M24 92H44V164H24ZM88 62H108V164H88ZM152 83H172V164H152ZM216 39H236V164H216Z"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M47 121H67V164H47ZM111 91H131V164H111ZM175 49H195V164H175ZM239 78H259V164H239Z"
            fill="var(--catalog-preview-2)"
          />
        </>
      )
    case 'heatmap':
      return (
        <>
          <path
            d="M22 27H66V59H22ZM70 27H114V59H70ZM166 27H210V59H166ZM214 27H258V59H214ZM70 63H114V95H70ZM118 63H162V95H118ZM214 63H258V95H214ZM22 99H66V131H22ZM118 99H162V131H118ZM166 99H210V131H166ZM70 135H114V167H70ZM214 135H258V167H214Z"
            fill="var(--catalog-preview-1)"
            opacity=".38"
          />
          <path
            d="M118 27H162V59H118ZM22 63H66V95H22ZM166 63H210V95H166ZM70 99H114V131H70ZM214 99H258V131H214ZM22 135H66V167H22ZM118 135H162V167H118ZM166 135H210V167H166Z"
            fill="var(--catalog-preview-2)"
          />
        </>
      )
    case 'hierarchy':
      return (
        <>
          <path
            d="M144 42V73M72 73H216M72 73V111M216 73V111M36 111H108M180 111H252M36 111V148M108 111V148M180 111V148M252 111V148"
            fill="none"
            stroke="var(--catalog-preview-muted)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          <path
            d="M144 29a13 13 0 1 1 0 26a13 13 0 1 1 0-26M72 61a12 12 0 1 1 0 24a12 12 0 1 1 0-24M216 61a12 12 0 1 1 0 24a12 12 0 1 1 0-24"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M36 137a11 11 0 1 1 0 22a11 11 0 1 1 0-22M108 137a11 11 0 1 1 0 22a11 11 0 1 1 0-22M180 137a11 11 0 1 1 0 22a11 11 0 1 1 0-22M252 137a11 11 0 1 1 0 22a11 11 0 1 1 0-22"
            fill="var(--catalog-preview-2)"
          />
        </>
      )
    case 'histogram':
      return (
        <>
          <path
            d="M20 157H42V143H20ZM44 157H66V119H44ZM68 157H90V91H68ZM92 157H114V56H92ZM116 157H138V30H116ZM140 157H162V45H140ZM164 157H186V72H164ZM188 157H210V103H188ZM212 157H234V130H212ZM236 157H258V147H236Z"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M20 144C60 143 71 105 97 69S130 23 156 46S191 112 258 147"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </>
      )
    case 'interval':
      return (
        <>
          <path
            d="M19 36H97V59H19ZM109 36H214V59H109ZM43 70H158V93H43ZM170 70H268V93H170ZM19 104H74V127H19ZM86 104H190V127H86ZM202 104H249V127H202ZM61 138H141V161H61ZM153 138H268V161H153Z"
            fill="var(--catalog-preview-1)"
            opacity=".42"
          />
          <path
            d="M109 36H214V59H109ZM43 70H158V93H43ZM202 104H249V127H202ZM153 138H268V161H153Z"
            fill="var(--catalog-preview-2)"
          />
        </>
      )
    case 'line':
      return (
        <>
          <path
            d="M17 146C42 131 50 85 78 94S116 133 139 96S172 35 197 59S225 112 271 35"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="5"
          />
          <path
            d="M17 119C47 102 59 134 88 114S122 50 151 72S191 131 220 105S246 74 271 81"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        </>
      )
    case 'line-gaps':
      return (
        <>
          <path
            d="M18 143C46 125 58 77 90 94S125 120 143 90"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeLinecap="round"
            strokeWidth="5"
          />
          <path
            d="M176 84C199 47 226 71 270 31"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeLinecap="round"
            strokeWidth="5"
          />
          <path
            d="M18 116C45 100 62 132 91 111S127 53 155 72S196 128 222 104S251 70 270 78"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeWidth="4"
          />
        </>
      )
    case 'map':
      return (
        <>
          <path
            d="M32 51L61 34L91 38L107 54L96 70L72 72L66 91L43 96L25 78ZM124 44L147 30L179 39L192 57L183 78L161 88L156 119L137 148L119 135L126 107L111 83ZM199 95L224 80L256 91L267 111L251 131L221 128L205 111Z"
            fill="var(--catalog-preview-1)"
            opacity=".68"
          />
          <path
            d="M69 72C105 91 135 64 166 77S214 120 251 107"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeWidth="4"
          />
          <path
            d="M69 64a8 8 0 1 1 0 16a8 8 0 1 1 0-16M166 69a8 8 0 1 1 0 16a8 8 0 1 1 0-16M251 99a8 8 0 1 1 0 16a8 8 0 1 1 0-16"
            fill="var(--catalog-preview-2)"
          />
        </>
      )
    case 'network':
      return (
        <>
          <path
            d="M41 112L81 49L136 81L190 36L245 79L224 145L157 151L101 133L41 112M81 49L101 133M136 81L157 151M190 36L224 145M136 81L245 79"
            fill="none"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="3"
          />
          <path
            d="M41 100a12 12 0 1 1 0 24a12 12 0 1 1 0-24M81 37a12 12 0 1 1 0 24a12 12 0 1 1 0-24M136 69a12 12 0 1 1 0 24a12 12 0 1 1 0-24M190 24a12 12 0 1 1 0 24a12 12 0 1 1 0-24M245 67a12 12 0 1 1 0 24a12 12 0 1 1 0-24M224 133a12 12 0 1 1 0 24a12 12 0 1 1 0-24M157 139a12 12 0 1 1 0 24a12 12 0 1 1 0-24M101 121a12 12 0 1 1 0 24a12 12 0 1 1 0-24"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M136 72a9 9 0 1 1 0 18a9 9 0 1 1 0-18M224 136a9 9 0 1 1 0 18a9 9 0 1 1 0-18"
            fill="var(--catalog-preview-2)"
          />
        </>
      )
    case 'parallel':
      return (
        <>
          <path
            d="M30 34V159M87 34V159M144 34V159M201 34V159M258 34V159"
            fill="none"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="2"
          />
          <path
            d="M30 57L87 123L144 74L201 142L258 91M30 118L87 52L144 133L201 66L258 125M30 145L87 92L144 46L201 111L258 54"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <path
            d="M30 81L87 145L144 102L201 43L258 151"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        </>
      )
    case 'polar':
      return (
        <>
          <circle
            cx="144"
            cy="96"
            fill="none"
            r="58"
            stroke="var(--catalog-preview-muted)"
            strokeWidth="31"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            r="58"
            pathLength="100"
            stroke="var(--catalog-preview-1)"
            strokeDasharray="42 58"
            strokeLinecap="round"
            strokeWidth="31"
            transform="rotate(-90 144 96)"
          />
          <circle
            cx="144"
            cy="96"
            fill="none"
            r="58"
            pathLength="100"
            stroke="var(--catalog-preview-2)"
            strokeDasharray="25 75"
            strokeDashoffset="-45"
            strokeLinecap="round"
            strokeWidth="31"
            transform="rotate(-90 144 96)"
          />
        </>
      )
    case 'radar':
      return (
        <>
          <path
            d="M144 22L216 73L189 158H99L72 73Z"
            fill="none"
            stroke="var(--catalog-preview-muted)"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M144 43L196 80L177 139H111L92 80Z"
            fill="var(--catalog-preview-1)"
            opacity=".32"
            stroke="var(--catalog-preview-1)"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          <path
            d="M144 60L179 84L166 125H121L108 84Z"
            fill="var(--catalog-preview-2)"
            opacity=".28"
            stroke="var(--catalog-preview-2)"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        </>
      )
    case 'range':
      return (
        <>
          <path
            d="M18 128C48 101 72 117 101 83S154 69 184 45S233 65 270 34L270 91C239 106 213 86 185 109S135 126 104 142S49 147 18 163Z"
            fill="var(--catalog-preview-1)"
            opacity=".3"
          />
          <path
            d="M18 145C49 124 76 130 103 111S155 96 185 76S232 85 270 61"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeLinecap="round"
            strokeWidth="5"
          />
          <path
            d="M18 121C47 94 72 111 101 77S154 63 184 39S233 59 270 28"
            fill="none"
            stroke="var(--catalog-preview-2)"
            strokeLinecap="round"
            strokeWidth="3"
          />
        </>
      )
    case 'sankey':
      return (
        <>
          <path
            d="M45 48C104 48 106 71 169 71S213 50 253 50M45 81C103 81 109 120 169 120S213 143 253 143M45 126C94 126 112 94 169 94S213 96 253 96"
            fill="none"
            stroke="var(--catalog-preview-1)"
            strokeLinecap="round"
            strokeWidth="17"
            opacity=".5"
          />
          <path
            d="M28 31H48V143H28ZM159 52H179V137H159ZM243 32H263V158H243Z"
            fill="var(--catalog-preview-2)"
          />
        </>
      )
    case 'scatter':
      return (
        <>
          <path
            d="M34 136a8 8 0 1 1 0 16a8 8 0 1 1 0-16M62 119a11 11 0 1 1 0 22a11 11 0 1 1 0-22M91 132a7 7 0 1 1 0 14a7 7 0 1 1 0-14M111 91a14 14 0 1 1 0 28a14 14 0 1 1 0-28M145 102a8 8 0 1 1 0 16a8 8 0 1 1 0-16M172 67a12 12 0 1 1 0 24a12 12 0 1 1 0-24M207 76a7 7 0 1 1 0 14a7 7 0 1 1 0-14M229 39a15 15 0 1 1 0 30a15 15 0 1 1 0-30M258 50a9 9 0 1 1 0 18a9 9 0 1 1 0-18"
            fill="var(--catalog-preview-1)"
            opacity=".78"
          />
          <path
            d="M47 97a7 7 0 1 1 0 14a7 7 0 1 1 0-14M82 84a9 9 0 1 1 0 18a9 9 0 1 1 0-18M135 63a7 7 0 1 1 0 14a7 7 0 1 1 0-14M188 111a10 10 0 1 1 0 20a10 10 0 1 1 0-20M240 101a8 8 0 1 1 0 16a8 8 0 1 1 0-16"
            fill="var(--catalog-preview-2)"
            opacity=".85"
          />
        </>
      )
    case 'waffle':
      return (
        <>
          <path
            d="M25 34H67V69H25ZM72 34H114V69H72ZM119 34H161V69H119ZM166 34H208V69H166ZM213 34H255V69H213ZM25 74H67V109H25ZM72 74H114V109H72ZM119 74H161V109H119ZM25 114H67V149H25ZM72 114H114V149H72Z"
            fill="var(--catalog-preview-1)"
          />
          <path
            d="M166 74H208V109H166ZM213 74H255V109H213ZM119 114H161V149H119ZM166 114H208V149H166ZM213 114H255V149H213Z"
            fill="var(--catalog-preview-2)"
            opacity=".42"
          />
        </>
      )
  }
}
