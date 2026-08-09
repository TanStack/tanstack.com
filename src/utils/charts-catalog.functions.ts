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

export const getChartsCatalogLanding = createServerFn({
  method: 'GET',
}).handler(async () => {
  const publication = await loadPublication()
  if (publication.manifest.schemaVersion !== 5) {
    throw new Error('Current Charts catalog publication requires previews')
  }
  setCatalogResponseHeaders()
  return {
    artifactRevision: publication.artifactRevision,
    cases: publication.manifest.cases.map((catalogCase) => ({
      id: catalogCase.id,
      family: catalogCase.family,
      order: catalogCase.order,
      title: catalogCase.title,
      module: catalogCase.modules.tanstack,
      preview: catalogCase.preview,
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

    const {
      getChartsCatalogAuthoredSource,
      getChartsCatalogExampleDefinition,
    } = await import('./charts-catalog.server')
    const [tanstackSource, comparisonSource, example] = await Promise.all([
      getChartsCatalogAuthoredSource(
        publication.manifest,
        catalogCase.id,
        'tanstack',
      ),
      data.comparison
        ? getChartsCatalogAuthoredSource(
            publication.manifest,
            catalogCase.id,
            'reference',
          )
        : Promise.resolve(undefined),
      getChartsCatalogExampleDefinition(publication.manifest, catalogCase.id),
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
        authoredSource: {
          tanstack: tanstackSource,
          ...(comparisonSource ? { comparison: comparisonSource } : {}),
        },
        example,
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

    const authoredSource = data.source
      ? await (
          await import('./charts-catalog.server')
        ).getChartsCatalogAuthoredSource(
          publication.manifest,
          catalogCase.id,
          'tanstack',
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
        authoredSource,
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
