import { chartsCatalogRepo, type ChartsCatalogManifest } from './charts-catalog'

const exactGitShaPattern = /^[a-f0-9]{40}$/
const encodedSeparatorPattern = /%(?:2f|5c)/i

export function getChartsCatalogAssetHeaders() {
  return {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': 'text/javascript; charset=utf-8',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
  }
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
    assetPath.startsWith('/') ||
    !Object.hasOwn(manifest.assets, assetPath)
  ) {
    throw new TypeError('Invalid Charts catalog asset request')
  }

  return {
    headers: getChartsCatalogAssetHeaders(),
    repo: chartsCatalogRepo,
    repoPath: assetPath,
  }
}
