import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'

test('failed presence cleanup does not interrupt scheduled workflow processing', async () => {
  const calls: string[] = []
  const bundle = await build({
    entryPoints: ['src/server/scheduled.server.ts'],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'scheduled',
    plugins: [
      {
        name: 'scheduled-dependencies',
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) =>
            args.importer ? { path: args.path, namespace: 'stub' } : undefined,
          )
          build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
            contents: `
        export async function pruneLiveVisitors() { calls.push('presence-prune'); throw new Error('Database unavailable') }
        export async function interruptExpiredBuilderProjectRunLeases() { calls.push('builder-leases'); return 0 }
        export async function reconcileBuilderProjectSnapshotReservations() { return {} }
        export async function pruneBuilderProjectSnapshotStorage() { return {} }
        export async function pruneDeletedBuilderProjects() { return 0 }
        export async function reconcileWorkflowRuntimeStore() { return {} }
        export async function materializeWorkflowSchedules() { calls.push('materialize'); return [] }
        export const workflowRuntime = { async sweep() { calls.push('workflow-sweep'); return { summary: {} } } }
        export const WORKFLOW_RUNTIME_MAX_DURATION_MS = 1000
        export const WORKFLOW_RUNTIME_MIN_REMAINING_MS = 100
        export async function pruneStaleCacheRows() {}
        export async function refreshHomepageNpmStatsSummary() {}
        export async function refreshGitHubOrgStats() {}
      `,
          }))
        },
      },
    ],
  })
  const api = runInNewContext(`${bundle.outputFiles[0].text}\nscheduled`, {
    calls,
    console: { log() {}, warn() {}, error() {} },
  })
  await api.runScheduledTasks('* * * * *', Date.now())
  assert.ok(calls.includes('presence-prune'))
  assert.ok(calls.includes('builder-leases'))
  assert.ok(calls.includes('materialize'))
  assert.ok(calls.includes('workflow-sweep'))
})
