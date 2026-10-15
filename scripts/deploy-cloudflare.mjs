import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'

function wrangler(args, capture = false) {
  const result = spawnSync('pnpm', ['exec', 'wrangler', ...args], {
    stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(
      `wrangler ${args[0]} failed with exit code ${result.status ?? 1}`,
    )
  return result.stdout
}

const sitePath = 'dist/server/wrangler.json'
const chatPath = 'dist/chat/wrangler.json'
const site = JSON.parse(readFileSync(sitePath, 'utf8'))
const chat = JSON.parse(readFileSync(chatPath, 'utf8'))
const workflow = chat.workflows[0]
const deploy = (config) =>
  wrangler(['deploy', '--config', config, '--keep-vars'])

// Fail before any namespace changes if a child is missing its credentials.
for (const worker of ['chat', 'starter']) {
  const configPath = `dist/${worker}/wrangler.json`
  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  const secrets = JSON.parse(
    wrangler(['secret', 'list', '--config', configPath], true),
  )
  const missing = (config.secrets?.required ?? []).filter(
    (name) => !secrets.some((secret) => secret.name === name),
  )
  if (missing.length)
    throw new Error(
      `Provision ${config.name} secrets before deployment: ${missing.join(', ')}`,
    )
}

let currentWorkflow
for (let page = 1; !currentWorkflow; page++) {
  const workflows = JSON.parse(
    wrangler(
      [
        'workflows',
        'list',
        '--json',
        '--per-page',
        '100',
        '--page',
        String(page),
        '--config',
        sitePath,
      ],
      true,
    ),
  )
  currentWorkflow = workflows.find((item) => item.name === workflow.name)
  if (workflows.length < 100) break
}
if (
  !currentWorkflow ||
  ![site.name, chat.name].includes(currentWorkflow.script_name)
) {
  throw new Error(
    `Expected ${workflow.name} to belong to ${site.name} or ${chat.name}. Check the existing deployment before continuing.`,
  )
}

for (const worker of ['og', 'starter']) deploy(`dist/${worker}/wrangler.json`)

if (currentWorkflow.script_name === site.name) {
  // First rollout: prepare transfers while the old site still owns the state.
  // Cross-script bindings resolve to the existing namespace IDs and continue
  // working after those namespaces move. Do not create replacement namespaces.
  const preparing = structuredClone(chat)
  for (const entry of Object.values(preparing.exports)) {
    if (entry.type !== 'durable-object') continue
    entry.state = 'expecting-transfer'
    entry.transfer_from = site.name
  }
  for (const binding of preparing.durable_objects.bindings)
    binding.script_name = site.name
  for (const binding of preparing.workflows) binding.script_name = site.name
  preparing.triggers = { crons: [] }

  const committing = structuredClone(site)
  committing.exports = Object.fromEntries(
    chat.durable_objects.bindings.map((binding) => [
      binding.class_name,
      {
        type: 'durable-object',
        state: 'transferred',
        transferred_to: chat.name,
      },
    ]),
  )

  const preparingPath = 'dist/chat/wrangler.prepare-transfer.json'
  const committingPath = 'dist/server/wrangler.commit-transfer.json'
  try {
    writeFileSync(preparingPath, JSON.stringify(preparing))
    writeFileSync(committingPath, JSON.stringify(committing))
    deploy(preparingPath)
    deploy(committingPath)
    deploy(chatPath)
    // Remove the completed source tombstones. The site owns no namespaces.
    deploy(sitePath)
  } finally {
    rmSync(preparingPath, { force: true })
    rmSync(committingPath, { force: true })
  }
} else {
  deploy(chatPath)
  deploy(sitePath)
}
