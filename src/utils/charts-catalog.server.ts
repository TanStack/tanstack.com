import {
  fetchGitHubRecursiveTree,
  fetchRemoteRepoRawFile,
  fetchRepoRawFile,
} from './documents.server'
import {
  chartsCatalogRepo,
  type ChartsCatalogAuthoredSource,
} from './charts-catalog'
import type {
  ChartsCatalogIndexCase,
  ChartsCatalogIndexPublication,
} from './charts-catalog-index'
import {
  createChartsCatalogExampleDefinition,
  type ChartsCatalogExampleVersions,
} from './charts-catalog-example'

const catalogSourceRoot = 'benchmarks/conformance/'
const catalogExamplePackagePaths = {
  charts: 'packages/charts-core/package.json',
  root: 'package.json',
}
const catalogExampleRootDependencies = [
  'd3-array',
  'd3-brush',
  'd3-contour',
  'd3-delaunay',
  'd3-force',
  'd3-format',
  'd3-geo',
  'd3-hexbin',
  'd3-hierarchy',
  'd3-interpolate',
  'd3-sankey',
  'd3-scale',
  'd3-selection',
  'd3-shape',
  'd3-time',
  'd3-zoom',
  'react',
  'react-dom',
  'topojson-client',
  'us-atlas',
  'world-atlas',
] as const
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

export async function getChartsCatalogExample(
  publication: ChartsCatalogIndexPublication,
  caseId: string,
  options?: {
    chartHeight?: number
    renderRevision?: number
  },
) {
  const catalogCase = publication.index.cases.find(
    (entry) => entry.id === caseId,
  )
  if (!catalogCase) {
    throw new ChartsCatalogResourceNotFoundError(
      `Charts catalog case not found: ${caseId}`,
    )
  }
  const entryPath = getChartsCatalogEntryPath(catalogCase)

  const [files, versions] = await Promise.all([
    getChartsCatalogExampleFiles(
      publication.revision,
      entryPath,
      publication.sourceKind,
    ),
    getChartsCatalogExampleVersions(
      publication.revision,
      publication.sourceKind,
    ),
  ])

  return {
    example: createChartsCatalogExampleDefinition({
      chartHeight: options?.chartHeight,
      caseId: catalogCase.id,
      title: catalogCase.title,
      description: catalogCase.intent,
      revision: publication.revision,
      entryPath,
      files,
      renderRevision: options?.renderRevision,
      versions,
    }),
    authoredSource: createChartsCatalogAuthoredSource(files, entryPath),
  }
}

function getChartsCatalogEntryPath(catalogCase: ChartsCatalogIndexCase) {
  return 'example' in catalogCase.entries
    ? catalogCase.entries.example
    : catalogCase.entries.tanstack
}

export async function getChartsCatalogExampleDefinition(
  publication: ChartsCatalogIndexPublication,
  caseId: string,
  options?: {
    chartHeight?: number
    renderRevision?: number
  },
) {
  return (await getChartsCatalogExample(publication, caseId, options)).example
}

export async function getChartsCatalogAuthoredSource(
  publication: ChartsCatalogIndexPublication,
  caseId: string,
) {
  return (await getChartsCatalogExample(publication, caseId)).authoredSource
}

export async function getChartsCatalogSource(
  sourceRevision: string,
  sourcePath: string,
  sourceKind: ChartsCatalogIndexPublication['sourceKind'],
) {
  const source =
    sourceKind === 'local'
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

function createChartsCatalogAuthoredSource(
  files: Record<string, string>,
  entryPath: string,
): ChartsCatalogAuthoredSource {
  const authoredFiles = Object.entries(files).map(([path, source]) => ({
    path: path.startsWith(catalogSourceRoot)
      ? path.slice(catalogSourceRoot.length)
      : path,
    source,
    kind: path === entryPath ? ('entry' as const) : ('dependency' as const),
    lines: countCatalogSourceLines(source),
    bytes: countCatalogSourceBytes(source),
  }))

  return {
    totalFiles: authoredFiles.length,
    totalLines: authoredFiles.reduce((total, file) => total + file.lines, 0),
    totalBytes: authoredFiles.reduce((total, file) => total + file.bytes, 0),
    files: authoredFiles,
  }
}

async function getChartsCatalogExampleFiles(
  revision: string,
  entryPath: string,
  sourceKind: ChartsCatalogIndexPublication['sourceKind'],
) {
  const caseDirectory = entryPath.slice(0, entryPath.lastIndexOf('/') + 1)
  const isSelfContainedExample = entryPath.endsWith('/example.tsx')
  const sourcePaths =
    sourceKind === 'local'
      ? undefined
      : await getChartsCatalogSourcePaths(revision)
  if (sourcePaths && !sourcePaths.has(entryPath)) {
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

    const source = await getChartsCatalogSource(revision, path, sourceKind)
    files.set(path, source)

    const dependencies = await Promise.all(
      extractStaticRelativeModuleSpecifiers(source).map((specifier) =>
        resolveCatalogExampleModule(path, specifier, sourcePaths, revision),
      ),
    )
    for (const dependency of dependencies) {
      if (isSelfContainedExample && !dependency.startsWith(caseDirectory)) {
        throw new ChartsCatalogIntegrityError(
          `Charts catalog example import leaves its case directory: ${dependency}`,
        )
      }
    }
    await Promise.all(dependencies.map(load))
  }

  await load(entryPath)

  return Object.fromEntries(
    [...files.entries()].sort(([left], [right]) => left.localeCompare(right)),
  )
}

async function getChartsCatalogSourcePaths(revision: string) {
  const tree = await fetchGitHubRecursiveTree(chartsCatalogRepo, revision)
  if (!tree) {
    throw new ChartsCatalogResourceNotFoundError(
      'Charts catalog source tree is unavailable',
    )
  }
  return new Set(
    tree.flatMap((entry) => (entry.type === 'blob' ? [entry.path] : [])),
  )
}

async function resolveCatalogExampleModule(
  importer: string,
  specifier: string,
  sourcePaths: Set<string> | undefined,
  revision: string,
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
  const resolved = sourcePaths
    ? candidates.find((candidate) => sourcePaths.has(candidate))
    : await findLocalCatalogExampleModule(revision, candidates)

  if (!resolved) {
    throw new ChartsCatalogResourceNotFoundError(
      `Could not resolve ${specifier} from ${importer}`,
    )
  }

  return resolved
}

async function findLocalCatalogExampleModule(
  revision: string,
  candidates: Array<string>,
) {
  for (const candidate of candidates) {
    const source = await fetchRepoRawFile(
      chartsCatalogRepo,
      revision,
      candidate,
    )
    if (source !== null) return candidate
  }
  return undefined
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
  sourceKind: ChartsCatalogIndexPublication['sourceKind'],
): Promise<ChartsCatalogExampleVersions> {
  const [chartsSource, rootSource] = await Promise.all([
    getChartsCatalogSource(
      revision,
      catalogExamplePackagePaths.charts,
      sourceKind,
    ),
    getChartsCatalogSource(
      revision,
      catalogExamplePackagePaths.root,
      sourceKind,
    ),
  ])
  const charts = parsePackageMetadata(
    chartsSource,
    catalogExamplePackagePaths.charts,
  )
  const root = parsePackageMetadata(rootSource, catalogExamplePackagePaths.root)
  const dependencies = Object.fromEntries(
    catalogExampleRootDependencies.map((name) => [
      name,
      getPackageDependency(root.devDependencies, name),
    ]),
  )

  return {
    charts: getPackageVersion(charts, catalogExamplePackagePaths.charts),
    react: dependencies.react,
    reactDom: dependencies['react-dom'],
    dependencies,
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
      `Charts package metadata is missing ${name}`,
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

function countCatalogSourceLines(source: string) {
  if (source.length === 0) return 0
  const lineBreaks = source.match(/\r\n|\r|\n/g)?.length ?? 0
  return lineBreaks + (/(?:\r\n|\r|\n)$/.test(source) ? 0 : 1)
}

function countCatalogSourceBytes(source: string) {
  return new TextEncoder().encode(source).byteLength
}
