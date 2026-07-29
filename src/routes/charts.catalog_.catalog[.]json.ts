import { createFileRoute } from '@tanstack/react-router'
import { chartsCatalogPublicationCacheTag } from '~/utils/charts-catalog'

export const Route = createFileRoute('/charts/catalog_/catalog.json')({
  server: {
    handlers: {
      GET: async () => {
        const { getChartsCatalogPublication } =
          await import('~/utils/charts-catalog.server')
        const publication = await getChartsCatalogPublication()

        return Response.json(publication.manifest, {
          headers: {
            'Cache-Control': 'public, max-age=60, must-revalidate',
            'Cloudflare-CDN-Cache-Control':
              'public, max-age=300, stale-while-revalidate=300',
            'Cache-Tag': chartsCatalogPublicationCacheTag,
            'X-Charts-Catalog-Artifact-Revision': publication.artifactRevision,
          },
        })
      },
    },
  },
})
