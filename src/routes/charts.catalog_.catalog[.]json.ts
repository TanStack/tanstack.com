import { createFileRoute } from '@tanstack/react-router'
import { chartsCatalogIndexCacheHeaders } from '~/utils/charts-catalog-index'

export const Route = createFileRoute('/charts/catalog_/catalog.json')({
  server: {
    handlers: {
      GET: async () => {
        const { getChartsCatalogIndexPublication } =
          await import('~/utils/charts-catalog-index.server')
        const publication = await getChartsCatalogIndexPublication()

        return Response.json(publication.index, {
          headers: {
            ...chartsCatalogIndexCacheHeaders,
            'X-Charts-Catalog-Source-Revision': publication.revision,
          },
        })
      },
    },
  },
})
