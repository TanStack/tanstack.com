import assert from 'node:assert/strict'
import {
  getForgeGitHubExportDisplayState,
  getForgeWorkflowStatusText,
  getLatestForgeGitHubExport,
} from '../src/utils/forge-ui'

assert.equal(
  getForgeWorkflowStatusText({
    isExportingGitHub: true,
    isSubmitting: false,
    isValidating: false,
    latestRunStatus: 'finished',
  }),
  'GitHub export in progress',
)

assert.equal(
  getForgeWorkflowStatusText({
    isExportingGitHub: true,
    isSubmitting: true,
    isValidating: true,
  }),
  'Run in progress',
)

assert.equal(
  getForgeWorkflowStatusText({
    isExportingGitHub: true,
    isSubmitting: false,
    isValidating: true,
  }),
  'Validation in progress',
)

assert.deepEqual(
  getForgeGitHubExportDisplayState({
    latestGitHubExport: {
      error: 'Push failed after repository creation',
      kind: 'github',
      repoUrl: 'https://github.com/fixture/stale-repo',
      status: 'failed',
    },
    repoUrl: null,
  }),
  {
    latestGitHubExport: {
      error: 'Push failed after repository creation',
      kind: 'github',
      repoUrl: 'https://github.com/fixture/stale-repo',
      status: 'failed',
    },
    visibleError: 'Push failed after repository creation',
    visibleRepoUrl: undefined,
  },
)

assert.deepEqual(
  getForgeGitHubExportDisplayState({
    latestGitHubExport: {
      kind: 'github',
      repoUrl: 'https://github.com/fixture/current-repo',
      status: 'completed',
    },
    repoUrl: null,
  }).visibleRepoUrl,
  'https://github.com/fixture/current-repo',
)

assert.deepEqual(
  getForgeGitHubExportDisplayState({
    latestGitHubExport: {
      error: 'Previous failure',
      kind: 'github',
      repoUrl: 'https://github.com/fixture/stale-repo',
      status: 'failed',
    },
    repoUrl: 'https://github.com/fixture/just-created',
  }).visibleRepoUrl,
  'https://github.com/fixture/just-created',
)

assert.equal(
  getForgeGitHubExportDisplayState({
    latestGitHubExport: undefined,
    repoUrl: null,
  }).visibleRepoUrl,
  undefined,
)

assert.deepEqual(
  getLatestForgeGitHubExport([
    {
      kind: 'github',
      repoUrl: 'https://github.com/fixture/current-repo',
      status: 'completed',
    },
    {
      kind: 'zip',
      status: 'completed',
    },
  ]),
  {
    kind: 'github',
    repoUrl: 'https://github.com/fixture/current-repo',
    status: 'completed',
  },
)

console.log('Forge GitHub export display verifier passed')
