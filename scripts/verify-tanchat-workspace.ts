import { projectBotActivity } from '../src/chat/core/bot-activity'
import { readBootstrap } from '../src/chat/server/bootstrap'
import { readOnboarding, updateOnboarding } from '../src/chat/server/onboarding'
import {
  readConversationWorkflowWorker,
  readConversationWorkflowOwner,
  readConversationLifecycle,
  conversationRetryReady,
  readConversationRunContext,
  confirmCopyActivityPublication,
  conversationCopyPublished,
  workflowChildPublished,
  readKodyUsername,
  readRunUsageStart,
} from '../src/chat/server/conversation-database'
import { SavedActions } from '../src/chat/server/saved-actions'
import { AssistantConversations } from '../src/chat/server/assistant-conversation-tools'
import { botDragLayout } from '../src/chat/core/bot-drag'
import { moveBotGroup } from '../src/chat/core/bot-group-move'
import { BotWorkspace } from '../src/chat/server/bot-workspace'
import {
  reserveWorkspaceConversations,
  type WorkspaceLifecycleEnvironment,
} from '../src/chat/server/workspace-lifecycle-reservation'
import { WorkspaceSections } from '../src/chat/server/workspace-sections'
import {
  readWorkspaceBots,
  readWorkspaceBot,
  readBotSections,
} from '../src/chat/server/bot-workspace-reads'
import {
  readSyncProjection,
  syncMembership,
} from '../src/chat/server/workspace-sync-projection'
import {
  probeKodyAccount,
  invalidateKodyCatalogs,
} from '../src/chat/server/kody-sync'
import {
  ConversationRetries,
  type RetryEnvironment,
} from '../src/chat/server/conversation-retries'
import type { RetryPreparationSnapshot } from '../src/chat/core/conversation-retry'
import {
  listMessageReferences,
  resolveMessageReferences,
  discoverWorkspaceConversations,
  type ReferenceEnvironment,
} from '../src/chat/server/message-references'
import {
  refreshKodyReferences,
  listKodyReferences,
  resolveKodyReference,
} from '../src/chat/server/kody-reference-catalog'
import {
  listToolReferences,
  refreshToolReferences,
  resolveToolReference,
} from '../src/chat/server/tool-reference-catalog'
import {
  listKodyAccountReferences,
  refreshKodyAccountReferences,
  resolveKodyAccountReference,
  inspectKodyAccountReference,
} from '../src/chat/server/kody-account-reference-catalog'
import { kodyAccountSchema } from '../src/chat/core/kody-account'
import { copyRetrySource } from '../src/chat/server/copy-retry-source'
import {
  canonicalCopyJson,
  copyBoundaryMessage,
} from '../src/chat/core/conversation-copy'
import {
  projectRetryTurn,
  retryReviewPayload,
} from '../src/chat/core/retry-source'
import type { ConversationCopyRow } from '../src/chat/server/conversation-copy-contract'
import { ConversationCopies } from '../src/chat/server/conversation-copies'
import {
  resumeConversationCopies,
  getAuthorizedCopyOperation,
} from '../src/chat/server/conversation-copy-worker'
import type { CopyManifest } from '../src/chat/core/conversation-copy'
import { hash as copyHash } from '../src/chat/server/crypto'
import {
  ConversationThreads,
  conversationThreadContext,
} from '../src/chat/server/conversation-threads'
import {
  reserveRunUsage,
  settleFundedSpend,
  fundedSpendReport,
  RunUsageAllowanceError,
} from '../src/chat/server/run-usage'
import {
  deviceAccountApi,
  deviceTransportApi,
  listDevices,
} from '../src/chat/server/connected-devices'
import { readExecutionAuthority } from '../src/chat/server/execution-authority'
import {
  readScheduleLifecycleGeneration,
  readThreadScheduleLifecycleGeneration,
} from '../src/chat/server/schedule-lifecycle'
import { DatabaseSync } from 'node:sqlite'
import type { R2Checksums, SqlStorage } from '@cloudflare/workers-types'
import {
  BotActivityOutbox,
  readBotActivity,
  markBotRead,
  markConversationRead,
  readConversationReadVersion,
} from '../src/chat/server/bot-activity'
import { publishWorkflowChild } from '../src/chat/server/workflow-children'
import { Workflows } from '../src/chat/server/workflows'
import { resolveWorkflowContext } from '../src/chat/server/workflow-context'
import { pluginMcpConnections } from '../src/chat/server/plugin-connections'
import { connectedMcpServers } from '../src/chat/server/mcp-connections'
import { defaultPolicy } from '../src/chat/core/types'
import { McpSetups } from '../src/chat/server/mcp-setup'
import { Plugins } from '../src/chat/server/plugins'
import { McpAccounts } from '../src/chat/server/mcp-accounts'
import { McpAccountReads } from '../src/chat/server/mcp-account-reads'
import { seal } from '../src/chat/server/crypto'
import { assistantSkillTools } from '../src/chat/server/assistant-skill-tools'
import { SkillCatalog } from '../src/chat/server/skill-catalog'
import { parseSkillMarkdown } from '../src/chat/core/skills'
import { PluginPackages } from '../src/chat/server/plugin-packages'
import {
  pluginManifestSchemaId,
  pluginMcpSchemaId,
} from '../src/chat/core/plugins'
import {
  KodySkillCatalog,
  suggestKodySkills,
} from '../src/chat/server/kody-skill-catalog'
import { syncKodySkills } from '../src/chat/server/kody-skill-sync'
import { kodySkillAccount } from '../src/chat/server/kody-skill-account'
import type { kodyCall } from '../src/chat/server/kody'
import { readKodyAccount } from '../src/chat/server/kody-account'
import { Skills } from '../src/chat/server/skills'
import { chatSkills, chatSkillVersions } from '../src/db/schema'
import {
  readWorkspacePolicy,
  updateWorkspacePolicy,
} from '../src/chat/workspace-policy.server'
import { BotDrafts } from '../src/chat/server/bot-drafts'
import type { RunModelSelection } from '../src/chat/core/run-model'
import { db as appDb } from '../src/db/client'
import { chatBotDrafts } from '../src/db/schema'
import {
  DraftFiles,
  resolveDraftAttachments,
  promoteDraftFiles,
} from '../src/chat/server/draft-files'
import type { SaveFileInput } from '../src/chat/core/files'
import {
  SavedFiles,
  type FileEnvironment,
} from '../src/chat/server/saved-files'
import { composerDraftApi } from '../src/chat/server/composer-drafts'
import { Memories } from '../src/chat/server/memory'
import {
  readAccountPreferences,
  updateAccountPreferences,
} from '../src/chat/server/account-preferences'
import {
  readCredentials,
  writeCredentials,
  updateCredentials,
} from '../src/chat/server/credentials'
import { connectionSchema } from '../src/chat/core/types'
import { readThreadContext } from '../src/chat/thread-context.server'
import { resolveConversationIdentity } from '../src/chat/conversation-identity.server'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import postgres from 'postgres'
import {
  archiveConversations,
  createPersonalConversation,
  openPersonalChatWorkspace,
} from '../src/chat/workspace.server'

// This script deliberately requires an empty, local Postgres database.
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
  await sql`CREATE TABLE users (id uuid PRIMARY KEY)`
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0002_tanchat_account_workspace.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0003_tanchat_conversation_identity.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0004_tanchat_thread_context.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0005_tanchat_thread_requests.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0006_tanchat_credentials.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0007_tanchat_account_preferences.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0008_tanchat_conversation_memory.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0009_tanchat_composer_drafts.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0010_tanchat_saved_files.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0011_tanchat_first_send_receipts.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0012_tanchat_first_send_identity.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL('../drizzle/migrations/0013_tanchat_skills.sql', import.meta.url),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL('../drizzle/migrations/0014_pale_risque.sql', import.meta.url),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0015_married_machine_man.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL('../drizzle/migrations/0016_crazy_cable.sql', import.meta.url),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0017_messy_sabretooth.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0018_large_rawhide_kid.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0019_slow_power_pack.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0020_tranquil_harpoon.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL('../drizzle/migrations/0021_even_roulette.sql', import.meta.url),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0022_tricky_texas_twister.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0023_productive_the_spike.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0024_worried_dazzler.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0025_crazy_emma_frost.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0026_youthful_maria_hill.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0027_certain_captain_stacy.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0028_nebulous_songbird.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL('../drizzle/migrations/0029_faithful_loa.sql', import.meta.url),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL('../drizzle/migrations/0030_last_expediter.sql', import.meta.url),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL('../drizzle/migrations/0031_sloppy_mesmero.sql', import.meta.url),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0032_low_jack_murdock.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0033_breezy_mister_sinister.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0034_tanchat_parent_guards.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0035_tanchat_saved_actions.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0036_tanchat_onboarding.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await sql.unsafe(
    await readFile(
      new URL(
        '../drizzle/migrations/0037_tanchat_kody_oauth.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  const first = crypto.randomUUID()
  const second = crypto.randomUUID()
  await sql`INSERT INTO users (id) VALUES (${first}), (${second})`
  const readDraft = (user: string) =>
    composerDraftApi(new Request('https://test.local'), user, 'draft:test')
  const writeDraft = (value: string, revision: number) =>
    composerDraftApi(
      new Request('https://test.local', { method: 'POST' }),
      first,
      'draft:test',
      { value, revision },
    )
  assert.deepEqual(await (await readDraft(first)).json(), {
    value: '',
    revision: 0,
  })
  const draftResults = await Promise.all([
    writeDraft('one', 0),
    writeDraft('two', 0),
  ])
  const savedDrafts = await Promise.all(draftResults.map((item) => item.json()))
  assert.equal(savedDrafts.filter((item) => item.saved).length, 1)
  const cleared = await (await writeDraft('', 1)).json()
  assert.equal(cleared.draft.revision, 2)
  assert.equal((await (await writeDraft('old text', 1)).json()).saved, false)
  assert.deepEqual(await (await readDraft(first)).json(), {
    value: '',
    revision: 2,
  })
  assert.deepEqual(await (await readDraft(second)).json(), {
    value: '',
    revision: 0,
  })
  const defaults = await readAccountPreferences(first)
  assert.equal(defaults.revision, 0)
  const response = { language: 'en', tone: 'direct', detail: 'brief' }
  const changed = await updateAccountPreferences(first, {
    revision: 0,
    response,
  })
  assert.equal(changed.revision, 1)
  const timezone = await updateAccountPreferences(first, {
    revision: 1,
    timezone: 'America/Denver',
  })
  assert.deepEqual(timezone.response, response)
  assert.ok(timezone.timezoneConfirmedAt)
  assert.equal(
    (
      await updateAccountPreferences(first, {
        revision: 2,
        timezone: 'America/Denver',
      })
    ).revision,
    2,
  )
  await assert.rejects(
    updateAccountPreferences(first, { revision: 1, timezone: 'UTC' }),
    /changed/,
  )
  const updates = await Promise.allSettled([
    updateAccountPreferences(first, { revision: 2, timezone: 'UTC' }),
    updateAccountPreferences(first, { revision: 2, timezone: 'Europe/London' }),
  ])
  assert.equal(
    updates.filter((result) => result.status === 'fulfilled').length,
    1,
  )
  assert.equal((await readAccountPreferences(second)).revision, 0)
  const credentialEnv = {
    ENCRYPTION_KEY: 'local-test-encryption-key-not-a-production-secret',
  }
  const connection = connectionSchema.parse({
    provider: 'included',
    model: '@cf/moonshotai/kimi-k2.6',
  })
  assert.equal(await readCredentials(credentialEnv, first), null)
  await writeCredentials(credentialEnv, first, { connection })
  await Promise.all([
    updateCredentials(credentialEnv, first, (current) => ({
      ...current,
      connection,
      connections: {
        ...current?.connections,
        openai: connectionSchema.parse({
          provider: 'openai',
          model: 'test',
          apiKey: 'test-openai-key',
        }),
      },
    })),
    updateCredentials(credentialEnv, first, (current) => ({
      ...current,
      connection,
      connections: {
        ...current?.connections,
        anthropic: connectionSchema.parse({
          provider: 'anthropic',
          model: 'test',
          apiKey: 'test-anthropic-key',
        }),
      },
    })),
  ])
  const savedCredentials = await readCredentials(credentialEnv, first)
  assert.equal(savedCredentials?.connections?.openai?.apiKey, 'test-openai-key')
  assert.equal(
    savedCredentials?.connections?.anthropic?.apiKey,
    'test-anthropic-key',
  )
  assert.equal(await readCredentials(credentialEnv, second), null)
  const [encrypted] =
    await sql`SELECT ciphertext FROM chat_credentials WHERE user_id = ${first}`
  assert.ok(!encrypted.ciphertext.includes('test-openai-key'))
  await assert.rejects(
    readCredentials(
      { ENCRYPTION_KEY: 'wrong-local-test-encryption-key-long-enough' },
      first,
    ),
  )
  const results = await Promise.all(
    Array.from({ length: 8 }, () => openPersonalChatWorkspace(first)),
  )
  assert.equal(new Set(results.map((result) => result.assistantId)).size, 1)
  const other = await openPersonalChatWorkspace(second)
  const main = results[0]
  const threadId = crypto.randomUUID()
  await sql`INSERT INTO chat_conversations (id, bot_id, user_id) VALUES (${threadId}, ${main.assistantId}, ${first})`
  assert.equal(
    (
      await resolveConversationIdentity({
        userId: first,
        workspaceId: main.workspace.id,
        botId: main.assistantId,
      })
    ).conversationId,
    main.conversationId,
  )
  assert.equal(
    (
      await resolveConversationIdentity({
        userId: first,
        workspaceId: main.workspace.id,
        conversationId: threadId,
      })
    ).conversationId,
    threadId,
  )
  await assert.rejects(
    resolveConversationIdentity({
      userId: second,
      workspaceId: main.workspace.id,
      conversationId: threadId,
    }),
    /not found/,
  )
  const snapshot = {
    epoch: 'epoch-1',
    digest: 'a'.repeat(43),
    role: 'user',
    text: 'Original request',
    truncated: false,
  }
  await sql`INSERT INTO chat_conversation_threads (conversation_id, parent_conversation_id, bot_id, user_id, source_message_id, source, title) VALUES (${threadId}, ${main.conversationId}, ${main.assistantId}, ${first}, 'message-1', ${sql.json(snapshot)}, 'Thread')`
  assert.equal(
    (
      await readThreadContext({
        userId: first,
        workspaceId: main.workspace.id,
        conversationId: threadId,
      })
    )?.source.text,
    'Original request',
  )
  await assert.rejects(
    readThreadContext({
      userId: second,
      workspaceId: main.workspace.id,
      conversationId: threadId,
    }),
    /not found/,
  )
  await assert.rejects(
    sql`UPDATE chat_conversation_threads SET parent_conversation_id = ${other.conversationId} WHERE conversation_id = ${threadId}`,
    /foreign key constraint/,
  )
  await sql`DELETE FROM chat_conversations WHERE id = ${threadId}`

  assert.notEqual(other.workspace.id, results[0].workspace.id)
  for (const table of [
    'chat_workspaces',
    'chat_memberships',
    'chat_bots',
    'chat_conversations',
  ]) {
    const [row] = await sql`SELECT count(*)::int AS count FROM ${sql(table)}`
    assert.equal(row.count, 2, table)
  }
  await assert.rejects(
    sql`UPDATE chat_bots SET archived_at = now() WHERE id = ${results[0].assistantId}`,
    /chat_personal_assistant_active_check/,
  )
  await assert.rejects(
    sql`INSERT INTO chat_bots (id, workspace_id, parent_id, name) VALUES ('wrong-parent', ${other.workspace.id}, ${results[0].assistantId}, 'Wrong')`,
    /Parent bot is not available/,
  )
  const own = await Promise.all([
    createPersonalConversation(first),
    createPersonalConversation(first),
  ])
  const foreign = await createPersonalConversation(second)
  await assert.rejects(
    archiveConversations(first, [own[0].bot.id, foreign.bot.id]),
    /cannot be changed/,
  )
  const [unchanged] =
    await sql`SELECT archived_at FROM chat_bots WHERE id = ${own[0].bot.id}`
  assert.equal(
    unchanged.archived_at,
    null,
    'failed bulk operations must not partially apply',
  )
  await assert.rejects(
    archiveConversations(first, [results[0].assistantId]),
    /cannot be archived/,
  )
  const draftId = crypto.randomUUID()
  const fileId = crypto.randomUUID()
  await sql`INSERT INTO chat_file_drafts(workspace_id,user_id,id,created_at) VALUES (${main.workspace.id},${first},${draftId},1000)`
  await sql`INSERT INTO chat_saved_files(id,workspace_id,user_id,draft_id,name,media_type,size,sha256,source,state,created_at) VALUES (${fileId},${main.workspace.id},${first},${draftId},'report.txt','text/plain',4,${'a'.repeat(64)},'upload','pending',1000)`
  await assert.rejects(
    sql`UPDATE chat_saved_files SET name='changed.txt' WHERE id=${fileId}`,
    /immutable/,
  )
  await assert.rejects(
    sql`UPDATE chat_saved_files SET bot_id=${own[0].bot.id},conversation_id=${own[0].conversationId},draft_id=NULL WHERE id=${fileId}`,
    /promoted/,
  )
  await sql`UPDATE chat_saved_files SET state='ready' WHERE id=${fileId}`
  await assert.rejects(
    sql`UPDATE chat_saved_files SET state='pending' WHERE id=${fileId}`,
    /immutable/,
  )
  await sql`INSERT INTO chat_bot_drafts(workspace_id,user_id,id,bot_id,conversation_id,file_ids,created_at) VALUES (${main.workspace.id},${first},${draftId},${own[0].bot.id},${own[0].conversationId},${sql.json([fileId])},1000)`
  await sql`UPDATE chat_saved_files SET bot_id=${own[0].bot.id},conversation_id=${own[0].conversationId},draft_id=NULL WHERE id=${fileId}`
  await assert.rejects(
    sql`UPDATE chat_saved_files SET bot_id=${own[1].bot.id},conversation_id=${own[1].conversationId} WHERE id=${fileId}`,
    /immutable/,
  )
  await assert.rejects(
    sql`INSERT INTO chat_saved_files(id,workspace_id,user_id,bot_id,conversation_id,name,media_type,size,sha256,source,state,created_at) VALUES (${crypto.randomUUID()},${main.workspace.id},${second},${own[0].bot.id},${own[0].conversationId},'other.txt','text/plain',1,${'b'.repeat(64)},'assistant','pending',1000)`,
    /foreign key/,
  )
  const importedId = crypto.randomUUID()
  await sql`INSERT INTO chat_saved_file_imports(target_file_id,workspace_id,user_id,target_conversation_id,source_conversation_id,source_file_id,sha256,name,media_type,size,source,created_at) VALUES (${importedId},${main.workspace.id},${first},${own[0].conversationId},${own[1].conversationId},${fileId},${'a'.repeat(64)},'report.txt','text/plain',4,'upload',1000)`
  await assert.rejects(
    sql`UPDATE chat_saved_file_imports SET name='changed.txt' WHERE target_file_id=${importedId}`,
    /immutable/,
  )
  console.log(
    'Passed: file scope constraints, immutable metadata/import receipts, ready-state monotonicity, and authorized one-way draft promotion.',
  )
  const stored = new Map<
    string,
    { size: number; checksums: R2Checksums; bytes: Uint8Array<ArrayBuffer> }
  >()
  let failUpload = false
  const fileEnv: FileEnvironment = {
    FILES: {
      put: async (key, payload) => {
        if (failUpload) throw new Error('Test upload unavailable')
        if (stored.has(key)) return null
        const sha256 = await crypto.subtle.digest(
          'SHA-256',
          new Uint8Array(payload),
        )
        const item = {
          bytes: new Uint8Array(payload),
          size: payload.byteLength,
          checksums: {
            sha256,
            toJSON: () => ({ sha256: Buffer.from(sha256).toString('hex') }),
          },
        }
        stored.set(key, item)
        return item
      },
      head: async (key) => stored.get(key) ?? null,
      get: async (key) => {
        const object = stored.get(key)
        if (!object) return null
        return {
          ...object,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(object.bytes))
              controller.close()
            },
          }),
          arrayBuffer: async () => new Uint8Array(object.bytes).buffer,
        }
      },
    },
  }
  const files = new SavedFiles(fileEnv, {
    workspaceId: main.workspace.id,
    userId: first,
    botId: own[0].bot.id,
    conversationId: own[0].conversationId,
  })
  const upload: SaveFileInput = {
    id: crypto.randomUUID(),
    name: 'parallel.txt',
    mediaType: 'text/plain',
    source: 'assistant',
  }
  const payload = new TextEncoder().encode('hello')
  const uploads = await Promise.all(
    Array.from({ length: 8 }, () => files.save(upload, payload)),
  )
  assert.ok(
    uploads.every((item) => item.state === 'ready' && item.id === upload.id),
  )
  assert.equal(stored.size, 1)
  await assert.rejects(
    files.save(upload, new TextEncoder().encode('other')),
    /different contents/,
  )
  const resumable = { ...upload, id: crypto.randomUUID() }
  failUpload = true
  await assert.rejects(files.save(resumable, payload), /could not finish/)
  assert.equal((await files.get(resumable.id)).state, 'pending')
  failUpload = false
  assert.equal((await files.save(resumable, payload)).state, 'ready')
  const textRead = await files.readText(upload.id, { offset: 1, limit: 2 })
  assert.equal(textRead.text, 'el')
  assert.equal(textRead.nextOffset, 3)
  const copied = await files.copy(upload.id, {
    id: crypto.randomUUID(),
    name: 'copy.txt',
  })
  assert.equal(copied.sha256, uploads[0].sha256)
  assert.equal((await files.readText(copied.id)).text, 'hello')
  await assert.rejects(
    files.copy(upload.id, { id: upload.id, name: 'same.txt' }),
    /new file ID/,
  )
  const stranger = new SavedFiles(fileEnv, {
    workspaceId: main.workspace.id,
    userId: second,
    botId: own[0].bot.id,
    conversationId: own[0].conversationId,
  })
  await assert.rejects(stranger.get(upload.id), /access/)
  console.log(
    'Passed: concurrent immutable R2 publication, content conflict rejection, resumable pending uploads, and account isolation.',
  )
  const targetFiles = new SavedFiles(fileEnv, {
    workspaceId: main.workspace.id,
    userId: first,
    botId: own[1].bot.id,
    conversationId: own[1].conversationId,
  })
  const targetId = crypto.randomUUID()
  const imports = await Promise.all(
    Array.from({ length: 8 }, () =>
      targetFiles.importFrom(
        own[0].conversationId,
        upload.id,
        targetId,
        uploads[0].sha256,
      ),
    ),
  )
  assert.ok(
    imports.every(
      (item) =>
        item.id === targetId &&
        item.sha256 === uploads[0].sha256 &&
        item.state === 'ready',
    ),
  )
  assert.equal((await targetFiles.readText(targetId)).text, 'hello')
  await assert.rejects(
    targetFiles.importFrom(
      own[0].conversationId,
      copied.id,
      targetId,
      copied.sha256,
    ),
    /different import/,
  )
  const unfinishedImport = crypto.randomUUID()
  failUpload = true
  await assert.rejects(
    targetFiles.importFrom(
      own[0].conversationId,
      upload.id,
      unfinishedImport,
      uploads[0].sha256,
    ),
    /could not finish/,
  )
  await assert.rejects(
    targetFiles.save({ ...upload, id: unfinishedImport }, payload),
    /original operation/,
  )
  failUpload = false
  assert.equal(
    (
      await targetFiles.importFrom(
        own[0].conversationId,
        upload.id,
        unfinishedImport,
        uploads[0].sha256,
      )
    ).state,
    'ready',
  )
  await sql`UPDATE chat_bots SET deleted_at=now() WHERE id=${own[0].bot.id}`
  assert.equal(
    (
      await targetFiles.importFrom(
        own[0].conversationId,
        upload.id,
        targetId,
        uploads[0].sha256,
      )
    ).state,
    'ready',
  )
  assert.equal((await targetFiles.readText(targetId)).text, 'hello')
  await assert.rejects(
    targetFiles.importFrom(
      own[0].conversationId,
      upload.id,
      crypto.randomUUID(),
      uploads[0].sha256,
    ),
    /not found|access/,
  )
  await sql`UPDATE chat_bots SET deleted_at=NULL WHERE id=${own[0].bot.id}`
  const reciprocal = await Promise.all([
    targetFiles.importFrom(
      own[0].conversationId,
      upload.id,
      crypto.randomUUID(),
      uploads[0].sha256,
    ),
    files.importFrom(
      own[1].conversationId,
      targetId,
      crypto.randomUUID(),
      uploads[0].sha256,
    ),
  ])
  assert.equal(reciprocal.length, 2)
  console.log(
    'Passed: concurrent import receipts, source-binding conflicts, reserved-ID protection, failed-import recovery, completed-copy independence, and reciprocal imports.',
  )
  const stagedScope = {
    workspaceId: main.workspace.id,
    userId: first,
    draftId: crypto.randomUUID(),
  }
  const staged = new DraftFiles(fileEnv, stagedScope)
  assert.deepEqual(await staged.list(), [])
  const [unreserved] =
    await sql`SELECT count(*)::integer AS count FROM chat_file_drafts WHERE id=${stagedScope.draftId}`
  assert.equal(unreserved.count, 0)
  const selected = { ...upload, id: crypto.randomUUID(), name: 'selected.txt' }
  const pending = { ...upload, id: crypto.randomUUID(), name: 'pending.txt' }
  await staged.save(selected, payload)
  failUpload = true
  await assert.rejects(staged.save(pending, payload), /could not finish/)
  await assert.rejects(
    resolveDraftAttachments(fileEnv, stagedScope, [pending.id]),
    /Finish uploading/,
  )
  failUpload = false
  assert.equal(
    (await resolveDraftAttachments(fileEnv, stagedScope, [selected.id])).length,
    1,
  )
  await appDb.transaction(async (tx) => {
    await tx.insert(chatBotDrafts).values({
      workspaceId: stagedScope.workspaceId,
      userId: first,
      id: stagedScope.draftId,
      botId: own[1].bot.id,
      conversationId: own[1].conversationId,
      fileIds: [selected.id],
      createdAt: 1000,
    })
    await promoteDraftFiles(
      tx,
      stagedScope,
      own[1].bot.id,
      own[1].conversationId,
    )
  })
  await assert.rejects(staged.get(selected.id), /draft was sent/)
  assert.equal((await targetFiles.get(selected.id)).state, 'ready')
  assert.equal((await targetFiles.get(pending.id)).state, 'pending')
  assert.equal((await targetFiles.save(pending, payload)).state, 'ready')
  await appDb.transaction((tx) =>
    promoteDraftFiles(tx, stagedScope, own[1].bot.id, own[1].conversationId),
  )
  const quotaDrafts = await Promise.allSettled(
    Array.from({ length: 22 }, () =>
      new DraftFiles(fileEnv, {
        workspaceId: main.workspace.id,
        userId: first,
        draftId: crypto.randomUUID(),
      }).save({ ...upload, id: crypto.randomUUID() }, payload),
    ),
  )
  assert.equal(
    quotaDrafts.filter((item) => item.status === 'fulfilled').length,
    20,
  )
  assert.equal(
    quotaDrafts.filter((item) => item.status === 'rejected').length,
    2,
  )
  console.log(
    'Passed: read-only empty drafts, ready attachment checks, atomic promotion of pending and ready files, sent-draft denial, resumable promoted uploads, and concurrent unsent-draft quota.',
  )
  const drafts = new BotDrafts(fileEnv, main.workspace.id, first)
  const firstSendId = crypto.randomUUID()
  const selection: RunModelSelection = {
    provider: 'included',
    model: '@cf/moonshotai/kimi-k2.6',
  }
  const firstSendInput = {
    text: 'Plan my weekend',
    fileIds: [],
    runModel: selection,
  }
  const firstSends = await Promise.all(
    Array.from({ length: 8 }, () =>
      drafts.reserve(firstSendId, firstSendInput, async () => selection),
    ),
  )
  assert.equal(new Set(firstSends.map((item) => item.botId)).size, 1)
  assert.ok(firstSends.every((item) => item.started === false))
  assert.equal((await drafts.get(firstSendId))?.started, false)
  assert.equal((await drafts.markStarted(firstSendId)).started, true)
  assert.equal((await drafts.get(firstSendId))?.started, true)
  await assert.rejects(
    new BotDrafts(fileEnv, main.workspace.id, second).markStarted(firstSendId),
    /Workspace not found/,
  )
  const replayed = await drafts.reserve(
    firstSendId,
    firstSendInput,
    async () => {
      throw new Error('Replay must not reprepare')
    },
  )
  assert.equal(replayed.botId, firstSends[0].botId)
  await assert.rejects(
    drafts.reserve(
      firstSendId,
      { ...firstSendInput, text: 'Different first message' },
      async () => selection,
    ),
    /already has a first message/,
  )
  const [chosen] =
    await sql`SELECT d.id, f.id AS file_id FROM chat_file_drafts d JOIN chat_saved_files f ON f.draft_id=d.id AND f.workspace_id=d.workspace_id AND f.user_id=d.user_id LEFT JOIN chat_bot_drafts b ON b.id=d.id AND b.workspace_id=d.workspace_id AND b.user_id=d.user_id WHERE d.workspace_id=${main.workspace.id} AND d.user_id=${first} AND b.id IS NULL LIMIT 1`
  const attachmentInput = {
    text: 'Read my notes',
    fileIds: [chosen.file_id],
    parentId: own[0].bot.id,
  }
  const attachmentSends = await Promise.all(
    Array.from({ length: 8 }, () =>
      drafts.reserve(chosen.id, attachmentInput, async () => selection),
    ),
  )
  assert.equal(new Set(attachmentSends.map((item) => item.botId)).size, 1)
  const [promoted] =
    await sql`SELECT bot_id,conversation_id,draft_id FROM chat_saved_files WHERE id=${chosen.file_id}`
  assert.equal(promoted.bot_id, attachmentSends[0].botId)
  assert.equal(promoted.conversation_id, attachmentSends[0].conversationId)
  assert.equal(promoted.draft_id, null)
  const [beforeRejected] =
    await sql`SELECT count(*)::integer AS count FROM chat_bots`
  await assert.rejects(
    drafts.reserve(
      crypto.randomUUID(),
      { text: 'Foreign parent', parentId: foreign.bot.id },
      async () => selection,
    ),
    /parent is unavailable/,
  )
  const [afterRejected] =
    await sql`SELECT count(*)::integer AS count FROM chat_bots`
  assert.equal(afterRejected.count, beforeRejected.count)
  await assert.rejects(
    new BotDrafts(fileEnv, main.workspace.id, second).get(firstSendId),
    /Workspace not found/,
  )
  const pendingScope = {
    workspaceId: main.workspace.id,
    userId: first,
    draftId: crypto.randomUUID(),
  }
  const pendingInput = { ...upload, id: crypto.randomUUID() }
  failUpload = true
  await assert.rejects(
    new DraftFiles(fileEnv, pendingScope).save(pendingInput, payload),
    /could not finish/,
  )
  failUpload = false
  await assert.rejects(
    drafts.reserve(
      pendingScope.draftId,
      { text: 'Pending attachment', fileIds: [pendingInput.id] },
      async () => selection,
    ),
    /Finish uploading/,
  )
  assert.equal(await drafts.get(pendingScope.draftId), null)
  const [afterPending] =
    await sql`SELECT count(*)::integer AS count FROM chat_bots`
  assert.equal(afterPending.count, beforeRejected.count)
  await archiveConversations(first, [
    firstSends[0].botId,
    attachmentSends[0].botId,
  ])
  console.log(
    'Passed: concurrent first-send identity and attachment promotion, frozen input/model receipts, no reprepare on replay, parent/account isolation, and no orphan chat after pending-attachment rejection.',
  )
  assert.deepEqual(
    await readWorkspacePolicy(main.workspace.id, first),
    main.workspace.policy,
  )
  const changedPolicy = { ...main.workspace.policy, allowKody: false }
  assert.deepEqual(
    await updateWorkspacePolicy(main.workspace.id, first, changedPolicy),
    { ok: true },
  )
  assert.deepEqual(
    await readWorkspacePolicy(main.workspace.id, first),
    changedPolicy,
  )
  await assert.rejects(
    updateWorkspacePolicy(main.workspace.id, second, main.workspace.policy),
    /Only the workspace owner/,
  )
  await assert.rejects(
    updateWorkspacePolicy(main.workspace.id, first, { allowKody: true }),
  )
  assert.deepEqual(
    await readWorkspacePolicy(main.workspace.id, first),
    changedPolicy,
  )
  await updateWorkspacePolicy(main.workspace.id, first, main.workspace.policy)
  console.log(
    'Passed: owner-only policy update, unchanged policy after foreign/invalid input and source schema preservation.',
  )

  await assert.rejects(
    readWorkspacePolicy(main.workspace.id, second),
    /access is unavailable/,
  )
  const skills = new Skills({ workspaceId: main.workspace.id, userId: first })
  const skillDocument = {
    name: 'weekly-notes',
    description: 'Write a weekly recap.',
    instructions: 'Summarize supplied notes. Preserve uncertainty.',
  }
  const skillId = crypto.randomUUID()
  const skillCreate = {
    type: 'create',
    id: skillId,
    commandId: crypto.randomUUID(),
    document: skillDocument,
  }
  const skillReceipts = await Promise.all(
    Array.from({ length: 8 }, () => skills.command(skillCreate)),
  )
  assert.ok(
    skillReceipts.every((item) => item.version === 1 && item.revision === 1),
  )
  await assert.rejects(
    skills.command({
      ...skillCreate,
      document: { ...skillDocument, description: 'Different' },
    }),
    /another change/,
  )
  const updatedSkill = await skills.command({
    type: 'update',
    id: skillId,
    commandId: crypto.randomUUID(),
    expectedRevision: 1,
    document: { ...skillDocument, instructions: 'Use the updated procedure.' },
  })
  assert.equal(updatedSkill.version, 2)
  assert.equal(
    (await skills.inspect(skillId, 1)).document.instructions,
    skillDocument.instructions,
  )
  assert.deepEqual(await skills.command(skillCreate), skillReceipts[0])
  await assert.rejects(
    skills.command({
      type: 'update',
      id: skillId,
      commandId: crypto.randomUUID(),
      expectedRevision: 1,
      document: skillDocument,
    }),
    /changed/,
  )
  await skills.command({
    type: 'archive',
    id: skillId,
    commandId: crypto.randomUUID(),
    expectedRevision: 2,
  })
  await assert.rejects(
    skills.resolve({ skillId, version: 1 }),
    /disabled or archived/,
  )
  await assert.rejects(
    skills.command({
      type: 'enabled',
      id: skillId,
      commandId: crypto.randomUUID(),
      expectedRevision: 3,
      enabled: true,
    }),
    /Restore/,
  )
  const restoredSkill = await skills.command({
    type: 'restore',
    id: skillId,
    commandId: crypto.randomUUID(),
    expectedRevision: 3,
  })
  assert.equal(restoredSkill.enabled, false)
  await skills.command({
    type: 'enabled',
    id: skillId,
    commandId: crypto.randomUUID(),
    expectedRevision: 4,
    enabled: true,
  })
  assert.equal(
    (await skills.resolve({ skillId, version: 1 })).document.instructions,
    skillDocument.instructions,
  )
  await assert.rejects(
    new Skills({ workspaceId: main.workspace.id, userId: second }).inspect(
      skillId,
    ),
    /access/,
  )
  await assert.rejects(
    new Skills({
      workspaceId: foreign.bot.workspaceId,
      userId: second,
    }).inspect(skillId),
    /not found/,
  )
  for (let index = 0; index < 3; index++)
    await skills.command({
      type: 'create',
      id: crypto.randomUUID(),
      commandId: crypto.randomUUID(),
      document: { ...skillDocument, name: `extra-${index}` },
    })
  const skillPage = await skills.list({ limit: 1 })
  assert.ok(skillPage.nextCursor)
  assert.equal('document' in skillPage.items[0], false)
  const following = await skills.list({
    limit: 1,
    cursor: skillPage.nextCursor,
  })
  assert.notEqual(following.items[0].id, skillPage.items[0].id)
  await assert.rejects(
    skills.list({ limit: 1, cursor: skillPage.nextCursor, query: 'different' }),
    /changing its filters/,
  )
  assert.equal((await skills.list({ query: 'WEEKLY' })).items.length, 4)
  await sql.unsafe(
    "CREATE FUNCTION pg_temp.fail_skill_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.document->>'instructions'='Synthetic failure' THEN RAISE EXCEPTION 'Synthetic version write failure'; END IF; RETURN NEW; END; $$",
  )
  await sql.unsafe(
    'CREATE TRIGGER test_skill_version_failure BEFORE INSERT ON chat_skill_versions FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_skill_version()',
  )
  const atomicSkill = {
    type: 'create',
    id: crypto.randomUUID(),
    commandId: crypto.randomUUID(),
    document: {
      ...skillDocument,
      name: 'atomic-write',
      description: 'Check transaction.',
      instructions: 'Synthetic failure',
    },
  }
  await assert.rejects(skills.command(atomicSkill))
  await assert.rejects(skills.inspect(atomicSkill.id), /not found/)
  const [failedReceipt] =
    await sql`SELECT count(*)::integer AS count FROM chat_skill_commands WHERE command_id=${atomicSkill.commandId}`
  assert.equal(failedReceipt.count, 0)
  await sql.unsafe(
    'DROP TRIGGER test_skill_version_failure ON chat_skill_versions',
  )
  assert.equal((await skills.command(atomicSkill)).version, 1)
  const filledSkills = Array.from({ length: 195 }, () => ({
    id: crypto.randomUUID(),
    workspaceId: main.workspace.id,
    userId: first,
    version: 1,
    revision: 1,
    enabled: false,
    archived: true,
    createdAt: 1000,
    updatedAt: 1000,
  }))
  await appDb.transaction(async (tx) => {
    await tx.insert(chatSkills).values(filledSkills)
    await tx.insert(chatSkillVersions).values(
      filledSkills.map((item) => ({
        skillId: item.id,
        version: 1,
        document: skillDocument,
        contentHash: 'test-seed',
        createdAt: 1000,
      })),
    )
  })
  await assert.rejects(
    skills.command({
      type: 'create',
      id: crypto.randomUUID(),
      commandId: crypto.randomUUID(),
      document: skillDocument,
    }),
    /200 skills/,
  )
  const [savedVersion] =
    await sql`SELECT content_hash FROM chat_skill_versions WHERE skill_id=${skillId} AND version=1`
  assert.ok(savedVersion.content_hash.length > 20)
  console.log(
    'Passed: skill command idempotency, immutable historical versions/receipts, revision conflicts, archive/restore/enable behavior, pinned-version resolution, private scope, metadata pagination, filter-bound cursors, and quota including archived skills.',
  )
  const memories = new Memories(
    {
      workspaceId: main.workspace.id,
      userId: first,
      conversationId: own[0].conversationId,
    },
    () => 1000,
  )
  assert.deepEqual(await memories.preferences(), {
    enabled: false,
    revision: 0,
  })
  await memories.setPreferences({ enabled: true, expectedRevision: 0 })
  await assert.rejects(
    memories.setPreferences({ enabled: false, expectedRevision: 0 }),
    /changed/,
  )
  const memoryId = crypto.randomUUID()
  const command = {
    type: 'create',
    id: memoryId,
    commandId: crypto.randomUUID(),
    document: { title: 'Memory title', body: 'Remember this', expiresAt: null },
  }
  const memoryReceipts = await Promise.all(
    Array.from({ length: 8 }, () => memories.command(command)),
  )
  assert.equal(new Set(memoryReceipts.map((item) => item.completedAt)).size, 1)
  assert.equal((await memories.list()).items.length, 1)
  assert.equal((await memories.read(memoryId)).body, 'Remember this')
  await assert.rejects(
    memories.command({
      ...command,
      document: { ...command.document, body: 'Different' },
    }),
    /another change/,
  )
  const isolated = new Memories({
    workspaceId: main.workspace.id,
    userId: second,
    conversationId: own[0].conversationId,
  })
  await assert.rejects(isolated.read(memoryId), /access/)
  const stale = {
    type: 'update',
    id: memoryId,
    expectedRevision: 1,
    commandId: crypto.randomUUID(),
    document: { title: 'New title', body: 'New value', expiresAt: null },
  }
  await memories.command(stale)
  await assert.rejects(
    memories.command({ ...stale, commandId: crypto.randomUUID() }),
    /changed/,
  )
  await memories.command({
    type: 'delete',
    id: memoryId,
    expectedRevision: 2,
    commandId: crypto.randomUUID(),
  })
  await assert.rejects(memories.read(memoryId), /not found/)
  await assert.rejects(
    memories.command({ ...command, commandId: crypto.randomUUID() }),
    /changed/,
  )
  await assert.rejects(
    memories.command({
      ...command,
      id: crypto.randomUUID(),
      commandId: crypto.randomUUID(),
      document: { ...command.document, expiresAt: 1000 },
    }),
    /future/,
  )
  const archived = await archiveConversations(first, [
    own[0].bot.id,
    own[1].bot.id,
    own[0].bot.id,
  ])
  assert.equal(archived.length, 2)
  await assert.rejects(
    memories.command({
      ...command,
      id: crypto.randomUUID(),
      commandId: crypto.randomUUID(),
    }),
    /access/,
  )
  const kodyEnv = {
    ENCRYPTION_KEY: 'local-test-encryption-key-not-a-production-secret',
    KODY_ORIGIN: 'https://kody.test',
  }
  assert.equal(
    (await readKodyAccount(kodyEnv, first, results[0].workspace.id)).status,
    'disconnected',
  )
  await assert.rejects(
    readKodyAccount(kodyEnv, second, results[0].workspace.id),
    /access/,
  )
  {
    const packageId = '4b0f2b31-224c-4d8b-8e5d-28dc10456316'
    const inventory = {
      content: [],
      structuredContent: {
        result: {
          format: 'gum-kody-inventory-v2',
          capabilities: [],
          exports: ['skill-list', 'skill-get'].map((subpath) => ({
            identity: subpath,
            name: subpath,
            description: '',
            importSpecifier: `kody:@example/skills/${subpath}`,
            exportName: 'default',
            packageId,
            subpath: `./${subpath}`,
          })),
          counts: { domains: 0, packages: 1, advertisedCapabilities: 0 },
          issues: [],
        },
      },
    }
    const skillText = 'Review tests.'
    const source = () => ({
      content: [],
      structuredContent: {
        result: {
          skills: [
            {
              id: 'test-audit',
              name: 'test-audit',
              description: 'Review tests.',
              packageId,
              updated_at: '2026-09-24T19:06:25.377Z',
              files: [
                {
                  path: 'SKILL.md',
                  content: `---\nname: test-audit\ndescription: Review tests.\n---\n${skillText}`,
                },
                { path: 'CAMPAIGN.md', content: 'Companion guidance.' },
              ],
            },
          ],
          page: {
            offset: 0,
            next: 1,
            total: 1,
            fingerprint: 'a'.repeat(64),
          },
          errors: [],
        },
      },
    })

    const scope = { userId: first, workspaceId: results[0].workspace.id }
    await updateCredentials(kodyEnv, first, (current) => ({
      ...current,
      connection: current?.connection ?? connection,
      kody: {
        client_id: 'client',
        access_token: 'token',
        expires_at: Date.now() + 3600000,
      },
    }))
    const account = await kodySkillAccount(kodyEnv, scope)
    assert.ok(account)
    let remoteCalls = 0
    const call: typeof kodyCall = async () => {
      remoteCalls++
      return remoteCalls === 1 ? inventory : source()
    }
    assert.equal(await syncKodySkills(kodyEnv, scope, account, call), true)
    const [snapshot] =
      await sql`SELECT name,current,document,files FROM chat_kody_skill_versions WHERE user_id=${first}`
    assert.equal(snapshot.name, 'test-audit')
    assert.equal(snapshot.current, true)
    assert.equal(snapshot.files[1].path, 'CAMPAIGN.md')
    assert.equal(await syncKodySkills(kodyEnv, scope, account, call), false)
    assert.equal(remoteCalls, 2)
    const catalog = new KodySkillCatalog(kodyEnv, scope, call)
    const cached = await catalog.cached()
    assert.equal(cached.status, 'ready')
    assert.equal(cached.items.length, 1)
    const selected = cached.items[0]
    assert.equal(
      (await catalog.inspect(selected.id, selected.version)).document.name,
      'test-audit',
    )
    assert.equal(
      (await catalog.readFile(selected.id, selected.version, 'CAMPAIGN.md'))
        .content,
      'Companion guidance.',
    )
    assert.equal(
      (await suggestKodySkills(kodyEnv, scope, 'review tests'))[0].id,
      selected.id,
    )
    assert.equal(remoteCalls, 2)
    await sql`UPDATE chat_kody_skill_sync SET fetched_at=0 WHERE user_id=${first}`
    const bad = source()
    bad.structuredContent.result.page.next = 0
    let failedCalls = 0
    const failing: typeof kodyCall = async () =>
      ++failedCalls === 1 ? inventory : bad
    await assert.rejects(
      syncKodySkills(kodyEnv, scope, account, failing),
      /index changed/,
    )
    const [preserved] =
      await sql`SELECT current FROM chat_kody_skill_versions WHERE user_id=${first}`
    assert.equal(preserved.current, true)

    const [staged] =
      await sql`SELECT count(*)::integer AS count FROM chat_kody_skill_sync_stage`
    assert.equal(staged.count, 0)
    console.log(
      'Passed: Kody collector publication, preserved companion files, fresh-cache lease exclusion, and staging cleanup.',
    )
  }
  {
    const reader = new PluginPackages({
      userId: first,
      workspaceId: results[0].workspace.id,
    })
    const files = [
      {
        path: 'plugin.json',
        text: JSON.stringify({
          $schema: pluginManifestSchemaId,
          name: 'example.tools',
          version: '1.0.0',
          description: 'Private test package',
        }),
      },
      {
        path: 'skills/review/SKILL.md',
        text: '---\nname: review\ndescription: Review the supplied notes.\n---\nPreserve uncertainty.',
      },
    ]
    const parsed = await reader.preview(files)
    const lifecycle = new Plugins(kodyEnv, {
      userId: first,
      workspaceId: results[0].workspace.id,
    })
    const install = {
      type: 'install',
      id: crypto.randomUUID(),
      commandId: crypto.randomUUID(),
      files,
      digest: parsed.digest,
      enabled: true,
    }
    await sql.unsafe(
      `CREATE FUNCTION reject_plugin_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.digest='${parsed.digest}' THEN RAISE EXCEPTION 'Synthetic plugin version failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_plugin_version BEFORE INSERT ON chat_plugin_versions FOR EACH ROW EXECUTE FUNCTION reject_plugin_version()`,
    )
    await assert.rejects(lifecycle.command(install))
    const [aborted] =
      await sql`SELECT count(*)::integer AS count FROM chat_plugin_installations WHERE id=${install.id}`
    assert.equal(aborted.count, 0)
    const [abortedReceipt] =
      await sql`SELECT count(*)::integer AS count FROM chat_plugin_commands WHERE command_id=${install.commandId}`
    assert.equal(abortedReceipt.count, 0)
    await sql.unsafe(
      'DROP TRIGGER reject_plugin_version ON chat_plugin_versions; DROP FUNCTION reject_plugin_version()',
    )
    const installs = await Promise.all(
      Array.from({ length: 8 }, () => lifecycle.command(install)),
    )
    assert.ok(
      installs.every((item) => item.id === install.id && item.revision === 1),
    )
    await assert.rejects(
      lifecycle.command({ ...install, enabled: false }),
      /another change/,
    )
    assert.equal(
      (await lifecycle.list({ query: 'example' })).items[0].id,
      install.id,
    )
    assert.equal(
      (await lifecycle.skillMetadata(install.id, 1))[0].name,
      'review',
    )
    const installedSkills = await lifecycle.listSkills({ query: 'review' })
    const stableSkill = installedSkills.items[0].id
    const nextFiles = files.map((file) =>
      file.path.endsWith('SKILL.md')
        ? { ...file, text: file.text + ' Updated.' }
        : file,
    )
    const nextParsed = await lifecycle.preview(nextFiles)
    await lifecycle.command({
      type: 'update',
      id: install.id,
      commandId: crypto.randomUUID(),
      expectedRevision: 1,
      files: nextFiles,
      digest: nextParsed.digest,
    })
    assert.equal((await lifecycle.listSkills()).items[0].id, stableSkill)
    assert.equal(
      (await lifecycle.readFile(install.id, 1, files[1].path)).text,
      files[1].text,
    )
    await lifecycle.command({
      type: 'remove',
      id: install.id,
      commandId: crypto.randomUUID(),
      expectedRevision: 2,
    })
    await lifecycle.command({
      type: 'restore',
      id: install.id,
      commandId: crypto.randomUUID(),
      expectedRevision: 3,
    })
    assert.equal((await lifecycle.inspect(install.id)).enabled, false)
    const id = crypto.randomUUID()
    await sql`INSERT INTO chat_plugin_installations VALUES(${id},${results[0].workspace.id},${first},1,1,true,false,1000,1000)`
    await sql`INSERT INTO chat_plugin_versions VALUES(${id},1,${parsed.digest},${sql.typed(JSON.stringify(parsed), 25)}::jsonb,1000)`
    for (const file of files)
      await sql`INSERT INTO chat_plugin_files VALUES(${id},1,${file.path},${file.text})`
    const skillId = crypto.randomUUID()
    await sql`INSERT INTO chat_plugin_skill_identities VALUES(${skillId},${id},${files[1].path})`
    await sql`INSERT INTO chat_plugin_skill_versions VALUES(${skillId},1,${sql.json(parseSkillMarkdown(files[1].text))})`
    assert.equal(
      (await reader.inspectSkill(skillId, 1)).document.name,
      'review',
    )
    assert.equal(
      (await reader.resolveSkill({ skillId, version: 1 })).origin
        .installationId,
      id,
    )
    const skillPage = await reader.listSkills({ query: 'review' })
    assert.equal(skillPage.items[0].id, skillId)
    assert.equal(
      (await reader.listSkills({}, [{ installationId: id, version: 1 }]))
        .items[0].version,
      1,
    )
    await assert.rejects(
      reader.listSkills({}, [{ installationId: id, version: 2 }]),
      /unavailable/,
    )
    await sql`UPDATE chat_kody_skill_sync SET fetched_at=${Date.now()} WHERE user_id=${first}`
    const combined = new SkillCatalog(kodyEnv, {
      userId: first,
      workspaceId: results[0].workspace.id,
    })
    const pages = []
    let cursor: string | undefined
    do {
      const page = await combined.list({
        limit: 1,
        ...(cursor ? { cursor } : {}),
      })
      pages.push(...page.items)
      cursor = page.nextCursor
      assert.ok(pages.length < 20)
    } while (cursor)
    assert.ok(pages.some((item) => item.id === 'plugin:' + skillId))
    assert.ok(pages.some((item) => item.id.startsWith('kody:')))
    assert.equal(
      (await combined.resolve({ skillId: 'plugin:' + skillId, version: 1 }))
        .document.name,
      'review',
    )
    let pinned = false
    const tools = assistantSkillTools({
      env: kodyEnv,
      scope: { userId: first, workspaceId: results[0].workspace.id },
      onRead: async () => {
        pinned = true
      },
    })
    const readTool = tools.find((tool) => tool.name === 'read_skill')!
    const result = await readTool.execute!({
      skillId: 'plugin:' + skillId,
      version: 1,
    })
    assert.ok(result && typeof result === 'object' && 'ok' in result)
    assert.equal(result.ok, true)
    assert.equal(pinned, true)
    const external = await combined.list({ source: 'external', limit: 50 })
    assert.ok(
      external.items.every(
        (item) => item.id.startsWith('plugin:') || item.id.startsWith('kody:'),
      ),
    )
    assert.equal((await reader.inspect(id, 1)).name, 'example.tools')
    assert.equal((await reader.authorizeVersion(id, 1)).digest, parsed.digest)
    assert.equal(
      (await reader.readFile(id, 1, files[1].path)).text,
      files[1].text,
    )
    await assert.rejects(
      new PluginPackages({
        userId: second,
        workspaceId: results[0].workspace.id,
      }).inspect(id),
      /access/,
    )
    await sql`UPDATE chat_plugin_installations SET enabled=false WHERE id=${id}`
    assert.equal((await reader.inspect(id, 1)).enabled, false)
    assert.equal((await reader.listSkills()).items.length, 0)
    await assert.rejects(
      reader.resolveSkill({ skillId, version: 1 }),
      /disabled/,
    )

    await assert.rejects(reader.readFile(id, 1, files[1].path), /disabled/)
    await sql`UPDATE chat_plugin_installations SET enabled=true,removed=true WHERE id=${id}`
    await assert.rejects(reader.authorizeVersion(id, 1), /removed/)
    console.log(
      'Passed: plugin package validation, private account reads, retained version inspection, file retrieval, and disabled/removed execution denial.',
    )
  }
  {
    const id = crypto.randomUUID(),
      grant = crypto.randomUUID()
    const ciphertext = await seal(
      {
        schemaVersion: 1,
        id,
        userId: first,
        secret: { authMode: 'token', accessToken: 'private-token' },
      },
      kodyEnv.ENCRYPTION_KEY,
    )
    await sql`INSERT INTO chat_mcp_accounts(id,user_id,label,url,auth_mode,enabled,removed,revision,grant_id,token_revision,ciphertext,status,created_at,updated_at) VALUES(${id},${first},'Test','https://example.test/mcp','token',true,false,1,${grant},1,${ciphertext},'configured',1000,1000)`
    const reader = new McpAccountReads(kodyEnv, {
      userId: first,
      workspaceId: results[0].workspace.id,
    })
    assert.equal((await reader.list())[0].hasToken, true)
    assert.equal(
      (await reader.configuredServers())[0].accessToken,
      'private-token',
    )
    assert.equal(
      (await reader.runtimeServers())[0].accessToken,
      'private-token',
    )
    await assert.rejects(
      new McpAccountReads(kodyEnv, {
        userId: second,
        workspaceId: results[0].workspace.id,
      }).read(id),
      /access/,
    )
    await sql`UPDATE chat_mcp_accounts SET status='needs_auth' WHERE id=${id}`
    assert.equal((await reader.runtimeServers()).length, 0)
    assert.equal((await reader.configuredServers()).length, 0)
    assert.equal((await reader.get(id)).hasToken, false)
    const accounts = new McpAccounts(kodyEnv, {
      userId: first,
      workspaceId: results[0].workspace.id,
    })
    const command = {
      type: 'save',
      id: crypto.randomUUID(),
      commandId: crypto.randomUUID(),
      expectedRevision: 0,
      label: 'New connection',
      url: 'https://example.com/mcp',
      authMode: 'none',
    }
    const saved = await Promise.all(
      Array.from({ length: 8 }, () => accounts.command(command)),
    )
    assert.ok(
      saved.every((item) => item.id === command.id && item.revision === 1),
    )
    await assert.rejects(
      accounts.command({ ...command, label: 'Different' }),
      /another change/,
    )
    const disabled = await accounts.command({
      type: 'enabled',
      id: command.id,
      commandId: crypto.randomUUID(),
      expectedRevision: 1,
      enabled: false,
    })
    assert.equal(disabled.revision, 2)
    const oauthId = crypto.randomUUID()
    const begun = await accounts.beginOAuth({
      id: oauthId,
      commandId: crypto.randomUUID(),
      expectedRevision: 0,
      label: 'OAuth',
      url: 'https://example.com/mcp',
    })
    const state = {
      grantId: begun.grantId,
      authorizationServerUrl: 'https://example.com',
      resource: 'https://example.com/mcp',
      redirectUri: 'https://tanstack.com/api/chat/oauth/callback',
      tokens: {
        access_token: 'expired',
        refresh_token: 'single-use',
        token_type: 'Bearer',
      },
      expiresAt: Date.now() - 1,
    }
    await accounts.completeOAuth({
      id: oauthId,
      expectedRevision: 1,
      grantId: begun.grantId,
      state,
    })
    await accounts.completeOAuth({
      id: oauthId,
      expectedRevision: 1,
      grantId: begun.grantId,
      state,
    })
    const claims = await Promise.all(
      Array.from({ length: 8 }, () => accounts.claimRefresh(oauthId)),
    )
    const claim = claims.find((item) => item.status === 'claimed')!
    assert.equal(claims.filter((item) => item.status === 'claimed').length, 1)
    assert.equal(claim.status, 'claimed')
    if (claim.status === 'claimed') {
      await accounts.assertRefreshClaim(claim)
      const renewed = {
        ...state,
        tokens: {
          ...state.tokens,
          access_token: 'renewed',
          refresh_token: 'rotated',
        },
        expiresAt: Date.now() + 3600000,
      }
      await accounts.completeRefresh({ ...claim, state: renewed })
      await accounts.completeRefresh({ ...claim, state: renewed })
      await assert.rejects(
        accounts.assertRefreshClaim(claim),
        /no longer authorized/,
      )
      assert.equal((await accounts.read(oauthId)).tokenRevision, 2)
    }

    await assert.rejects(
      accounts.command({
        type: 'remove',
        id: command.id,
        commandId: crypto.randomUUID(),
        expectedRevision: 1,
      }),
      /changed/,
    )
    console.log(
      'Passed: MCP private metadata, encrypted credential reads, runtime projection, foreign membership denial, and reconnect-state omission.',
    )
  }
  {
    const scope = { userId: first, workspaceId: results[0].workspace.id }
    const network: typeof fetch = async (input, init) => {
      const request = new Request(input, init)
      if (request.method === 'GET') return new Response(null, { status: 405 })
      const message = (await request.json()) as { method: string; id?: number }
      if (message.method === 'initialize')
        return Response.json({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2025-11-25',
            capabilities: {},
            serverInfo: { name: 'Synthetic', version: '1' },
          },
        })
      if (message.method === 'notifications/initialized')
        return new Response(null, { status: 202 })
      throw Error('Unexpected MCP operation')
    }
    const setups = new McpSetups(kodyEnv, scope, { fetch: network })
    const input = {
      id: crypto.randomUUID(),
      label: 'Public service',
      url: 'https://example.com/mcp',
    }
    const review = await setups.prepare(input, 'https://tanstack.com')
    assert.equal(review.kind, 'public')
    assert.deepEqual(
      await setups.prepare(input, 'https://tanstack.com'),
      review,
    )
    await assert.rejects(
      setups.prepare({ ...input, label: 'Changed' }, 'https://tanstack.com'),
      /different request/,
    )
    await assert.rejects(
      new McpSetups(
        kodyEnv,
        { ...scope, userId: second },
        { fetch: network },
      ).get(input.id),
      /not found|unavailable/,
    )
    await assert.rejects(
      setups.start(input.id, new Request('https://other.example/start')),
      /address where setup began/,
    )
    const done = await setups.start(
      input.id,
      new Request('https://tanstack.com/start'),
    )
    assert.equal(done.summary.status, 'complete')
    assert.equal(
      (await setups.start(input.id, new Request('https://tanstack.com/start')))
        .summary.status,
      'complete',
    )
    assert.equal(
      (await new McpAccounts(kodyEnv, scope).get(review.accountId)).authMode,
      'none',
    )
    const expired = { ...input, id: crypto.randomUUID() }
    await setups.prepare(expired, 'https://tanstack.com')
    await sql`UPDATE chat_mcp_setup_attempts SET expires_at=0 WHERE id=${expired.id}`
    await assert.rejects(setups.get(expired.id), /expired/)
    const batches = await Promise.allSettled(
      Array.from({ length: 24 }, () =>
        setups.prepare(
          { ...input, id: crypto.randomUUID() },
          'https://tanstack.com',
        ),
      ),
    )
    assert.equal(
      batches.filter((value) => value.status === 'fulfilled').length,
      19,
    )
    const [count] =
      await sql`SELECT COUNT(*)::integer AS count FROM chat_mcp_setup_attempts WHERE user_id=${first}`
    assert.equal(count.count, 20)
    console.log(
      'Passed: MCP setup publication, replay, request conflict, account isolation, origin check, public connection completion, and expiration.',
    )
  }
  {
    const scope = { userId: first, workspaceId: results[0].workspace.id }
    const accounts = new McpAccounts(kodyEnv, scope)
    const account = await accounts.command({
      type: 'save',
      id: crypto.randomUUID(),
      commandId: crypto.randomUUID(),
      expectedRevision: 0,
      label: 'Notes',
      url: 'https://notes.example.com/mcp',
      authMode: 'none',
    })
    const plugins = new Plugins(kodyEnv, scope)
    const files = [
      {
        path: 'plugin.json',
        text: JSON.stringify({
          $schema: pluginManifestSchemaId,
          name: 'example.notes',
        }),
      },
      {
        path: 'mcp.json',
        text: JSON.stringify({
          $schema: pluginMcpSchemaId,
          mcpServers: { notes: { type: 'streamable-http', url: account.url } },
        }),
      },
    ]
    const preview = await plugins.preview(files)
    const installed = await plugins.command({
      type: 'install',
      id: crypto.randomUUID(),
      commandId: crypto.randomUUID(),
      files,
      digest: preview.digest,
      enabled: true,
    })
    await plugins.command({
      type: 'bind',
      id: installed.id,
      commandId: crypto.randomUUID(),
      expectedRevision: 1,
      version: 1,
      requirementKey: 'notes',
      serverId: account.id,
    })
    const servers = await accounts.configuredServers()
    const aliases = await pluginMcpConnections(kodyEnv, scope, servers)
    assert.equal(aliases.length, 1)
    assert.equal(aliases[0].accountId, account.id)
    assert.equal(aliases[0].plugin?.version, 1)
    assert.equal(
      (
        await pluginMcpConnections(kodyEnv, scope, servers, {
          serverId: aliases[0].id,
        })
      ).length,
      1,
    )
    assert.equal(
      (
        await pluginMcpConnections(kodyEnv, scope, servers, {
          versions: [{ installationId: installed.id, version: 2 }],
        })
      ).length,
      0,
    )
    assert.equal(
      (
        await pluginMcpConnections(
          kodyEnv,
          { ...scope, userId: second },
          servers,
        )
      ).length,
      0,
    )
    const connected = await connectedMcpServers(
      kodyEnv,
      first,
      defaultPolicy,
      undefined,
      { workspaceId: scope.workspaceId },
    )
    assert.ok(connected.some((server) => server.id === aliases[0].id))
    await plugins.command({
      type: 'enabled',
      id: installed.id,
      commandId: crypto.randomUUID(),
      expectedRevision: 2,
      enabled: false,
    })
    assert.equal(
      (await pluginMcpConnections(kodyEnv, scope, servers)).length,
      0,
    )
    console.log(
      'Passed: plugin connection binding, exact alias selection, version pin exclusion, private membership, combined MCP projection, and disabled-package denial.',
    )
  }
  {
    const identity = {
      userId: first,
      workspaceId: main.workspace.id,
      botId: main.assistantId,
      conversationId: main.conversationId,
    }
    const env = { ...kodyEnv, INCLUDED_MODEL: '@cf/moonshotai/kimi-k2.6' }
    const context = await resolveWorkflowContext(env, identity, {
      provider: 'included',
      model: env.INCLUDED_MODEL,
    })
    assert.equal(context.identity.conversationId, main.conversationId)
    await assert.rejects(
      resolveWorkflowContext(
        env,
        { ...identity, userId: second },
        { provider: 'included', model: env.INCLUDED_MODEL },
      ),
      /not found/,
    )
    await assert.rejects(
      resolveWorkflowContext(
        env,
        identity,
        { provider: 'included', model: env.INCLUDED_MODEL },
        own[0].conversationId,
      ),
      /not found/,
    )
    console.log(
      'Passed: workflow current account access and same-bot child restriction.',
    )
  }
  {
    const scope = {
      userId: first,
      workspaceId: main.workspace.id,
      conversationId: main.conversationId,
    }
    const workflows = new Workflows(scope)
    const definition = {
      version: 1,
      name: 'Review',
      steps: [
        { id: 'review', name: 'Review', objective: 'Review supplied notes' },
      ],
    }
    const command = {
      type: 'save',
      id: crypto.randomUUID(),
      commandId: crypto.randomUUID(),
      expectedRevision: 0,
      definition,
    }
    const receipts = await Promise.all(
      Array.from({ length: 8 }, () => workflows.command(command)),
    )
    assert.ok(receipts.every((receipt) => receipt.revision === 1))
    await assert.rejects(
      workflows.command({
        ...command,
        definition: { ...definition, name: 'Changed' },
      }),
      /different input/,
    )
    const updated = await workflows.command({
      ...command,
      commandId: crypto.randomUUID(),
      expectedRevision: 1,
      definition: { ...definition, name: 'Updated' },
    })
    assert.equal(updated.revision, 2)
    assert.equal(
      (await workflows.read(command.id, 1)).definition.name,
      'Review',
    )
    await assert.rejects(
      workflows.command({
        ...command,
        commandId: crypto.randomUUID(),
        expectedRevision: 1,
      }),
      /changed/,
    )
    const archived = await workflows.command({
      type: 'archive',
      id: command.id,
      commandId: crypto.randomUUID(),
      expectedRevision: 2,
    })
    assert.equal(archived.archived, true)
    assert.equal((await workflows.list()).items[0].revision, 3)
    await assert.rejects(
      new Workflows({ ...scope, userId: second }).read(command.id),
      /access/,
    )
    await assert.rejects(
      sql`UPDATE chat_workflow_revisions SET request_hash='changed' WHERE conversation_id=${scope.conversationId}`,
      /immutable/,
    )
    await assert.rejects(
      sql`INSERT INTO chat_workflow_revisions SELECT conversation_id,workflow_id,99,workspace_id,user_id,${crypto.randomUUID()},request_hash,definition_json,archived,created_at FROM chat_workflow_revisions WHERE conversation_id=${scope.conversationId} LIMIT 1`,
      /advance once/,
    )
    console.log(
      'Passed: concurrent workflow receipts, input conflicts, retained revisions, stale edits, archive, account isolation, and database immutability/revision guards.',
    )
  }
  {
    const id = crypto.randomUUID(),
      now = Date.now()
    const owner = {
      userId: first,
      workspaceId: main.workspace.id,
      botId: main.assistantId,
      conversationId: main.conversationId,
    }
    const env = { ...kodyEnv, INCLUDED_MODEL: '@cf/moonshotai/kimi-k2.6' }
    const admission = {
      id,
      childConversationId: id,
      owner,
      workflowRunId: crypto.randomUUID(),
      workflowId: crypto.randomUUID(),
      definitionRevision: 1,
      stepId: 'review',
      objective: 'Review supplied notes',
      model: { provider: 'included', model: env.INCLUDED_MODEL },
      sources: [],
      inputs: [],
      createdAt: now,
      deadline: now + 60000,
    }
    const children = await Promise.all(
      Array.from({ length: 8 }, () => publishWorkflowChild(env, admission)),
    )
    assert.ok(children.every((child) => child.childConversationId === id))
    const [count] =
      await sql`SELECT count(*)::integer AS count FROM chat_workflow_children WHERE conversation_id=${id}`
    assert.equal(count.count, 1)
    assert.deepEqual(await readConversationWorkflowWorker(id), {
      ownerConversationId: main.conversationId,
      runId: admission.workflowRunId,
      stepId: admission.stepId,
    })
    assert.equal(await readConversationWorkflowOwner(id), main.conversationId)
    assert.equal(await readConversationWorkflowOwner(main.conversationId), null)
    assert.equal(await readConversationWorkflowOwner(crypto.randomUUID()), null)
    await assert.rejects(
      publishWorkflowChild(env, { ...admission, objective: 'Changed' }),
      /another admission/,
    )
    await assert.rejects(
      publishWorkflowChild(env, {
        ...admission,
        owner: { ...owner, userId: second },
      }),
      /not found/,
    )
    console.log(
      'Passed: exact workflow child publication, concurrent replay, admission conflict, and foreign owner denial.',
    )
  }
  {
    const local = new DatabaseSync(':memory:')
    const storage = {
      exec(query: string, ...args: unknown[]) {
        const statement = local.prepare(query)
        const rows = statement.columns().length
          ? statement.all(...(args as never[]))
          : (statement.run(...(args as never[])), [])
        return { toArray: () => rows }
      },
    } as unknown as SqlStorage
    const outbox = new BotActivityOutbox(storage)
    const identity = {
      workspaceId: main.workspace.id,
      userId: first,
      botId: main.assistantId,
      conversationId: main.conversationId,
    }
    const summary = {
      conversationId: main.conversationId,
      botId: main.assistantId,
      userId: first,
      status: 'completed' as const,
      activityAt: Date.now(),
      eventVersion: 10,
      readVersion: 0,
      preview: 'Done',
      messageCount: 2,
      queuedCount: 0,
      queuePaused: false,
    }
    const projection = projectBotActivity(
      undefined,
      identity,
      {
        status: 'idle',
        messages: [
          {
            id: 'prompt',
            role: 'user',
            parts: [{ type: 'text', content: 'Work' }],
          },
          {
            id: 'reply',
            role: 'assistant',
            parts: [{ type: 'text', content: 'Done' }],
          },
        ],
        approvals: [],
      },
      summary.activityAt,
    )
    outbox.enqueue({ ...projection, summary })
    await outbox.flush()
    assert.equal(
      (await readBotActivity(main.workspace.id, first))[main.assistantId]
        .eventVersion,
      10,
    )
    assert.deepEqual(await readBotActivity(main.workspace.id, second), {})
    await markBotRead(main.workspace.id, second, main.assistantId, 10)
    assert.equal(
      (await readBotActivity(main.workspace.id, first))[main.assistantId]
        .readVersion,
      0,
    )
    await markBotRead(main.workspace.id, first, main.assistantId, 5)
    await markConversationRead(main.workspace.id, first, main.conversationId, 3)
    assert.equal(
      (await readBotActivity(main.workspace.id, first))[main.assistantId]
        .readVersion,
      5,
    )
    await markConversationRead(
      main.workspace.id,
      first,
      main.conversationId,
      100,
    )
    assert.equal(
      (await readBotActivity(main.workspace.id, first))[main.assistantId]
        .readVersion,
      10,
    )
    assert.equal(
      await readConversationReadVersion(
        main.workspace.id,
        first,
        main.conversationId,
      ),
      10,
    )
    assert.equal(
      await readConversationReadVersion(
        main.workspace.id,
        second,
        main.conversationId,
      ),
      0,
    )
    assert.equal(
      await readConversationReadVersion(
        'foreign-workspace',
        first,
        main.conversationId,
      ),
      0,
    )
    outbox.enqueue({
      ...projection,
      summary: { ...summary, eventVersion: 9, preview: 'Stale' },
    })
    await outbox.flush()
    assert.equal(
      (await readBotActivity(main.workspace.id, first))[main.assistantId]
        .preview,
      'Done',
    )
    assert.equal(
      local.prepare('SELECT COUNT(*) AS count FROM activity_outbox').get()
        ?.count,
      0,
    )
    local.close()
    console.log(
      'Passed: durable local activity outbox delivery, stale event rejection, private reads, foreign read-marker denial, and monotonic bounded read versions.',
    )
  }
  {
    const botId = own[0].bot.id
    const initial = await readScheduleLifecycleGeneration(botId)
    assert.ok(initial >= 1)
    await sql`UPDATE chat_bots SET archived_at=NULL WHERE id=${botId}`
    assert.equal(await readScheduleLifecycleGeneration(botId), initial)
    await sql`UPDATE chat_bots SET archived_at=now() WHERE id=${botId}`
    assert.equal(await readScheduleLifecycleGeneration(botId), initial + 1)
    await sql`UPDATE chat_bots SET archived_at=now() WHERE id=${botId}`
    assert.equal(await readScheduleLifecycleGeneration(botId), initial + 1)
    const lifecycleThreadId = crypto.randomUUID()
    await sql`INSERT INTO chat_conversations(id,bot_id,user_id) VALUES(${lifecycleThreadId},${main.assistantId},${first})`
    await sql`INSERT INTO chat_conversation_threads(conversation_id,parent_conversation_id,bot_id,user_id,source_message_id,source,title) VALUES(${lifecycleThreadId},${main.conversationId},${main.assistantId},${first},'lifecycle-message',${sql.json(snapshot)},'Lifecycle')`
    assert.equal(
      await readThreadScheduleLifecycleGeneration(lifecycleThreadId),
      0,
    )
    await sql`UPDATE chat_conversation_threads SET archived_at=now() WHERE conversation_id=${lifecycleThreadId}`
    assert.equal(
      await readThreadScheduleLifecycleGeneration(lifecycleThreadId),
      1,
    )
    await sql`UPDATE chat_conversation_threads SET archived_at=NULL WHERE conversation_id=${lifecycleThreadId}`
    assert.equal(
      await readThreadScheduleLifecycleGeneration(lifecycleThreadId),
      1,
    )
    const [before] =
      await sql`SELECT generation::integer AS generation FROM chat_execution_membership_generations WHERE workspace_id=${main.workspace.id} AND user_id=${first}`
    await sql`DELETE FROM chat_memberships WHERE workspace_id=${main.workspace.id} AND user_id=${first}`
    await sql`INSERT INTO chat_memberships(workspace_id,user_id,role) VALUES(${main.workspace.id},${first},'owner')`
    const [after] =
      await sql`SELECT generation::integer AS generation FROM chat_execution_membership_generations WHERE workspace_id=${main.workspace.id} AND user_id=${first}`
    assert.equal(after.generation, before.generation + 2)
    console.log(
      'Passed: archive generation advances once, restore retains generation, thread suspension persists, and membership remove/rejoin invalidates old execution epochs.',
    )
  }
  {
    const identity = {
      workspaceId: main.workspace.id,
      userId: first,
      botId: main.assistantId,
      conversationId: main.conversationId,
    }
    const authority = await readExecutionAuthority(identity)
    assert.ok(authority.membershipGeneration >= 3)
    await assert.rejects(
      readExecutionAuthority({ ...identity, userId: second }),
      /not found/,
    )
    const inactive = {
      ...identity,
      botId: own[0].bot.id,
      conversationId: own[0].conversationId,
    }
    await assert.rejects(readExecutionAuthority(inactive), /Restore/)
    assert.ok(
      (await readExecutionAuthority(inactive, { allowInactive: true }))
        .lifecycleGeneration >= 2,
    )
    const copyId = crypto.randomUUID()
    await sql`INSERT INTO chat_conversation_copies(id,workspace_id,user_id,source_bot_id,source_conversation_id,target_bot_id,target_conversation_id,idempotency_key,request_digest,kind,boundary_json,name,purpose,created_at,updated_at) VALUES(${copyId},${main.workspace.id},${first},${own[0].bot.id},${own[0].conversationId},${main.assistantId},${main.conversationId},'authority-copy','digest','duplicate','{"kind":"end"}','Copy','',1,1)`
    await assert.rejects(readExecutionAuthority(identity), /not ready/)
    await sql`UPDATE chat_conversation_copies SET status='ready' WHERE id=${copyId}`
    assert.deepEqual(await readExecutionAuthority(identity), authority)
    await sql`UPDATE chat_conversation_copies SET user_id=${second} WHERE id=${copyId}`
    await assert.rejects(readExecutionAuthority(identity), /not ready/)
    await sql`DELETE FROM chat_conversation_copies WHERE id=${copyId}`
    console.log(
      'Passed: execution exact identity, current membership epochs, inactive denial, explicitly allowed inactive inspection, pending-copy denial, ready-copy acceptance, and mismatched copy-owner denial.',
    )
  }
  {
    const request = (body: unknown, token?: string) =>
      new Request('https://tanstack.com/api/chat/devices', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify(body),
      })
    const registration = (await (
      await deviceAccountApi(
        request({ type: 'register', name: 'Test desktop' }),
        first,
      )
    ).json()) as { id: string; token: string }
    assert.equal((await listDevices(first)).length, 1)
    assert.equal((await listDevices(second)).length, 0)
    assert.equal(
      (await deviceTransportApi(request({ type: 'poll', grants: [] }, 'bad')))
        .status,
      401,
    )
    const grantId = crypto.randomUUID()
    const poll = () =>
      deviceTransportApi(
        request(
          { type: 'poll', grants: [{ id: grantId, name: 'Notes' }] },
          registration.token,
        ),
      )
    assert.equal(await (await poll()).json(), null)
    assert.equal((await listDevices(first))[0].online, true)
    const operationId = crypto.randomUUID()
    await sql`INSERT INTO chat_device_operations(id,device_id,user_id,conversation_id,request,created_at,expires_at) VALUES(${operationId},${registration.id},${first},${main.conversationId},${JSON.stringify({ deviceId: registration.id, grantId, operation: 'read', path: 'notes.txt' })},${Date.now()},${Date.now() + 30000})`
    const claims = await Promise.all(
      Array.from({ length: 8 }, async () => (await poll()).json()),
    )
    assert.equal(
      claims.filter(Boolean).length,
      1,
      'one poll claims the operation',
    )
    assert.equal(claims.find(Boolean).id, operationId)
    await deviceTransportApi(
      request(
        { type: 'result', id: operationId, result: '{"text":"Notes"}' },
        registration.token,
      ),
    )
    const [completed] =
      await sql`SELECT status,result FROM chat_device_operations WHERE id=${operationId}`
    assert.equal(completed.status, 'complete')
    assert.equal(JSON.parse(completed.result).text, 'Notes')
    assert.equal(
      await (await poll()).json(),
      null,
      'completed operations are not replayed',
    )
    const cancelledId = crypto.randomUUID()
    await sql`INSERT INTO chat_device_operations(id,device_id,user_id,conversation_id,request,created_at,expires_at) VALUES(${cancelledId},${registration.id},${first},${main.conversationId},'{}',${Date.now()},${Date.now() + 30000})`
    await deviceAccountApi(
      request({ type: 'revoke', id: registration.id }),
      second,
    )
    assert.equal(
      (await listDevices(first)).length,
      1,
      'foreign revoke cannot affect the device',
    )
    await deviceAccountApi(
      request({ type: 'revoke', id: registration.id }),
      first,
    )
    assert.equal((await listDevices(first)).length, 0)
    assert.equal((await poll()).status, 401)
    assert.equal(
      (
        await sql`SELECT status FROM chat_device_operations WHERE id=${cancelledId}`
      )[0].status,
      'cancelled',
    )
    console.log(
      'Passed: private device registration, presence and grants, atomic concurrent claim, result delivery without replay, foreign revocation denial, and owner revocation cancelling pending work.',
    )
  }
  {
    const identity = {
      workspaceId: main.workspace.id,
      userId: first,
      botId: main.assistantId,
      conversationId: main.conversationId,
    }
    const now = Date.parse('2030-01-01T12:00:00Z'),
      day = '2030-01-01'
    const input = {
      identity,
      runId: 'usage-idempotent',
      policy: { dailyTurns: 2 },
      localDevelopment: false,
      scheduled: false,
      now,
      fundedSpend: {
        userCapMicros: 100,
        globalCapMicros: 200,
        reservationMicros: 40,
      },
    }
    const receipts = await Promise.all(
      Array.from({ length: 8 }, () => reserveRunUsage(input)),
    )
    assert.equal(receipts.filter((r) => r.status === 'reserved').length, 1)
    assert.equal(receipts.filter((r) => r.status === 'duplicate').length, 7)
    assert.equal(
      (
        await sql`SELECT turns::integer AS turns FROM chat_daily_usage WHERE user_id=${first} AND day=${day}`
      )[0].turns,
      1,
    )
    await assert.rejects(
      reserveRunUsage({
        ...input,
        identity: { ...identity, botId: own[0].bot.id },
      }),
      /different request/,
    )
    assert.equal(
      (await reserveRunUsage({ ...input, now: now + 86400000 })).status,
      'duplicate',
      'replay on another day retains the original receipt',
    )
    await reserveRunUsage({ ...input, runId: 'usage-second' })
    await assert.rejects(
      reserveRunUsage({ ...input, runId: 'usage-third' }),
      (e) => e instanceof RunUsageAllowanceError && e.code === 'user',
    )
    await settleFundedSpend(
      identity.conversationId,
      input.runId,
      0.00001,
      false,
    )
    assert.equal((await fundedSpendReport(first, day)).user_micros, 50)
    await settleFundedSpend(
      identity.conversationId,
      input.runId,
      0.000001,
      false,
    )
    assert.equal((await fundedSpendReport(first, day)).user_micros, 50)
    await settleFundedSpend(
      identity.conversationId,
      input.runId,
      0.000001,
      true,
    )
    assert.equal((await fundedSpendReport(first, day)).user_micros, 80)
    assert.equal((await fundedSpendReport(first, day)).unknown_runs, 1)
    await reserveRunUsage({
      ...input,
      runId: 'usage-unlimited',
      unlimited: true,
    })
    const scheduled = {
      ...input,
      runId: 'scheduled-first',
      now: now + 2 * 86400000,
      scheduled: true,
      scheduledDailyLimit: 1,
      localDevelopment: true,
      policy: { dailyTurns: 200 },
      fundedSpend: undefined,
    }
    await reserveRunUsage(scheduled)
    await assert.rejects(
      reserveRunUsage({ ...scheduled, runId: 'scheduled-second' }),
      (e) => e instanceof RunUsageAllowanceError && e.code === 'scheduled',
    )
    const budget = {
      ...input,
      now: now + 3 * 86400000,
      policy: { dailyTurns: 200 },
      fundedSpend: {
        userCapMicros: 60,
        globalCapMicros: 100,
        reservationMicros: 40,
      },
    }
    await reserveRunUsage({ ...budget, runId: 'budget-first' })
    await assert.rejects(
      reserveRunUsage({ ...budget, runId: 'budget-second' }),
      (e) => e instanceof RunUsageAllowanceError && e.code === 'user-spend',
    )
    console.log(
      'Passed: concurrent usage receipt idempotency, identity conflict, cross-day replay, exact turn limits, unlimited entitlement, scheduled limit, spend reservation, and monotonic unknown-cost settlement.',
    )
  }
  {
    let captured = 0,
      released = 0,
      reserved = 0
    const env = {
      CONVERSATIONS: {
        getByName: (_id: string) => ({
          bindIdentity: async () => {},
          captureThreadSource: async () => {
            captured++
            return {
              ok: true as const,
              source: { ...snapshot, text: '**Original** request' },
            }
          },
          reserveEmptyThread: async () => ({ reserved: true }),
          reserveDeletion: async () => {
            reserved++
            return { reserved: true }
          },
          releaseDeletion: async () => {
            released++
          },
        }),
      },
    }
    const threads = new ConversationThreads(env, main.workspace.id, first)
    const key = crypto.randomUUID()
    const created = await Promise.all(
      Array.from({ length: 8 }, () =>
        threads.create(main.conversationId, {
          idempotencyKey: key,
          sourceMessageId: 'thread-source',
        }),
      ),
    )
    assert.equal(new Set(created.map((t) => t.conversationId)).size, 1)
    const thread = created[0]
    assert.equal(thread.title, 'Original request')
    await assert.rejects(
      threads.create(thread.conversationId, {
        idempotencyKey: crypto.randomUUID(),
        sourceMessageId: 'nested',
      }),
      /active main/,
    )
    const capturesBefore = captured
    await threads.create(main.conversationId, {
      idempotencyKey: key,
      sourceMessageId: 'thread-source',
    })
    assert.equal(
      captured,
      capturesBefore,
      'receipt replay never recaptures the parent',
    )
    await assert.rejects(
      threads.create(main.conversationId, {
        idempotencyKey: key,
        sourceMessageId: 'different-source',
      }),
      /different message/,
    )
    assert.equal(
      (await threads.list(main.conversationId)).items.some(
        (t) => t.conversationId === thread.conversationId,
      ),
      true,
    )
    const context = await conversationThreadContext({
      workspaceId: main.workspace.id,
      userId: first,
      botId: main.assistantId,
      conversationId: thread.conversationId,
    })
    assert.equal(context?.source.text, '**Original** request')
    await assert.rejects(
      new ConversationThreads(env, main.workspace.id, second).get(
        thread.conversationId,
      ),
      /not found/,
    )
    const renamed = await threads.rename(thread.conversationId, {
      type: 'rename',
      title: 'Review',
      expectedVersion: 0,
    })
    assert.equal(renamed.version, 1)
    assert.equal(
      (
        await threads.rename(thread.conversationId, {
          type: 'rename',
          title: 'Review',
          expectedVersion: 0,
        })
      ).version,
      1,
    )
    await assert.rejects(
      threads.rename(thread.conversationId, {
        type: 'rename',
        title: 'Other',
        expectedVersion: 0,
      }),
      /changed/,
    )
    const archived = await threads.archive(thread.conversationId, {
      type: 'archive',
      archived: true,
      expectedVersion: 1,
    })
    assert.ok(archived.archivedAt !== null)
    assert.equal(archived.version, 2)
    assert.equal(reserved, 1)
    assert.equal(released, 1)
    assert.equal(
      (
        await threads.archive(thread.conversationId, {
          type: 'archive',
          archived: true,
          expectedVersion: 1,
        })
      ).version,
      2,
    )
    assert.equal(
      (await threads.list(main.conversationId)).items.some(
        (t) => t.conversationId === thread.conversationId,
      ),
      false,
      'empty archived threads are omitted',
    )
    const restored = await threads.archive(thread.conversationId, {
      type: 'archive',
      archived: false,
      expectedVersion: 2,
    })
    assert.equal(restored.archivedAt, null)
    assert.equal(restored.version, 3)
    const childId = crypto.randomUUID(),
      delegationKey = crypto.randomUUID()
    const delegated = {
      idempotencyKey: delegationKey,
      sourceMessageId: 'delegation',
      conversationId: childId,
      source: snapshot,
      title: 'Worker',
    }
    const child = await threads.createDelegated(main.conversationId, delegated)
    assert.equal(child.conversationId, childId)
    assert.equal(child.title, 'Worker')
    await assert.rejects(
      threads.createDelegated(main.conversationId, {
        ...delegated,
        title: 'Changed',
      }),
      /different thread/,
    )
    console.log(
      'Passed: full thread service concurrent creation, frozen source/replay, title extraction, context and account isolation, versioned rename, archive reservation/release, empty-thread filtering, restore, and delegated receipt binding.',
    )
  }
  {
    const identity = {
      workspaceId: main.workspace.id,
      userId: first,
      botId: main.assistantId,
      conversationId: main.conversationId,
    }
    const payload = 'snapshot page',
      digest = await copyHash(payload)
    let imports = 0,
      activated = 0,
      released = 0,
      discarded = 0
    const target = {
      importCopyPages: async () => {
        imports++
        return { accepted: true as const }
      },
      finishCopyImport: async (id: string, d: string) => ({
        status: 'ready' as const,
        operationId: id,
        digest: d,
      }),
      discardCopyImport: async () => {
        discarded++
      },
      activateCopy: async () => {
        activated++
      },
    }
    const env = { CONVERSATIONS: { getByName: () => target } }
    const make = async () => {
      const id = crypto.randomUUID(),
        bot = crypto.randomUUID(),
        conversation = crypto.randomUUID()
      await sql`INSERT INTO chat_conversation_copies(id,workspace_id,user_id,source_bot_id,source_conversation_id,target_bot_id,target_conversation_id,idempotency_key,request_digest,kind,boundary_json,name,purpose,created_at,updated_at) VALUES(${id},${main.workspace.id},${first},${main.assistantId},${main.conversationId},${bot},${conversation},${id},'digest','duplicate','{"kind":"end"}','Copy worker','',1,1)`
      const manifest: CopyManifest = {
        schemaVersion: 2,
        operationId: id,
        digest,
        pageCount: 1,
        sourceEpoch: 'epoch',
        sourceRevision: 1,
        sourceMessageId: null,
        sourceMessageDigest: null,
        messageCount: 1,
        actionEvidence: [],
      }
      return { id, bot, conversation, manifest }
    }
    const valid = await make()
    const source = {
      startCopyExport: async () => ({
        status: 'sealed' as const,
        manifest: valid.manifest,
      }),
      readCopyPages: async () => [{ ordinal: 0, digest, payload }],
      releaseCopyExport: async () => {
        released++
      },
    }
    assert.equal(
      await getAuthorizedCopyOperation(
        env,
        valid.id,
        { ...identity, userId: second },
        'source',
      ),
      undefined,
    )
    for (let i = 0; i < 3; i++)
      await resumeConversationCopies(env, identity, source)
    assert.equal(
      (
        await sql`SELECT phase FROM chat_conversation_copies WHERE id=${valid.id}`
      )[0].phase,
      'publish',
    )
    await Promise.all(
      Array.from({ length: 8 }, () =>
        resumeConversationCopies(env, identity, source),
      ),
    )
    const [published] =
      await sql`SELECT status,phase FROM chat_conversation_copies WHERE id=${valid.id}`
    assert.equal(published.status, 'ready')
    assert.equal(
      (
        await sql`SELECT count(*)::integer AS count FROM chat_bots WHERE id=${valid.bot}`
      )[0].count,
      1,
    )
    assert.equal(
      (
        await sql`SELECT conversation_id FROM chat_conversation_mains WHERE bot_id=${valid.bot} AND user_id=${first}`
      )[0].conversation_id,
      valid.conversation,
    )
    await resumeConversationCopies(env, identity, source)
    assert.equal(
      (
        await sql`SELECT phase FROM chat_conversation_copies WHERE id=${valid.id}`
      )[0].phase,
      'done',
    )
    assert.ok(activated >= 1 && released >= 1 && imports >= 1)
    await sql`UPDATE chat_bots SET archived_at=now() WHERE id=${valid.bot}`
    const invalid = await make()
    const badSource = {
      ...source,
      startCopyExport: async () => ({
        status: 'sealed' as const,
        manifest: invalid.manifest,
      }),
      readCopyPages: async () => [{ ordinal: 0, digest: 'wrong', payload }],
    }
    await resumeConversationCopies(env, identity, badSource)
    await resumeConversationCopies(env, identity, badSource)
    const [failed] =
      await sql`SELECT status,error_code,phase FROM chat_conversation_copies WHERE id=${invalid.id}`
    assert.equal(failed.status, 'failed')
    assert.equal(failed.error_code, 'invalid_page')
    assert.equal(failed.phase, 'cleanup')
    await resumeConversationCopies(env, identity, badSource)
    assert.equal(discarded, 1)
    assert.equal(
      (
        await sql`SELECT count(*)::integer AS count FROM chat_bots WHERE id=${invalid.bot}`
      )[0].count,
      0,
    )
    const interrupted = await make()
    const result = await resumeConversationCopies(env, identity, {
      ...source,
      startCopyExport: async () => {
        throw new Error('Private provider body')
      },
    })
    assert.equal(result.pending, true)
    const [retry] =
      await sql`SELECT attempts::integer AS attempts,retry_at::double precision AS retry_at,error_message FROM chat_conversation_copies WHERE id=${interrupted.id}`
    assert.equal(retry.attempts, 1)
    assert.ok(retry.retry_at > Date.now())
    assert.equal(retry.error_message, null)
    await sql`DELETE FROM chat_conversation_copies WHERE id=${interrupted.id}`
    console.log(
      'Passed: source-scoped copy worker, bounded export/transfer/import, concurrent atomic publication, activation/cleanup, corrupt-page failure without publication, and private transient backoff.',
    )
  }
  {
    let wakes = 0,
      registrations = 0
    const env = {
      CONVERSATIONS: {
        getByName: () => ({
          bindIdentity: async () => {},
          wakeCopies: async (registration?: unknown) => {
            wakes++
            if (registration) registrations++
          },
          copyBoundary: async () => ({ ok: false as const }),
          importCopyPages: async () => ({ accepted: true as const }),
          finishCopyImport: async (id: string, digest: string) => ({
            status: 'ready' as const,
            operationId: id,
            digest,
          }),
          discardCopyImport: async () => {},
          activateCopy: async () => {},
        }),
      },
    }
    const service = new ConversationCopies(env, main.workspace.id, first)
    const input = {
      idempotencyKey: crypto.randomUUID(),
      kind: 'duplicate',
      boundary: { kind: 'end', epoch: 'epoch', expectedRevision: 0 },
    }
    const copies = await Promise.all(
      Array.from({ length: 8 }, () =>
        service.create(main.assistantId, input, main.conversationId),
      ),
    )
    assert.equal(new Set(copies.map((c) => c.operationId)).size, 1)
    const id = copies[0].operationId
    assert.ok(registrations >= 1 && wakes >= 1)
    assert.equal((await service.get(id)).status, 'copying')
    await assert.rejects(
      service.create(
        main.assistantId,
        { ...input, name: 'Conflicting' },
        main.conversationId,
      ),
      /different options/,
    )
    await assert.rejects(
      new ConversationCopies(env, main.workspace.id, second).get(id),
      /not found/,
    )
    const fork = await service.create(
      main.assistantId,
      {
        idempotencyKey: crypto.randomUUID(),
        kind: 'fork',
        boundary: {
          kind: 'message',
          epoch: 'epoch',
          messageId: 'source',
          expectedDigest: 'digest',
        },
      },
      main.conversationId,
    )
    assert.equal(
      (
        await sql`SELECT parent_id FROM chat_conversation_copies WHERE id=${fork.operationId}`
      )[0].parent_id,
      main.assistantId,
    )
    await assert.rejects(
      service.create(
        main.assistantId,
        {
          ...input,
          idempotencyKey: crypto.randomUUID(),
          parentId: foreign.bot.id,
        },
        main.conversationId,
      ),
      /active parent/,
    )
    const rowId = crypto.randomUUID()
    await sql`INSERT INTO chat_conversation_retries(id,workspace_id,user_id,source_bot_id,source_conversation_id,message_id,idempotency_key,source_json,file_plan_json,created_at,updated_at) VALUES(${rowId},${main.workspace.id},${first},${main.assistantId},${main.conversationId},'message',${rowId},'{}','{}',1,1)`
    await assert.rejects(
      sql`UPDATE chat_conversation_retries SET source_json='{}' WHERE id=${rowId}`,
      /immutable/,
    )
    await assert.rejects(
      sql`UPDATE chat_conversation_copies SET retry_id=NULL WHERE id=${id}`,
      /immutable/,
    )
    await sql`DELETE FROM chat_conversation_retries WHERE id=${rowId}`
    await sql`DELETE FROM chat_conversation_copies WHERE id IN (${id},${fork.operationId})`
    console.log(
      'Passed: concurrent copy admission receipt, durable wake registration, conflicting request denial, private reads, fork parenting, foreign parent denial, and database retry identity immutability.',
    )
  }
  {
    const prompt = {
      id: 'retry-request',
      role: 'user' as const,
      parts: [{ type: 'text' as const, content: 'Original request' }],
    }
    const projection = projectRetryTurn({
      id: prompt.id,
      messages: [
        prompt,
        {
          id: 'retry-answer',
          role: 'assistant',
          parts: [{ type: 'text', content: 'Original answer' }],
        },
      ],
      approvals: [],
      outcome: { status: 'done', answerId: 'retry-answer' },
    })
    const review = {
      ...projection,
      boundary: {
        kind: 'message' as const,
        epoch: 'retry-epoch',
        messageId: prompt.id,
        expectedDigest: await copyHash(
          canonicalCopyJson(copyBoundaryMessage(prompt)),
        ),
        side: 'before' as const,
      },
      evidenceDigest: await copyHash(canonicalCopyJson(projection)),
      inheritedEvidence: [],
      reviewDigest: '',
    }
    review.reviewDigest = await copyHash(retryReviewPayload(review))
    const retryId = crypto.randomUUID(),
      copyId = crypto.randomUUID()
    const insert = async (id: string, source: unknown) =>
      sql`INSERT INTO chat_conversation_retries(id,workspace_id,user_id,source_bot_id,source_conversation_id,message_id,idempotency_key,source_json,file_plan_json,created_at,updated_at) VALUES(${id},${main.workspace.id},${first},${main.assistantId},${main.conversationId},${prompt.id},${id},${sql.typed(JSON.stringify(source), 25)}::jsonb,'{}',1,1)`
    await insert(retryId, review)
    await sql`INSERT INTO chat_conversation_copies(id,retry_id,workspace_id,user_id,source_bot_id,source_conversation_id,target_bot_id,target_conversation_id,idempotency_key,request_digest,kind,boundary_json,name,purpose,created_at,updated_at) VALUES(${copyId},${retryId},${main.workspace.id},${first},${main.assistantId},${main.conversationId},${crypto.randomUUID()},${crypto.randomUUID()},${copyId},'digest','fork',${sql.json(review.boundary)},'Retry','',1,1)`
    const [copy] = await sql<
      ConversationCopyRow[]
    >`SELECT *,boundary_json::text AS boundary_json FROM chat_conversation_copies WHERE id=${copyId}`
    assert.deepEqual(await copyRetrySource(copy), review)
    assert.equal(await copyRetrySource({ ...copy, retry_id: null }), undefined)
    await assert.rejects(
      copyRetrySource({ ...copy, user_id: second }),
      /unavailable/,
    )
    await assert.rejects(
      copyRetrySource({
        ...copy,
        boundary_json: JSON.stringify({
          ...review.boundary,
          messageId: 'wrong',
        }),
      }),
      /verified/,
    )
    const badEvidence = crypto.randomUUID(),
      badReview = crypto.randomUUID()
    await insert(badEvidence, { ...review, evidenceDigest: 'a'.repeat(43) })
    await insert(badReview, { ...review, reviewDigest: 'a'.repeat(43) })
    await assert.rejects(
      copyRetrySource({ ...copy, retry_id: badEvidence }),
      /verified/,
    )
    await assert.rejects(
      copyRetrySource({ ...copy, retry_id: badReview }),
      /verified/,
    )
    await sql`DELETE FROM chat_conversation_copies WHERE id=${copyId}`
    await sql`DELETE FROM chat_conversation_retries WHERE id IN (${retryId},${badEvidence},${badReview})`
    console.log(
      'Passed: immutable retry-source retrieval, exact account/source scope, boundary equality, evidence digest, and inherited review commitment verification.',
    )
  }
  {
    const scope = { workspaceId: main.workspace.id, userId: first },
      options = { policy: defaultPolicy, fixture: false }
    const empty = { status: 'ready', items: [] }
    const account = kodyAccountSchema.parse({
      status: 'connected',
      identity: { status: 'ready' },
      packages: { ...empty, executionReadiness: 'not_checked', limited: false },
      jobs: { ...empty, limited: false },
      workflows: { ...empty, limited: false },
      runs: { ...empty, more: false },
      integrations: {
        status: 'ready',
        items: [{ name: 'Calendar', usageMode: 'personal' }],
      },
      servers: empty,
      secrets: empty,
      waiting: empty,
      checkedAt: new Date().toISOString(),
    })
    assert.equal(
      (
        await listKodyAccountReferences(kodyEnv, scope, {
          ...options,
          query: '',
        })
      ).status,
      'missing',
    )
    assert.equal(
      await refreshKodyAccountReferences(
        kodyEnv,
        scope,
        options,
        AbortSignal.timeout(10000),
        async () => account,
      ),
      1,
    )
    const listing = await listKodyAccountReferences(kodyEnv, scope, {
      ...options,
      query: 'calendar',
    })
    assert.equal(listing.status, 'ready')
    assert.ok(listing.items[0].kind === 'kody')
    assert.equal(listing.items[0].entity, 'integration:Calendar')
    assert.equal(
      (
        await resolveKodyAccountReference(
          kodyEnv,
          scope,
          { entity: 'integration:Calendar' },
          options,
        )
      ).label,
      'Calendar',
    )
    const detail = await inspectKodyAccountReference(
      kodyEnv,
      scope,
      { entity: 'integration:Calendar' },
      options,
      AbortSignal.timeout(10000),
      async () => account,
    )
    assert.equal(detail.title, 'Calendar')
    await assert.rejects(
      listKodyAccountReferences(
        kodyEnv,
        { ...scope, userId: second },
        { ...options, query: '' },
      ),
      /access/,
    )
    let release!: () => void, entered!: () => void
    const wait = new Promise<void>((resolve) => {
        release = resolve
      }),
      began = new Promise<void>((resolve) => {
        entered = resolve
      })
    const stale = refreshKodyAccountReferences(
      kodyEnv,
      scope,
      options,
      AbortSignal.timeout(10000),
      async () => {
        entered()
        await wait
        return account
      },
    )
    const rejected = assert.rejects(stale, /newer object refresh/)
    await began
    const newer = {
      ...account,
      integrations: {
        status: 'ready' as const,
        items: [{ name: 'Mail', usageMode: 'personal' }],
      },
    }
    await refreshKodyAccountReferences(
      kodyEnv,
      scope,
      options,
      AbortSignal.timeout(10000),
      async () => newer,
    )
    release()
    await rejected
    const updatedReference = (
      await listKodyAccountReferences(kodyEnv, scope, { ...options, query: '' })
    ).items[0]
    assert.ok(updatedReference.kind === 'kody')
    assert.equal(updatedReference.entity, 'integration:Mail')
    await updateCredentials(kodyEnv, first, (current) => {
      assert.ok(current?.kody)
      return {
        ...current,
        kody: { ...current.kody, client_id: 'different-client' },
      }
    })
    assert.equal(
      (
        await listKodyAccountReferences(kodyEnv, scope, {
          ...options,
          query: '',
        })
      ).status,
      'missing',
    )
    console.log(
      'Passed: Kody account reference publication/search/resolve/inspection, private scope, newer-refresh fencing, and changed-account cache exclusion.',
    )
  }
  {
    const scope = { workspaceId: main.workspace.id, userId: first },
      options = {
        policy: { ...defaultPolicy, allowKody: false },
        fixture: false,
      }
    const accounts = new McpAccounts(kodyEnv, scope),
      id = crypto.randomUUID(),
      serverId = 'mcp:' + id
    await accounts.command({
      type: 'save',
      id,
      commandId: crypto.randomUUID(),
      expectedRevision: 0,
      label: 'Reference server',
      url: 'https://example.com/mcp',
      authMode: 'none',
    })
    const before = await listToolReferences(kodyEnv, scope, {
      ...options,
      query: '',
    })
    assert.ok(before.toolSources?.some((s) => s.serverId === serverId))
    const catalog = {
      serverId,
      complete: true,
      fetchedAt: Date.now(),
      scope: 'server-advertised' as const,
      warnings: [],
      entries: [
        {
          id: 'calendar-search',
          serverId,
          serverLabel: 'Reference server',
          kind: 'tool' as const,
          name: 'calendar_search',
          title: 'Search calendar',
          description: 'Find calendar events',
          target: { method: 'tools/call' as const, name: 'calendar_search' },
          inputSchema: { type: 'object' },
        },
      ],
    }
    await refreshToolReferences(
      kodyEnv,
      scope,
      options,
      serverId,
      AbortSignal.timeout(10000),
      async () => catalog,
    )
    const found = await listToolReferences(kodyEnv, scope, {
      ...options,
      query: 'calendar',
    })
    assert.ok(
      found.items.some(
        (item) => item.kind === 'tool' && item.toolName === 'calendar_search',
      ),
    )
    assert.equal(
      (
        await resolveToolReference(
          kodyEnv,
          scope,
          { serverId, toolName: 'calendar_search' },
          options,
        )
      ).label,
      'Search calendar',
    )
    await assert.rejects(
      listToolReferences(
        kodyEnv,
        { ...scope, userId: second },
        { ...options, query: '' },
      ),
      /access/,
    )
    await assert.rejects(
      refreshToolReferences(
        kodyEnv,
        scope,
        options,
        serverId,
        AbortSignal.timeout(10000),
        async () => ({ ...catalog, complete: false }),
      ),
      /incomplete/,
    )
    await accounts.command({
      type: 'enabled',
      id,
      commandId: crypto.randomUUID(),
      expectedRevision: 1,
      enabled: false,
    })
    await assert.rejects(
      resolveToolReference(
        kodyEnv,
        scope,
        { serverId, toolName: 'calendar_search' },
        options,
      ),
      /unavailable/,
    )
    assert.equal(
      (
        await listToolReferences(kodyEnv, scope, {
          ...options,
          query: 'calendar',
        })
      ).items.some(
        (item) => item.kind === 'tool' && item.serverId === serverId,
      ),
      false,
    )
    console.log(
      'Passed: generic MCP tool catalog refresh, local search and exact reference resolution, private scope, incomplete catalog rejection, and disabled connection exclusion.',
    )
  }
  {
    const raw = {
      content: [],
      structuredContent: {
        result: {
          format: 'gum-kody-inventory-v3',
          capabilities: [
            {
              identity: 'activityRead',
              name: 'activityRead',
              description: 'Read recent activity',
              domain: 'activity',
              source: 'builtin',
            },
          ],
          exports: [
            {
              identity: '["kody:@example/slack/read","default"]',
              name: 'kody:@example/slack/read#default',
              description: 'List conversations',
              importSpecifier: 'kody:@example/slack/read',
              exportName: 'default',
              packageId: 'slack',
              subpath: './read',
            },
          ],
          packages: [
            {
              packageId: 'slack',
              name: '@example/slack',
              description: 'Saved Slack helpers',
            },
          ],
          counts: { domains: 1, packages: 1, advertisedCapabilities: 1 },
          issues: [],
          package_secrets: [{ value: 'never store this' }],
        },
      },
    }
    const scope = { workspaceId: main.workspace.id, userId: first },
      options = { policy: defaultPolicy, fixture: false }
    const call: typeof kodyCall = async () => raw
    await refreshKodyReferences(
      kodyEnv,
      scope,
      options,
      AbortSignal.timeout(10000),
      call,
    )
    const found = await listKodyReferences(kodyEnv, scope, {
      ...options,
      query: 'recent activity',
    })
    assert.ok(
      found.items.some(
        (item) =>
          item.kind === 'kody' && item.entity === 'capability:activityRead',
      ),
    )
    const resolvedCapability = await resolveKodyReference(
      kodyEnv,
      scope,
      { entity: 'capability:activityRead' },
      options,
      call,
    )
    assert.ok(resolvedCapability.kind === 'kody')
    assert.equal(resolvedCapability.entity, 'capability:activityRead')
    const [before] =
      await sql`SELECT data_revision::integer AS data_revision FROM chat_kody_reference_catalog WHERE user_id=${first}`
    assert.ok(before.data_revision > 0)
    await refreshKodyReferences(
      kodyEnv,
      scope,
      options,
      AbortSignal.timeout(10000),
      call,
    )
    assert.equal(
      (
        await sql`SELECT data_revision::integer AS data_revision FROM chat_kody_reference_catalog WHERE user_id=${first}`
      )[0].data_revision,
      before.data_revision,
      'identical inventory retains its published rows',
    )
    await assert.rejects(
      listKodyReferences(
        kodyEnv,
        { ...scope, userId: second },
        { ...options, query: '' },
      ),
      /access|connection/,
    )
    const storage =
      await sql`SELECT payload::text AS payload FROM chat_kody_reference_items WHERE user_id=${first}`
    assert.equal(
      storage.some((row) => row.payload.includes('never store this')),
      false,
    )
    console.log(
      'Passed: staged Kody capability publication, local search, exact reference resolution, unchanged inventory reuse, foreign account denial, and secret projection exclusion.',
    )
  }
  {
    const botId = crypto.randomUUID(),
      conversationId = crypto.randomUUID()
    await sql`INSERT INTO chat_bots(id,workspace_id,name) VALUES(${botId},${main.workspace.id},'Reference discovery target')`
    await sql`INSERT INTO chat_conversations(id,bot_id,user_id) VALUES(${conversationId},${botId},${first})`
    await sql`INSERT INTO chat_conversation_mains(bot_id,user_id,conversation_id) VALUES(${botId},${first},${conversationId})`
    const env: ReferenceEnvironment = {
      ...kodyEnv,
      ...fileEnv,
      CONVERSATIONS: {
        getByName() {
          return {
            async referenceContext() {
              throw new Error('Metadata discovery must not read a transcript')
            },
          }
        },
      },
    }
    const scope = { workspaceId: main.workspace.id, userId: first },
      options = { policy: defaultPolicy, fixture: true }
    const discovered = await discoverWorkspaceConversations(env, scope, {
      query: 'reference DISCOVERY',
      state: 'active',
    })
    assert.equal(discovered.items.length, 1)
    assert.equal(discovered.items[0].kind, 'conversation')
    assert.equal(discovered.items[0].conversationId, conversationId)
    const picker = await listMessageReferences(env, scope, {
      ...options,
      kind: 'conversation',
      query: 'reference discovery',
    })
    assert.equal(picker.items.length, 1)
    const resolved = await resolveMessageReferences(
      env,
      scope,
      [{ kind: 'conversation', botId, conversationId }],
      options,
    )
    assert.ok(resolved.references[0].kind === 'conversation')
    assert.equal(resolved.references[0].conversationId, conversationId)
    await assert.rejects(
      discoverWorkspaceConversations(
        env,
        { ...scope, userId: second },
        { query: '' },
      ),
      /access/,
    )
    const self = { ...scope, botId, conversationId }
    assert.equal(
      (
        await listMessageReferences(env, self, {
          ...options,
          kind: 'conversation',
          query: 'reference discovery',
        })
      ).items.length,
      0,
    )
    await assert.rejects(
      resolveMessageReferences(
        env,
        self,
        [{ kind: 'conversation', botId, conversationId }],
        options,
      ),
      /already in context/,
    )
    await sql`UPDATE chat_bots SET archived_at=now() WHERE id=${botId}`
    assert.equal(
      (
        await discoverWorkspaceConversations(env, scope, {
          query: 'reference discovery',
          state: 'active',
        })
      ).items.length,
      0,
    )
    const archived = await discoverWorkspaceConversations(env, scope, {
      query: 'reference discovery',
      state: 'archived',
    })
    assert.equal(archived.items[0].detail, 'Archived')
    const filePicker = await listMessageReferences(env, scope, {
      ...options,
      kind: 'file',
      query: '',
    })
    assert.ok(filePicker.items.length > 0)
    assert.ok(filePicker.items[0].kind === 'file')
    assert.equal(typeof filePicker.items[0].recentAt, 'number')
    await sql`UPDATE chat_bots SET deleted_at=now() WHERE id=${botId}`
    assert.equal(
      (
        await discoverWorkspaceConversations(env, scope, {
          query: 'reference discovery',
          state: 'all',
        })
      ).items.length,
      0,
    )
    await assert.rejects(
      resolveMessageReferences(
        env,
        scope,
        [{ kind: 'conversation', botId, conversationId }],
        options,
      ),
      /unavailable/,
    )
    console.log(
      'Passed: original message-reference metadata discovery, picker and exact resolution, self exclusion, private scope, archive filtering, deleted-source rejection, file metadata, and no transcript RPC during discovery.',
    )
  }
  {
    const identity = {
      workspaceId: main.workspace.id,
      userId: first,
      botId: main.assistantId,
      conversationId: main.conversationId,
    }
    const prompt = {
      id: 'prepare-retry-request',
      role: 'user' as const,
      parts: [{ type: 'text' as const, content: 'Original retry request' }],
    }
    const projection = projectRetryTurn({
      id: prompt.id,
      messages: [
        prompt,
        {
          id: 'prepare-retry-answer',
          role: 'assistant',
          parts: [{ type: 'text', content: 'Original answer' }],
        },
      ],
      approvals: [],
      outcome: { status: 'done', answerId: 'prepare-retry-answer' },
    })
    const review = {
      ...projection,
      boundary: {
        kind: 'message' as const,
        epoch: 'prepare-retry-epoch',
        messageId: prompt.id,
        expectedDigest: await copyHash(
          canonicalCopyJson(copyBoundaryMessage(prompt)),
        ),
        side: 'before' as const,
      },
      evidenceDigest: await copyHash(canonicalCopyJson(projection)),
      inheritedEvidence: [],
      reviewDigest: '',
    }
    review.reviewDigest = await copyHash(retryReviewPayload(review))
    let captures = 0,
      snapshot: RetryPreparationSnapshot = {}
    const env: RetryEnvironment = {
      ...kodyEnv,
      ...fileEnv,
      CONVERSATIONS: {
        getByName() {
          return {
            async bindIdentity() {},
            async captureRetrySourceJson() {
              captures++
              return JSON.stringify({ ok: true, source: review })
            },
            async retryPreparationSnapshot() {
              return snapshot
            },
            async wakeCopies() {},
            async copyBoundary() {
              return { ok: true as const, boundary: review.boundary }
            },
            async importCopyPages() {
              return { accepted: true as const }
            },
            async finishCopyImport(id: string, digest: string) {
              return { status: 'ready' as const, operationId: id, digest }
            },
            async discardCopyImport() {},
            async activateCopy() {},
            async referenceContext() {
              throw new Error('Unexpected transcript read')
            },
          }
        },
      },
    }
    const service = new ConversationRetries(env, main.workspace.id, first),
      options = { policy: defaultPolicy, fixture: true },
      input = { idempotencyKey: crypto.randomUUID(), messageId: prompt.id }
    const created = await Promise.all(
      Array.from({ length: 8 }, () => service.create(identity, input, options)),
    )
    assert.equal(new Set(created.map((v) => v.attemptId)).size, 1)
    assert.ok(created.every((v) => v.status === 'preparing'))
    const attemptId = created[0].attemptId,
      captured = captures
    assert.equal(
      (await service.create(identity, input, options)).attemptId,
      attemptId,
    )
    assert.equal(captures, captured, 'replay uses the frozen review')
    await assert.rejects(
      service.create(identity, { ...input, messageId: 'different' }, options),
      /different request/,
    )
    await assert.rejects(
      new ConversationRetries(env, main.workspace.id, second).get(attemptId),
      /not found/,
    )
    const [copy] =
      await sql`SELECT * FROM chat_conversation_copies WHERE retry_id=${attemptId}`
    assert.ok(copy)
    assert.equal(
      (
        await sql`SELECT count(*)::integer AS count FROM chat_conversation_copies WHERE retry_id=${attemptId}`
      )[0].count,
      1,
    )
    await sql`INSERT INTO chat_bots(id,workspace_id,name,parent_id) VALUES(${copy.target_bot_id},${main.workspace.id},'Retry service target',${main.assistantId})`
    await sql`INSERT INTO chat_conversations(id,bot_id,user_id) VALUES(${copy.target_conversation_id},${copy.target_bot_id},${first})`
    await sql`INSERT INTO chat_conversation_mains(bot_id,user_id,conversation_id) VALUES(${copy.target_bot_id},${first},${copy.target_conversation_id})`
    await sql`UPDATE chat_conversation_copies SET status='ready',phase='done' WHERE id=${copy.id}`
    const ready = await service.prepare(attemptId, options)
    assert.equal(ready.status, 'ready')
    assert.equal(ready.target?.conversationId, copy.target_conversation_id)
    assert.equal(ready.draft?.request.text, 'Original retry request')
    assert.equal(ready.draft?.evidenceDigest, review.evidenceDigest)
    const beforeRead = captures
    assert.equal((await service.get(attemptId)).status, 'ready')
    assert.equal(
      captures,
      beforeRead,
      'status reads never capture or submit a request',
    )
    snapshot = {
      submittedMessageId: 'explicitly-submitted',
      submittedDraftRevision: 2,
    }
    const submitted = await service.get(attemptId)
    assert.equal(submitted.submittedMessageId, 'explicitly-submitted')
    assert.equal(submitted.draft, undefined)
    snapshot = { reset: true }
    const reset = await service.get(attemptId)
    assert.equal(reset.status, 'failed')
    assert.equal(reset.error?.code, 'target_reset')
    assert.equal(reset.draft, undefined)
    snapshot = {}
    await sql`UPDATE chat_bots SET archived_at=now() WHERE id=${copy.target_bot_id}`
    await assert.rejects(service.get(attemptId), /Restore/)
    const failure = await service.create(
      identity,
      { ...input, idempotencyKey: crypto.randomUUID() },
      options,
    )
    await sql`UPDATE chat_conversation_copies SET status='failed',error_code='test-copy-failure',error_message='Copy stopped' WHERE retry_id=${failure.attemptId}`
    const failed = await service.prepare(failure.attemptId, options)
    assert.equal(failed.status, 'failed')
    assert.equal(failed.error?.code, 'test-copy-failure')
    console.log(
      'Passed: full retry service concurrent receipt and copy admission, frozen replay, private reads, ready draft publication, inert status reads, explicit submission and reset handling, inactive target denial, and copy failure propagation.',
    )
  }
  {
    const scope = { workspaceId: main.workspace.id, userId: first },
      options = { policy: defaultPolicy, fixture: false }
    const response = (fingerprint: string) => ({
      content: [],
      structuredContent: {
        result: {
          format: 'banks-kody-account-index-v2',
          fingerprint,
          counts: { packages: 1, domains: 1, servers: 1 },
        },
      },
    })
    let calls = 0
    const call: typeof kodyCall = async () => {
      calls++
      return response('a'.repeat(64))
    }
    const probes = await Promise.all(
      Array.from({ length: 8 }, () =>
        probeKodyAccount(
          kodyEnv,
          scope,
          options,
          AbortSignal.timeout(10000),
          call,
        ),
      ),
    )
    assert.equal(probes.filter(Boolean).length, 1)
    assert.equal(calls, 1)
    assert.equal(
      (
        await sql`SELECT fetched_at::integer AS value FROM chat_kody_reference_catalog WHERE user_id=${first}`
      )[0].value,
      0,
    )
    await sql`UPDATE chat_kody_reference_catalog SET fetched_at=999 WHERE user_id=${first}`
    await sql`UPDATE chat_kody_account_probe SET checked_at=0 WHERE user_id=${first}`
    assert.equal(
      await probeKodyAccount(
        kodyEnv,
        scope,
        options,
        AbortSignal.timeout(10000),
        call,
      ),
      false,
    )
    assert.equal(
      (
        await sql`SELECT fetched_at::integer AS value FROM chat_kody_reference_catalog WHERE user_id=${first}`
      )[0].value,
      999,
    )
    await sql`UPDATE chat_kody_account_probe SET checked_at=0 WHERE user_id=${first}`
    let release: (
        value: Awaited<ReturnType<typeof kodyCall>>,
      ) => void = () => {},
      entered: () => void = () => {}
    const waiting = new Promise<void>((resolve) => {
      entered = resolve
    })
    const oldCall: typeof kodyCall = async () => {
      entered()
      return new Promise((resolve) => {
        release = resolve
      })
    }
    const old = probeKodyAccount(
      kodyEnv,
      scope,
      options,
      AbortSignal.timeout(10000),
      oldCall,
    )
    await waiting
    await sql`UPDATE chat_kody_account_probe SET checked_at=0 WHERE user_id=${first}`
    const latestCall: typeof kodyCall = async () => response('b'.repeat(64))
    assert.equal(
      await probeKodyAccount(
        kodyEnv,
        scope,
        options,
        AbortSignal.timeout(10000),
        latestCall,
      ),
      true,
    )
    release(response('c'.repeat(64)))
    assert.equal(await old, false)
    assert.equal(
      (
        await sql`SELECT source_fingerprint FROM chat_kody_account_probe WHERE user_id=${first}`
      )[0].source_fingerprint,
      'banks-kody-account-index-v2:' + 'b'.repeat(64),
    )
    assert.equal(
      await probeKodyAccount(
        kodyEnv,
        { ...scope, userId: second },
        options,
        AbortSignal.timeout(10000),
        call,
      ),
      false,
    )
    await sql`UPDATE chat_kody_account_probe SET checked_at=0 WHERE user_id=${first}`
    const failure: typeof kodyCall = async () => {
      throw new Error('Probe failed')
    }
    await assert.rejects(
      probeKodyAccount(
        kodyEnv,
        scope,
        options,
        AbortSignal.timeout(10000),
        failure,
      ),
      /Probe failed/,
    )
    assert.equal(
      (
        await sql`SELECT checked_at::integer AS value FROM chat_kody_account_probe WHERE user_id=${first}`
      )[0].value,
      0,
    )
    await invalidateKodyCatalogs(kodyEnv, first)
    assert.equal(
      (
        await sql`SELECT fetched_at::integer AS value FROM chat_kody_account_reference_catalog WHERE user_id=${first}`
      )[0].value,
      0,
    )
    console.log(
      'Passed: concurrent Kody probe suppression, changed-account invalidation, unchanged cache retention, superseded refresh rejection, foreign account exclusion, failed-probe recovery, and explicit action invalidation.',
    )
  }
  {
    const clock = async () =>
      (
        await sql`SELECT revision::integer AS revision FROM chat_workspace_sync_clock WHERE workspace_id=${main.workspace.id}`
      )[0].revision
    const sectionId = crypto.randomUUID(),
      foreignSection = crypto.randomUUID()
    const before = await clock()
    await sql`INSERT INTO chat_bot_sections(id,workspace_id,user_id,name) VALUES(${sectionId},${main.workspace.id},${first},'Work')`
    assert.equal(await clock(), before + 1)
    await sql`INSERT INTO chat_bot_sections(id,workspace_id,user_id,name) VALUES(${foreignSection},${main.workspace.id},${second},'Foreign')`
    const viewerBefore = await clock()
    await sql`INSERT INTO chat_bot_viewer_state(bot_id,user_id,section_id,pinned,tags) VALUES(${main.assistantId},${first},${sectionId},true,'["test"]')`
    assert.equal(await clock(), viewerBefore + 1)
    await assert.rejects(
      sql`UPDATE chat_bot_viewer_state SET section_id=${foreignSection} WHERE bot_id=${main.assistantId} AND user_id=${first}`,
      /Section is not available/,
    )
    const projection = await readSyncProjection(main.workspace.id, first)
    assert.ok(projection)
    assert.equal(projection.revision, await clock())
    const assistant = projection.state.bots.find(
      (bot) => bot.id === main.assistantId,
    )
    assert.ok(assistant)
    assert.equal(assistant.mainConversationId, main.conversationId)
    assert.equal(assistant.pinned, true)
    assert.equal(assistant.section_id, sectionId)
    assert.deepEqual(assistant.tags, ['test'])
    assert.equal(typeof assistant.created_at, 'number')
    assert.ok(
      projection.state.sections.some((section) => section.id === sectionId),
    )
    assert.equal(
      projection.state.sections.some(
        (section) => section.id === foreignSection,
      ),
      false,
    )
    assert.equal(await readSyncProjection(main.workspace.id, second), undefined)
    assert.equal(await syncMembership(main.workspace.id, second), undefined)
    assert.deepEqual(
      await readWorkspaceBots(main.workspace.id, first),
      projection.state.bots,
    )
    for (const expected of projection.state.bots)
      assert.deepEqual(
        await readWorkspaceBot(main.workspace.id, first, expected.id),
        expected,
      )
    await assert.rejects(
      readWorkspaceBot(main.workspace.id, first, crypto.randomUUID()),
      (error) =>
        error instanceof Error && error.message === 'Conversation not found.',
    )
    await assert.rejects(
      readWorkspaceBot(other.workspace.id, first, main.assistantId),
      (error) =>
        error instanceof Error && error.message === 'Conversation not found.',
    )
    assert.deepEqual(
      await readBotSections(main.workspace.id, first),
      projection.state.sections,
    )
    assert.equal(
      (await readBotSections(main.workspace.id, second)).some(
        (section) => section.id === sectionId,
      ),
      false,
    )
    const discoveredSections = await readBotSections(main.workspace.id, first, {
      query: 'WORK',
      afterId: '',
    })
    assert.equal(discoveredSections.length, 1)
    assert.equal(discoveredSections[0].id, sectionId)
    await sql`INSERT INTO chat_bot_sections(id,workspace_id,user_id,name,position) SELECT 'paged-section-'||lpad(i::text,3,'0'),${main.workspace.id},${first},'Pagination test',105-i FROM generate_series(1,105) i`
    const firstPage = await readBotSections(main.workspace.id, first, {
      query: 'pagination test',
    })
    assert.equal(firstPage.length, 101)
    assert.equal(firstPage[0].id, 'paged-section-001')
    const nextPage = await readBotSections(main.workspace.id, first, {
      query: 'pagination test',
      afterId: firstPage[99].id,
    })
    assert.equal(nextPage.length, 5)
    assert.equal(nextPage[0].id, 'paged-section-101')
    await sql`DELETE FROM chat_bot_sections WHERE workspace_id=${main.workspace.id} AND id LIKE 'paged-section-%'`
    console.log(
      'Passed: original workspace sidebar read projection equality, viewer-private sections, case-insensitive section search, bounded 101-row discovery, and stable ID pagination independent of display order.',
    )
    const metadataBefore = await clock()
    await sql`UPDATE chat_bots SET version=version+1,updated_at=now() WHERE id=${main.assistantId}`
    assert.equal(await clock(), metadataBefore + 1)
    await sql`DELETE FROM chat_bot_sections WHERE id=${sectionId}`
    assert.equal(
      (
        await sql`SELECT section_id FROM chat_bot_viewer_state WHERE bot_id=${main.assistantId} AND user_id=${first}`
      )[0].section_id,
      null,
    )
    const [old] =
      await sql`SELECT generation FROM chat_workspace_sync_members WHERE workspace_id=${main.workspace.id} AND user_id=${first}`
    await sql`DELETE FROM chat_memberships WHERE workspace_id=${main.workspace.id} AND user_id=${first}`
    assert.equal(
      (
        await sql`SELECT generation FROM chat_workspace_sync_members WHERE workspace_id=${main.workspace.id} AND user_id=${first}`
      ).length,
      0,
    )
    assert.equal(await readSyncProjection(main.workspace.id, first), undefined)
    assert.equal(await syncMembership(main.workspace.id, first), undefined)
    await sql`INSERT INTO chat_memberships(workspace_id,user_id,role) VALUES(${main.workspace.id},${first},'owner')`
    const [joined] =
      await sql`SELECT generation FROM chat_workspace_sync_members WHERE workspace_id=${main.workspace.id} AND user_id=${first}`
    assert.notEqual(joined.generation, old.generation)
    assert.equal(
      (await readSyncProjection(main.workspace.id, first))?.generation,
      joined.generation,
    )
    console.log(
      'Passed: workspace clock initialization and sidebar dirty revisions, private section assignment guard, section removal clearing assignments, and revoked/rejoined membership generation rotation.',
    )
  }
  {
    let published = 0
    const service = new WorkspaceSections(
      {
        WORKSPACE_SYNC: {
          getByName: () => ({
            publish: async () => {
              published++
            },
          }),
        },
      },
      main.workspace.id,
      first,
    )
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        service.createSection({ name: 'Section ' + i }),
      ),
    )
    const sections = await readBotSections(main.workspace.id, first)
    assert.equal(new Set(created.map((item) => item.id)).size, 8)
    assert.deepEqual(
      sections.map((section) => section.position),
      [0, 1, 2, 3, 4, 5, 6, 7],
    )
    const last = sections.at(-1)!
    const moved = await service.patchSection(last.id, {
      version: last.version,
      position: 0,
      name: 'Moved',
      sortOverride: 'name',
    })
    assert.equal(moved.sections[0].id, last.id)
    assert.deepEqual(
      moved.sections.map((section) => section.position),
      [0, 1, 2, 3, 4, 5, 6, 7],
    )
    assert.equal(moved.sections[0].version, 1)
    assert.equal(moved.sections[0].sort_override, 'name')
    const edits = await Promise.allSettled([
      service.patchSection(last.id, { version: 1, name: 'First edit' }),
      service.patchSection(last.id, { version: 1, name: 'Second edit' }),
    ])
    assert.equal(
      edits.filter((result) => result.status === 'fulfilled').length,
      1,
    )
    assert.equal(
      edits.filter((result) => result.status === 'rejected').length,
      1,
    )
    await assert.rejects(
      service.patchSection(last.id, { version: 0, name: 'Stale' }),
      /changed/,
    )
    await assert.rejects(
      new WorkspaceSections({}, main.workspace.id, second).deleteSection(
        last.id,
      ),
      /not found/,
    )
    await sql`UPDATE chat_bot_viewer_state SET section_id=${last.id} WHERE bot_id=${main.assistantId} AND user_id=${first}`
    await service.deleteSection(last.id)
    assert.equal(
      (
        await sql`SELECT section_id FROM chat_bot_viewer_state WHERE bot_id=${main.assistantId} AND user_id=${first}`
      )[0].section_id,
      null,
    )
    await assert.rejects(service.deleteSection(last.id), /not found/)
    assert.ok(published >= 11)
    console.log(
      'Passed: original section commands with concurrent position allocation, atomic reorder and versions, one winning competing edit, stale edit denial, private deletion, cascading assignment cleanup, and sync wakeups.',
    )
  }
  {
    const service = new WorkspaceSections({}, main.workspace.id, first)
    const old = await service.createSection({ name: 'Old section' }),
      target = await service.createSection({ name: 'Target section' })
    const ids = [main.assistantId, own[0].bot.id]
    const firstMove = await service.setSections(
      ids.map((id) => ({ id, sectionId: old.id })),
    )
    assert.ok(firstMove.every((result) => result.ok))
    await service.setSections([{ id: ids[0], sectionId: target.id }])
    assert.ok(
      (await readBotSections(main.workspace.id, first)).some(
        (section) => section.id === old.id,
      ),
      'occupied old section stays',
    )
    await service.setSections([{ id: ids[1], sectionId: target.id }])
    assert.equal(
      (await readBotSections(main.workspace.id, first)).some(
        (section) => section.id === old.id,
      ),
      false,
      'empty previous section is removed',
    )
    const foreignSection = (await readBotSections(main.workspace.id, second))[0]
      .id
    await assert.rejects(
      service.setSections([
        { id: ids[0], sectionId: null },
        { id: ids[1], sectionId: foreignSection },
      ]),
      /Section not found/,
    )
    assert.ok(
      (await readWorkspaceBots(main.workspace.id, first))
        .filter((bot) => ids.includes(bot.id))
        .every((bot) => bot.section_id === target.id),
      'invalid batch leaves all assignments unchanged',
    )
    await assert.rejects(
      service.setSections([
        { id: ids[0], sectionId: null },
        { id: ids[0], sectionId: null },
      ]),
      /only once/,
    )
    await sql`UPDATE chat_bots SET deleted_at=now() WHERE id=${ids[1]}`
    await assert.rejects(
      service.setSections(ids.map((id) => ({ id, sectionId: null }))),
      /Trash/,
    )
    assert.equal(
      (await readWorkspaceBots(main.workspace.id, first)).find(
        (bot) => bot.id === ids[0],
      )?.section_id,
      target.id,
    )
    await sql`UPDATE chat_bots SET deleted_at=NULL WHERE id=${ids[1]}`
    const left = await service.createSection({ name: 'Left section' }),
      right = await service.createSection({ name: 'Right section' })
    const competing = await Promise.allSettled([
      service.setSections([{ id: ids[0], sectionId: left.id }]),
      service.setSections([{ id: ids[0], sectionId: right.id }]),
    ])
    assert.equal(
      competing.filter((result) => result.status === 'fulfilled').length,
      1,
    )
    assert.equal(
      competing.filter((result) => result.status === 'rejected').length,
      1,
    )
    await assert.rejects(
      new WorkspaceSections({}, main.workspace.id, second).setSections([
        { id: ids[0], sectionId: null },
      ]),
      /not found/,
    )
    console.log(
      'Passed: original bulk section assignment, occupied-section retention, empty-section cleanup, all-or-nothing invalid batches, duplicate/deleted selection rejection, stale competing assignment rejection, and foreign membership denial.',
    )
  }
  {
    const expected =
      await sql`SELECT c.id FROM chat_conversations c JOIN chat_bots b ON b.id=c.bot_id WHERE b.workspace_id=${main.workspace.id} AND c.bot_id=${main.assistantId} ORDER BY c.created_at,c.id`
    const bound: string[] = [],
      released: string[] = [],
      tokens = new Set<string>()
    const env: WorkspaceLifecycleEnvironment = {
      CONVERSATIONS: {
        getByName: (id: string) => ({
          async bindIdentity(identity) {
            assert.equal(identity.conversationId, id)
            assert.equal(identity.workspaceId, main.workspace.id)
            bound.push(id)
          },
          async reserveDeletion(token) {
            tokens.add(token)
            return { reserved: true }
          },
          async releaseDeletion(token) {
            tokens.add(token)
            released.push(id)
          },
        }),
      },
    }
    const reserved = await reserveWorkspaceConversations(
      env,
      main.workspace.id,
      [main.assistantId, foreign.bot.id],
    )
    assert.deepEqual(
      reserved.conversationIds,
      expected.map((row) => row.id),
    )
    assert.deepEqual(
      bound,
      expected.map((row) => row.id),
    )
    assert.equal(tokens.size, 1)
    assert.ok(reserved.expiresAt > Date.now())
    await reserved.release()
    assert.deepEqual(
      released,
      expected.map((row) => row.id),
    )
    let checks = 0
    released.length = 0
    const busy: WorkspaceLifecycleEnvironment = {
      CONVERSATIONS: {
        getByName: (id: string) => ({
          async bindIdentity() {},
          async reserveDeletion() {
            checks++
            return checks === 2
              ? { reserved: false, executionSession: true }
              : { reserved: true }
          },
          async releaseDeletion() {
            released.push(id)
          },
        }),
      },
    }
    assert.ok(expected.length >= 2)
    await assert.rejects(
      reserveWorkspaceConversations(busy, main.workspace.id, [
        main.assistantId,
      ]),
      /execution session/,
    )
    assert.deepEqual(
      released,
      [expected[0].id],
      'earlier reservations are released when a later conversation is busy',
    )
    assert.equal(
      (
        await reserveWorkspaceConversations(env, main.workspace.id, [
          foreign.bot.id,
        ])
      ).conversationIds.length,
      0,
    )
    console.log(
      'Passed: original lifecycle reservation workspace scope, all selected main and thread identities, one shared reservation token, explicit release, active execution denial, and failure cleanup.',
    )
  }
  {
    const root = crypto.randomUUID(),
      child = crypto.randomUUID(),
      leaf = crypto.randomUUID()
    await sql`INSERT INTO chat_bots(id,workspace_id,name) VALUES (${root},${main.workspace.id},'Hierarchy root')`
    await sql`INSERT INTO chat_bots(id,workspace_id,parent_id,name) VALUES (${child},${main.workspace.id},${root},'Hierarchy child')`
    await sql`INSERT INTO chat_bots(id,workspace_id,parent_id,name) VALUES (${leaf},${main.workspace.id},${child},'Hierarchy leaf')`
    await assert.rejects(
      sql`UPDATE chat_bots SET parent_id=${leaf} WHERE id=${root}`,
      /own ancestor/,
    )
    await assert.rejects(
      sql`UPDATE chat_bots SET parent_id=${root} WHERE id=${root}`,
      /own ancestor/,
    )
    await sql`UPDATE chat_bots SET archived_at=now() WHERE id=${root}`
    await assert.rejects(
      sql`INSERT INTO chat_bots(id,workspace_id,parent_id,name) VALUES (${crypto.randomUUID()},${main.workspace.id},${root},'Unavailable')`,
      /Parent bot is not available/,
    )
    await assert.rejects(
      sql`UPDATE chat_bots SET parent_id=${root} WHERE id=${leaf}`,
      /Parent bot is not available/,
    )
    await sql`UPDATE chat_bots SET archived_at=NULL WHERE id=${root}`
    await sql`UPDATE chat_bots SET parent_id=${root} WHERE id=${leaf}`
    const a = crypto.randomUUID(),
      b = crypto.randomUUID()
    await sql`INSERT INTO chat_bots(id,workspace_id,name) VALUES (${a},${main.workspace.id},'Concurrent A'),(${b},${main.workspace.id},'Concurrent B')`
    const moves = await Promise.allSettled([
      sql`UPDATE chat_bots SET parent_id=${b} WHERE id=${a}`,
      sql`UPDATE chat_bots SET parent_id=${a} WHERE id=${b}`,
    ])
    assert.equal(
      moves.filter((result) => result.status === 'fulfilled').length,
      1,
      'opposing concurrent moves cannot both commit',
    )
    const parents =
      await sql`SELECT id,parent_id FROM chat_bots WHERE id IN (${a},${b})`
    assert.equal(parents.filter((row) => row.parent_id !== null).length, 1)
    await sql`UPDATE chat_bots SET archived_at=now() WHERE id IN (${root},${child},${leaf},${a},${b})`
    console.log(
      'Passed: source hierarchy guards reject self/descendant cycles and unavailable parents, preserving active parent moves.',
    )
  }
  {
    let wakes = 0
    const released: string[] = []
    const commandEnv = {
      WORKSPACE_SYNC: {
        getByName: () => ({
          async publish() {
            wakes++
          },
        }),
      },
      CONVERSATIONS: {
        getByName: (id: string) => ({
          async bindIdentity() {},
          async reserveDeletion() {
            return { reserved: true }
          },
          async releaseDeletion() {
            released.push(id)
          },
        }),
      },
    }
    const commands = new BotWorkspace(commandEnv, main.workspace.id, first)
    const created = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        commands.create({
          name: `Source created ${i}`,
          purpose: 'Port verification',
        }),
      ),
    )
    assert.equal(new Set(created.map((result) => result.id)).size, 6)
    for (const result of created) {
      assert.equal(result.bot.mainConversationId, `chat:${result.id}:${first}`)
      assert.equal(result.bot.purpose, 'Port verification')
      assert.equal(result.bot.version, 0)
      assert.deepEqual(await commands.get(result.id), result.bot)
    }
    const child = await commands.create({
      name: 'Source nested',
      parentId: created[0].id,
    })
    assert.equal(child.bot.parent_id, created[0].id)
    await assert.rejects(
      commands.create({ name: 'Foreign parent', parentId: foreign.bot.id }),
      /Conversation not found/,
    )
    await sql`UPDATE chat_bots SET archived_at=now() WHERE id=${created[0].id}`
    await assert.rejects(
      commands.create({ name: 'Inactive parent', parentId: created[0].id }),
      /active parent/,
    )
    await assert.rejects(
      new BotWorkspace(commandEnv, main.workspace.id, second).create({
        name: 'Foreign workspace',
      }),
      /Workspace access/,
    )
    await assert.rejects(commands.create({ name: ' ' }))
    assert.ok(wakes >= 7)
    const sectionA = await commands.createSection({ name: 'Organization A' })
    const sectionB = await commands.createSection({ name: 'Organization B' })
    const organized = await commands.organize(created[5].id, {
      sectionId: sectionA.id,
      tags: ['one', 'one'],
    })
    assert.deepEqual(organized.bot.tags, ['one'])
    assert.equal(organized.bot.section_id, sectionA.id)
    await Promise.all([
      commands.organize(created[5].id, { pinned: true }),
      commands.organize(created[5].id, { tags: ['two'] }),
    ])
    const merged = await commands.get(created[5].id)
    assert.equal(merged.pinned, true)
    assert.deepEqual(merged.tags, ['two'])
    const otherView = await readWorkspaceBot(
      main.workspace.id,
      second,
      created[5].id,
    )
    assert.equal(otherView.pinned, false)
    assert.equal(otherView.section_id, null)
    assert.deepEqual(otherView.tags, [])
    await commands.organize(created[5].id, {
      sectionId: sectionB.id,
      pinned: false,
      position: 0,
    })
    assert.ok(
      !(await readBotSections(main.workspace.id, first)).some(
        (section) => section.id === sectionA.id,
      ),
      'moving last member removes empty previous section',
    )
    assert.equal((await commands.get(created[5].id)).position, 0)
    await commands.organize(created[1].id, { sectionId: sectionB.id })
    await commands.organize(created[2].id, { sectionId: sectionB.id })
    await commands.organize(created[2].id, { position: 0 })
    let ordered = (await readWorkspaceBots(main.workspace.id, first))
      .filter((bot) => bot.section_id === sectionB.id)
      .sort((a, b) => a.position - b.position)
    assert.deepEqual(
      ordered.map((bot) => bot.position),
      [0, 1, 2],
    )
    assert.equal(ordered[0].id, created[2].id)
    await commands.organize(created[2].id, { position: 999 })
    ordered = (await readWorkspaceBots(main.workspace.id, first))
      .filter((bot) => bot.section_id === sectionB.id)
      .sort((a, b) => a.position - b.position)
    assert.deepEqual(
      ordered.map((bot) => bot.position),
      [0, 1, 2],
    )
    assert.equal(ordered[2].id, created[2].id)
    await assert.rejects(
      commands.organize(created[5].id, { sectionId: crypto.randomUUID() }),
      /Section not found/,
    )
    assert.equal((await commands.get(created[5].id)).section_id, sectionB.id)
    console.log(
      'Passed: source viewer organization, deduplicated tags, concurrent supplied-field merging, private viewer state, dense positioning, empty section cleanup, and invalid-section rollback.',
    )
    const renamed = await commands.patch(created[1].id, {
      version: 0,
      name: 'Edited',
      purpose: 'Updated',
    })
    assert.equal(renamed.bot.version, 1)
    assert.equal(renamed.bot.name, 'Edited')
    assert.equal(renamed.bot.purpose, 'Updated')
    await assert.rejects(
      commands.patch(created[1].id, { version: 0, name: 'Stale' }),
      /changed in another window/,
    )
    const edits = await Promise.allSettled([
      commands.patch(created[1].id, { version: 1, name: 'One' }),
      commands.patch(created[1].id, { version: 1, name: 'Two' }),
    ])
    assert.equal(
      edits.filter((result) => result.status === 'fulfilled').length,
      1,
    )
    assert.equal((await commands.get(created[1].id)).version, 2)
    await assert.rejects(
      commands.patch(main.assistantId, {
        version: (await commands.get(main.assistantId)).version,
        archived: true,
      }),
      /cannot be archived/,
    )
    await assert.rejects(
      commands.patch(created[1].id, { version: 2, parentId: created[1].id }),
      /nested under itself/,
    )
    const archived = await commands.patch(created[2].id, {
      version: 0,
      archived: true,
    })
    assert.ok(archived.bot.archived_at !== null)
    assert.deepEqual(released, [created[2].bot.mainConversationId])
    const restored = await commands.patch(created[2].id, {
      version: 1,
      archived: false,
    })
    assert.equal(restored.bot.archived_at, null)
    await sql`UPDATE chat_bots SET deleted_at=now() WHERE id=${created[3].id}`
    await assert.rejects(
      commands.patch(created[3].id, { version: 0, name: 'Deleted' }),
      /Restore this conversation/,
    )
    await assert.rejects(
      new BotWorkspace(commandEnv, main.workspace.id, second).patch(
        created[1].id,
        { version: 2, name: 'Foreign' },
      ),
      /Workspace access/,
    )
    const lateConversation = crypto.randomUUID()
    const racing = new BotWorkspace(
      {
        ...commandEnv,
        CONVERSATIONS: {
          getByName: (id: string) => ({
            async bindIdentity() {},
            async reserveDeletion() {
              await sql`INSERT INTO chat_conversations(id,bot_id,user_id) VALUES (${lateConversation},${created[4].id},${first})`
              return { reserved: true }
            },
            async releaseDeletion() {
              released.push(id)
            },
          }),
        },
      },
      main.workspace.id,
      first,
    )
    await assert.rejects(
      racing.patch(created[4].id, { version: 0, archived: true }),
      /changed in another window/,
    )
    const unchanged = await commands.get(created[4].id)
    assert.equal(unchanged.version, 0)
    assert.equal(unchanged.archived_at, null)
    assert.equal(released.at(-1), created[4].bot.mainConversationId)
    const groupRoot = await commands.create({ name: 'Move root' })
    const groupChild = await commands.create({
      name: 'Move child',
      parentId: groupRoot.id,
    })
    const groupPeer = await commands.create({ name: 'Move peer' })
    const groupTarget = await commands.create({ name: 'Move target' })
    const beforeMove = await readWorkspaceBots(main.workspace.id, first)
    const moveInput = {
      bots: [
        { id: groupRoot.id, version: 0 },
        { id: groupChild.id, version: 0 },
        { id: groupPeer.id, version: 0 },
      ],
      parentId: groupTarget.id,
      sectionId: sectionB.id,
      pinned: false,
      position: 0,
      layout: botDragLayout(beforeMove),
    }
    const expectedMove = moveBotGroup(beforeMove, moveInput, Date.now())
    const moved = await commands.moveGroup(moveInput)
    assert.deepEqual(
      new Set(moved.movedIds),
      new Set([groupRoot.id, groupPeer.id]),
    )
    const afterMove = await readWorkspaceBots(main.workspace.id, first)
    for (const expected of expectedMove) {
      const actual = afterMove.find((bot) => bot.id === expected.id)
      assert.ok(actual)
      assert.deepEqual(
        [
          actual.parent_id,
          actual.section_id,
          actual.pinned,
          actual.position,
          actual.version,
        ],
        [
          expected.parent_id,
          expected.section_id,
          expected.pinned,
          expected.position,
          expected.version,
        ],
      )
    }
    assert.equal((await commands.get(groupChild.id)).parent_id, groupRoot.id)
    await assert.rejects(commands.moveGroup(moveInput), /order changed/)
    const nextMove = {
      bots: [{ id: groupPeer.id, version: 1 }],
      parentId: null,
      sectionId: null,
      pinned: false,
      position: 0,
      layout: botDragLayout(afterMove),
    }
    const competingMoves = await Promise.allSettled([
      commands.moveGroup(nextMove),
      commands.moveGroup(nextMove),
    ])
    assert.equal(
      competingMoves.filter((result) => result.status === 'fulfilled').length,
      1,
    )
    const latest = await readWorkspaceBots(main.workspace.id, first)
    await assert.rejects(
      commands.moveGroup({
        ...nextMove,
        bots: [{ id: groupRoot.id, version: 1 }],
        parentId: groupChild.id,
        layout: botDragLayout(latest),
      }),
      /nested under itself/,
    )
    await sql`UPDATE chat_bots SET archived_at=now() WHERE id IN (${groupRoot.id},${groupChild.id},${groupPeer.id},${groupTarget.id})`
    console.log(
      'Passed: source group projection equality, ancestor/child deduplication, carried subtree metadata, stale layout denial, one winning competing move, and cycle rejection.',
    )
    const historyBot = await commands.create({ name: 'History checks' })
    const placement = (bot: Awaited<ReturnType<typeof commands.get>>) => ({
      id: bot.id,
      parent_id: bot.parent_id,
      section_id: bot.section_id,
      pinned: bot.pinned,
      position: bot.position,
      archived: bot.archived_at !== null,
    })
    const originalPlacement = placement(await commands.get(historyBot.id))
    const historySection = {
      id: crypto.randomUUID(),
      name: 'History section',
      position: 30,
      sort_override: null,
    }
    const nextPlacement = {
      ...originalPlacement,
      pinned: true,
      section_id: historySection.id,
    }
    const historyChange = {
      bots: [{ before: originalPlacement, after: nextPlacement }],
      sections: [{ before: null, after: historySection }],
    }
    await commands.applyHistory(historyChange)
    assert.equal((await commands.get(historyBot.id)).pinned, true)
    assert.equal(
      (await commands.get(historyBot.id)).section_id,
      historySection.id,
    )
    await assert.rejects(
      commands.applyHistory(historyChange),
      /cannot be undone/,
    )
    await commands.applyHistory({
      bots: [{ before: nextPlacement, after: originalPlacement }],
      sections: [{ before: historySection, after: null }],
    })
    assert.equal((await commands.get(historyBot.id)).pinned, false)
    assert.ok(
      !(await readBotSections(main.workspace.id, first)).some(
        (section) => section.id === historySection.id,
      ),
    )
    const concurrentHistory = {
      bots: [
        {
          before: originalPlacement,
          after: { ...originalPlacement, pinned: true },
        },
      ],
      sections: [],
    }
    const historyResults = await Promise.allSettled([
      commands.applyHistory(concurrentHistory),
      commands.applyHistory(concurrentHistory),
    ])
    assert.equal(
      historyResults.filter((result) => result.status === 'fulfilled').length,
      1,
    )
    const currentHistory = placement(await commands.get(historyBot.id))
    await commands.applyHistory({
      bots: [
        {
          before: currentHistory,
          after: { ...currentHistory, archived: true },
        },
      ],
      sections: [],
    })
    assert.ok((await commands.get(historyBot.id)).archived_at !== null)
    const archivedPlacement = placement(await commands.get(historyBot.id))
    await commands.applyHistory({
      bots: [
        {
          before: archivedPlacement,
          after: { ...archivedPlacement, archived: false },
        },
      ],
      sections: [],
    })
    const unchangedHistory = placement(await commands.get(historyBot.id))
    await assert.rejects(
      commands.applyHistory({
        bots: [
          {
            before: unchangedHistory,
            after: { ...unchangedHistory, pinned: false },
          },
          {
            before: {
              ...placement(await commands.get(created[1].id)),
              position: 9999,
            },
            after: placement(await commands.get(created[1].id)),
          },
        ],
        sections: [],
      }),
      /cannot be undone/,
    )
    assert.deepEqual(
      placement(await commands.get(historyBot.id)),
      unchangedHistory,
      'history conflict rolls back every affected row',
    )
    await sql`UPDATE chat_bots SET archived_at=now() WHERE id=${historyBot.id}`
    console.log(
      'Passed: source history section restoration/removal, undo/redo placement, stale conflict, one winning concurrent history change, archive/unarchive, and atomic conflict rollback.',
    )
    const toolBot = await commands.create({ name: 'Tool settings' })
    const conversationTools = new AssistantConversations(commandEnv, {
      workspaceId: main.workspace.id,
      userId: first,
      botId: main.assistantId,
      conversationId: main.conversationId,
    })
    const inspected = await conversationTools.inspect({
      conversationId: toolBot.bot.mainConversationId,
    })
    assert.equal(inspected.name, 'Tool settings')
    assert.equal(inspected.version, 0)
    assert.equal(inspected.untrusted, true)
    const renamedTool = await conversationTools.rename({
      conversationId: toolBot.bot.mainConversationId,
      version: 0,
      name: 'Tool renamed',
    })
    assert.equal(renamedTool.ok, true)
    await assert.rejects(
      conversationTools.rename({
        conversationId: toolBot.bot.mainConversationId,
        version: 0,
        name: 'Stale tool',
      }),
      /changed in another window/,
    )
    assert.equal(
      (
        await conversationTools.pin({
          conversationId: toolBot.bot.mainConversationId,
          pinned: true,
        })
      ).ok,
      true,
    )
    const toolThread = crypto.randomUUID()
    await sql`INSERT INTO chat_conversations(id,bot_id,user_id) VALUES (${toolThread},${toolBot.id},${first})`
    await sql`INSERT INTO chat_conversation_threads(conversation_id,parent_conversation_id,bot_id,user_id,source_message_id,source,title) VALUES (${toolThread},${toolBot.bot.mainConversationId!},${toolBot.id},${first},'tool-message',${sql.json(snapshot)},'Tool thread')`
    await assert.rejects(
      conversationTools.inspect({ conversationId: toolThread }),
      /Thread settings/,
    )
    await assert.rejects(
      conversationTools.inspect({ conversationId: foreign.conversationId }),
      /Conversation not found/,
    )
    const deletedInitiator = new AssistantConversations(commandEnv, {
      workspaceId: main.workspace.id,
      userId: first,
      botId: created[3].id,
      conversationId: created[3].bot.mainConversationId!,
    })
    await assert.rejects(
      deletedInitiator.inspect({
        conversationId: toolBot.bot.mainConversationId,
      }),
      /Conversation is unavailable/,
    )
    assert.equal((await commands.get(toolBot.id)).name, 'Tool renamed')
    await sql`UPDATE chat_bots SET archived_at=now() WHERE id=${toolBot.id}`
    console.log(
      'Passed: original assistant conversation tool metadata contract, rename/pin dispatch, stale writes, thread and foreign target exclusion, and deleted initiator exclusion.',
    )
    const lifecycleRoot = await commands.create({ name: 'Lifecycle root' })
    const lifecycleChild = await commands.create({
      name: 'Lifecycle child',
      parentId: lifecycleRoot.id,
    })
    const lifecycleLeaf = await commands.create({
      name: 'Earlier trash',
      parentId: lifecycleChild.id,
    })
    await commands.delete(lifecycleLeaf.id, {
      version: 0,
      descendants: 'subtree',
    })
    await commands.delete(lifecycleRoot.id, {
      version: 0,
      descendants: 'subtree',
    })
    assert.ok((await commands.get(lifecycleRoot.id)).deleted_at !== null)
    assert.ok((await commands.get(lifecycleChild.id)).deleted_at !== null)
    await commands.restore(lifecycleRoot.id, { version: 1 })
    assert.equal((await commands.get(lifecycleRoot.id)).deleted_at, null)
    assert.equal((await commands.get(lifecycleChild.id)).deleted_at, null)
    assert.ok(
      (await commands.get(lifecycleLeaf.id)).deleted_at !== null,
      'restore excludes earlier deletion batch',
    )
    await commands.delete(lifecycleRoot.id, {
      version: 2,
      descendants: 'reparent',
    })
    assert.equal((await commands.get(lifecycleChild.id)).parent_id, null)
    assert.equal((await commands.get(lifecycleChild.id)).deleted_at, null)
    await commands.restore(lifecycleRoot.id, { version: 3 })
    await assert.rejects(
      commands.restore(lifecycleRoot.id, { version: 4 }),
      /not in Trash/,
    )
    await assert.rejects(
      commands.delete(main.assistantId, {
        version: (await commands.get(main.assistantId)).version,
        descendants: 'subtree',
      }),
      /cannot be deleted/,
    )
    await assert.rejects(
      commands.delete(lifecycleChild.id, {
        version: 0,
        descendants: 'subtree',
      }),
      /changed in another window/,
    )
    const lateChild = crypto.randomUUID()
    const hierarchyRace = new BotWorkspace(
      {
        ...commandEnv,
        CONVERSATIONS: {
          getByName: (id: string) => ({
            async bindIdentity() {},
            async reserveDeletion() {
              await sql`INSERT INTO chat_bots(id,workspace_id,parent_id,name) VALUES (${lateChild},${main.workspace.id},${lifecycleRoot.id},'Late child')`
              return { reserved: true }
            },
            async releaseDeletion() {
              released.push(id)
            },
          }),
        },
      },
      main.workspace.id,
      first,
    )
    await assert.rejects(
      hierarchyRace.delete(lifecycleRoot.id, {
        version: 4,
        descendants: 'subtree',
      }),
      /hierarchy changed/,
    )
    assert.equal((await commands.get(lifecycleRoot.id)).deleted_at, null)
    assert.equal((await commands.get(lifecycleRoot.id)).version, 4)
    await sql`UPDATE chat_bots SET archived_at=now() WHERE id IN (${lifecycleRoot.id},${lifecycleChild.id},${lifecycleLeaf.id},${lateChild})`
    console.log(
      'Passed: source subtree deletion, earlier-batch exclusion during restoration, reparent deletion, personal assistant protection, stale denial, and concurrent hierarchy rollback.',
    )
    console.log(
      'Passed: original workspace patch version fencing, competing edits, parent and assistant guards, archive reservation/release, unarchive, deleted-source denial, and private scope.',
    )
    await sql`UPDATE chat_bots SET archived_at=now() WHERE id IN(SELECT jsonb_array_elements_text(${sql.json([...created.map((result) => result.id), child.id])}::jsonb))`
    console.log(
      'Passed: original workspace create contract, concurrent distinct identities, atomic main mapping, parent validation, private scope, input validation, and sync wakeups.',
    )
  }
  {
    const actions = new SavedActions(main.workspace.id, first)
    const created = await Promise.all(
      Array.from({ length: 35 }, (_, i) =>
        actions.create({
          title: `Action ${i}`,
          description: 'Verification',
          code: 'export default () => 9',
        }),
      ),
    )
    assert.equal(new Set(created.map((action) => action.id)).size, 35)
    const all = await actions.list()
    assert.equal(all.length, 35)
    assert.equal((await actions.list(true)).length, 30)
    assert.ok(
      all.every(
        (action) =>
          typeof action.created_at === 'number' &&
          action.workspace_id === main.workspace.id &&
          action.code === 'export default () => 9',
      ),
    )
    await assert.rejects(
      new SavedActions(main.workspace.id, second).list(),
      /Workspace access/,
    )
    await assert.rejects(
      new SavedActions(main.workspace.id, second).create({
        title: 'Foreign',
        description: 'No',
        code: 'export default()=>0',
      }),
      /Workspace access/,
    )
    await new SavedActions(other.workspace.id, second).delete(created[0].id)
    assert.equal((await actions.list()).length, 35)
    const [stored] =
      await sql`SELECT policy FROM chat_workspaces WHERE id=${main.workspace.id}`
    await sql`UPDATE chat_workspaces SET policy=${sql.json({ ...stored.policy, allowKody: false })} WHERE id=${main.workspace.id}`
    await assert.rejects(
      actions.create({
        title: 'Blocked',
        description: 'Policy',
        code: 'export default()=>0',
      }),
      /disabled by policy/,
    )
    await actions.delete(created[0].id)
    assert.equal(
      (await actions.list()).length,
      34,
      'existing actions can be removed while creation is disabled',
    )
    await sql`UPDATE chat_workspaces SET policy=${sql.json(stored.policy)} WHERE id=${main.workspace.id}`
    await assert.rejects(
      actions.create({ title: '', description: 'Invalid', code: '' }),
    )
    console.log(
      'Passed: source saved action schema and concurrent creation, workspace-scoped listing/deletion, 30-action runtime bound, input validation, and policy-gated creation.',
    )
  }
  {
    const context = await readConversationRunContext({
      workspaceId: main.workspace.id,
      userId: first,
      botId: main.assistantId,
    })
    assert.equal(context.bot.id, main.assistantId)
    assert.equal(context.bot.workspace_id, main.workspace.id)
    assert.equal(context.userId, first)
    assert.equal(typeof context.bot.created_at, 'number')
    assert.equal(context.recipes.length, 30)
    assert.ok(
      context.recipes.every(
        (action) => action.workspace_id === main.workspace.id,
      ),
    )
    await assert.rejects(
      readConversationRunContext({
        workspaceId: main.workspace.id,
        userId: second,
        botId: main.assistantId,
      }),
      /Workspace access/,
    )
    await assert.rejects(
      readConversationRunContext({
        workspaceId: main.workspace.id,
        userId: first,
        botId: foreign.bot.id,
      }),
      /Workspace access/,
    )
    const lifecycle = await readConversationLifecycle(
      main.assistantId,
      main.conversationId,
    )
    assert.deepEqual(lifecycle.bot, { archived_at: null, deleted_at: null })
    assert.equal(lifecycle.thread, null)
    const missing = await readConversationLifecycle(
      crypto.randomUUID(),
      crypto.randomUUID(),
    )
    assert.deepEqual(missing, { bot: null, thread: null })
    const retries =
      await sql`SELECT retry.id AS retry_id,copy.id AS operation_id,copy.target_conversation_id,copy.user_id,copy.workspace_id,retry.status AS retry_status,copy.status AS copy_status FROM chat_conversation_retries retry JOIN chat_conversation_copies copy ON copy.retry_id=retry.id`
    for (const row of retries) {
      const input = {
        retryId: row.retry_id,
        operationId: row.operation_id,
        conversationId: row.target_conversation_id,
        userId: row.user_id,
        workspaceId: row.workspace_id,
      }
      assert.equal(
        await conversationRetryReady(input),
        row.retry_status === 'ready' && row.copy_status === 'ready',
      )
      assert.equal(
        await conversationRetryReady({ ...input, userId: second }),
        false,
      )
    }
    assert.equal(
      await conversationRetryReady({
        retryId: 'missing',
        operationId: 'missing',
        conversationId: '',
        userId: '',
        workspaceId: '',
      }),
      false,
    )
    console.log(
      'Passed: source conversation run context policy/account/bot scope, saved action runtime bound, lifecycle projection and missing states, and exact retry readiness predicates.',
    )
  }
  {
    const copied = await createPersonalConversation(first)
    const input = {
      workspaceId: main.workspace.id,
      userId: first,
      conversationId: copied.conversationId,
      version: 7,
      messageCount: 4,
    }
    await assert.rejects(
      confirmCopyActivityPublication(input),
      /activity is still being published/,
    )
    await sql`INSERT INTO chat_conversation_activity(conversation_id,bot_id,user_id,status,activity_at,event_version,message_count) VALUES (${copied.conversationId},${copied.bot.id},${first},'completed',1,6,4)`
    await assert.rejects(
      confirmCopyActivityPublication(input),
      /activity is still being published/,
    )
    await sql`UPDATE chat_conversation_activity SET event_version=7,message_count=3 WHERE conversation_id=${copied.conversationId}`
    await assert.rejects(
      confirmCopyActivityPublication(input),
      /activity is still being published/,
    )
    await sql`UPDATE chat_conversation_activity SET message_count=4 WHERE conversation_id=${copied.conversationId}`
    await assert.rejects(
      confirmCopyActivityPublication({ ...input, userId: second }),
      /read watermark is still being published/,
    )
    await confirmCopyActivityPublication(input)
    const [read] =
      await sql`SELECT read_version FROM chat_conversation_activity WHERE conversation_id=${copied.conversationId}`
    assert.equal(Number(read.read_version), 7)
    assert.equal(await conversationCopyPublished(copied.conversationId), true)
    assert.equal(await conversationCopyPublished(crypto.randomUUID()), false)
    await sql`UPDATE chat_bots SET archived_at=now() WHERE id=${copied.bot.id}`
    console.log(
      'Passed: source copy publication gates for missing/stale activity, exact message count, authorized read watermark, and published conversation detection.',
    )
  }
  {
    assert.equal(
      await workflowChildPublished({
        conversationId: main.conversationId,
        botId: main.assistantId,
        userId: first,
      }),
      true,
    )
    assert.equal(
      await workflowChildPublished({
        conversationId: main.conversationId,
        botId: main.assistantId,
        userId: second,
      }),
      false,
    )
    assert.equal(
      await workflowChildPublished({
        conversationId: main.conversationId,
        botId: foreign.bot.id,
        userId: first,
      }),
      false,
    )
    const receipts =
      await sql`SELECT conversation_id,run_id,created_at FROM chat_run_usage_receipts`
    assert.ok(receipts.length > 0)
    for (const row of receipts)
      assert.deepEqual(
        await readRunUsageStart(row.conversation_id, row.run_id),
        { created_at: Number(row.created_at) },
      )
    assert.equal(
      await readRunUsageStart(main.conversationId, crypto.randomUUID()),
      null,
    )
    const links = await sql`SELECT user_id,username FROM chat_kody_links`
    for (const row of links)
      assert.deepEqual(await readKodyUsername(row.user_id), {
        username: row.username,
      })
    console.log(
      'Passed: source workflow child exact identity detection and run usage receipt timestamp projections.',
    )
  }

  {
    const before = await readOnboarding(first)
    assert.equal(before.status, 'pending')
    const command = {
      action: 'save',
      commandId: crypto.randomUUID(),
      revision: before.revision,
      workspaceName: 'Onboarding check',
      useCase: 'work',
    }
    const repeated = await Promise.all(
      Array.from({ length: 8 }, () => updateOnboarding(first, command)),
    )
    assert(
      repeated.every(
        (value) =>
          value.revision === before.revision + 1 &&
          value.completedAt === repeated[0].completedAt,
      ),
    )
    await assert.rejects(
      updateOnboarding(first, { ...command, workspaceName: 'Changed replay' }),
      /already used/,
    )
    assert.equal(
      (await readOnboarding(first)).workspaceName,
      'Onboarding check',
    )
    const current = await readOnboarding(first)
    const competing = await Promise.allSettled(
      ['One', 'Two'].map((workspaceName) =>
        updateOnboarding(first, {
          action: 'save',
          commandId: crypto.randomUUID(),
          revision: current.revision,
          workspaceName,
          useCase: 'everyday',
        }),
      ),
    )
    assert.equal(
      competing.filter((value) => value.status === 'fulfilled').length,
      1,
    )
    assert.equal(
      competing.filter((value) => value.status === 'rejected').length,
      1,
    )
    const next = await readOnboarding(first)
    const skipped = await updateOnboarding(first, {
      action: 'skip',
      commandId: crypto.randomUUID(),
      revision: next.revision,
    })
    assert.equal(skipped.status, 'skipped')
    assert.equal(skipped.workspaceName, next.workspaceName)
    assert.equal(skipped.useCase, next.useCase)
    await sql.unsafe(
      `CREATE FUNCTION reject_onboarding_name() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name='Reject onboarding' THEN RAISE EXCEPTION 'Rejected onboarding name'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_onboarding_name BEFORE UPDATE ON chat_workspaces FOR EACH ROW EXECUTE FUNCTION reject_onboarding_name()`,
    )
    const failedId = crypto.randomUUID()
    await assert.rejects(
      updateOnboarding(first, {
        action: 'save',
        commandId: failedId,
        revision: skipped.revision,
        workspaceName: 'Reject onboarding',
        useCase: 'building',
      }),
      (error: unknown) =>
        error instanceof Error &&
        error.cause instanceof Error &&
        error.cause.message === 'Rejected onboarding name',
    )
    assert.deepEqual(await readOnboarding(first), skipped)
    assert.equal(
      (
        await sql`SELECT 1 FROM chat_account_onboarding_commands WHERE command_id=${failedId}`
      ).length,
      0,
    )
    await sql.unsafe(
      'DROP TRIGGER reject_onboarding_name ON chat_workspaces; DROP FUNCTION reject_onboarding_name()',
    )
    console.log(
      'Passed: onboarding duplicate command replay, changed-command rejection, competing revisions, skip preservation and atomic rollback.',
    )
  }

  {
    const bootstrapUser = crypto.randomUUID()
    await sql`INSERT INTO users(id) VALUES(${bootstrapUser})`
    const bootstrapWorkspace = await openPersonalChatWorkspace(bootstrapUser)
    const user = {
      userId: bootstrapUser,
      email: 'first@example.com',
      name: 'First',
      displayUsername: 'first',
      image: null,
      oauthImage: null,
      capabilities: [],
      adsDisabled: null,
      interestedInHidingAds: null,
      lastUsedFramework: null,
      signupSources: [],
    }
    const bootstrap = await readBootstrap(
      new Request('https://tanstack.com/api/chat/bootstrap'),
      {
        ENCRYPTION_KEY: 'a'.repeat(64),
        KODY_ORIGIN: 'https://kody.codes',
        INCLUDED_MODEL: '@cf/moonshotai/kimi-k2.6',
      },
      user,
      bootstrapWorkspace.workspace.id,
    )
    assert.equal(bootstrap.user.id, bootstrapUser)
    assert.equal(bootstrap.fixture, false)
    assert.equal(
      bootstrap.personalAssistant?.id,
      bootstrapWorkspace.assistantId,
    )
    assert.equal(bootstrap.onboarding.status, 'pending')
    assert.equal(bootstrap.workspace.name, bootstrap.onboarding.workspaceName)
    assert.equal(bootstrap.connection.provider, 'included')
    assert.equal(bootstrap.connection.hasKey, false)
    assert.equal(bootstrap.kodyConnected, false)
    assert.equal(bootstrap.includedModel, '@cf/moonshotai/kimi-k2.6')
    assert(
      bootstrap.workspaces?.every(
        (workspace) => workspace.id !== other.workspace.id,
      ),
    )
    for (const activity of Object.values(bootstrap.activity ?? {}))
      assert.equal(typeof activity.event_version, 'number')
    await assert.rejects(
      readBootstrap(
        new Request('https://tanstack.com/api/chat/bootstrap'),
        {
          ENCRYPTION_KEY: 'a'.repeat(64),
          KODY_ORIGIN: 'https://kody.codes',
          INCLUDED_MODEL: '@cf/moonshotai/kimi-k2.6',
        },
        { ...user, userId: second },
        bootstrapWorkspace.workspace.id,
      ),
      /Workspace access/,
    )
    console.log(
      'Passed: native bootstrap response identity, assistant, onboarding, connection defaults, activity serialization and workspace isolation.',
    )
  }
  {
    const {
      readKodyOauthClient,
      saveKodyOauthClient,
      saveKodyOauthPending,
      consumeKodyOauthPending,
    } = await import('../src/chat/server/kody-oauth-store')
    assert.equal(
      await readKodyOauthClient('https://oauth-fixture.invalid'),
      undefined,
    )
    assert.equal(
      await saveKodyOauthClient(
        'https://oauth-fixture.invalid',
        'first-client',
      ),
      'first-client',
    )
    assert.equal(
      await saveKodyOauthClient(
        'https://oauth-fixture.invalid',
        'later-client',
      ),
      'first-client',
    )
    await saveKodyOauthPending({
      stateHash: 'test-state',
      userId: first,
      payload: 'encrypted-payload',
      expiresAt: Date.now() + 60000,
    })
    assert.equal(await consumeKodyOauthPending('test-state', second), undefined)
    assert.equal(
      await consumeKodyOauthPending('test-state', first),
      'encrypted-payload',
    )
    assert.equal(await consumeKodyOauthPending('test-state', first), undefined)
    await saveKodyOauthPending({
      stateHash: 'expired-state',
      userId: first,
      payload: 'expired-payload',
      expiresAt: Date.now() - 1,
    })
    assert.equal(
      await consumeKodyOauthPending('expired-state', first),
      undefined,
    )
    console.log(
      'Passed: native OAuth registration winner, pending owner isolation, single consumption and expiry.',
    )
  }
  const reopened = await openPersonalChatWorkspace(first)
  assert.equal(
    reopened.bots.length,
    1,
    'archived conversations are omitted from active listings',
  )
  assert.equal(reopened.bots[0].id, results[0].assistantId)
  console.log(
    'Passed: concurrent creation, user isolation, assistant protection, parent isolation, atomic bulk archive, deduplication, and active listings.',
  )
} finally {
  await sql.end()
}
// The app database client also owns a pool. All checks finished before exiting.
process.exit(0)
