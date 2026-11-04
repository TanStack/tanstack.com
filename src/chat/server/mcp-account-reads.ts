import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '~/db/client'
import { chatMcpAccounts } from '~/db/schema'
import { readWorkspacePolicy } from '../workspace-policy.server'
import type { SavedMcpServer } from '../core/types'
import type { McpAccountSummary } from '../core/mcp-accounts'
import {
  McpAccountError,
  type McpAccountScope,
  type McpAccountSecret,
} from './mcp-account-contract'
import type { CredentialEnv } from './credentials'
import { unseal } from './crypto'
const uuid = z.uuid()
export type Row = {
  id: string
  user_id: string
  label: string
  url: string
  auth_mode: 'none' | 'token' | 'oauth'
  enabled: number
  removed: number
  revision: number
  grant_id: string
  token_revision: number
  ciphertext: string | null
  status: 'configured' | 'checked' | 'needs_auth' | 'error'
  checked_at: number | null
  error: string | null
  refresh_claim: string | null
  refresh_until: number | null
  created_at: number
  updated_at: number
}
export function summary(r: Row): McpAccountSummary {
  return {
    id: r.id,
    label: r.label,
    url: r.url,
    enabled: !!r.enabled && !r.removed,
    hasToken: !!r.ciphertext && r.status !== 'needs_auth',
    revision: r.revision,
    authMode: r.auth_mode,
    status: !r.enabled || r.removed ? 'disabled' : r.status,
    ...(r.checked_at === null ? {} : { checkedAt: r.checked_at }),
    ...(r.error ? { error: r.error } : {}),
  }
}

export function sourceRow(row: typeof chatMcpAccounts.$inferSelect): Row {
  return {
    id: row.id,
    user_id: row.userId,
    label: row.label,
    url: row.url,
    auth_mode: row.authMode,
    enabled: Number(row.enabled),
    removed: Number(row.removed),
    revision: row.revision,
    grant_id: row.grantId,
    token_revision: row.tokenRevision,
    ciphertext: row.ciphertext,
    status: row.status,
    checked_at: row.checkedAt,
    error: row.error,
    refresh_claim: row.refreshClaim,
    refresh_until: row.refreshUntil,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}
export class McpAccountReads {
  constructor(
    protected env: CredentialEnv,
    protected scope: McpAccountScope,
  ) {}
  protected async authorize() {
    const policy = await readWorkspacePolicy(
      this.scope.workspaceId,
      this.scope.userId,
    )
    if (!policy.allowMcp)
      throw new McpAccountError(
        'MCP connections are disabled by workspace policy.',
        403,
      )
  }
  private async rows(removed?: boolean, enabled?: boolean) {
    return (
      await db
        .select()
        .from(chatMcpAccounts)
        .where(
          and(
            eq(chatMcpAccounts.userId, this.scope.userId),
            removed === undefined
              ? undefined
              : eq(chatMcpAccounts.removed, removed),
            enabled === undefined
              ? undefined
              : eq(chatMcpAccounts.enabled, enabled),
          ),
        )
        .orderBy(chatMcpAccounts.label, chatMcpAccounts.id)
    ).map(sourceRow)
  }
  protected async required(id: string) {
    uuid.parse(id)
    await this.authorize()
    const [row] = await db
      .select()
      .from(chatMcpAccounts)
      .where(
        and(
          eq(chatMcpAccounts.id, id),
          eq(chatMcpAccounts.userId, this.scope.userId),
        ),
      )
    if (!row || row.removed)
      throw new McpAccountError('Connection not found.', 404)
    return sourceRow(row)
  }
  protected async decrypt(row: Row): Promise<McpAccountSecret | undefined> {
    if (!row.ciphertext) return
    const envelope = await unseal<{
      schemaVersion: number
      id: string
      userId: string
      secret: McpAccountSecret
    }>(row.ciphertext, this.env.ENCRYPTION_KEY)
    if (
      envelope.schemaVersion !== 1 ||
      envelope.id !== row.id ||
      envelope.userId !== this.scope.userId
    )
      throw new McpAccountError('Reconnect this connection.', 409)
    return envelope.secret
  }
  async list() {
    await this.authorize()
    const rows = await this.rows(false)
    await this.authorize()
    return rows.map(summary)
  }
  async get(id: string) {
    await this.authorize()
    return summary(await this.required(id))
  }
  async read(id: string) {
    await this.authorize()
    const row = await this.required(id),
      secret = await this.decrypt(row)
    const current = await this.required(id)
    if (
      current.revision !== row.revision ||
      current.token_revision !== row.token_revision ||
      current.grant_id !== row.grant_id ||
      current.refresh_claim !== row.refresh_claim ||
      current.status !== row.status
    )
      throw new McpAccountError(
        'This connection changed while it was read. Try again.',
        409,
      )
    return {
      summary: summary(row),
      grantId: row.grant_id,
      tokenRevision: row.token_revision,
      secret,
    }
  }
  /** Local metadata/credential projection. Never refreshes OAuth or contacts a server.
   * Expired grants remain discoverable so an explicit refresh can renew them. */
  async configuredServers(): Promise<
    Array<SavedMcpServer & { credentialId: string }>
  > {
    const summaries = await this.list()
    const servers: Array<SavedMcpServer & { credentialId: string }> = []
    for (const item of summaries) {
      if (!item.enabled || item.status === 'needs_auth') continue
      const current = await this.read(item.id)
      if (!current.summary.enabled || current.summary.status === 'needs_auth')
        continue
      const accessToken =
        current.secret?.authMode === 'token'
          ? current.secret.accessToken
          : current.secret?.authMode === 'oauth'
            ? current.secret.oauth.tokens?.access_token
            : undefined
      if (current.summary.authMode !== 'none' && !accessToken) continue
      servers.push({
        id: item.id,
        label: current.summary.label,
        url: current.summary.url,
        enabled: true,
        accessToken,
        credentialId: current.grantId,
      })
    }
    const current = await this.rows()
    await this.authorize()
    return servers.filter((server) =>
      current.some(
        (row) =>
          row.id === server.id &&
          row.grant_id === server.credentialId &&
          row.url === server.url &&
          row.enabled &&
          !row.removed &&
          row.status !== 'needs_auth',
      ),
    )
  }
  async runtimeServers(): Promise<SavedMcpServer[]> {
    await this.authorize()
    const rows = await this.rows(false, true)
    const servers: SavedMcpServer[] = []
    for (const row of rows) {
      if (row.status === 'needs_auth') continue
      const secret = await this.decrypt(row)
      let accessToken: string | undefined
      if (secret?.authMode === 'token') accessToken = secret.accessToken
      if (secret?.authMode === 'oauth') {
        if (
          !secret.oauth.tokens?.access_token ||
          (secret.oauth.expiresAt !== undefined &&
            secret.oauth.expiresAt <= Date.now())
        )
          continue
        accessToken = secret.oauth.tokens.access_token
      }
      if (row.auth_mode !== 'none' && !accessToken) continue
      servers.push({
        id: row.id,
        label: row.label,
        url: row.url,
        enabled: true,
        ...(accessToken ? { accessToken } : {}),
      })
    }
    await this.authorize()
    const current = await this.rows(false, true)
    return servers.filter((server) => {
      const original = rows.find((r) => r.id === server.id)
      return current.some(
        (r) =>
          r.id === server.id &&
          r.grant_id === original?.grant_id &&
          r.revision === original.revision &&
          r.token_revision === original.token_revision &&
          r.status === original.status,
      )
    })
  }
}
