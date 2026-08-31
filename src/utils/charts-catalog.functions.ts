import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import * as v from 'valibot'
import {
  chartsCatalogCaseIdSchema,
  chartsCatalogCollectionIdSchema,
  findChartsCatalogCollection,
} from './charts-catalog'
import { chartsCatalogIndexCacheHeaders } from './charts-catalog-index'

const caseInputSchema = v.strictObject({
  caseId: chartsCatalogCaseIdSchema,
})

const collectionInputSchema = v.strictObject({
  collectionId: chartsCatalogCollectionIdSchema,
})

const embedCaseInputSchema = v.strictObject({
  caseId: chartsCatalogCaseIdSchema,
  height: v.pipe(v.number(), v.integer(), v.minValue(120), v.maxValue(1_200)),
  revision: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10_000)),
  source: v.boolean(),
})

export const getChartsCatalogAll = createServerFn({ method: 'GET' }).handler(
  async () => {
    const publication = await loadPublication()
    setCatalogResponseHeaders()
    return {
      revision: publication.revision,
      cases: publication.index.cases,
    }
  },
)

export const getChartsCatalogCollection = createServerFn({ method: 'GET' })
  .validator(collectionInputSchema)
  .handler(async ({ data }) => {
    const collection = findChartsCatalogCollection(data.collectionId)
    if (!collection) return null

    const publication = await loadPublication()
    const cases = publication.index.cases.filter(
      (catalogCase) => catalogCase.collection === collection.id,
    )
    if (cases.length === 0) return null

    setCatalogResponseHeaders()
    return {
      collection,
      revision: publication.revision,
      cases,
    }
  })

export const getChartsCatalogLanding = createServerFn({
  method: 'GET',
}).handler(async () => {
  const publication = await loadPublication()
  setCatalogResponseHeaders()
  return {
    revision: publication.revision,
    cases: publication.index.cases.map((catalogCase) => ({
      id: catalogCase.id,
      family: catalogCase.family,
      order: catalogCase.order,
      title: catalogCase.title,
    })),
  }
})

export const getChartsCatalogCase = createServerFn({ method: 'GET' })
  .validator(caseInputSchema)
  .handler(async ({ data }) => {
    const publication = await loadPublication()
    const catalogCase = publication.index.cases.find(
      (entry) => entry.id === data.caseId,
    )
    if (!catalogCase) return null

    const { getChartsCatalogExample } = await import('./charts-catalog.server')
    const { authoredSource, example } = await getChartsCatalogExample(
      publication,
      catalogCase.id,
    )

    setCatalogResponseHeaders()
    return {
      revision: publication.revision,
      case: {
        ...catalogCase,
        authoredSource: { tanstack: authoredSource },
        example,
      },
    }
  })

export const getChartsCatalogEmbedCase = createServerFn({ method: 'GET' })
  .validator(embedCaseInputSchema)
  .handler(async ({ data }) => {
    const publication = await loadPublication()
    const catalogCase = publication.index.cases.find(
      (entry) => entry.id === data.caseId,
    )
    if (!catalogCase) return null

    const { getChartsCatalogExample } = await import('./charts-catalog.server')
    const { authoredSource, example } = await getChartsCatalogExample(
      publication,
      catalogCase.id,
      {
        chartHeight: data.height,
        renderRevision: data.revision,
      },
    )

    setCatalogResponseHeaders()
    return {
      case: {
        id: catalogCase.id,
        title: catalogCase.title,
        authoredSource: data.source ? authoredSource : undefined,
        example,
      },
    }
  })

async function loadPublication() {
  const { getChartsCatalogIndexPublication } =
    await import('./charts-catalog-index.server')
  return getChartsCatalogIndexPublication()
}

function setCatalogResponseHeaders() {
  for (const [name, value] of Object.entries(chartsCatalogIndexCacheHeaders)) {
    setResponseHeader(name, value)
  }
}
