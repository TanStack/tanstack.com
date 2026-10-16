import fs from 'node:fs'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'
import { SessionService } from '../src/auth/session.server'
const c = JSON.parse(fs.readFileSync('.staging/credentials.json', 'utf8'))
if (
  new URL(c.DIRECT_DATABASE_URL).hostname !==
  'ep-blue-rice-b4fz0smd.c-6.us-east-2.aws.neon.tech'
)
  throw new Error('Not staging')
const sql = postgres(c.DIRECT_DATABASE_URL, { max: 1 })
const service = new SessionService(c.SESSION_SECRET, true)
const users = []
try {
  for (const name of ['Alice', 'Bob']) {
    const candidateId = randomUUID()
    const [user] =
      await sql`insert into users (id,email,name) values (${candidateId},${'staging-' + name.toLowerCase() + '@example.invalid'},${'Staging ' + name}) ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name RETURNING id`
    const id = user.id
    await sql`insert into chat_access (user_id) values (${id}) ON CONFLICT (user_id) DO NOTHING`
    users.push({
      id,
      name,
      token: await service.signCookie({
        userId: id,
        expiresAt: Date.now() + 86400000,
        version: 0,
      }),
    })
  }
  const expired = await service.signCookie({
    userId: users[0].id,
    expiresAt: Date.now() - 1000,
    version: 0,
  })
  const revoked = await service.signCookie({
    userId: users[0].id,
    expiresAt: Date.now() + 86400000,
    version: 1,
  })
  const missing = await service.signCookie({
    userId: randomUUID(),
    expiresAt: Date.now() + 86400000,
    version: 0,
  })
  fs.writeFileSync(
    '.staging/sessions.json',
    JSON.stringify({ users, expired, revoked, missing }),
    { mode: 0o600 },
  )
  console.log({
    seededUsers: users.map(({ id, name }) => ({ id, name })),
    productionDataCopied: false,
  })
} finally {
  await sql.end()
}
