import * as v from 'valibot'

export const chartsCatalogRepo = 'tanstack/charts'
export const chartsCatalogPublicationRef = 'catalog-dist'
export const chartsCatalogPublicationCacheTag =
  'charts-catalog:tanstack/charts:catalog-dist'
export const chartsCatalogBasePath = '/charts/catalog/'
export const chartsCatalogAssetBasePath = '/charts/catalog/assets/'
export const chartsCatalogPublicationCacheHeaders = {
  'Cache-Control': 'public, max-age=60, must-revalidate',
  'Cloudflare-CDN-Cache-Control':
    'public, max-age=300, stale-while-revalidate=300',
  'Cache-Tag': chartsCatalogPublicationCacheTag,
}

const gitShaSchema = v.pipe(
  v.string(),
  v.regex(/^[a-f0-9]{40}$/, 'Expected a lowercase 40-character Git SHA'),
)

const sha256Schema = v.pipe(
  v.string(),
  v.regex(/^[a-f0-9]{64}$/, 'Expected a lowercase SHA-256 digest'),
)

const chartsCatalogCaseIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const chartsCatalogCaseIdSchema = v.pipe(
  v.string(),
  v.regex(chartsCatalogCaseIdPattern, 'Invalid catalog case ID'),
)

export function isChartsCatalogCaseId(value: string) {
  return chartsCatalogCaseIdPattern.test(value)
}

export const chartsCatalogAssetPathSchema = v.pipe(
  v.string(),
  v.regex(
    /^assets\/[a-zA-Z0-9][a-zA-Z0-9._-]*-[a-zA-Z0-9_-]{5,}\.js$/,
    'Expected a flat, hashed JavaScript asset path',
  ),
)

const sourcePathSchema = v.pipe(
  v.string(),
  v.regex(
    /^(?:benchmarks|examples)\/[a-zA-Z0-9._/-]+\.(?:ts|tsx)$/,
    'Invalid catalog source path',
  ),
  v.check(
    (path) =>
      !path.includes('..') &&
      !path.includes('//') &&
      !path.includes('\\') &&
      !path.startsWith('/'),
    'Unsafe catalog source path',
  ),
)

const catalogSourcePathRoot = 'benchmarks/conformance/'

const catalogAuthoredSourcePathSchema = v.string()

const sourceUrlSchema = v.pipe(
  v.string(),
  v.url(),
  v.check(
    (value) => new URL(value).protocol === 'https:',
    'Expected an HTTPS source URL',
  ),
)

const rendererSchema = v.picklist(['observable-plot', 'recharts', 'echarts'])

const geometrySchema = v.strictObject({
  role: v.pipe(v.string(), v.nonEmpty()),
  count: v.pipe(v.number(), v.integer(), v.minValue(0)),
  rendererRoles: v.optional(
    v.record(
      v.picklist(['observable-plot', 'recharts', 'echarts', 'tanstack']),
      v.pipe(v.string(), v.nonEmpty()),
    ),
  ),
  maxCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  view: v.optional(v.pipe(v.string(), v.nonEmpty())),
  id: v.optional(v.pipe(v.string(), v.nonEmpty())),
})

const caseModuleSchema = v.strictObject({
  path: chartsCatalogAssetPathSchema,
  preload: v.array(chartsCatalogAssetPathSchema),
})

const comparisonModuleSchema = v.strictObject({
  renderer: rendererSchema,
  path: chartsCatalogAssetPathSchema,
  preload: v.array(chartsCatalogAssetPathSchema),
  visibility: v.literal('debug'),
})

const catalogSourceMetricsSchema = v.strictObject({
  files: v.pipe(v.number(), v.integer(), v.minValue(0)),
  lines: v.pipe(v.number(), v.integer(), v.minValue(0)),
  bytes: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

const catalogSourceRoleSchema = v.strictObject({
  ...catalogSourceMetricsSchema.entries,
  paths: v.array(catalogAuthoredSourcePathSchema),
})

const catalogSourceClosureSchema = v.strictObject({
  totalFiles: v.pipe(v.number(), v.integer(), v.minValue(0)),
  totalLines: v.pipe(v.number(), v.integer(), v.minValue(0)),
  totalBytes: v.pipe(v.number(), v.integer(), v.minValue(0)),
  datasetIds: v.array(v.string()),
  roles: v.strictObject({
    entry: catalogSourceRoleSchema,
    support: catalogSourceRoleSchema,
    fixture: catalogSourceRoleSchema,
    harness: catalogSourceRoleSchema,
  }),
})

const catalogDatasetSchema = v.strictObject({
  id: v.string(),
  title: v.string(),
  specifier: v.string(),
  format: v.picklist(['CSV', 'JSON']),
  records: v.pipe(v.number(), v.integer(), v.minValue(0)),
  fields: v.array(v.string()),
  schema: v.array(
    v.strictObject({
      name: v.string(),
      types: v.array(v.string()),
    }),
  ),
  bytes: v.pipe(v.number(), v.integer(), v.minValue(0)),
  sha256: sha256Schema,
  selection: v.string(),
  source: v.string(),
  sourceUrl: v.string(),
  observablePackage: v.string(),
  observableRevision: v.string(),
  observableFile: v.string(),
  observableUrl: v.string(),
  license: v.string(),
})

const catalogCaseEntries = {
  schemaVersion: v.literal(1),
  referenceRenderer: v.optional(rendererSchema),
  order: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id: chartsCatalogCaseIdSchema,
  title: v.pipe(v.string(), v.nonEmpty()),
  family: v.pipe(v.string(), v.nonEmpty()),
  intent: v.pipe(v.string(), v.nonEmpty()),
  support: v.picklist(['native', 'composed', 'gap', 'deferred']),
  features: v.array(v.pipe(v.string(), v.nonEmpty())),
  geometry: v.array(geometrySchema),
  source: v.strictObject({
    title: v.pipe(v.string(), v.nonEmpty()),
    url: sourceUrlSchema,
  }),
  ai: v.strictObject({
    create: v.pipe(v.string(), v.nonEmpty()),
    maintain: v.pipe(v.string(), v.nonEmpty()),
  }),
  routes: v.strictObject({
    page: v.pipe(v.string(), v.nonEmpty()),
    embed: v.pipe(v.string(), v.nonEmpty()),
  }),
  code: v.strictObject({
    tanstack: sourcePathSchema,
    reference: sourcePathSchema,
  }),
  modules: v.strictObject({
    tanstack: caseModuleSchema,
    comparison: comparisonModuleSchema,
  }),
  guideAssertions: v.optional(v.array(v.unknown())),
  interactionScenarios: v.optional(v.array(v.unknown())),
  minimumGeometrySimilarity: v.optional(
    v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  ),
}

const catalogCaseSchema = v.strictObject({
  ...catalogCaseEntries,
  authoredSource: v.strictObject({
    tanstack: catalogSourceClosureSchema,
    reference: catalogSourceClosureSchema,
  }),
})

const assetDescriptorSchema = v.strictObject({
  bytes: v.pipe(v.number(), v.integer(), v.minValue(0)),
  sha256: sha256Schema,
  imports: v.array(chartsCatalogAssetPathSchema),
  dynamicImports: v.array(chartsCatalogAssetPathSchema),
})

const catalogRuntimeSchema = v.strictObject({
  contractVersion: v.literal(1),
  export: v.literal('mount'),
})

const catalogSiteSchema = v.strictObject({
  origin: v.literal('https://tanstack.com'),
  basePath: v.literal(chartsCatalogBasePath),
  assetBasePath: v.literal(chartsCatalogAssetBasePath),
})

const catalogEmbedSchema = v.strictObject({
  protocol: v.strictObject({
    type: v.literal('tanstack-charts:embed'),
    version: v.literal(1),
    statuses: v.tuple([
      v.literal('ready'),
      v.literal('resize'),
      v.literal('error'),
    ]),
    commands: v.tuple([v.literal('set-theme')]),
  }),
  parameters: v.strictObject({
    theme: v.strictObject({
      values: v.tuple([
        v.literal('system'),
        v.literal('light'),
        v.literal('dark'),
      ]),
      default: v.literal('system'),
    }),
    height: v.strictObject({
      minimum: v.literal(120),
      maximum: v.literal(1_200),
      default: v.literal(360),
    }),
    revision: v.strictObject({
      minimum: v.literal(0),
      maximum: v.literal(10_000),
      default: v.literal(0),
    }),
  }),
})

const catalogAssetsSchema = v.pipe(
  v.record(chartsCatalogAssetPathSchema, assetDescriptorSchema),
  v.maxEntries(1_000),
)

const chartsCatalogManifestSchema = v.strictObject({
  schemaVersion: v.literal(4),
  revision: gitShaSchema,
  source: v.strictObject({
    repo: v.literal(chartsCatalogRepo),
    ref: gitShaSchema,
    pathRoot: v.literal(catalogSourcePathRoot),
  }),
  runtime: catalogRuntimeSchema,
  site: catalogSiteSchema,
  embed: catalogEmbedSchema,
  datasets: v.record(v.string(), catalogDatasetSchema),
  assets: catalogAssetsSchema,
  cases: v.pipe(v.array(catalogCaseSchema), v.nonEmpty()),
})

export type ChartsCatalogManifest = v.InferOutput<
  typeof chartsCatalogManifestSchema
>
export type ChartsCatalogCase = ChartsCatalogManifest['cases'][number]
export type ChartsCatalogDataset = v.InferOutput<typeof catalogDatasetSchema>

export type ChartsCatalogSourceKind = 'entry' | 'support' | 'fixture'

export type ChartsCatalogAuthoredSource = {
  totalFiles: number
  totalLines: number
  totalBytes: number
  roles: Record<
    ChartsCatalogSourceKind,
    v.InferOutput<typeof catalogSourceMetricsSchema>
  >
  files: Array<{
    path: string
    source: string
    kind: ChartsCatalogSourceKind
    lines: number
    bytes: number
  }>
  datasets: Array<ChartsCatalogDataset>
  excludedHarness: v.InferOutput<typeof catalogSourceRoleSchema>
}

export type ChartsCatalogPublication = {
  artifactRevision: string
  manifest: ChartsCatalogManifest
}

export function parseChartsCatalogManifest(
  value: unknown,
): ChartsCatalogManifest {
  const parsed = v.safeParse(chartsCatalogManifestSchema, value)
  if (!parsed.success) {
    throw new TypeError(
      `Invalid Charts catalog manifest: ${v.summarize(parsed.issues)}`,
    )
  }

  validateManifestRelationships(parsed.output)
  return parsed.output
}

function validateManifestRelationships(manifest: ChartsCatalogManifest) {
  if (manifest.source.ref !== manifest.revision) {
    throw new TypeError(
      'Invalid Charts catalog manifest: source.ref must match revision',
    )
  }

  const assetPaths = new Set(Object.keys(manifest.assets))
  if (assetPaths.size === 0) {
    throw new TypeError(
      'Invalid Charts catalog manifest: assets must not be empty',
    )
  }

  let totalAssetBytes = 0
  for (const [assetPath, descriptor] of Object.entries(manifest.assets)) {
    if (
      !Number.isSafeInteger(descriptor.bytes) ||
      descriptor.bytes > 1024 * 1024
    ) {
      throw new TypeError(
        `Invalid Charts catalog manifest: ${assetPath} exceeds 1 MiB`,
      )
    }
    totalAssetBytes += descriptor.bytes
    for (const dependency of [
      ...descriptor.imports,
      ...descriptor.dynamicImports,
    ]) {
      if (!assetPaths.has(dependency)) {
        throw new TypeError(
          `Invalid Charts catalog manifest: ${assetPath} references unlisted asset ${dependency}`,
        )
      }
    }
  }
  if (totalAssetBytes > 6 * 1024 * 1024) {
    throw new TypeError(
      'Invalid Charts catalog manifest: assets exceed 6 MiB total',
    )
  }

  validateCatalogDatasets(manifest)

  const caseIds = new Set<string>()
  const caseOrders = new Set<number>()

  for (const catalogCase of manifest.cases) {
    if (!Number.isSafeInteger(catalogCase.order)) {
      throw new TypeError(
        `Invalid Charts catalog manifest: invalid case order ${catalogCase.order}`,
      )
    }
    if (caseIds.has(catalogCase.id)) {
      throw new TypeError(
        `Invalid Charts catalog manifest: duplicate case ID ${catalogCase.id}`,
      )
    }
    if (caseOrders.has(catalogCase.order)) {
      throw new TypeError(
        `Invalid Charts catalog manifest: duplicate case order ${catalogCase.order}`,
      )
    }
    caseIds.add(catalogCase.id)
    caseOrders.add(catalogCase.order)

    const comparisonRenderer =
      catalogCase.referenceRenderer ?? 'observable-plot'
    const referenceFilename =
      comparisonRenderer === 'observable-plot' ? 'plot' : comparisonRenderer
    const sourceRoot = `benchmarks/conformance/cases/${catalogCase.id}`
    if (
      catalogCase.code.tanstack !== `${sourceRoot}/tanstack.ts` ||
      catalogCase.code.reference !== `${sourceRoot}/${referenceFilename}.ts` ||
      catalogCase.modules.comparison.renderer !== comparisonRenderer
    ) {
      throw new TypeError(
        `Invalid Charts catalog manifest: source or renderer does not match case ${catalogCase.id}`,
      )
    }

    if (
      catalogCase.routes.page !==
        `${chartsCatalogBasePath}charts/${catalogCase.id}/` ||
      catalogCase.routes.embed !==
        `${chartsCatalogBasePath}embed/${catalogCase.id}/`
    ) {
      throw new TypeError(
        `Invalid Charts catalog manifest: routes do not match case ${catalogCase.id}`,
      )
    }

    validateCaseModuleAssets(
      catalogCase.id,
      'tanstack',
      catalogCase.modules.tanstack,
      assetPaths,
    )

    validateCaseModuleAssets(
      catalogCase.id,
      'comparison',
      catalogCase.modules.comparison,
      assetPaths,
    )
  }

  for (const catalogCase of manifest.cases) {
    validateCatalogSourceClosure(
      catalogCase.authoredSource.tanstack,
      `${catalogCase.id} TanStack authored source`,
      catalogCase.code.tanstack.slice(manifest.source.pathRoot.length),
      manifest.datasets,
    )
    validateCatalogSourceClosure(
      catalogCase.authoredSource.reference,
      `${catalogCase.id} reference authored source`,
      catalogCase.code.reference.slice(manifest.source.pathRoot.length),
      manifest.datasets,
    )
  }

  const reachableAssets = new Set<string>()
  for (const catalogCase of manifest.cases) {
    validateStaticPreloadClosure(
      catalogCase.id,
      'tanstack',
      catalogCase.modules.tanstack,
      manifest,
    )
    collectReachableAssets(
      catalogCase.modules.tanstack.path,
      manifest,
      reachableAssets,
    )

    validateStaticPreloadClosure(
      catalogCase.id,
      'comparison',
      catalogCase.modules.comparison,
      manifest,
    )
    collectReachableAssets(
      catalogCase.modules.comparison.path,
      manifest,
      reachableAssets,
    )
  }

  for (const assetPath of assetPaths) {
    if (!reachableAssets.has(assetPath)) {
      throw new TypeError(
        `Invalid Charts catalog manifest: unreferenced asset ${assetPath}`,
      )
    }
  }
}

function validateCaseModuleAssets(
  caseId: string,
  renderer: string,
  module: { path: string; preload: Array<string> },
  assetPaths: Set<string>,
) {
  for (const assetPath of [module.path, ...module.preload]) {
    if (!assetPaths.has(assetPath)) {
      throw new TypeError(
        `Invalid Charts catalog manifest: ${caseId} ${renderer} module references unlisted asset ${assetPath}`,
      )
    }
  }
}

function validateStaticPreloadClosure(
  caseId: string,
  renderer: string,
  module: { path: string; preload: Array<string> },
  manifest: ChartsCatalogManifest,
) {
  const expectedPreload = new Set<string>()
  collectStaticImports(module.path, manifest, expectedPreload)
  expectedPreload.delete(module.path)

  const expected = [...expectedPreload].sort(compareStrings)
  const actualPreload = new Set(module.preload)
  const invalid =
    actualPreload.size !== module.preload.length ||
    actualPreload.size !== expected.length ||
    expected.some((assetPath) => !actualPreload.has(assetPath)) ||
    JSON.stringify(module.preload) !== JSON.stringify(expected)

  if (invalid) {
    throw new TypeError(
      `Invalid Charts catalog manifest: ${caseId} ${renderer} preload does not match its static import closure`,
    )
  }
}

type ChartsCatalogSourceClosureMetadata =
  ChartsCatalogManifest['cases'][number]['authoredSource']['tanstack']
type ChartsCatalogSourceRole = keyof ChartsCatalogSourceClosureMetadata['roles']

const chartsCatalogSourceRoles: Array<ChartsCatalogSourceRole> = [
  'entry',
  'support',
  'fixture',
  'harness',
]

function validateCatalogDatasets(manifest: ChartsCatalogManifest) {
  for (const [id, dataset] of Object.entries(manifest.datasets)) {
    if (
      dataset.id !== id ||
      dataset.specifier !== `@charts-poc/demo-data/${dataset.id}` ||
      !Number.isSafeInteger(dataset.records) ||
      !Number.isSafeInteger(dataset.bytes)
    ) {
      throw new TypeError(
        `Invalid Charts catalog manifest: dataset ${id} metadata is invalid`,
      )
    }
  }
}

function validateCatalogSourceClosure(
  closure: ChartsCatalogSourceClosureMetadata,
  label: string,
  entryPath: string,
  datasets: ChartsCatalogManifest['datasets'],
) {
  if (
    !Number.isSafeInteger(closure.totalFiles) ||
    !Number.isSafeInteger(closure.totalLines) ||
    !Number.isSafeInteger(closure.totalBytes)
  ) {
    throw new TypeError(
      `Invalid Charts catalog manifest: ${label} metrics are invalid`,
    )
  }

  const sortedDatasetIds = [...new Set(closure.datasetIds)].sort(compareStrings)
  if (
    JSON.stringify(closure.datasetIds) !== JSON.stringify(sortedDatasetIds) ||
    closure.datasetIds.some((id) => datasets[id] === undefined)
  ) {
    throw new TypeError(
      `Invalid Charts catalog manifest: ${label} dataset IDs are invalid`,
    )
  }

  const seenPaths = new Set<string>()
  for (const roleName of chartsCatalogSourceRoles) {
    validateCatalogSourceRole(
      closure.roles[roleName],
      roleName,
      label,
      seenPaths,
    )
  }

  if (
    closure.roles.entry.files !== 1 ||
    closure.roles.entry.paths[0] !== entryPath
  ) {
    throw new TypeError(
      `Invalid Charts catalog manifest: ${label} must contain one entry file`,
    )
  }

  const visibleRoles: Array<ChartsCatalogSourceKind> = [
    'entry',
    'support',
    'fixture',
  ]
  const totals = visibleRoles.reduce(
    (result, roleName) => ({
      files: result.files + closure.roles[roleName].files,
      lines: result.lines + closure.roles[roleName].lines,
      bytes: result.bytes + closure.roles[roleName].bytes,
    }),
    { files: 0, lines: 0, bytes: 0 },
  )
  if (
    totals.files !== closure.totalFiles ||
    totals.lines !== closure.totalLines ||
    totals.bytes !== closure.totalBytes
  ) {
    throw new TypeError(
      `Invalid Charts catalog manifest: ${label} totals include excluded or missing files`,
    )
  }
}

function validateCatalogSourceRole(
  role: ChartsCatalogSourceClosureMetadata['roles'][ChartsCatalogSourceRole],
  roleName: ChartsCatalogSourceRole,
  label: string,
  seenPaths: Set<string>,
) {
  if (
    !Number.isSafeInteger(role.files) ||
    !Number.isSafeInteger(role.lines) ||
    !Number.isSafeInteger(role.bytes) ||
    role.files !== role.paths.length ||
    (role.files === 0 && (role.lines !== 0 || role.bytes !== 0))
  ) {
    throw new TypeError(
      `Invalid Charts catalog manifest: ${label} ${roleName} role metrics are invalid`,
    )
  }

  if (
    JSON.stringify(role.paths) !==
    JSON.stringify([...role.paths].sort(compareStrings))
  ) {
    throw new TypeError(
      `Invalid Charts catalog manifest: ${label} ${roleName} paths must be sorted`,
    )
  }

  for (const sourcePath of role.paths) {
    if (!isCatalogSourcePath(sourcePath)) {
      throw new TypeError(
        `Invalid Charts catalog manifest: ${label} ${roleName} path is invalid`,
      )
    }
    if (seenPaths.has(sourcePath)) {
      throw new TypeError(
        `Invalid Charts catalog manifest: ${label} has duplicate path ${sourcePath}`,
      )
    }
    seenPaths.add(sourcePath)

    const harness = isCatalogHarnessSourcePath(sourcePath)
    if (roleName === 'harness' ? !harness : harness) {
      throw new TypeError(
        `Invalid Charts catalog manifest: ${label} ${roleName} path has the wrong role`,
      )
    }
  }
}

function isCatalogSourcePath(sourcePath: string) {
  return (
    isSafeRepositoryPath(sourcePath) &&
    (sourcePath.startsWith('cases/') || sourcePath.startsWith('shared/')) &&
    sourcePath.endsWith('.ts') &&
    !sourcePath.endsWith('.test.ts') &&
    !sourcePath.includes('\\') &&
    !sourcePath.includes('?') &&
    !sourcePath.includes('#')
  )
}

function isCatalogHarnessSourcePath(sourcePath: string) {
  return /^shared\/(?:mount|recharts-mount|echarts-mount)\.ts$/.test(sourcePath)
}

function isSafeRepositoryPath(value: string) {
  if (value.length === 0 || value.startsWith('/')) return false
  return value
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

function compareStrings(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function collectStaticImports(
  assetPath: string,
  manifest: ChartsCatalogManifest,
  collected: Set<string>,
) {
  if (collected.has(assetPath)) return
  collected.add(assetPath)

  const descriptor = manifest.assets[assetPath]
  if (!descriptor) return
  for (const dependency of descriptor.imports) {
    collectStaticImports(dependency, manifest, collected)
  }
}

function collectReachableAssets(
  assetPath: string,
  manifest: ChartsCatalogManifest,
  collected: Set<string>,
) {
  if (collected.has(assetPath)) return
  collected.add(assetPath)

  const descriptor = manifest.assets[assetPath]
  if (!descriptor) return
  for (const dependency of [
    ...descriptor.imports,
    ...descriptor.dynamicImports,
  ]) {
    collectReachableAssets(dependency, manifest, collected)
  }
}

export function parseChartsCatalogSearch(
  search: string,
  options: { embed?: boolean } = {},
) {
  const parameters = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  )
  const comparisonValues = parameters.getAll('compare')

  return {
    comparison: isChartsCatalogComparisonEnabled(comparisonValues, options),
  }
}

export type ChartsCatalogRouteSearch = {
  compare?: string | number | boolean | Array<string | number | boolean>
}

export function validateChartsCatalogRouteSearch(
  search: Record<string, unknown>,
): ChartsCatalogRouteSearch {
  const compare = search.compare
  if (
    typeof compare === 'string' ||
    typeof compare === 'number' ||
    typeof compare === 'boolean'
  ) {
    return { compare }
  }
  if (
    Array.isArray(compare) &&
    compare.every(
      (value): value is string | number | boolean =>
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean',
    )
  ) {
    return { compare }
  }
  return {}
}

export function parseChartsCatalogRouteSearch(
  search: ChartsCatalogRouteSearch,
  options: { embed?: boolean } = {},
) {
  const comparisonValues =
    search.compare !== undefined && !Array.isArray(search.compare)
      ? [search.compare]
      : []

  return {
    comparison: isChartsCatalogComparisonEnabled(comparisonValues, options),
  }
}

function isChartsCatalogComparisonEnabled(
  comparisonValues: Array<string | number | boolean>,
  options: { embed?: boolean },
) {
  return (
    options.embed !== true &&
    comparisonValues.length === 1 &&
    (comparisonValues[0] === '1' || comparisonValues[0] === 1)
  )
}

export function findChartsCatalogCase(
  manifest: ChartsCatalogManifest,
  caseId: string,
) {
  return manifest.cases.find((catalogCase) => catalogCase.id === caseId)
}

export function getChartsCatalogAssetUrl(
  artifactRevision: string,
  assetPath: string,
) {
  return `${chartsCatalogAssetBasePath}${artifactRevision}/${assetPath}`
}

export function getChartsCatalogSitemapEntries(
  manifest: ChartsCatalogManifest,
) {
  return [
    { path: chartsCatalogBasePath },
    { path: `${chartsCatalogBasePath}all/` },
    ...manifest.cases.map((catalogCase) => ({
      path: catalogCase.routes.page,
    })),
  ]
}
