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

function deploymentFixture(owner: string, missingSecret = false) {
  const directory = mkdtempSync(path.join(tmpdir(), 'worker-deployment-'))
  const binaryDirectory = path.join(directory, 'bin')
  mkdirSync(binaryDirectory)
  const base = { name: 'site' }
  const chat = {
    name: 'chat',
    secrets: { required: ['SESSION_SECRET'] },
    exports: { Conversation: { type: 'durable-object', storage: 'sqlite' } },
    durable_objects: {
      bindings: [{ name: 'CONVERSATIONS', class_name: 'Conversation' }],
    },
    workflows: [
      {
        name: 'existing-workflow',
        binding: 'WORKFLOW_RUNS',
        class_name: 'ChatWorkflow',
      },
    ],
    triggers: { crons: ['* * * * *'] },
  }
  for (const [name, config] of Object.entries({
    server: base,
    chat,
    og: { name: 'og' },
    starter: { name: 'starter', secrets: { required: ['SESSION_SECRET'] } },
  })) {
    mkdirSync(path.join(directory, 'dist', name), { recursive: true })
    writeFileSync(
      path.join(directory, 'dist', name, 'wrangler.json'),
      JSON.stringify(config),
    )
  }
  writeFileSync(
    path.join(binaryDirectory, 'pnpm'),
    `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2)
if (args.includes('secret')) console.log(JSON.stringify(${missingSecret ? '[]' : "[{name:'SESSION_SECRET'}]"}))
else if (args.includes('workflows')) console.log(JSON.stringify([{name:'existing-workflow',script_name:${JSON.stringify(owner)}}]))
else if (args.includes('deploy')) {
 const config = JSON.parse(fs.readFileSync(args[args.indexOf('--config') + 1], 'utf8'))
 fs.appendFileSync('deployments.jsonl',JSON.stringify(config)+'\\n')
 if (!args.includes('--keep-vars')) process.exit(1)
}
`,
    { mode: 0o755 },
  )
  const result = spawnSync(
    process.execPath,
    [path.resolve('scripts/deploy-cloudflare.mjs')],
    {
      cwd: directory,
      env: {
        ...process.env,
        PATH: binaryDirectory + path.delimiter + process.env.PATH,
      },
      encoding: 'utf8',
    },
  )
  const log = path.join(directory, 'deployments.jsonl')
  const deployments = existsSync(log)
    ? readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    : []
  return {
    directory,
    result,
    deployments,
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  }
}

test('first deployment prepares existing namespaces before transfer and workflow reassignment', () => {
  const fixture = deploymentFixture('site')
  try {
    assert.equal(fixture.result.status, 0, fixture.result.stderr)
    const [, , preparing, committing, chat, site] = fixture.deployments
    assert.equal(preparing.exports.Conversation.state, 'expecting-transfer')
    assert.equal(preparing.exports.Conversation.transfer_from, 'site')
    assert.equal(preparing.exports.Conversation.storage, 'sqlite')
    assert.equal(preparing.durable_objects.bindings[0].script_name, 'site')
    assert.equal(preparing.workflows[0].script_name, 'site')
    assert.deepEqual(preparing.triggers.crons, [])
    assert.deepEqual(committing.exports.Conversation, {
      type: 'durable-object',
      state: 'transferred',
      transferred_to: 'chat',
    })
    assert.deepEqual(chat.exports.Conversation, {
      type: 'durable-object',
      storage: 'sqlite',
    })
    assert.equal(chat.durable_objects.bindings[0].script_name, undefined)
    assert.equal(chat.workflows[0].name, 'existing-workflow')
    assert.equal(chat.workflows[0].script_name, undefined)
    assert.equal(site.exports, undefined)
    assert.equal(fixture.deployments.length, 6)
    assert.equal(
      existsSync(
        path.join(
          fixture.directory,
          'dist/chat/wrangler.prepare-transfer.json',
        ),
      ),
      false,
    )
  } finally {
    fixture.cleanup()
  }
})

test('subsequent deployments keep the existing owner and deploy dependencies before the site', () => {
  const fixture = deploymentFixture('chat')
  try {
    assert.equal(fixture.result.status, 0, fixture.result.stderr)
    assert.deepEqual(
      fixture.deployments.map((config) => config.name),
      ['og', 'starter', 'chat', 'site'],
    )
    assert.equal(fixture.deployments[2].exports.Conversation.state, undefined)
  } finally {
    fixture.cleanup()
  }
})

test('missing credentials or an unexpected workflow owner stop deployment before any changes', () => {
  for (const [owner, missingSecret] of [
    ['site', true],
    ['unexpected', false],
  ]) {
    const fixture = deploymentFixture(String(owner), Boolean(missingSecret))
    try {
      assert.notEqual(fixture.result.status, 0)
      assert.deepEqual(fixture.deployments, [])
    } finally {
      fixture.cleanup()
    }
  }
})
