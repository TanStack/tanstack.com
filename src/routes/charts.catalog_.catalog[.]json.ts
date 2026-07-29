import { createFileRoute } from '@tanstack/react-router'
import { chartsCatalogPublicationCacheHeaders } from '~/utils/charts-catalog'

export const Route = createFileRoute('/charts/catalog_/catalog.json')({
  server: {
    handlers: {
      GET: async () => {
        const { getChartsCatalogPublication } =
          await import('~/utils/charts-catalog.server')
        const publication = await getChartsCatalogPublication()

        return Response.json(publication.manifest, {
          headers: {
            ...chartsCatalogPublicationCacheHeaders,
            'X-Charts-Catalog-Artifact-Revision': publication.artifactRevision,
          },
        })
      },
    },
  },
})
