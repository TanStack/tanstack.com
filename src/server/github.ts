import { graphql } from '@octokit/graphql'
import { env } from '~/utils/env'

export type GitHubApiErrorKind =
  | 'rate_limited'
  | 'forbidden'
  | 'unauthorized'
  | 'upstream'
  | 'unknown'

export class GitHubApiError extends Error {
  kind: GitHubApiErrorKind
  status?: number
  resetAt?: Date

  constructor(opts: {
    message: string
    kind: GitHubApiErrorKind
    status?: number
    resetAt?: Date
  }) {
    super(opts.message)
    this.name = 'GitHubApiError'
    this.kind = opts.kind
    this.status = opts.status
    this.resetAt = opts.resetAt
  }
}

function getHeader(
  headers: Record<string, string> | undefined,
  key: string,
): string | undefined {
  if (!headers) return undefined

  const loweredKey = key.toLowerCase()
  const entry = Object.entries(headers).find(
    ([headerKey]) => headerKey.toLowerCase() === loweredKey,
  )

  return entry?.[1]
}

function parseRateLimitReset(headers: Record<string, string> | undefined) {
  const resetHeader = getHeader(headers, 'x-ratelimit-reset')

  if (!resetHeader) return undefined

  const epochSeconds = Number.parseInt(resetHeader, 10)
  if (Number.isNaN(epochSeconds)) return undefined

  return new Date(epochSeconds * 1000)
}

export function normalizeGitHubApiError(error: unknown, context: string) {
  const status =
    typeof error === 'object' && error && 'status' in error
      ? Number(error.status)
      : undefined
  const responseHeaders =
    typeof error === 'object' && error && 'response' in error
      ? (error.response as { headers?: Record<string, string> }).headers
      : undefined
  const message =
    error instanceof Error ? error.message : `${context} failed`

  if (status === 401) {
    return new GitHubApiError({
      kind: 'unauthorized',
      status,
      message: `${context} was unauthorized`,
    })
  }

  if (status === 403 && getHeader(responseHeaders, 'x-ratelimit-remaining') === '0') {
    const resetAt = parseRateLimitReset(responseHeaders)
    return new GitHubApiError({
      kind: 'rate_limited',
      status,
      resetAt,
      message: resetAt
        ? `${context} hit the GitHub rate limit until ${resetAt.toISOString()}`
        : `${context} hit the GitHub rate limit`,
    })
  }

  if (status === 403) {
    return new GitHubApiError({
      kind: 'forbidden',
      status,
      message: `${context} was forbidden`,
    })
  }

  if (typeof status === 'number' && status >= 500) {
    return new GitHubApiError({
      kind: 'upstream',
      status,
      message: `${context} failed with GitHub ${status}`,
    })
  }

  return new GitHubApiError({
    kind: 'unknown',
    status,
    message,
  })
}

export function isRecoverableGitHubApiError(error: unknown) {
  return error instanceof GitHubApiError
}

export const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${env.GITHUB_AUTH_TOKEN}`,
  },
})
