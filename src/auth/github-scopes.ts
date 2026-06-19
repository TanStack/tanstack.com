const PUBLIC_REPO_SCOPE = 'public_repo'
const PRIVATE_REPO_SCOPE = 'repo'

export interface GitHubRepoScopeState {
  hasPrivateRepoScope: boolean
  hasRepoScope: boolean
}

export function readGitHubRepoScopeState(
  tokenScope: string | null | undefined,
): GitHubRepoScopeState {
  const scopes = new Set((tokenScope ?? '').split(/[,\s]+/).filter(Boolean))
  const hasPrivateRepoScope = scopes.has(PRIVATE_REPO_SCOPE)

  return {
    hasPrivateRepoScope,
    hasRepoScope: hasPrivateRepoScope || scopes.has(PUBLIC_REPO_SCOPE),
  }
}
