import {
  fetchGitHubCommitHistory,
  fetchGitHubRecursiveTree,
  fetchRemoteRepoRawFile,
  fetchRepoRawFile,
  GitHubContentError,
  resolveGitHubRef,
  shouldUseLocalDocsFiles,
} from './documents.server'
import {
  getCachedDocsArtifact,
  getCachedGitHubJsonContent,
} from './github-content-cache.server'
import {
  chartsCatalogPublicationRef,
  chartsCatalogRepo,
  parseChartsCatalogManifest,
  type ChartsCatalogAuthoredSource,
  type ChartsCatalogManifest,
  type ChartsCatalogPublication,
  type ChartsCatalogSourceKind,
} from './charts-catalog'
import {
  createChartsCatalogExampleDefinition,
  type ChartsCatalogExampleVersions,
} from './charts-catalog-example'

const catalogManifestPath = 'catalog.json'
const localCatalogRoot = '.catalog-artifact'
const catalogRevisionHistoryCachePath =
  '.tanstack/catalog-dist-revision-history'
const catalogRevisionHistoryLimit = 100
const catalogPublicationArtifactType = 'charts-catalog'
const catalogPublicationArtifactKey = 'v5'
const exactGitShaPattern = /^[a-f0-9]{40}$/
const catalogExamplePackagePaths = {
  charts: 'packages/charts-core/package.json',
  reactCharts: 'packages/react-charts/package.json',
  catalog: 'packages/react-charts-catalog/package.json',
  root: 'package.json',
}
const catalogExampleRootDependencies = [
  'react',
  'react-dom',
  'topojson-client',
  'us-atlas',
  'world-atlas',
]
const catalogExampleModuleExtensions = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.css',
  '.json',
  '.svg',
]
const maxCatalogExampleFiles = 128

export class ChartsCatalogResourceNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChartsCatalogResourceNotFoundError'
  }
}

export class ChartsCatalogIntegrityError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'ChartsCatalogIntegrityError'
  }
}

export function classifyChartsCatalogAssetError(error: unknown) {
  if (error instanceof ChartsCatalogResourceNotFoundError) {
    return 'not-found'
  }
  if (
    error instanceof GitHubContentError &&
    ['network', 'rate-limit', 'server'].includes(error.kind)
  ) {
    return 'unavailable'
  }
  return 'internal'
}

export async function getChartsCatalogPublication(): Promise<ChartsCatalogPublication> {
  if (shouldUseLocalDocsFiles()) {
    const manifest = await getLocalChartsCatalogManifest()
    if (manifest) {
      return {
        artifactRevision: manifest.revision,
        manifest,
      }
    }
  }

  return getCachedDocsArtifact({
    repo: chartsCatalogRepo,
    gitRef: chartsCatalogPublicationRef,
    docsRoot: '',
    artifactType: catalogPublicationArtifactType,
    artifactKey: catalogPublicationArtifactKey,
    isValue: isChartsCatalogPublication,
    build: buildChartsCatalogPublication,
  })
}

export async function getChartsCatalogManifestAtRevision(
  artifactRevision: string,
) {
  if (!exactGitShaPattern.test(artifactRevision)) {
    throw new ChartsCatalogResourceNotFoundError(
      'Invalid Charts catalog artifact revision',
    )
  }

  if (shouldUseLocalDocsFiles()) {
    const manifest = await getLocalChartsCatalogManifest()
    if (manifest) {
      if (artifactRevision !== manifest.revision) {
        throw new ChartsCatalogResourceNotFoundError(
          'Unpublished Charts catalog artifact revision',
        )
      }
      return manifest
    }
  }

  const publication = await getChartsCatalogPublication()
  if (artifactRevision === publication.artifactRevision) {
    return publication.manifest
  }

  const publishedRevisions = await getPublishedChartsCatalogRevisions()
  if (!publishedRevisions.includes(artifactRevision)) {
    throw new ChartsCatalogResourceNotFoundError(
      'Unpublished Charts catalog artifact revision',
    )
  }

  return readChartsCatalogManifest(artifactRevision, 'remote')
}

export async function getVerifiedChartsCatalogAssetSource(
  artifactRevision: string,
  assetPath: string,
  expected: { bytes: number; sha256: string },
) {
  const localManifest = await getLocalChartsCatalogManifest()
  const useLocal = localManifest?.revision === artifactRevision
  const filePath = useLocal ? `${localCatalogRoot}/${assetPath}` : assetPath
  const source = useLocal
    ? await fetchRepoRawFile(chartsCatalogRepo, artifactRevision, filePath)
    : await fetchRemoteRepoRawFile(
        chartsCatalogRepo,
        artifactRevision,
        filePath,
      )

  if (source === null) {
    throw new ChartsCatalogResourceNotFoundError(
      `Charts catalog asset not found: ${assetPath}`,
    )
  }

  const bytes = new TextEncoder().encode(source)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const sha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

  if (bytes.byteLength !== expected.bytes || sha256 !== expected.sha256) {
    throw new ChartsCatalogIntegrityError(
      `Charts catalog asset failed integrity check: ${assetPath}`,
    )
  }

  return source
}

export async function getChartsCatalogSource(
  sourceRevision: string,
  sourcePath: string,
) {
  const localManifest = await getLocalChartsCatalogManifest()
  const source =
    localManifest?.revision === sourceRevision
      ? await fetchRepoRawFile(chartsCatalogRepo, sourceRevision, sourcePath)
      : await fetchRemoteRepoRawFile(
          chartsCatalogRepo,
          sourceRevision,
          sourcePath,
        )
  if (source === null) {
    throw new ChartsCatalogResourceNotFoundError(
      `Charts catalog source not found: ${sourcePath}`,
    )
  }
  return source
}

export async function getChartsCatalogAuthoredSource(
  manifest: ChartsCatalogManifest,
  caseId: string,
  implementation: 'tanstack' | 'reference',
): Promise<ChartsCatalogAuthoredSource> {
  const catalogCase = manifest.cases.find((entry) => entry.id === caseId)
  if (!catalogCase) {
    throw new ChartsCatalogResourceNotFoundError(
      `Charts catalog case not found: ${caseId}`,
    )
  }
  const closure = catalogCase.authoredSource[implementation]
  const sourceKinds: Array<ChartsCatalogSourceKind> = [
    'entry',
    'support',
    'fixture',
  ]
  const files = await Promise.all(
    sourceKinds.flatMap((kind) =>
      closure.roles[kind].paths.map(async (path) => {
        const source = await getChartsCatalogSource(
          manifest.revision,
          `${manifest.source.pathRoot}${path}`,
        )
        return {
          path,
          source,
          kind,
          lines: countCatalogSourceLines(source),
          bytes: countCatalogSourceBytes(source),
        }
      }),
    ),
  )
  const roles = {
    entry: getCatalogSourceMetrics(files, 'entry'),
    support: getCatalogSourceMetrics(files, 'support'),
    fixture: getCatalogSourceMetrics(files, 'fixture'),
  }

  for (const kind of sourceKinds) {
    const expected = closure.roles[kind]
    const actual = roles[kind]
    if (
      actual.files !== expected.files ||
      actual.lines !== expected.lines ||
      actual.bytes !== expected.bytes
    ) {
      throw new ChartsCatalogIntegrityError(
        `Charts catalog ${caseId} ${implementation} ${kind} source failed its metadata check`,
      )
    }
  }

  return {
    totalFiles: closure.totalFiles,
    totalLines: closure.totalLines,
    totalBytes: closure.totalBytes,
    roles,
    files,
    datasets: closure.datasetIds.map((id) => manifest.datasets[id]),
    excludedHarness: closure.roles.harness,
  }
}

export async function getChartsCatalogExampleDefinition(
  manifest: ChartsCatalogManifest,
  caseId: string,
) {
  const catalogCase = manifest.cases.find((entry) => entry.id === caseId)
  if (!catalogCase) {
    throw new ChartsCatalogResourceNotFoundError(
      `Charts catalog case not found: ${caseId}`,
    )
  }

  const [files, versions] = await Promise.all([
    getChartsCatalogExampleFiles(manifest.revision, catalogCase.code.tanstack),
    getChartsCatalogExampleVersions(manifest.revision),
  ])

  return createChartsCatalogExampleDefinition({
    caseId: catalogCase.id,
    title: catalogCase.title,
    description: catalogCase.intent,
    revision: manifest.revision,
    entryPath: catalogCase.code.tanstack,
    files,
    versions,
  })
}

async function getChartsCatalogExampleFiles(
  revision: string,
  entryPath: string,
) {
  const tree = await fetchGitHubRecursiveTree(chartsCatalogRepo, revision)
  if (!tree) {
    throw new ChartsCatalogResourceNotFoundError(
      'Charts catalog source tree is unavailable',
    )
  }

  const sourcePaths = new Set(
    tree.flatMap((entry) => (entry.type === 'blob' ? [entry.path] : [])),
  )
  if (!sourcePaths.has(entryPath)) {
    throw new ChartsCatalogResourceNotFoundError(
      `Charts catalog source not found: ${entryPath}`,
    )
  }

  const files = new Map<string, string>()
  const scheduled = new Set<string>()

  async function load(path: string): Promise<void> {
    if (scheduled.has(path)) return
    if (scheduled.size >= maxCatalogExampleFiles) {
      throw new ChartsCatalogIntegrityError(
        `Charts catalog example exceeds ${maxCatalogExampleFiles} source files`,
      )
    }
    scheduled.add(path)

    const source = await getChartsCatalogSource(revision, path)
    files.set(path, source)

    const dependencies = extractStaticRelativeModuleSpecifiers(source).map(
      (specifier) => resolveCatalogExampleModule(path, specifier, sourcePaths),
    )
    await Promise.all(dependencies.map(load))
  }

  await load(entryPath)

  return Object.fromEntries(
    [...files.entries()].sort(([left], [right]) => left.localeCompare(right)),
  )
}

function resolveCatalogExampleModule(
  importer: string,
  specifier: string,
  sourcePaths: Set<string>,
) {
  const importerDirectory = importer.slice(0, importer.lastIndexOf('/'))
  const requestedPath = normalizeRepoModulePath(
    `${importerDirectory}/${specifier}`,
  )
  const hasKnownExtension = catalogExampleModuleExtensions.some((extension) =>
    requestedPath.endsWith(extension),
  )
  const candidates = hasKnownExtension
    ? [requestedPath]
    : [
        requestedPath,
        ...catalogExampleModuleExtensions.map(
          (extension) => `${requestedPath}${extension}`,
        ),
        ...catalogExampleModuleExtensions.map(
          (extension) => `${requestedPath}/index${extension}`,
        ),
      ]
  const resolved = candidates.find((candidate) => sourcePaths.has(candidate))

  if (!resolved) {
    throw new ChartsCatalogResourceNotFoundError(
      `Could not resolve ${specifier} from ${importer}`,
    )
  }

  return resolved
}

function normalizeRepoModulePath(path: string) {
  const segments = new Array<string>()
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  return segments.join('/')
}

function extractStaticRelativeModuleSpecifiers(source: string) {
  const tokens = tokenizeModuleSource(source)
  const specifiers = new Set<string>()

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token?.kind !== 'identifier') continue
    if (token.value !== 'import' && token.value !== 'export') continue

    const next = tokens[index + 1]
    if (token.value === 'import' && next?.value === '(') continue
    if (token.value === 'import' && next?.value === '.') continue

    if (next?.kind === 'string') {
      if (next.value.startsWith('.')) specifiers.add(next.value)
      continue
    }

    for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
      const candidate = tokens[cursor]
      if (!candidate || candidate.value === ';') break
      if (candidate.kind !== 'identifier' || candidate.value !== 'from') {
        continue
      }
      const value = tokens[cursor + 1]
      if (value?.kind === 'string' && value.value.startsWith('.')) {
        specifiers.add(value.value)
      }
      break
    }
  }

  return [...specifiers]
}

type ModuleSourceToken = {
  kind: 'identifier' | 'punctuation' | 'string'
  value: string
}

function tokenizeModuleSource(source: string) {
  const tokens = new Array<ModuleSourceToken>()
  let index = 0

  while (index < source.length) {
    const character = source[index]
    const next = source[index + 1]

    if (character === '/' && next === '/') {
      index += 2
      while (index < source.length && !isLineBreak(source[index])) index += 1
      continue
    }
    if (character === '/' && next === '*') {
      index += 2
      while (
        index < source.length &&
        !(source[index] === '*' && source[index + 1] === '/')
      ) {
        index += 1
      }
      index += 2
      continue
    }
    if (character === '"' || character === "'") {
      const value = readQuotedModuleString(source, index, character)
      tokens.push({ kind: 'string', value: value.value })
      index = value.end
      continue
    }
    if (character === '`') {
      index = skipTemplateLiteral(source, index)
      continue
    }
    if (character && /[a-zA-Z_$]/.test(character)) {
      const start = index
      index += 1
      while (index < source.length && /[\w$]/.test(source[index] ?? '')) {
        index += 1
      }
      tokens.push({ kind: 'identifier', value: source.slice(start, index) })
      continue
    }
    if (character && !/\s/.test(character)) {
      tokens.push({ kind: 'punctuation', value: character })
    }
    index += 1
  }

  return tokens
}

function readQuotedModuleString(
  source: string,
  start: number,
  quote: '"' | "'",
) {
  let index = start + 1
  let value = ''

  while (index < source.length) {
    const character = source[index]
    if (character === quote) return { value, end: index + 1 }
    if (character === '\\') {
      const escaped = source[index + 1]
      if (escaped !== undefined) value += escaped
      index += 2
      continue
    }
    if (character !== undefined) value += character
    index += 1
  }

  return { value, end: index }
}

function skipTemplateLiteral(source: string, start: number) {
  let index = start + 1
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2
      continue
    }
    if (source[index] === '`') return index + 1
    index += 1
  }
  return index
}

function isLineBreak(value: string | undefined) {
  return value === '\n' || value === '\r'
}

async function getChartsCatalogExampleVersions(
  revision: string,
): Promise<ChartsCatalogExampleVersions> {
  const [chartsSource, reactChartsSource, catalogSource, rootSource] =
    await Promise.all([
      getChartsCatalogSource(revision, catalogExamplePackagePaths.charts),
      getChartsCatalogSource(revision, catalogExamplePackagePaths.reactCharts),
      getChartsCatalogSource(revision, catalogExamplePackagePaths.catalog),
      getChartsCatalogSource(revision, catalogExamplePackagePaths.root),
    ])
  const charts = parsePackageMetadata(
    chartsSource,
    catalogExamplePackagePaths.charts,
  )
  const reactCharts = parsePackageMetadata(
    reactChartsSource,
    catalogExamplePackagePaths.reactCharts,
  )
  const catalog = parsePackageMetadata(
    catalogSource,
    catalogExamplePackagePaths.catalog,
  )
  const root = parsePackageMetadata(rootSource, catalogExamplePackagePaths.root)
  const rootDependencies = Object.fromEntries(
    catalogExampleRootDependencies.map((name) => [
      name,
      getPackageDependency(root.devDependencies, name),
    ]),
  )

  return {
    charts: getPackageVersion(charts, catalogExamplePackagePaths.charts),
    reactCharts: getPackageVersion(
      reactCharts,
      catalogExamplePackagePaths.reactCharts,
    ),
    react: rootDependencies.react,
    reactDom: rootDependencies['react-dom'],
    dependencies: Object.fromEntries(
      [
        ...Object.entries(catalog.dependencies),
        ...Object.entries(rootDependencies),
      ]
        .filter(([, version]) => !version.startsWith('workspace:'))
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
  }
}

function parsePackageMetadata(source: string, path: string) {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch (error) {
    throw new ChartsCatalogIntegrityError(
      `Invalid Charts package metadata: ${path}`,
      error,
    )
  }

  if (!isRecord(value)) {
    throw new ChartsCatalogIntegrityError(
      `Invalid Charts package metadata: ${path}`,
    )
  }

  return {
    version: typeof value.version === 'string' ? value.version : undefined,
    dependencies: getStringRecord(value.dependencies),
    devDependencies: getStringRecord(value.devDependencies),
  }
}

function getStringRecord(value: unknown) {
  if (!isRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value).flatMap(([name, entry]) =>
      typeof entry === 'string' ? [[name, entry]] : [],
    ),
  )
}

function getPackageDependency(
  dependencies: Record<string, string>,
  name: string,
) {
  const version = dependencies[name]
  if (!version) {
    throw new ChartsCatalogIntegrityError(
      `Charts catalog package metadata is missing ${name}`,
    )
  }
  return version
}

function getPackageVersion(
  metadata: { version: string | undefined },
  path: string,
) {
  if (!metadata.version) {
    throw new ChartsCatalogIntegrityError(
      `Charts package metadata is missing a version: ${path}`,
    )
  }
  return metadata.version
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readChartsCatalogManifest(
  artifactRevision: string,
  sourceKind: 'local' | 'remote',
) {
  const filePath =
    sourceKind === 'local'
      ? `${localCatalogRoot}/${catalogManifestPath}`
      : catalogManifestPath
  const source =
    sourceKind === 'local'
      ? await fetchRepoRawFile(chartsCatalogRepo, artifactRevision, filePath)
      : await fetchRemoteRepoRawFile(
          chartsCatalogRepo,
          artifactRevision,
          filePath,
        )

  if (source === null) {
    throw new ChartsCatalogResourceNotFoundError(
      'Charts catalog manifest is unavailable',
    )
  }

  let value: unknown
  try {
    value = JSON.parse(source)
  } catch (error) {
    throw new ChartsCatalogIntegrityError(
      'Invalid Charts catalog manifest: expected JSON',
      error,
    )
  }
  try {
    return parseChartsCatalogManifest(value)
  } catch (error) {
    throw new ChartsCatalogIntegrityError(
      'Invalid Charts catalog manifest contract',
      error,
    )
  }
}

let localManifestCache:
  | {
      expiresAt: number
      promise: Promise<ChartsCatalogManifest | null>
    }
  | undefined

function getLocalChartsCatalogManifest() {
  if (!shouldUseLocalDocsFiles()) {
    return Promise.resolve(null)
  }

  const now = Date.now()
  if (localManifestCache && localManifestCache.expiresAt > now) {
    return localManifestCache.promise
  }

  const promise = readChartsCatalogManifest(
    chartsCatalogPublicationRef,
    'local',
  ).catch((error: unknown) => {
    if (
      error instanceof ChartsCatalogResourceNotFoundError ||
      error instanceof ChartsCatalogIntegrityError
    ) {
      return null
    }
    throw error
  })
  localManifestCache = { expiresAt: now + 1_000, promise }
  return promise
}

function getCatalogSourceMetrics(
  files: ChartsCatalogAuthoredSource['files'],
  kind: ChartsCatalogSourceKind,
) {
  return files.reduce(
    (metrics, file) =>
      file.kind === kind
        ? {
            files: metrics.files + 1,
            lines: metrics.lines + file.lines,
            bytes: metrics.bytes + file.bytes,
          }
        : metrics,
    { files: 0, lines: 0, bytes: 0 },
  )
}

function countCatalogSourceLines(source: string) {
  if (source.length === 0) return 0
  const lineBreaks = source.match(/\r\n|\r|\n/g)?.length ?? 0
  return lineBreaks + (/(?:\r\n|\r|\n)$/.test(source) ? 0 : 1)
}

function countCatalogSourceBytes(source: string) {
  return new TextEncoder().encode(source).byteLength
}

async function buildChartsCatalogPublication(): Promise<ChartsCatalogPublication> {
  const artifactRevision = await resolveGitHubRef(
    chartsCatalogRepo,
    chartsCatalogPublicationRef,
  )
  if (!artifactRevision) {
    throw new ChartsCatalogResourceNotFoundError(
      'Charts catalog publication is unavailable',
    )
  }

  return {
    artifactRevision,
    manifest: await readChartsCatalogManifest(artifactRevision, 'remote'),
  }
}

function isChartsCatalogPublication(
  value: unknown,
): value is ChartsCatalogPublication {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('artifactRevision' in value) ||
    typeof value.artifactRevision !== 'string' ||
    !exactGitShaPattern.test(value.artifactRevision) ||
    !('manifest' in value)
  ) {
    return false
  }

  try {
    parseChartsCatalogManifest(value.manifest)
    return true
  } catch {
    return false
  }
}

async function getPublishedChartsCatalogRevisions() {
  const revisions = await getCachedGitHubJsonContent({
    repo: chartsCatalogRepo,
    gitRef: chartsCatalogPublicationRef,
    path: catalogRevisionHistoryCachePath,
    isValue: isChartsCatalogRevisionHistory,
    origin: () =>
      fetchGitHubCommitHistory(
        chartsCatalogRepo,
        chartsCatalogPublicationRef,
        catalogRevisionHistoryLimit,
      ),
  })

  if (!revisions) {
    throw new ChartsCatalogIntegrityError(
      'Charts catalog publication history is unavailable',
    )
  }
  return revisions
}

function isChartsCatalogRevisionHistory(
  value: unknown,
): value is Array<string> {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= catalogRevisionHistoryLimit &&
    value.every(
      (revision) =>
        typeof revision === 'string' && exactGitShaPattern.test(revision),
    ) &&
    new Set(value).size === value.length
  )
}
