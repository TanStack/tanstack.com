import { createFileRoute } from '@tanstack/react-router'
import {
  chartsCatalogCurrentPreviewRevision,
  getChartsCatalogPreviewHeaders,
  getChartsCatalogPreviewUrl,
  parseChartsCatalogPreviewRequest,
} from '~/utils/charts-catalog-preview'

const notFoundBody = 'Charts catalog preview not found'
const unavailableBody = 'Charts catalog preview temporarily unavailable'
const noStoreHeaders = {
  'Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
  'Content-Type': 'text/plain; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

export const Route = createFileRoute(
  '/charts/catalog_/previews/$revision/{$caseId}.svg',
)({
  server: {
    handlers: {
      GET: serveChartsCatalogPreview,
      HEAD: serveChartsCatalogPreview,
    },
  },
})

export async function serveChartsCatalogPreview({
  request,
  params,
}: {
  request: Request
  params: { caseId: string; revision: string }
}) {
  if (params.revision === chartsCatalogCurrentPreviewRevision) {
    return redirectToCurrentPreview(request.method, params.caseId)
  }

  let preview: ReturnType<typeof parseChartsCatalogPreviewRequest>
  try {
    preview = parseChartsCatalogPreviewRequest(params)
  } catch (error) {
    if (error instanceof TypeError) {
      return createErrorResponse(request.method, 404, notFoundBody)
    }
    throw error
  }

  const { fetchRemoteRepoRawFile, isRecoverableGitHubContentError } =
    await import('~/utils/documents.server')

  let source: string | null
  try {
    source = await fetchRemoteRepoRawFile(
      'tanstack/charts',
      preview.revision,
      preview.repoPath,
    )
  } catch (error) {
    if (isRecoverableGitHubContentError(error)) {
      return createErrorResponse(request.method, 503, unavailableBody, {
        'Retry-After': '60',
      })
    }
    throw error
  }

  if (source === null) {
    return createErrorResponse(request.method, 404, notFoundBody)
  }

  return new Response(request.method === 'HEAD' ? null : source, {
    headers: {
      ...getChartsCatalogPreviewHeaders(),
      'Content-Length': String(new TextEncoder().encode(source).byteLength),
    },
  })
}

async function redirectToCurrentPreview(method: string, caseId: string) {
  const { getChartsCatalogIndexPublication } =
    await import('~/utils/charts-catalog-index.server')

  let publication: Awaited<ReturnType<typeof getChartsCatalogIndexPublication>>
  try {
    publication = await getChartsCatalogIndexPublication()
  } catch {
    return createErrorResponse(method, 503, unavailableBody, {
      'Retry-After': '60',
    })
  }

  if (
    !publication.index.cases.some((catalogCase) => catalogCase.id === caseId)
  ) {
    return createErrorResponse(method, 404, notFoundBody)
  }

  return new Response(null, {
    status: 307,
    headers: {
      'Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store',
      Location: getChartsCatalogPreviewUrl(publication.revision, caseId),
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function createErrorResponse(
  method: string,
  status: 404 | 503,
  body: string,
  headers?: Record<string, string>,
) {
  return new Response(method === 'HEAD' ? null : body, {
    status,
    headers: {
      ...noStoreHeaders,
      ...headers,
      'Content-Length': String(new TextEncoder().encode(body).byteLength),
    },
  })
}
