import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const account = '8da95258a9c70b54c3e2b374a0079106'
const destinations = {
  og: 'tanstack-og',
  starter: 'tanstack-starter',
  recovery: 'tanstack-chat-recovery',
  chat: 'tanstack-chat',
  server: 'tanstack-com',
}
const configurations = Object.entries(destinations).map(([kind, name]) => {
  const file = `dist/${kind}/wrangler.json`
  return { file, name, config: JSON.parse(readFileSync(file, 'utf8')) }
})
const names = new Set(Object.values(destinations))
const buckets = new Set([
  'tanstack-github-content-cache',
  'tanstack-npm-download-cache',
  'tanstack-notebook-projects',
])

// Validate the entire fleet before the first upload. State transfers are a
// separate, supervised operation, never an automatic build side effect.
for (const { name, config } of configurations) {
  if (config.name !== name || config.account_id !== account)
    throw new Error(`Unexpected deployment destination: ${config.name}`)
  if (config.migrations?.length)
    throw new Error(`Migrations are not allowed during deployment: ${name}`)
  for (const entry of Object.values(config.exports ?? {}))
    if (entry.state || entry.transfer_from || entry.transferred_to)
      throw new Error(`Namespace changes are not allowed: ${name}`)
  if (name === 'tanstack-com' && Object.keys(config.exports ?? {}).length)
    throw new Error('The site must not own chat namespaces')
  for (const binding of config.services ?? [])
    if (!names.has(binding.service))
      throw new Error('Unexpected service binding')
  for (const binding of config.r2_buckets ?? [])
    if (!buckets.has(binding.bucket_name))
      throw new Error('Unexpected R2 bucket')
  for (const binding of config.hyperdrive ?? [])
    if (binding.id !== '6ec1513b87bb47e9897e5502727b0388')
      throw new Error('Unexpected Hyperdrive database')
  for (const binding of config.durable_objects?.bindings ?? [])
    if (binding.script_name && binding.script_name !== 'tanstack-chat')
      throw new Error('Unexpected chat namespace binding')
  for (const binding of config.workflows ?? [])
    if (
      binding.name !== 'tanstack-chat-workflows' ||
      !(
        (name === 'tanstack-chat' && !binding.script_name) ||
        (name === 'tanstack-chat-recovery' &&
          binding.script_name === 'tanstack-chat')
      )
    )
      throw new Error('Unexpected workflow owner')
}
if (
  process.env.WRANGLER_CI_OVERRIDE_NAME &&
  process.env.WRANGLER_CI_OVERRIDE_NAME !== 'tanstack-com'
)
  throw new Error('Production builds must be connected to tanstack-com')
if (
  (process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_ACCOUNT_ID !== account) ||
  (process.env.WRANGLER_CI_MATCH_TAG &&
    (process.env.CLOUDFLARE_ACCOUNT_ID !== account ||
      process.env.WRANGLER_CI_OVERRIDE_NAME !== 'tanstack-com'))
)
  throw new Error('The production CI account and Worker identity must match')

const env = { ...process.env }
delete env.WRANGLER_CI_OVERRIDE_NAME
delete env.WRANGLER_CI_MATCH_TAG
function wrangler(args, name, capture = false) {
  const workerEnv = { ...env }
  if (process.env.WRANGLER_CI_OVERRIDE_NAME === name) {
    workerEnv.WRANGLER_CI_OVERRIDE_NAME = name
    if (process.env.WRANGLER_CI_MATCH_TAG)
      workerEnv.WRANGLER_CI_MATCH_TAG = process.env.WRANGLER_CI_MATCH_TAG
  }
  const result = spawnSync('pnpm', ['exec', 'wrangler', ...args], {
    env: workerEnv,
    encoding: 'utf8',
    stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Wrangler failed for ${name}`)
  return result.stdout
}

for (const { file, name, config } of configurations) {
  const secrets = JSON.parse(
    wrangler(['secret', 'list', '--config', file, '--name', name], name, true),
  )
  const missing = (config.secrets?.required ?? []).filter(
    (required) => !secrets.some((secret) => secret.name === required),
  )
  if (missing.length)
    throw new Error(`Missing ${name} secrets: ${missing.join(', ')}`)
}

const site = configurations.find(({ name }) => name === 'tanstack-com')
const deployments = JSON.parse(
  wrangler(
    [
      'deployments',
      'list',
      '--config',
      site.file,
      '--name',
      site.name,
      '--json',
    ],
    site.name,
    true,
  ),
).sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))
const previousVersion = deployments[0]?.versions[0]?.version_id
if (!previousVersion || deployments[0].versions.length !== 1)
  throw new Error('Expected a single existing production version for rollback')

console.log(
  JSON.stringify({
    target: 'production',
    ciWorker: process.env.WRANGLER_CI_OVERRIDE_NAME ?? null,
    ciTagPresent: Boolean(process.env.WRANGLER_CI_MATCH_TAG),
    destinations: [...names],
    previousVersion,
  }),
)
for (const { file, name } of configurations.filter(
  ({ name }) => name !== site.name,
)) {
  console.log(`Deploying ${name}`)
  wrangler(['deploy', '--config', file, '--name', name, '--keep-vars'], name)
}

// Keep the failed build visible and restore the previous site if its public
// entry points do not work. No schema or namespace changes happen in this flow.
try {
  wrangler(
    ['deploy', '--config', site.file, '--name', site.name, '--keep-vars'],
    site.name,
  )
  for (const path of [
    '/',
    '/query/latest/docs/framework/react/overview',
    '/router/latest/docs/framework/react/overview',
    '/start/latest/docs/framework/react/overview',
  ]) {
    const response = await fetch(`https://tanstack.com${path}`, {
      signal: AbortSignal.timeout(30_000),
      headers: { 'Cache-Control': 'no-cache' },
    })
    const html = await response.text()
    if (response.status !== 200 || !html.includes('<html'))
      throw new Error(`Production check failed: ${path} (${response.status})`)
    console.log(`Verified ${path}: ${response.status}`)
  }
} catch (error) {
  wrangler(
    [
      'rollback',
      previousVersion,
      '--config',
      site.file,
      '--name',
      site.name,
      '--yes',
    ],
    site.name,
  )
  throw error
}
