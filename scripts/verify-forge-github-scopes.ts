import assert from 'node:assert/strict'
import { readGitHubRepoScopeState } from '../src/auth/github-scopes'

assert.deepEqual(readGitHubRepoScopeState(null), {
  hasPrivateRepoScope: false,
  hasRepoScope: false,
})

assert.deepEqual(readGitHubRepoScopeState('user:email'), {
  hasPrivateRepoScope: false,
  hasRepoScope: false,
})

assert.deepEqual(readGitHubRepoScopeState('user:email public_repo'), {
  hasPrivateRepoScope: false,
  hasRepoScope: true,
})

assert.deepEqual(readGitHubRepoScopeState('user:email,public_repo'), {
  hasPrivateRepoScope: false,
  hasRepoScope: true,
})

assert.deepEqual(readGitHubRepoScopeState('repo user:email'), {
  hasPrivateRepoScope: true,
  hasRepoScope: true,
})

console.log('Forge GitHub scope verifier passed')
