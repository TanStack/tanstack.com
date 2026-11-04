import { queryOptions } from '@tanstack/react-query'
import { fetchDocsPathManifest } from '~/utils/docs.functions'

export function docsPathManifestQueryOptions(request: {
  repo: string
  branch: string
  docsRoot: string
}) {
  const { repo, branch, docsRoot } = request

  return queryOptions({
    queryKey: ['docs-path-manifest', repo, branch, docsRoot],
    queryFn: () => fetchDocsPathManifest({ data: { repo, branch, docsRoot } }),
    staleTime: 1000 * 60 * 5,
  })
}
