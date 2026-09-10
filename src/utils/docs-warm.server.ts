/**
 * Server-only utility for pre-warming the docs artifact cache.
 *
 * Call warmDocsArtifacts after marking artifacts stale (e.g. from a GitHub
 * webhook) so the next user request is served from cache rather than
 * triggering an on-request N+1 GitHub API call.
 */
import { getCachedDocsArtifact } from './github-content-cache.server'
import { buildDocsManifest, buildDocsPathManifest } from './docs.functions'

type DocsManifest = {
  paths: Array<string>
  redirects: Record<string, string>
}

function isDocsManifest(value: unknown): value is DocsManifest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'paths' in value &&
    'redirects' in value &&
    Array.isArray((value as DocsManifest).paths) &&
    typeof (value as DocsManifest).redirects === 'object'
  )
}

export async function warmDocsArtifacts({
  repo,
  branch,
  docsRoot,
}: {
  repo: string
  branch: string
  docsRoot: string
}) {
  await Promise.all([
    getCachedDocsArtifact({
      repo,
      gitRef: branch,
      docsRoot,
      artifactType: 'docs-manifest',
      artifactKey: 'default',
      isValue: isDocsManifest,
      build: () => buildDocsManifest({ repo, branch, docsRoot }),
    }),
    getCachedDocsArtifact({
      repo,
      gitRef: branch,
      docsRoot,
      artifactType: 'docs-path-manifest',
      artifactKey: 'default',
      isValue: isDocsManifest,
      build: () => buildDocsPathManifest({ repo, branch, docsRoot }),
    }),
  ])
}
