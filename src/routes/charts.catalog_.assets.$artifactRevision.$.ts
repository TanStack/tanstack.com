import { createFileRoute, notFound } from '@tanstack/react-router'
import { parseChartsCatalogAssetRequest } from '~/utils/charts-catalog-assets'

export const Route = createFileRoute(
  '/charts/catalog_/assets/$artifactRevision/$',
)({
  server: {
    handlers: {
      GET: serveCatalogAsset,
      HEAD: serveCatalogAsset,
    },
  },
})

async function serveCatalogAsset({
  request,
  params,
}: {
  request: Request
  params: { artifactRevision: string; _splat: string }
}) {
  try {
    const {
      getChartsCatalogManifestAtRevision,
      getVerifiedChartsCatalogAssetSource,
    } = await import('~/utils/charts-catalog.server')
    const manifest = await getChartsCatalogManifestAtRevision(
      params.artifactRevision,
    )
    const asset = parseChartsCatalogAssetRequest({
      artifactRevision: params.artifactRevision,
      assetPath: params._splat,
      manifest,
    })
    const descriptor = manifest.assets[asset.repoPath]
    if (!descriptor) throw new TypeError('Unlisted Charts catalog asset')

    const source = await getVerifiedChartsCatalogAssetSource(
      params.artifactRevision,
      asset.repoPath,
      descriptor,
    )

    return new Response(request.method === 'HEAD' ? null : source, {
      headers: {
        ...asset.headers,
        'Content-Length': String(descriptor.bytes),
      },
    })
  } catch {
    throw notFound()
  }
}
