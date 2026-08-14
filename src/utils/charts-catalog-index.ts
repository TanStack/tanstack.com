import * as v from 'valibot'

export const chartsCatalogIndexRepo = 'tanstack/charts'
export const chartsCatalogIndexRef = 'main'
export const chartsCatalogIndexPath =
  'benchmarks/conformance/catalog-index.json'
export const chartsCatalogIndexCacheTag = 'docs:charts:branch:main'
export const chartsCatalogIndexCacheHeaders = {
  'Cache-Control': 'public, max-age=60, must-revalidate',
  'Cloudflare-CDN-Cache-Control':
    'public, max-age=300, stale-while-revalidate=300',
  'Cache-Tag': chartsCatalogIndexCacheTag,
}

const nonEmptyStringSchema = v.pipe(v.string(), v.nonEmpty())
const nonNegativeIntegerSchema = v.pipe(
  v.number(),
  v.finite(),
  v.integer(),
  v.minValue(0),
)
const caseIdSchema = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid catalog case ID'),
)
const gitShaSchema = v.pipe(
  v.string(),
  v.regex(/^[a-f0-9]{40}$/, 'Expected a lowercase 40-character Git SHA'),
)
const httpsUrlSchema = v.pipe(
  v.string(),
  v.url(),
  v.check((value) => new URL(value).protocol === 'https:', 'Expected HTTPS'),
)
const referenceRendererSchema = v.picklist([
  'observable-plot',
  'recharts',
  'echarts',
])
const caseEntryPathSchema = v.pipe(
  v.string(),
  v.regex(
    /^benchmarks\/conformance\/cases\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:tanstack|plot|recharts|echarts)\.ts$/,
    'Invalid catalog entry path',
  ),
)

// Deliberately use `object` here. The Charts benchmark owns geometry and
// interaction metadata; the site validates and retains only its UI contract.
const catalogCaseSchema = v.pipe(
  v.object({
    schemaVersion: v.literal(1),
    order: nonNegativeIntegerSchema,
    id: caseIdSchema,
    collection: v.optional(caseIdSchema),
    title: nonEmptyStringSchema,
    family: nonEmptyStringSchema,
    intent: nonEmptyStringSchema,
    support: v.picklist(['native', 'composed', 'gap', 'deferred']),
    features: v.array(nonEmptyStringSchema),
    source: v.strictObject({
      title: nonEmptyStringSchema,
      url: httpsUrlSchema,
    }),
    ai: v.strictObject({
      create: nonEmptyStringSchema,
      maintain: nonEmptyStringSchema,
    }),
    entries: v.strictObject({
      tanstack: caseEntryPathSchema,
      reference: v.strictObject({
        renderer: referenceRendererSchema,
        path: caseEntryPathSchema,
      }),
    }),
  }),
  v.check(
    (catalogCase) =>
      new Set(catalogCase.features).size === catalogCase.features.length,
    'Catalog case features must be unique',
  ),
  v.check(
    (catalogCase) =>
      catalogCase.entries.tanstack ===
      `benchmarks/conformance/cases/${catalogCase.id}/tanstack.ts`,
    'Catalog case TanStack entry must match its ID',
  ),
  v.check((catalogCase) => {
    const filename =
      catalogCase.entries.reference.renderer === 'observable-plot'
        ? 'plot'
        : catalogCase.entries.reference.renderer
    return (
      catalogCase.entries.reference.path ===
      `benchmarks/conformance/cases/${catalogCase.id}/${filename}.ts`
    )
  }, 'Catalog case reference entry must match its ID and renderer'),
)

const catalogIndexSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    source: v.strictObject({
      repo: v.literal(chartsCatalogIndexRepo),
      pathRoot: v.literal('benchmarks/conformance/'),
    }),
    cases: v.pipe(v.array(catalogCaseSchema), v.minLength(1)),
  }),
  v.check((index) => {
    const ids = index.cases.map((catalogCase) => catalogCase.id)
    return new Set(ids).size === ids.length
  }, 'Catalog case IDs must be unique'),
  v.check((index) => {
    const orders = index.cases.map((catalogCase) => catalogCase.order)
    return new Set(orders).size === orders.length
  }, 'Catalog case orders must be unique'),
  v.check(
    (index) =>
      index.cases.every(
        (catalogCase, position) =>
          position === 0 ||
          (index.cases[position - 1]?.order ?? -1) < catalogCase.order,
      ),
    'Catalog cases must be sorted by ascending order',
  ),
)

const catalogIndexPublicationSchema = v.strictObject({
  revision: gitShaSchema,
  sourceKind: v.picklist(['local', 'remote']),
  index: catalogIndexSchema,
})

export type ChartsCatalogIndex = v.InferOutput<typeof catalogIndexSchema>
export type ChartsCatalogIndexCase = ChartsCatalogIndex['cases'][number]
export type ChartsCatalogIndexPublication = v.InferOutput<
  typeof catalogIndexPublicationSchema
>

export function parseChartsCatalogIndex(value: unknown) {
  return v.parse(catalogIndexSchema, value)
}

export function parseChartsCatalogIndexPublication(value: unknown) {
  return v.parse(catalogIndexPublicationSchema, value)
}

export function isChartsCatalogIndexPublication(
  value: unknown,
): value is ChartsCatalogIndexPublication {
  return v.safeParse(catalogIndexPublicationSchema, value).success
}
