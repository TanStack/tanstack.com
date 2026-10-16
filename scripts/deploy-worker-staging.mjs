import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// This experiment can only target the isolated staging fleet.
const prefix = 'tanstack-perf-stage-'
const configurations = ['og', 'starter', 'chat', 'server'].map((kind) => {
  const file = `dist/${kind}/wrangler.json`
  return {
    file,
    expectedName: `${prefix}${kind === 'server' ? 'site' : kind}`,
    config: JSON.parse(readFileSync(file, 'utf8')),
  }
})
const names = new Set(configurations.map(({ config }) => config.name))
for (const { config, expectedName } of configurations) {
  if (
    config.name !== expectedName ||
    config.routes?.length ||
    config.triggers?.crons?.length
  )
    throw new Error(`Refusing non-staging destination: ${config.name}`)
  if (config.hyperdrive?.length || config.ai || config.migrations?.length)
    throw new Error(`Refusing shared resources or migrations: ${config.name}`)
  for (const binding of config.r2_buckets ?? [])
    if (!binding.bucket_name.startsWith(prefix))
      throw new Error('Non-staging R2 bucket')
  for (const binding of config.services ?? [])
    if (!names.has(binding.service))
      throw new Error('Non-staging service binding')
  for (const binding of config.durable_objects?.bindings ?? [])
    if (binding.script_name && !names.has(binding.script_name))
      throw new Error('Non-staging Durable Object binding')
  for (const binding of config.workflows ?? [])
    if (
      !binding.name.startsWith(prefix) ||
      (binding.script_name && !names.has(binding.script_name))
    )
      throw new Error('Non-staging workflow')
  for (const entry of Object.values(config.exports ?? {}))
    if (entry.state || entry.transfer_from || entry.transferred_to)
      throw new Error('Namespace transfers are disabled in staging deploys')
}

// These variables are scoped to one connected Cloudflare Builds Worker.
// Passing them to a different Worker overrides even an explicit --name.
const env = { ...process.env }
delete env.WRANGLER_CI_OVERRIDE_NAME
delete env.WRANGLER_CI_MATCH_TAG
for (const { file, config } of configurations) {
  console.log(`Deploying staging Worker ${config.name}`)
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'deploy',
      '--config',
      file,
      '--name',
      config.name,
      '--keep-vars',
    ],
    { env, stdio: 'inherit' },
  )
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Deployment failed: ${config.name}`)
}
