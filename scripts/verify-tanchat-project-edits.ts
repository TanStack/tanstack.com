import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import postgres from 'postgres'
import {
  createBuilderProjectState,
  updateBuilderProjectState,
  getBuilderProjectRevisionForMutation,
  getBuilderProjectState,
} from '../src/utils/builder-project-events.server'
const url = new URL(process.env.DATABASE_URL ?? '')
if (
  !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
  !url.pathname.startsWith('/tanchat_test')
)
  throw new Error(
    'Use an empty local database whose name starts with tanchat_test.',
  )
const sql = postgres(url.href)
try {
  await sql`CREATE TABLE users (id uuid PRIMARY KEY, name text, display_username text, image text, oauth_image text)`
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0000_builder_durability.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  const ownerId = crypto.randomUUID(),
    otherId = crypto.randomUUID(),
    projectId = crypto.randomUUID()
  await sql`INSERT INTO users (id) VALUES (${ownerId}), (${otherId})`
  const firstHash = 'a'.repeat(64),
    nextHash = 'b'.repeat(64),
    thirdHash = 'c'.repeat(64)
  await sql`INSERT INTO builder_project_snapshots (hash, source_bytes, stored_at) VALUES (${firstHash}, 100, now()), (${nextHash}, 100, now()), (${thirdHash}, 100, now())`
  await createBuilderProjectState({
    id: projectId,
    ownerId,
    clientMutationId: crypto.randomUUID(),
    revisionId: crypto.randomUUID(),
    snapshotHash: firstHash,
    title: 'App',
    description: '',
  })
  const edit = {
    projectId,
    ownerId,
    clientMutationId: crypto.randomUUID(),
    requestHash: 'd'.repeat(64),
    revisionId: crypto.randomUUID(),
    snapshotHash: nextHash,
    expectedRevisionNumber: 1,
  }
  assert.equal(await getBuilderProjectRevisionForMutation(edit), undefined)
  const committed = await updateBuilderProjectState(edit)
  assert.equal(committed.currentRevisionNumber, 2)
  assert.deepEqual(await getBuilderProjectRevisionForMutation(edit), {
    revisionNumber: 2,
    snapshotHash: nextHash,
  })
  assert.equal((await updateBuilderProjectState(edit)).currentRevisionNumber, 2)
  await assert.rejects(
    getBuilderProjectRevisionForMutation({ ...edit, ownerId: otherId }),
    /belongs to another user/,
  )
  await assert.rejects(
    getBuilderProjectRevisionForMutation({
      ...edit,
      requestHash: 'e'.repeat(64),
    }),
    /conflicts with an existing receipt/,
  )
  await assert.rejects(
    updateBuilderProjectState({
      ...edit,
      clientMutationId: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      snapshotHash: thirdHash,
    }),
    /revision changed/,
  )
  await updateBuilderProjectState({
    ...edit,
    clientMutationId: crypto.randomUUID(),
    requestHash: 'f'.repeat(64),
    revisionId: crypto.randomUUID(),
    snapshotHash: thirdHash,
    expectedRevisionNumber: 2,
  })
  assert.equal(
    (await getBuilderProjectState({ projectId, ownerId }))
      .currentRevisionNumber,
    3,
  )
  assert.deepEqual(await getBuilderProjectRevisionForMutation(edit), {
    revisionNumber: 2,
    snapshotHash: nextHash,
  })
  const [count] =
    await sql`SELECT count(*)::int AS count FROM builder_project_revisions WHERE project_id=${projectId}`
  assert.equal(count.count, 3)
  console.log(
    'Passed: native project edits, retry recovery, ownership, conflicting receipts, stale revisions and exact recovery after newer edits.',
  )
} finally {
  await sql.end()
}
process.exit(0)
