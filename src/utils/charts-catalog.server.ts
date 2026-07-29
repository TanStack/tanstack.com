import {
  fetchRepoRawFile,
  resolveGitHubRef,
  shouldUseLocalDocsFiles,
} from './documents.server'
import { getCachedGitHubTextFile } from './github-content-cache.server'
import {
  chartsCatalogPublicationRef,
  chartsCatalogRepo,
  parseChartsCatalogManifest,
  type ChartsCatalogPublication,
} from './charts-catalog'

const catalogManifestPath = 'catalog.json'
const localCatalogRoot = '.catalog-artifact'
const catalogHeadCachePath = '.tanstack/catalog-dist-head'
const exactGitShaPattern = /^[a-f0-9]{40}$/

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

  const artifactRevision = await resolveChartsCatalogArtifactRevision()
  return {
    artifactRevision,
    manifest: await readChartsCatalogManifest(artifactRevision),
  }
}

export async function getChartsCatalogManifestAtRevision(
  artifactRevision: string,
) {
  if (!exactGitShaPattern.test(artifactRevision)) {
    throw new TypeError('Invalid Charts catalog artifact revision')
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
    throw new Error(`Charts catalog asset not found: ${assetPath}`)
  }

  const bytes = new TextEncoder().encode(source)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const sha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

  if (bytes.byteLength !== expected.bytes || sha256 !== expected.sha256) {
    throw new Error(`Charts catalog asset failed integrity check: ${assetPath}`)
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
    throw new Error(`Charts catalog source not found: ${sourcePath}`)
  }
  return source
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
    throw new Error('Charts catalog manifest is unavailable')
  }

  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new TypeError('Invalid Charts catalog manifest: expected JSON')
  }
  return parseChartsCatalogManifest(value)
}

async function resolveChartsCatalogArtifactRevision() {
  const revision = await getCachedGitHubTextFile({
    repo: chartsCatalogRepo,
    gitRef: chartsCatalogPublicationRef,
    path: catalogHeadCachePath,
    origin: fetchChartsCatalogArtifactRevision,
  })

  if (!revision || !exactGitShaPattern.test(revision)) {
    throw new Error('Charts catalog publication revision is unavailable')
  }
  return revision
}

async function fetchChartsCatalogArtifactRevision() {
  return resolveGitHubRef(chartsCatalogRepo, chartsCatalogPublicationRef)
}
