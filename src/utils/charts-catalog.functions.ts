import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import * as v from 'valibot'
import type {
  ChartsCatalogCase,
  ChartsCatalogPublication,
} from './charts-catalog'
import {
  chartsCatalogCaseIdSchema,
  chartsCatalogPublicationCacheHeaders,
} from './charts-catalog'

const defaultReferenceRenderer = 'observable-plot'

const comparisonInputSchema = v.strictObject({
  comparison: v.boolean(),
})

const caseInputSchema = v.strictObject({
  caseId: chartsCatalogCaseIdSchema,
  comparison: v.boolean(),
})

const embedCaseInputSchema = v.strictObject({
  caseId: chartsCatalogCaseIdSchema,
  source: v.boolean(),
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
    const [tanstackSource, comparisonSource] = await Promise.all([
      getChartsCatalogSource(
        publication.manifest.revision,
        catalogCase.code.tanstack,
      ),
      data.comparison
        ? getChartsCatalogSource(
            publication.manifest.revision,
            catalogCase.code.reference,
          )
        : Promise.resolve(undefined),
    ])

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

    const source = data.source
      ? await (
          await import('./charts-catalog.server')
        ).getChartsCatalogSource(
          publication.manifest.revision,
          catalogCase.code.tanstack,
        )
      : undefined

    setCatalogResponseHeaders()
    return {
      artifactRevision: publication.artifactRevision,
      revision: publication.manifest.revision,
      case: {
        id: catalogCase.id,
        title: catalogCase.title,
        module: catalogCase.modules.tanstack,
        code: source
          ? {
              path: catalogCase.code.tanstack,
              source,
            }
          : undefined,
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
  for (const [name, value] of Object.entries(
    chartsCatalogPublicationCacheHeaders,
  )) {
    setResponseHeader(name, value)
  }
}
