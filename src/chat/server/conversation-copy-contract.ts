import type {
  CopyExportProgress,
  CopyExportRequest,
  CopyIdentity,
  CopyKind,
  CopyManifest,
  CopyPage,
} from '../core/conversation-copy'
export interface CopyFailure {
  status: 'failed'
  error: { code: string; message: string }
}
export interface CopySourcePort {
  startCopyExport(
    request: CopyExportRequest,
  ): Promise<CopyExportProgress | CopyFailure>
  readCopyPages(
    operationId: string,
    cursor: number,
  ): Promise<CopyPage[] | CopyFailure>
  releaseCopyExport(operationId: string): Promise<unknown>
}
export interface CopyTargetPort {
  importCopyPages(input: {
    operationId: string
    manifest: CopyManifest
    pages: CopyPage[]
    identity: CopyIdentity
  }): Promise<{ accepted: true } | CopyFailure>
  finishCopyImport(
    operationId: string,
    digest: string,
  ): Promise<
    | { status: 'importing' }
    | { status: 'ready'; operationId: string; digest: string }
    | CopyFailure
  >
  discardCopyImport(operationId: string): Promise<unknown>
  activateCopy(operationId: string): Promise<unknown>
}
export interface CopyWakePort {
  wakeCopies(registration?: {
    operationId: string
    registerUntil: number
  }): Promise<unknown>
}
export interface ConversationCopyRow {
  id: string
  retry_id?: string | null
  workspace_id: string
  user_id: string
  source_bot_id: string
  source_conversation_id: string
  target_bot_id: string
  target_conversation_id: string
  idempotency_key: string
  request_digest: string
  kind: CopyKind
  boundary_json: string
  name: string
  purpose: string
  parent_id: string | null
  status: 'copying' | 'ready' | 'failed'
  phase: 'export' | 'transfer' | 'import' | 'publish' | 'cleanup' | 'done'
  manifest_json: string | null
  next_page: number
  work_version: number
  error_code: string | null
  error_message: string | null
  attempts: number
  retry_at: number
  created_at: number
  updated_at: number
  completed_at: number | null
}
export interface CopyOperationView {
  operationId: string
  status: ConversationCopyRow['status']
  botId?: string
  conversationId?: string
  error?: { code: string; message: string }
}

export interface CopyRuntimeEnvironment {
  CONVERSATIONS: { getByName(id: string): CopyTargetPort }
}
