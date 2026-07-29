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
  const {
    classifyChartsCatalogAssetError,
    getChartsCatalogManifestAtRevision,
    getVerifiedChartsCatalogAssetSource,
  } = await import('~/utils/charts-catalog.server')

  let manifest: Awaited<ReturnType<typeof getChartsCatalogManifestAtRevision>>
  try {
    manifest = await getChartsCatalogManifestAtRevision(params.artifactRevision)
  } catch (error) {
    return handleCatalogAssetError(
      error,
      classifyChartsCatalogAssetError,
      request.method,
    )
  }

  let asset: ReturnType<typeof parseChartsCatalogAssetRequest>
  try {
    asset = parseChartsCatalogAssetRequest({
      artifactRevision: params.artifactRevision,
      assetPath: params._splat,
      manifest,
    })
  } catch (error) {
    if (error instanceof TypeError) throw notFound()
    throw error
  }

  const descriptor = manifest.assets[asset.repoPath]
  if (!descriptor) throw notFound()

  let source: string
  try {
    source = await getVerifiedChartsCatalogAssetSource(
      params.artifactRevision,
      asset.repoPath,
      descriptor,
    )
  } catch (error) {
    return handleCatalogAssetError(
      error,
      classifyChartsCatalogAssetError,
      request.method,
    )
  }

  return new Response(request.method === 'HEAD' ? null : source, {
    headers: {
      ...asset.headers,
      'Content-Length': String(descriptor.bytes),
    },
  })
}

function handleCatalogAssetError(
  error: unknown,
  classify: (error: unknown) => 'not-found' | 'unavailable' | 'internal',
  method: string,
) {
  const classification = classify(error)
  if (classification === 'not-found') throw notFound()

  console.error('[Charts catalog asset] Failed to serve asset', error)
  if (classification === 'unavailable') {
    return new Response(
      method === 'HEAD' ? null : 'Charts catalog asset temporarily unavailable',
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'Cloudflare-CDN-Cache-Control': 'no-store',
          'Retry-After': '60',
        },
      },
    )
  }

  throw error
}
