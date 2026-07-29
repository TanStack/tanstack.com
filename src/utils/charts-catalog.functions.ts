import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import * as v from 'valibot'
import type {
  ChartsCatalogCase,
  ChartsCatalogPublication,
} from './charts-catalog'
import { chartsCatalogPublicationCacheTag } from './charts-catalog'

const defaultReferenceRenderer = 'observable-plot'

const caseIdSchema = v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))

const comparisonInputSchema = v.strictObject({
  comparison: v.boolean(),
})

const caseInputSchema = v.strictObject({
  caseId: caseIdSchema,
  comparison: v.boolean(),
})

const embedCaseInputSchema = v.strictObject({
  caseId: caseIdSchema,
})

export const getChartsCatalogIndex = createServerFn({
  method: 'GET',
}).handler(async () => {
  const publication = await loadPublication()
  setCatalogResponseHeaders()
  return {
    artifactRevision: publication.artifactRevision,
    revision: publication.manifest.revision,
    cases: publication.manifest.cases.map(getCaseMetadata),
  }
})

export const getChartsCatalogAll = createServerFn({ method: 'GET' })
  .validator(comparisonInputSchema)
  .handler(async ({ data }) => {
    const publication = await loadPublication()
    setCatalogResponseHeaders()
    return {
      artifactRevision: publication.artifactRevision,
      revision: publication.manifest.revision,
      cases: publication.manifest.cases.map((catalogCase) => ({
        ...getCaseMetadata(catalogCase),
        modules: data.comparison
          ? catalogCase.modules
          : { tanstack: catalogCase.modules.tanstack },
      })),
    }
  })

export const getChartsCatalogCase = createServerFn({ method: 'GET' })
  .validator(caseInputSchema)
  .handler(async ({ data }) => {
    const publication = await loadPublication()
    const catalogCase = publication.manifest.cases.find(
      (entry) => entry.id === data.caseId,
    )
    if (!catalogCase) return null

    const { getChartsCatalogSource } = await import('./charts-catalog.server')
    const tanstackSource = await getChartsCatalogSource(
      publication.manifest.revision,
      catalogCase.code.tanstack,
    )
    const comparisonSource = data.comparison
      ? await getChartsCatalogSource(
          publication.manifest.revision,
          catalogCase.code.reference,
        )
      : undefined

    setCatalogResponseHeaders()
    return {
      artifactRevision: publication.artifactRevision,
      revision: publication.manifest.revision,
      case: {
        ...getCaseMetadata(catalogCase),
        modules: data.comparison
          ? catalogCase.modules
          : { tanstack: catalogCase.modules.tanstack },
        code: {
          tanstack: {
            path: catalogCase.code.tanstack,
            source: tanstackSource,
          },
          ...(data.comparison
            ? {
                comparison: {
                  path: catalogCase.code.reference,
                  source: comparisonSource,
                },
              }
            : {}),
        },
      },
    }
  })

export const getChartsCatalogEmbedCase = createServerFn({ method: 'GET' })
  .validator(embedCaseInputSchema)
  .handler(async ({ data }) => {
    const publication = await loadPublication()
    const catalogCase = publication.manifest.cases.find(
      (entry) => entry.id === data.caseId,
    )
    if (!catalogCase) return null

    setCatalogResponseHeaders()
    return {
      artifactRevision: publication.artifactRevision,
      revision: publication.manifest.revision,
      case: {
        id: catalogCase.id,
        title: catalogCase.title,
        module: catalogCase.modules.tanstack,
      },
    }
  })

async function loadPublication(): Promise<ChartsCatalogPublication> {
  const { getChartsCatalogPublication } =
    await import('./charts-catalog.server')
  return getChartsCatalogPublication()
}

function getCaseMetadata(catalogCase: ChartsCatalogCase) {
  return {
    schemaVersion: catalogCase.schemaVersion,
    referenceRenderer:
      catalogCase.referenceRenderer ?? defaultReferenceRenderer,
    order: catalogCase.order,
    id: catalogCase.id,
    title: catalogCase.title,
    family: catalogCase.family,
    intent: catalogCase.intent,
    support: catalogCase.support,
    features: catalogCase.features,
    geometry: catalogCase.geometry,
    source: catalogCase.source,
    ai: catalogCase.ai,
    routes: catalogCase.routes,
  }
}

function setCatalogResponseHeaders() {
  setResponseHeader('Cache-Control', 'public, max-age=60, must-revalidate')
  setResponseHeader(
    'Cloudflare-CDN-Cache-Control',
    'public, max-age=300, stale-while-revalidate=300',
  )
  setResponseHeader('Cache-Tag', chartsCatalogPublicationCacheTag)
}
