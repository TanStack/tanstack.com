import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

function fixture(productionBinding = false) {
  const directory = mkdtempSync(path.join(tmpdir(), 'staging-deployment-'))
  const bin = path.join(directory, 'bin')
  mkdirSync(bin)
  for (const kind of ['og', 'starter', 'chat', 'server']) {
    const name = `tanstack-perf-stage-${kind === 'server' ? 'site' : kind}`
    mkdirSync(path.join(directory, 'dist', kind), { recursive: true })
    writeFileSync(
      path.join(directory, 'dist', kind, 'wrangler.json'),
      JSON.stringify({
        name,
        services:
          productionBinding && kind === 'server'
            ? [{ service: 'tanstack-com' }]
            : [],
      }),
    )
  }
  writeFileSync(
    path.join(bin, 'pnpm'),
    `#!/usr/bin/env node
const fs = require('node:fs')
fs.appendFileSync('calls.jsonl', JSON.stringify({args:process.argv.slice(2),override:process.env.WRANGLER_CI_OVERRIDE_NAME,tag:process.env.WRANGLER_CI_MATCH_TAG})+'\\n')
`,
    { mode: 0o755 },
  )
  const result = spawnSync(
    process.execPath,
    [path.resolve('scripts/deploy-worker-staging.mjs')],
    {
      cwd: directory,
      env: {
        ...process.env,
        PATH: bin + path.delimiter + process.env.PATH,
        WRANGLER_CI_OVERRIDE_NAME: 'tanstack-com',
        WRANGLER_CI_MATCH_TAG: 'production-tag',
      },
      encoding: 'utf8',
    },
  )
  const log = path.join(directory, 'calls.jsonl')
  const calls = existsSync(log)
    ? readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    : []
  rmSync(directory, { recursive: true, force: true })
  return { result, calls }
}

test('Cloudflare Builds overrides cannot redirect any staging upload', () => {
  const { result, calls } = fixture()
  assert.equal(result.status, 0, result.stderr)
  assert.equal(calls.length, 4)
  assert.deepEqual(
    calls.map((call) => call.args[call.args.indexOf('--name') + 1]),
    [
      'tanstack-perf-stage-og',
      'tanstack-perf-stage-starter',
      'tanstack-perf-stage-chat',
      'tanstack-perf-stage-site',
    ],
  )
  for (const call of calls) {
    assert.equal(call.override, undefined)
    assert.equal(call.tag, undefined)
  }
})

test('a production binding aborts the entire fleet before the first upload', () => {
  const { result, calls } = fixture(true)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Non-staging service binding/)
  assert.deepEqual(calls, [])
})
