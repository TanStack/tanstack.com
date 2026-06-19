import assert from 'node:assert/strict'
import { getTableColumns } from 'drizzle-orm'
import { forgeChatSessions, forgeProjects } from '../src/db/schema'

const forgeProjectColumns = Object.values(getTableColumns(forgeProjects))
  .map((column) => column.name)
  .sort()

const forgeChatSessionColumns = Object.values(
  getTableColumns(forgeChatSessions),
)
  .map((column) => column.name)
  .sort()

assert.deepEqual(forgeProjectColumns, [
  'active_chat_session_id',
  'created_at',
  'id',
  'name',
  'runtime_project_id',
  'updated_at',
  'user_id',
])

assert.deepEqual(forgeChatSessionColumns, [
  'archived_at',
  'created_at',
  'current_manifest_version_id',
  'id',
  'latest_run_id',
  'latest_run_status',
  'project_id',
  'runtime_session_id',
  'title',
  'updated_at',
  'user_id',
])

const forbiddenCanonicalStateColumns = new Set([
  'agent_events',
  'blob',
  'blobs',
  'event',
  'event_log',
  'events',
  'file',
  'files',
  'manifest',
  'manifest_json',
  'messages',
  'payload',
  'state',
  'state_json',
  'stream',
  'timeline',
  'transcript',
  'transcript_json',
])

for (const columnName of [...forgeProjectColumns, ...forgeChatSessionColumns]) {
  assert.equal(
    forbiddenCanonicalStateColumns.has(columnName),
    false,
    `Forge meta table must not store canonical runtime state in ${columnName}`,
  )
}

console.log('Forge meta boundary verifier passed')
