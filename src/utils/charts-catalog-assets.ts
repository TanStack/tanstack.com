import { chartsCatalogRepo, type ChartsCatalogManifest } from './charts-catalog'

const exactGitShaPattern = /^[a-f0-9]{40}$/
const encodedSeparatorPattern = /%(?:2f|5c)/i

export function getChartsCatalogAssetHeaders(
  mediaType: 'text/javascript' | 'image/svg+xml' = 'text/javascript',
) {
  const headers = {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': `${mediaType}; charset=utf-8`,
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
  }

  return mediaType === 'image/svg+xml'
    ? {
        ...headers,
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      }
    : headers
}

export function parseChartsCatalogAssetRequest({
  artifactRevision,
  assetPath,
  manifest,
}: {
  artifactRevision: string
  assetPath: string
  manifest: ChartsCatalogManifest
}) {
  if (
    !exactGitShaPattern.test(artifactRevision) ||
    encodedSeparatorPattern.test(assetPath) ||
    assetPath.includes('\\') ||
    assetPath.includes('..') ||
    assetPath.startsWith('/')
  ) {
    throw new TypeError('Invalid Charts catalog asset request')
  }

  const moduleDescriptor = Object.hasOwn(manifest.assets, assetPath)
    ? manifest.assets[assetPath]
    : undefined
  const previewDescriptor =
    manifest.schemaVersion === 5
      ? manifest.cases.find(
          (catalogCase) => catalogCase.preview.path === assetPath,
        )?.preview
      : undefined
  const descriptor = moduleDescriptor ?? previewDescriptor

  if (!descriptor) {
    throw new TypeError('Invalid Charts catalog asset request')
  }

  const mediaType = moduleDescriptor ? 'text/javascript' : 'image/svg+xml'

  return {
    descriptor,
    headers: getChartsCatalogAssetHeaders(mediaType),
    repo: chartsCatalogRepo,
    repoPath: assetPath,
  }
}
