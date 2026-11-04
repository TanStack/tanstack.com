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

function fixture(
  options: {
    wrongName?: boolean
    wrongAccount?: boolean
    missingSecret?: boolean
    unhealthy?: boolean
    missingAccount?: boolean
  } = {},
) {
  const directory = mkdtempSync(path.join(tmpdir(), 'production-deployment-'))
  const bin = path.join(directory, 'bin')
  mkdirSync(bin)
  for (const kind of ['og', 'starter', 'recovery', 'chat', 'server']) {
    mkdirSync(path.join(directory, 'dist', kind), { recursive: true })
    writeFileSync(
      path.join(directory, 'dist', kind, 'wrangler.json'),
      JSON.stringify({
        name:
          kind === 'server'
            ? options.wrongName
              ? 'tanstack-perf-stage-site'
              : 'tanstack-com'
            : `tanstack-${kind === 'recovery' ? 'chat-recovery' : kind}`,
        account_id: options.wrongAccount
          ? 'another-account'
          : '8da95258a9c70b54c3e2b374a0079106',
        secrets: { required: ['SESSION_SECRET'] },
      }),
    )
  }
  writeFileSync(
    path.join(bin, 'pnpm'),
    `#!/usr/bin/env node
const fs = require('node:fs')
const args=process.argv.slice(2)
fs.appendFileSync('calls.jsonl', JSON.stringify({args,override:process.env.WRANGLER_CI_OVERRIDE_NAME,tag:process.env.WRANGLER_CI_MATCH_TAG})+'\\n')
if(args.includes('secret'))console.log(JSON.stringify(${options.missingSecret ? '[]' : '[{name:"SESSION_SECRET"}]'}))
if(args.includes('deployments'))console.log(JSON.stringify([
{created_on:'2026-10-15',versions:[{version_id:'older'}]},
{created_on:'2026-10-16',versions:[{version_id:'previous'}]}
]))
`,
    { mode: 0o755 },
  )
  const mock = path.join(directory, 'mock.mjs')
  writeFileSync(
    mock,
    `globalThis.fetch=async()=>new Response('<html>TanStack</html>',{status:${options.unhealthy ? 404 : 200}})`,
  )
  const result = spawnSync(
    process.execPath,
    ['--import', mock, path.resolve('scripts/deploy-cloudflare.mjs')],
    {
      cwd: directory,
      env: {
        ...process.env,
        PATH: bin + path.delimiter + process.env.PATH,
        WRANGLER_CI_OVERRIDE_NAME: 'tanstack-com',
        WRANGLER_CI_MATCH_TAG: 'site-tag',
        CLOUDFLARE_ACCOUNT_ID: options.missingAccount
          ? undefined
          : '8da95258a9c70b54c3e2b374a0079106',
      },
      encoding: 'utf8',
    },
  )
  const log = path.join(directory, 'calls.jsonl')
  const calls: Array<{ args: string[]; override?: string; tag?: string }> =
    existsSync(log)
      ? readFileSync(log, 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
      : []
  rmSync(directory, { recursive: true, force: true })
  return { result, calls }
}

test('production CI identity is kept only for the site, including preflight commands', () => {
  const { result, calls } = fixture()
  assert.equal(result.status, 0, result.stderr)
  const uploads = calls.filter((call) => call.args[2] === 'deploy')
  assert.deepEqual(
    uploads.map((call) => call.args[call.args.indexOf('--name') + 1]),
    [
      'tanstack-og',
      'tanstack-starter',
      'tanstack-chat-recovery',
      'tanstack-chat',
      'tanstack-com',
    ],
  )
  for (const call of calls) {
    const name = call.args[call.args.indexOf('--name') + 1]
    assert.equal(call.override, name === 'tanstack-com' ? name : undefined)
    assert.equal(call.tag, name === 'tanstack-com' ? 'site-tag' : undefined)
  }
})

test('staging names and wrong accounts are rejected before contacting Cloudflare', () => {
  for (const options of [{ wrongName: true }, { wrongAccount: true }]) {
    const { result, calls } = fixture(options)
    assert.notEqual(result.status, 0)
    assert.deepEqual(calls, [])
  }
})

test('missing credentials stop the rollout before any upload', () => {
  const { result, calls } = fixture({ missingSecret: true })
  assert.notEqual(result.status, 0)
  assert.equal(
    calls.some((call) => call.args[2] === 'deploy'),
    false,
  )
})

test('incomplete CI account context is rejected before any Cloudflare command', () => {
  const { result, calls } = fixture({ missingAccount: true })
  assert.notEqual(result.status, 0)
  assert.deepEqual(calls, [])
})

test('failed live checks restore the newest previous site version and fail the build', () => {
  const { result, calls } = fixture({ unhealthy: true })
  assert.notEqual(result.status, 0)
  const rollback = calls.at(-1)
  assert.equal(rollback?.args[2], 'rollback')
  assert.equal(rollback?.args[3], 'previous')
  assert.equal(rollback?.override, 'tanstack-com')
})
