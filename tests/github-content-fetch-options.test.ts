import assert from 'node:assert/strict'
import { runWithHostRuntimeEnv } from '../src/server/runtime/host.server'
import { getGitHubContentFetchOptions } from '../src/utils/documents.server'

function getHeaderValue(init: RequestInit, name: string) {
  return new Headers(init.headers).get(name)
}

const authenticatedOptions = runWithHostRuntimeEnv(
  { GITHUB_AUTH_TOKEN: 'host-token' },
  () => getGitHubContentFetchOptions(),
)

assert.equal(
  getHeaderValue(authenticatedOptions, 'Authorization'),
  'Bearer host-token',
  'GitHub API fetches use the Worker env token when present',
)

const unauthenticatedOptions = runWithHostRuntimeEnv(
  { GITHUB_AUTH_TOKEN: 'host-token' },
  () => getGitHubContentFetchOptions({ includeAuthorization: false }),
)

assert.equal(
  getHeaderValue(unauthenticatedOptions, 'Authorization'),
  null,
  'GitHub API fetches can still opt out of authorization',
)

console.log('github-content-fetch-options tests passed')
