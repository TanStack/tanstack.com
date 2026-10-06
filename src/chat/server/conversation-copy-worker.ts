import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import {
  canonicalCopyJson,
  type CopyIdentity,
  type CopyManifest,
} from '../core/conversation-copy'
import type {
  CopyFailure,
  CopySourcePort,
  CopyTargetPort,
  ConversationCopyRow,
  CopyRuntimeEnvironment,
} from './conversation-copy-contract'
import { hash } from './crypto'
const columns = sql.raw(
  `chat_conversation_copies.*,boundary_json::text AS boundary_json,manifest_json::text AS manifest_json,next_page::double precision AS next_page,work_version::double precision AS work_version,attempts::double precision AS attempts,retry_at::double precision AS retry_at,created_at::double precision AS created_at,updated_at::double precision AS updated_at,completed_at::double precision AS completed_at`,
)
const sourceScope = sql.raw(
  `EXISTS(SELECT 1 FROM chat_memberships membership JOIN chat_bots source ON source.workspace_id=membership.workspace_id JOIN chat_conversations conversation ON conversation.bot_id=source.id AND conversation.user_id=membership.user_id WHERE membership.workspace_id=chat_conversation_copies.workspace_id AND membership.user_id=chat_conversation_copies.user_id AND source.id=chat_conversation_copies.source_bot_id AND conversation.id=chat_conversation_copies.source_conversation_id AND source.deleted_at IS NULL)`,
)
const operation = async (_env: CopyRuntimeEnvironment, id: string) => {
  const [row] = await db.execute<ConversationCopyRow & Record<string, unknown>>(
    sql`SELECT ${columns} FROM chat_conversation_copies WHERE id=${id}::uuid`,
  )
  return row
}
/** RPC identity validation. Cleanup only removes staging data and never grants access. */
export async function getAuthorizedCopyOperation(
  _env: CopyRuntimeEnvironment,
  operationId: string,
  identity: CopyIdentity,
  role: 'source' | 'target',
  options: { cleanup?: boolean } = {},
) {
  const bot = sql.identifier(
      role === 'source' ? 'source_bot_id' : 'target_bot_id',
    ),
    conversation = sql.identifier(
      role === 'source' ? 'source_conversation_id' : 'target_conversation_id',
    )
  const [row] = await db.execute<ConversationCopyRow & Record<string, unknown>>(
    sql`SELECT ${columns} FROM chat_conversation_copies WHERE id=${operationId}::uuid AND workspace_id=${identity.workspaceId} AND user_id=${identity.userId}::uuid AND ${bot}=${identity.botId} AND (${identity.conversationId ?? null}::text IS NULL OR ${conversation}=${identity.conversationId ?? null}) AND ${options.cleanup ? sql.raw("phase IN ('cleanup','done')") : sql`status='copying' AND ${sourceScope}`}`,
  )
  return row
}
async function updateOperation(
  env: CopyRuntimeEnvironment,
  row: ConversationCopyRow,
  fields: Record<string, string | number | null>,
) {
  const allowed = new Set([
    'phase',
    'status',
    'manifest_json',
    'next_page',
    'error_code',
    'error_message',
    'completed_at',
    'attempts',
    'retry_at',
  ])
  if (Object.keys(fields).some((key) => !allowed.has(key)))
    throw new Error('Invalid copy progress field.')
  const assignments = Object.entries(fields).map(
    ([key, value]) =>
      sql`${sql.identifier(key)}=${value}${key === 'manifest_json' ? sql.raw('::jsonb') : sql.empty()}`,
  )
  return db.execute(
    sql`UPDATE chat_conversation_copies SET ${sql.join(assignments, sql`,`)},work_version=work_version+1,updated_at=${Date.now()} WHERE id=${row.id}::uuid AND work_version=${row.work_version} AND phase=${row.phase} AND status=${row.status}`,
  )
}
async function failOperation(
  env: CopyRuntimeEnvironment,
  row: ConversationCopyRow,
  error: CopyFailure['error'],
) {
  await updateOperation(env, row, {
    status: 'failed',
    phase: 'cleanup',
    error_code: error.code,
    error_message: error.message,
    completed_at: Date.now(),
    retry_at: 0,
    attempts: 0,
  })
}
function failed(value: unknown): value is CopyFailure {
  return (
    !!value &&
    typeof value === 'object' &&
    'status' in value &&
    value.status === 'failed'
  )
}
function manifestFor(row: ConversationCopyRow): CopyManifest {
  if (!row.manifest_json) throw new Error('Copy manifest is missing.')
  return JSON.parse(row.manifest_json)
}
async function publish(env: CopyRuntimeEnvironment, row: ConversationCopyRow) {
  const published = await db.transaction(async (tx) => {
    const [current] = await tx.execute(
      sql`SELECT id FROM chat_conversation_copies WHERE id=${row.id}::uuid AND work_version=${row.work_version} AND status='copying' AND phase='publish' FOR UPDATE`,
    )
    if (!current) return false
    const [source] = await tx.execute(
      sql`SELECT c.id FROM chat_conversations c JOIN chat_bots b ON b.id=c.bot_id JOIN chat_memberships m ON m.workspace_id=b.workspace_id AND m.user_id=c.user_id WHERE c.id=${row.source_conversation_id} AND c.bot_id=${row.source_bot_id} AND c.user_id=${row.user_id}::uuid AND b.workspace_id=${row.workspace_id} AND b.deleted_at IS NULL FOR SHARE OF c,b,m`,
    )
    if (!source) return false
    if (row.parent_id) {
      const [parent] = await tx.execute(
        sql`SELECT id FROM chat_bots WHERE id=${row.parent_id} AND workspace_id=${row.workspace_id} AND archived_at IS NULL AND deleted_at IS NULL FOR SHARE`,
      )
      if (!parent) return false
    }
    const now = Date.now(),
      timestamp = new Date(now).toISOString()
    await tx.execute(
      sql`INSERT INTO chat_bots(id,workspace_id,parent_id,name,purpose,created_at) VALUES(${row.target_bot_id},${row.workspace_id},${row.parent_id},${row.name},${row.purpose},${timestamp}::timestamptz)`,
    )
    await tx.execute(
      sql`INSERT INTO chat_conversations(id,bot_id,user_id,created_at) VALUES(${row.target_conversation_id},${row.target_bot_id},${row.user_id}::uuid,${timestamp}::timestamptz)`,
    )
    await tx.execute(
      sql`INSERT INTO chat_conversation_mains(bot_id,user_id,conversation_id) VALUES(${row.target_bot_id},${row.user_id}::uuid,${row.target_conversation_id})`,
    )
    await tx.execute(
      sql`UPDATE chat_conversation_copies SET status='ready',phase='cleanup',completed_at=${now},updated_at=${now},work_version=work_version+1,attempts=0,retry_at=0 WHERE id=${row.id}::uuid AND work_version=${row.work_version} AND status='copying' AND phase='publish'`,
    )
    return true
  })
  if (published) return
  const current = await operation(env, row.id)
  if (!current || current.work_version !== row.work_version) return
  await failOperation(env, row, {
    code: 'publication_changed',
    message:
      'Access, the source conversation or the parent changed before copying finished. Try a new copy.',
  })
}

const scope = (identity: CopyIdentity) =>
  sql`source_bot_id=${identity.botId} AND workspace_id=${identity.workspaceId} AND user_id=${identity.userId}::uuid AND ((${identity.conversationId ?? null}::text IS NOT NULL AND source_conversation_id=${identity.conversationId ?? null}) OR (${identity.conversationId ?? null}::text IS NULL AND EXISTS(SELECT 1 FROM chat_conversation_mains main WHERE main.conversation_id=source_conversation_id AND main.bot_id=source_bot_id AND main.user_id=chat_conversation_copies.user_id)))`

/** One bounded step; the source DO alarm calls again at nextWakeAt until done. */
export async function resumeConversationCopies(
  env: CopyRuntimeEnvironment,
  identity: CopyIdentity,
  source: CopySourcePort,
): Promise<{ pending: boolean; nextWakeAt?: number }> {
  const [row] = await db.execute<ConversationCopyRow & Record<string, unknown>>(
    sql`SELECT ${columns} FROM chat_conversation_copies WHERE ${scope(identity)} AND phase!='done' AND retry_at<=${Date.now()} ORDER BY chat_conversation_copies.updated_at,chat_conversation_copies.id LIMIT 1`,
  )
  if (row) {
    try {
      const target: CopyTargetPort = env.CONVERSATIONS.getByName(
        row.target_conversation_id,
      )
      if (row.phase === 'cleanup') {
        if (row.status === 'failed') await target.discardCopyImport(row.id)
        else if (row.status === 'ready') await target.activateCopy(row.id)
        await source.releaseCopyExport(row.id)
        await updateOperation(env, row, {
          phase: 'done',
          retry_at: 0,
          attempts: 0,
        })
      } else if (
        !(await getAuthorizedCopyOperation(env, row.id, identity, 'source'))
      ) {
        await failOperation(env, row, {
          code: 'access_changed',
          message:
            'Access to this conversation changed before copying finished.',
        })
      } else if (row.phase === 'export') {
        const exported = await source.startCopyExport({
          ...identity,
          conversationId: row.source_conversation_id,
          operationId: row.id,
          boundary: JSON.parse(row.boundary_json),
          kind: row.kind,
          targetConversationId: row.target_conversation_id,
        })
        if (failed(exported)) await failOperation(env, row, exported.error)
        else if (exported.status === 'sealed') {
          const manifest = exported.manifest
          if (
            manifest.operationId !== row.id ||
            (manifest.schemaVersion !== 1 && manifest.schemaVersion !== 2) ||
            (manifest.schemaVersion === 2 &&
              !Array.isArray(manifest.actionEvidence)) ||
            !Number.isSafeInteger(manifest.pageCount) ||
            manifest.pageCount < 1
          )
            await failOperation(env, row, {
              code: 'invalid_manifest',
              message: 'The conversation snapshot could not be verified.',
            })
          else
            await updateOperation(env, row, {
              phase: 'transfer',
              manifest_json: canonicalCopyJson(manifest),
              attempts: 0,
              retry_at: 0,
            })
        } else await updateOperation(env, row, { attempts: 0, retry_at: 0 })
      } else if (row.phase === 'transfer') {
        const manifest = manifestFor(row)
        const pages = await source.readCopyPages(row.id, row.next_page)
        if (failed(pages)) await failOperation(env, row, pages.error)
        else if (
          !pages.length ||
          pages.length > 16 ||
          row.next_page + pages.length > manifest.pageCount ||
          !(
            await Promise.all(
              pages.map(
                async (page, index) =>
                  page.ordinal === row.next_page + index &&
                  new TextEncoder().encode(page.payload).length <= 48000 &&
                  (await hash(page.payload)) === page.digest,
              ),
            )
          ).every(Boolean)
        )
          await failOperation(env, row, {
            code: 'invalid_page',
            message: 'A conversation snapshot page could not be verified.',
          })
        else {
          const result = await target.importCopyPages({
            operationId: row.id,
            manifest,
            pages,
            identity: {
              botId: row.target_bot_id,
              conversationId: row.target_conversation_id,
              userId: row.user_id,
              workspaceId: row.workspace_id,
            },
          })
          if (failed(result)) await failOperation(env, row, result.error)
          else
            await updateOperation(env, row, {
              next_page: row.next_page + pages.length,
              phase:
                row.next_page + pages.length === manifest.pageCount
                  ? 'import'
                  : 'transfer',
              attempts: 0,
              retry_at: 0,
            })
        }
      } else if (row.phase === 'import') {
        const manifest = manifestFor(row)
        const result = await target.finishCopyImport(row.id, manifest.digest)
        if (failed(result)) await failOperation(env, row, result.error)
        else if (result.status === 'ready') {
          if (
            result.operationId !== row.id ||
            result.digest !== manifest.digest
          )
            await failOperation(env, row, {
              code: 'invalid_import',
              message: 'The copied conversation could not be verified.',
            })
          else
            await updateOperation(env, row, {
              phase: 'publish',
              attempts: 0,
              retry_at: 0,
            })
        } else await updateOperation(env, row, { attempts: 0, retry_at: 0 })
      } else if (row.phase === 'publish') await publish(env, row)
    } catch {
      // Exception bodies can contain private content or provider details. Keep
      // only a retry counter; a transient failure must not destroy the snapshot.
      await updateOperation(env, row, {
        attempts: row.attempts + 1,
        retry_at:
          Date.now() + Math.min(60_000, 1000 * 2 ** Math.min(row.attempts, 6)),
      })
    }
  }
  const [next] = await db.execute<{ wake: number | null }>(
    sql`SELECT min(retry_at)::double precision AS wake FROM chat_conversation_copies WHERE ${scope(identity)} AND phase!='done'`,
  )
  return next?.wake === null || next?.wake === undefined
    ? { pending: false }
    : { pending: true, nextWakeAt: Math.max(Date.now() + 1, next.wake) }
}
