import {
  fetchRemoteRepoRawFile,
  fetchRepoRawFile,
  resolveGitHubRef,
  shouldUseLocalDocsFiles,
} from './documents.server'
import { getCachedDocsArtifact } from './github-content-cache.server'
import {
  chartsCatalogIndexPath,
  chartsCatalogIndexRef,
  chartsCatalogIndexRepo,
  isChartsCatalogIndexPublication,
  parseChartsCatalogIndex,
  type ChartsCatalogIndex,
  type ChartsCatalogIndexPublication,
} from './charts-catalog-index'

const catalogIndexArtifactType = 'charts-catalog-index'
const catalogIndexArtifactKey = 'v1'

export class ChartsCatalogIndexResourceNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChartsCatalogIndexResourceNotFoundError'
  }
}

export class ChartsCatalogIndexIntegrityError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'ChartsCatalogIndexIntegrityError'
  }
}

export async function getChartsCatalogIndexPublication(): Promise<ChartsCatalogIndexPublication> {
  if (shouldUseLocalDocsFiles()) {
    const localPublication = await getLocalChartsCatalogIndexPublication()
    if (localPublication) return localPublication
  }

  return getCachedDocsArtifact({
    repo: chartsCatalogIndexRepo,
    gitRef: chartsCatalogIndexRef,
    docsRoot: 'benchmarks/conformance',
    artifactType: catalogIndexArtifactType,
    artifactKey: catalogIndexArtifactKey,
    isValue: isChartsCatalogIndexPublication,
    build: buildChartsCatalogIndexPublication,
  })
}

async function buildChartsCatalogIndexPublication(): Promise<ChartsCatalogIndexPublication> {
  const revision = await resolveGitHubRef(
    chartsCatalogIndexRepo,
    chartsCatalogIndexRef,
  )
  if (!revision) {
    throw new ChartsCatalogIndexResourceNotFoundError(
      'Charts catalog index revision is unavailable',
    )
  }

  return {
    revision,
    sourceKind: 'remote',
    index: await readChartsCatalogIndex(revision, 'remote'),
  }
}

async function readChartsCatalogIndex(
  revision: string,
  sourceKind: 'local' | 'remote',
): Promise<ChartsCatalogIndex> {
  const source =
    sourceKind === 'local'
      ? await fetchRepoRawFile(
          chartsCatalogIndexRepo,
          revision,
          chartsCatalogIndexPath,
        )
      : await fetchRemoteRepoRawFile(
          chartsCatalogIndexRepo,
          revision,
          chartsCatalogIndexPath,
        )

  if (!source) {
    throw new ChartsCatalogIndexResourceNotFoundError(
      'Charts catalog index is unavailable',
    )
  }

  let value: unknown
  try {
    value = JSON.parse(source)
  } catch (error) {
    throw new ChartsCatalogIndexIntegrityError(
      'Invalid Charts catalog index: expected JSON',
      error,
    )
  }

  try {
    return parseChartsCatalogIndex(value)
  } catch (error) {
    throw new ChartsCatalogIndexIntegrityError(
      'Invalid Charts catalog index contract',
      error,
    )
  }
}

let localPublicationCache:
  | {
      expiresAt: number
      promise: Promise<ChartsCatalogIndexPublication | null>
    }
  | undefined

function getLocalChartsCatalogIndexPublication() {
  const now = Date.now()
  if (localPublicationCache && localPublicationCache.expiresAt > now) {
    return localPublicationCache.promise
  }

  const promise = buildLocalChartsCatalogIndexPublication().catch(
    (error: unknown) => {
      if (
        error instanceof ChartsCatalogIndexResourceNotFoundError ||
        error instanceof ChartsCatalogIndexIntegrityError
      ) {
        return null
      }
      throw error
    },
  )
  localPublicationCache = { expiresAt: now + 1_000, promise }
  return promise
}

async function buildLocalChartsCatalogIndexPublication(): Promise<ChartsCatalogIndexPublication> {
  const index = await readChartsCatalogIndex(chartsCatalogIndexRef, 'local')
  const revision = await resolveGitHubRef(
    chartsCatalogIndexRepo,
    chartsCatalogIndexRef,
  )
  if (!revision) {
    throw new ChartsCatalogIndexResourceNotFoundError(
      'Charts catalog index revision is unavailable',
    )
  }
  return { revision, sourceKind: 'local', index }
}
