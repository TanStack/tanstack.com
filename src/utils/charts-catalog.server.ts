import {
  fetchGitHubCommitHistory,
  fetchRepoRawFile,
  GitHubContentError,
  shouldUseLocalDocsFiles,
} from './documents.server'
import { getCachedGitHubJsonContent } from './github-content-cache.server'
import {
  chartsCatalogPublicationRef,
  chartsCatalogRepo,
  parseChartsCatalogManifest,
  type ChartsCatalogAuthoredSource,
  type ChartsCatalogManifest,
  type ChartsCatalogPublication,
  type ChartsCatalogSourceKind,
} from './charts-catalog'

const catalogManifestPath = 'catalog.json'
const localCatalogRoot = '.catalog-artifact'
const catalogRevisionHistoryCachePath =
  '.tanstack/catalog-dist-revision-history'
const catalogRevisionHistoryLimit = 100
const exactGitShaPattern = /^[a-f0-9]{40}$/

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
    const manifest = await readChartsCatalogManifest(
      chartsCatalogPublicationRef,
    )
    return {
      artifactRevision: manifest.revision,
      manifest,
    }
  }

  const revisions = await getPublishedChartsCatalogRevisions()
  const artifactRevision = revisions[0]
  return {
    artifactRevision,
    manifest: await readChartsCatalogManifest(artifactRevision),
  }
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
    const manifest = await readChartsCatalogManifest(
      chartsCatalogPublicationRef,
    )
    if (artifactRevision !== manifest.revision) {
      throw new ChartsCatalogResourceNotFoundError(
        'Unpublished Charts catalog artifact revision',
      )
    }
    return manifest
  }

  const publishedRevisions = await getPublishedChartsCatalogRevisions()
  if (!publishedRevisions.includes(artifactRevision)) {
    throw new ChartsCatalogResourceNotFoundError(
      'Unpublished Charts catalog artifact revision',
    )
  }

  return readChartsCatalogManifest(artifactRevision)
}

export async function getVerifiedChartsCatalogAssetSource(
  artifactRevision: string,
  assetPath: string,
  expected: { bytes: number; sha256: string },
) {
  const filePath = shouldUseLocalDocsFiles()
    ? `${localCatalogRoot}/${assetPath}`
    : assetPath
  const source = await fetchRepoRawFile(
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
  const source = await fetchRepoRawFile(
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

async function readChartsCatalogManifest(artifactRevision: string) {
  const filePath = shouldUseLocalDocsFiles()
    ? `${localCatalogRoot}/${catalogManifestPath}`
    : catalogManifestPath
  const source = await fetchRepoRawFile(
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
