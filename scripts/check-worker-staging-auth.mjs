import fs from 'node:fs'
import assert from 'node:assert/strict'
const origin = 'https://tanstack-perf-stage-site.thetanstack.workers.dev'
const sessions = JSON.parse(fs.readFileSync('.staging/sessions.json', 'utf8'))
const [alice, bob] = sessions.users
const checks = []
async function request(
  label,
  path,
  token,
  method = 'GET',
  body,
  source = origin,
  expected = 200,
) {
  if (!path.startsWith('/api/chat/'))
    throw new Error('Unexpected staging test route')
  const response = await fetch(origin + path, {
    method,
    redirect: 'manual',
    headers: {
      ...(token
        ? { Cookie: 'session_token=' + encodeURIComponent(token) }
        : {}),
      ...(method !== 'GET'
        ? { 'Content-Type': 'application/json', Origin: source }
        : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = await response.json()
  checks.push({ label, status: response.status, expected })
  console.log({
    label,
    status: response.status,
    expected,
    ...(response.status !== expected ? { response: data } : {}),
  })
  assert.equal(response.status, expected, label)
  return data
}
try {
  await request(
    'anonymous rejected',
    '/api/chat/account/preferences',
    undefined,
    'GET',
    undefined,
    origin,
    401,
  )
  const first = await request(
    'Alice signed-in read',
    '/api/chat/account/preferences',
    alice.token,
  )
  const saved = await request(
    'Alice preference write',
    '/api/chat/account/preferences',
    alice.token,
    'POST',
    { revision: first.revision, timezone: 'America/Denver' },
  )
  assert.equal(saved.timezone, 'America/Denver')
  const second = await request(
    'Bob account isolation',
    '/api/chat/account/preferences',
    bob.token,
  )
  assert.equal(second.timezone, null)
  await request(
    'cross-origin mutation rejected',
    '/api/chat/account/preferences',
    alice.token,
    'POST',
    { revision: saved.revision, timezone: 'UTC' },
    'https://example.invalid',
    403,
  )
  await request(
    'expired session rejected',
    '/api/chat/account/preferences',
    sessions.expired,
    'GET',
    undefined,
    origin,
    401,
  )
  await request(
    'revoked session version rejected',
    '/api/chat/account/preferences',
    sessions.revoked,
    'GET',
    undefined,
    origin,
    401,
  )
  await request(
    'nonexistent user rejected',
    '/api/chat/account/preferences',
    sessions.missing,
    'GET',
    undefined,
    origin,
    401,
  )
  await request(
    'forged cookie rejected',
    '/api/chat/account/preferences',
    alice.token.slice(0, -4) + 'AAAA',
    'GET',
    undefined,
    origin,
    401,
  )
  const workspaceA = await request(
    'Alice creates personal workspace',
    '/api/chat/workspace',
    alice.token,
    'POST',
    {},
  )
  const workspaceB = await request(
    'Bob creates separate workspace',
    '/api/chat/workspace',
    bob.token,
    'POST',
    {},
  )
  assert.notDeepEqual(workspaceA, workspaceB)
  await request(
    'Alice reads staging Durable Object snapshot',
    '/api/chat/workspace-sync/snapshot?workspaceId=' +
      encodeURIComponent('personal:' + alice.id),
    alice.token,
  )
  await request(
    'Bob cannot read Alice workspace',
    '/api/chat/workspace-sync/snapshot?workspaceId=' +
      encodeURIComponent('personal:' + alice.id),
    bob.token,
    'GET',
    undefined,
    origin,
    403,
  )
  fs.writeFileSync(
    'staging/auth-flows.json',
    JSON.stringify(
      { checks, workspaceA, workspaceB, syntheticUsersOnly: true },
      null,
      2,
    ) + '\n',
  )
} finally {
  fs.writeFileSync(
    '/tmp/tanstack-staging-auth-checks.json',
    JSON.stringify(checks, null, 2) + '\n',
  )
}
