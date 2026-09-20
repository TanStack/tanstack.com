import { isChartsCatalogCaseId } from './charts-catalog'

const exactGitShaPattern = /^[a-f0-9]{40}$/

export const chartsCatalogCurrentPreviewRevision = 'current'

export function getChartsCatalogPreviewPath(caseId: string) {
  if (!isChartsCatalogCaseId(caseId)) {
    throw new TypeError('Invalid Charts catalog preview case ID')
  }

  return `benchmarks/conformance/previews/${caseId}.svg`
}

export function getChartsCatalogPreviewUrl(revision: string, caseId: string) {
  if (
    revision !== chartsCatalogCurrentPreviewRevision &&
    !exactGitShaPattern.test(revision)
  ) {
    throw new TypeError('Invalid Charts catalog preview revision')
  }

  getChartsCatalogPreviewPath(caseId)
  return `/charts/catalog/previews/${revision}/${caseId}.svg`
}

export function parseChartsCatalogPreviewRequest({
  caseId,
  revision,
}: {
  caseId: string
  revision: string
}) {
  if (!exactGitShaPattern.test(revision)) {
    throw new TypeError('Invalid Charts catalog preview revision')
  }

  return {
    caseId,
    repoPath: getChartsCatalogPreviewPath(caseId),
    revision,
  }
}

export function getChartsCatalogPreviewHeaders() {
  return {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Cloudflare-CDN-Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Security-Policy':
      "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
  }
}
