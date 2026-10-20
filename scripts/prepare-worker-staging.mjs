import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export const prefix = 'tanstack-perf-stage'
export const buckets = ['github', 'npm', 'files'].map(
  (name) => `${prefix}-${name}`,
)
const root = process.cwd()
mkdirSync('.staging', { recursive: true })
for (const [kind, source] of Object.entries({
  server: 'wrangler.jsonc',
  og: 'workers/og/wrangler.jsonc',
  starter: 'workers/starter/wrangler.jsonc',
  chat: 'workers/chat/wrangler.jsonc',
})) {
  const { config, error } = ts.parseConfigFileTextToJson(
    source,
    readFileSync(source, 'utf8'),
  )
  if (error) throw new Error(`Invalid ${source}`)
  config.name = `${prefix}-${kind === 'server' ? 'site' : kind}`
  config.main = path.resolve(path.dirname(source), config.main)
  config.workers_dev = kind === 'server'
  config.preview_urls = false
  config.routes = []
  config.triggers = { crons: [] }
  config.hyperdrive = []
  delete config.ai
  config.secrets = {
    required:
      kind === 'og'
        ? ['SESSION_SECRET', 'ENCRYPTION_KEY']
        : ['SESSION_SECRET', 'ENCRYPTION_KEY', 'DATABASE_URL'],
  }
  config.vars = { APP_MODE: 'production', SENTRY_DSN: '' }
  config.r2_buckets = (config.r2_buckets ?? []).map((binding) => ({
    binding: binding.binding,
    bucket_name: `${prefix}-${binding.binding === 'GITHUB_CONTENT_CACHE' ? 'github' : binding.binding === 'NPM_DOWNLOAD_CACHE' ? 'npm' : 'files'}`,
  }))
  config.services = (config.services ?? []).map((binding) => ({
    binding: binding.binding,
    service: `${prefix}-${binding.binding === 'ASSETS' ? 'site' : binding.binding.toLowerCase()}`,
  }))
  for (const binding of config.durable_objects?.bindings ?? [])
    delete binding.script_name
  for (const binding of config.workflows ?? []) {
    binding.name = `${prefix}-workflow`
    delete binding.script_name
  }
  if (config.assets) config.assets.directory = path.join(root, 'public')
  writeFileSync(`.staging/${kind}.json`, JSON.stringify(config, null, 2))
}
