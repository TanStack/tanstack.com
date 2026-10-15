import { db } from '~/db/client'
import { sql } from 'drizzle-orm'
import { canonicalCopyJson } from '../core/conversation-copy'
import { parseRetrySource, retryReviewPayload } from '../core/retry-source'
import type { RetryAttemptView } from '../core/conversation-retry'
import type { ConversationCopyRow } from './conversation-copy-contract'
import { hash } from './crypto'
export interface ConversationRetryRow {
  id: string
  workspace_id: string
  user_id: string
  source_bot_id: string
  source_conversation_id: string
  message_id: string
  idempotency_key: string
  source_json: string
  file_plan_json: string
  status: RetryAttemptView['status']
  error_code: string | null
  error_message: string | null
  created_at: number
  updated_at: number
}
/** Only the immutable server record can supply retry data to a copy export. */
export async function copyRetrySource(copy: ConversationCopyRow) {
  if (!copy.retry_id) return undefined
  const [row] = await db.execute<
    ConversationRetryRow & Record<string, unknown>
  >(
    sql`SELECT *,source_json::text AS source_json,file_plan_json::text AS file_plan_json,created_at::double precision AS created_at,updated_at::double precision AS updated_at FROM chat_conversation_retries WHERE id=${copy.retry_id}::uuid AND workspace_id=${copy.workspace_id} AND user_id=${copy.user_id}::uuid AND source_bot_id=${copy.source_bot_id} AND source_conversation_id=${copy.source_conversation_id}`,
  )
  if (!row) throw new Error('The original retry review is unavailable.')
  const source = parseRetrySource(JSON.parse(row.source_json))
  if (
    source.boundary.messageId !== row.message_id ||
    source.boundary.side !== 'before' ||
    canonicalCopyJson(source.boundary) !==
      canonicalCopyJson(JSON.parse(copy.boundary_json)) ||
    (await hash(
      canonicalCopyJson({ request: source.request, evidence: source.evidence }),
    )) !== source.evidenceDigest ||
    ((source.inheritedEvidence !== undefined ||
      source.reviewDigest !== undefined) &&
      (!source.inheritedEvidence ||
        !source.reviewDigest ||
        (await hash(retryReviewPayload(source))) !== source.reviewDigest))
  )
    throw new Error('The original retry review could not be verified.')
  return source
}
