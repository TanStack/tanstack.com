import { readCredentials } from './credentials'
import { mcpCheckErrors } from '../core/mcp-accounts'
import type {
  McpOAuthState,
  RefreshClaim,
  RefreshResult,
} from './mcp-account-contract'
import { policySchema } from '../core/types'
import { z } from 'zod'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '~/db/client'
import { chatMcpAccounts, chatMcpAccountCommands } from '~/db/schema'
import {
  mcpAccountCommandSchema,
  type McpAccountSummary,
} from '../core/mcp-accounts'
import {
  McpAccountReads,
  sourceRow,
  summary,
  type Row,
} from './mcp-account-reads'
import { McpAccountError, type McpAccountSecret } from './mcp-account-contract'
import { hash, seal } from './crypto'
import { validateMcpEndpoint } from './public-endpoint'
const uuid = z.uuid(),
  rev = z.number().int().nonnegative().safe()
const oauthInput = z
  .object({
    id: uuid,
    commandId: uuid,
    expectedRevision: rev,
    label: z.string().trim().min(1).max(80),
    url: z.string().min(1).max(500),
  })
  .strict()
function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']'
  if (v && typeof v === 'object')
    return (
      '{' +
      Object.entries(v)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => JSON.stringify(k) + ':' + canonical(x))
        .join(',') +
      '}'
    )
  return JSON.stringify(v)
}
export class McpAccounts extends McpAccountReads {
  /** Import the original credential-list shape once, without replacing account rows. */
  async ensureLegacy() {
    await this.authorize()
    const old = await readCredentials(this.env, this.scope.userId)
    const imports: Array<{
      id: string
      label: string
      url: string
      authMode: string
      enabled: boolean
      grantId: string
      ciphertext: string | null
      now: number
    }> = []
    for (const server of old?.mcpServers ?? []) {
      let url: string
      try {
        uuid.parse(server.id)
        url = validateMcpEndpoint(server.url)
      } catch {
        continue
      }
      const [existing] = await db
        .select({ id: chatMcpAccounts.id })
        .from(chatMcpAccounts)
        .where(eq(chatMcpAccounts.id, server.id))
      if (existing) continue
      const secret: McpAccountSecret | undefined = server.accessToken
        ? { authMode: 'token', accessToken: server.accessToken }
        : undefined
      imports.push({
        id: server.id,
        label: server.label,
        url,
        authMode: secret ? 'token' : 'none',
        enabled: server.enabled,
        grantId: crypto.randomUUID(),
        ciphertext: secret ? await this.encrypt(server.id, secret) : null,
        now: Date.now(),
      })
    }
    if (imports.length)
      await db.transaction(async (tx) => {
        for (const server of imports)
          await tx.execute(sql`INSERT INTO chat_mcp_accounts(id,user_id,label,url,auth_mode,enabled,removed,revision,grant_id,token_revision,ciphertext,status,checked_at,error,refresh_claim,refresh_until,created_at,updated_at)
       SELECT ${server.id}::uuid,${this.scope.userId}::uuid,${server.label},${server.url},${server.authMode},${server.enabled},false,1,${server.grantId}::uuid,0,${server.ciphertext},'configured',NULL,NULL,NULL,NULL,${server.now},${server.now}
       WHERE EXISTS(SELECT 1 FROM chat_memberships m JOIN chat_workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=${this.scope.workspaceId} AND m.user_id=${this.scope.userId}::uuid AND w.policy->>'allowMcp'='true') ON CONFLICT DO NOTHING`)
      })
    await this.authorize()
  }
  private async encrypt(id: string, secret: McpAccountSecret) {
    return seal(
      { schemaVersion: 1, id, userId: this.scope.userId, secret },
      this.env.ENCRYPTION_KEY,
    )
  }
  private async mutate(input: unknown, oauth = false) {
    await this.authorize()
    const command = oauth
      ? { type: 'oauth' as const, ...oauthInput.parse(input) }
      : mcpAccountCommandSchema.parse(input)
    const digest = await hash(
      canonical({ workspaceId: this.scope.workspaceId, command }),
    )
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM users WHERE id=${this.scope.userId} FOR UPDATE`,
      )
      const authorizeTransaction = async () => {
        const [row] = await tx.execute<{ policy: unknown }>(
          sql`SELECT w.policy FROM chat_workspaces w JOIN chat_memberships m ON m.workspace_id=w.id WHERE w.id=${this.scope.workspaceId} AND m.user_id=${this.scope.userId} FOR SHARE OF w,m`,
        )
        if (!row || !policySchema.parse(row.policy).allowMcp)
          throw new McpAccountError('Workspace access is unavailable.', 403)
      }
      await authorizeTransaction()
      const [savedReceipt] = await tx
        .select()
        .from(chatMcpAccountCommands)
        .where(
          and(
            eq(chatMcpAccountCommands.userId, this.scope.userId),
            eq(chatMcpAccountCommands.commandId, command.commandId),
          ),
        )
      if (savedReceipt && savedReceipt.requestHash !== digest)
        throw new McpAccountError(
          'This command ID was already used for another change.',
          409,
        )
      const replay = savedReceipt?.receipt as
        | { summary: McpAccountSummary; grantId: string }
        | undefined
      if (replay) {
        await authorizeTransaction()
        return replay
      }
      const [stored] = await tx
        .select()
        .from(chatMcpAccounts)
        .where(eq(chatMcpAccounts.id, command.id))
        .for('update')
      if (stored && stored.userId !== this.scope.userId)
        throw new McpAccountError('Connection not found.', 404)
      const old = stored ? sourceRow(stored) : undefined
      if (old?.removed)
        throw new McpAccountError(
          'This connection was removed. Create a new connection.',
          409,
        )
      if (command.expectedRevision !== (old?.revision ?? 0))
        throw new McpAccountError(
          'This connection changed. Reload it before editing.',
          409,
        )
      if (!old && !['save', 'oauth'].includes(command.type))
        throw new McpAccountError('Connection not found.', 404)
      const now = Date.now()
      let secret = old ? await this.decrypt(old) : undefined
      const url =
        command.type === 'save' || command.type === 'oauth'
          ? validateMcpEndpoint(command.url)
          : old!.url
      if (
        command.type === 'oauth' ||
        command.type === 'disconnect' ||
        command.type === 'remove'
      )
        secret = undefined
      if (command.type === 'save') {
        if (command.authMode === 'none') secret = undefined
        else if (command.token)
          secret = { authMode: 'token', accessToken: command.token }
        else if (old?.url !== url || secret?.authMode !== 'token')
          throw new McpAccountError('Provide a token for this connection.')
      }
      const authMode =
        command.type === 'oauth'
          ? 'oauth'
          : command.type === 'save'
            ? command.authMode
            : old!.auth_mode
      const next: Row = {
        id: command.id,
        user_id: this.scope.userId,
        label:
          command.type === 'save' || command.type === 'oauth'
            ? command.label
            : old!.label,
        url,
        auth_mode: authMode,
        enabled:
          command.type === 'enabled'
            ? Number(command.enabled)
            : command.type === 'disconnect' || command.type === 'remove'
              ? 0
              : command.type === 'oauth'
                ? 1
                : (old?.enabled ?? 1),
        removed: command.type === 'remove' ? 1 : 0,
        revision: (old?.revision ?? 0) + 1,
        grant_id: crypto.randomUUID(),
        token_revision: old?.token_revision ?? 0,
        ciphertext: secret ? await this.encrypt(command.id, secret) : null,
        status:
          command.type === 'oauth' ||
          command.type === 'disconnect' ||
          (command.type === 'enabled' &&
            (old?.status === 'needs_auth' || !!old?.refresh_claim))
            ? 'needs_auth'
            : secret || authMode === 'none'
              ? 'configured'
              : 'needs_auth',
        checked_at: null,
        error: null,
        refresh_claim: null,
        refresh_until: null,
        created_at: old?.created_at ?? now,
        updated_at: now,
      }
      if (secret?.authMode === 'oauth') {
        secret = {
          ...secret,
          oauth: { ...secret.oauth, grantId: next.grant_id },
        }
        next.ciphertext = await this.encrypt(next.id, secret)
      }
      const result = { summary: summary(next), grantId: next.grant_id }
      if (!old) {
        const [count] = await tx.execute<{ count: number }>(
          sql`SELECT count(*)::integer AS count FROM chat_mcp_accounts WHERE user_id=${this.scope.userId}`,
        )
        if (count.count >= 100)
          throw new McpAccountError(
            'The connection changed or the account limit was reached. Reload and try again.',
            409,
          )
      }
      const values = {
        id: next.id,
        userId: next.user_id,
        label: next.label,
        url: next.url,
        authMode: next.auth_mode,
        enabled: !!next.enabled,
        removed: !!next.removed,
        revision: next.revision,
        grantId: next.grant_id,
        tokenRevision: next.token_revision,
        ciphertext: next.ciphertext,
        status: next.status,
        checkedAt: next.checked_at,
        error: next.error,
        refreshClaim: next.refresh_claim,
        refreshUntil: next.refresh_until,
        createdAt: next.created_at,
        updatedAt: next.updated_at,
      }
      if (old)
        await tx
          .update(chatMcpAccounts)
          .set(values)
          .where(eq(chatMcpAccounts.id, next.id))
      else {
        const inserted = await tx
          .insert(chatMcpAccounts)
          .values(values)
          .onConflictDoNothing()
          .returning({ id: chatMcpAccounts.id })
        if (!inserted.length)
          throw new McpAccountError('Connection already exists.', 409)
      }
      await tx.insert(chatMcpAccountCommands).values({
        userId: this.scope.userId,
        commandId: command.commandId,
        requestHash: digest,
        receipt: result,
        createdAt: now,
      })
      await authorizeTransaction()
      return result
    })
  }
  async command(input: unknown) {
    return (await this.mutate(input)).summary
  }
  async beginOAuth(input: z.infer<typeof oauthInput>) {
    return this.mutate(input, true)
  }
  private membership() {
    return sql`EXISTS(SELECT 1 FROM chat_memberships m JOIN chat_workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=${this.scope.workspaceId} AND m.user_id=${this.scope.userId} AND w.policy->'allowMcp'='true'::jsonb)`
  }
  private validateOAuth(state: McpOAuthState, row: Row) {
    let resourceMatches = false
    try {
      const resource = new URL(validateMcpEndpoint(state.resource)),
        endpoint = new URL(row.url)
      const path = resource.pathname.replace(/\/$/, '')
      resourceMatches =
        resource.origin === endpoint.origin &&
        (endpoint.pathname === path || endpoint.pathname.startsWith(path + '/'))
    } catch {}
    if (
      state.grantId !== row.grant_id ||
      !resourceMatches ||
      !state.tokens?.access_token
    )
      throw new McpAccountError(
        'The authorization result does not match this connection.',
        409,
      )
    if (new TextEncoder().encode(JSON.stringify(state)).length > 128000)
      throw new McpAccountError('The authorization result is too large.')
    if (
      state.expiresAt !== undefined &&
      (!Number.isFinite(state.expiresAt) || state.expiresAt < 0)
    )
      throw new McpAccountError('Invalid token expiry.')
    return state
  }
  async completeOAuth(input: {
    id: string
    expectedRevision: number
    grantId: string
    state: McpOAuthState
  }) {
    const row = await this.required(input.id)
    if (
      row.grant_id !== input.grantId ||
      row.revision !== input.expectedRevision ||
      !row.enabled ||
      row.auth_mode !== 'oauth'
    )
      throw new McpAccountError(
        'This authorization was replaced or disconnected.',
        409,
      )
    if (row.ciphertext || row.status !== 'needs_auth') {
      const existing = await this.decrypt(row)
      if (
        existing?.authMode === 'oauth' &&
        canonical(existing.oauth) === canonical(input.state)
      )
        return this.get(row.id)
      throw new McpAccountError(
        'This authorization has already completed. Do not replay its tokens.',
        409,
      )
    }
    const state = this.validateOAuth(input.state, row),
      ciphertext = await this.encrypt(row.id, {
        authMode: 'oauth',
        oauth: state,
      })
    const [result] = await db.execute(
      sql`UPDATE chat_mcp_accounts SET ciphertext=${ciphertext},status='configured',error=NULL,token_revision=token_revision+1,updated_at=${Date.now()} WHERE id=${row.id} AND user_id=${this.scope.userId} AND revision=${input.expectedRevision} AND grant_id=${input.grantId} AND ciphertext IS NULL AND status='needs_auth' AND enabled=true AND removed=false AND ${this.membership()} RETURNING id`,
    )
    if (!result)
      throw new McpAccountError(
        'This authorization was replaced or disconnected.',
        409,
      )
    return this.get(row.id)
  }
  /** Final local fence before dispatch. Revocation after network dispatch cannot undo
   * a provider request; completeRefresh still prevents installing its result. */
  async assertRefreshClaim(claim: RefreshClaim): Promise<void> {
    const [current] = await db.execute(
      sql`SELECT id FROM chat_mcp_accounts WHERE id=${claim.id} AND user_id=${this.scope.userId} AND grant_id=${claim.grantId} AND token_revision=${claim.tokenRevision} AND refresh_claim=${claim.claimId} AND refresh_until>${Date.now()} AND enabled=true AND removed=false AND status!='needs_auth' AND ${this.membership()}`,
    )
    if (!current)
      throw new McpAccountError('This refresh is no longer authorized.', 409)
  }
  async claimRefresh(
    id: string,
    options: { leaseMs?: number } = {},
  ): Promise<RefreshResult> {
    const row = await this.required(id)
    if (
      !row.enabled ||
      row.auth_mode !== 'oauth' ||
      row.status === 'needs_auth'
    )
      return { status: 'needs_auth' }
    const now = Date.now()
    if (row.refresh_claim) {
      if ((row.refresh_until ?? 0) > now) return { status: 'busy' }
      await db.execute(
        sql`UPDATE chat_mcp_accounts SET status='needs_auth',error='Reconnect after an interrupted refresh.',refresh_claim=NULL,refresh_until=NULL WHERE id=${id} AND user_id=${this.scope.userId} AND refresh_claim=${row.refresh_claim}`,
      )
      return { status: 'needs_auth' }
    }
    const secret = await this.decrypt(row)
    if (secret?.authMode !== 'oauth' || !secret.oauth.tokens?.access_token)
      return { status: 'needs_auth' }
    if (
      secret.oauth.expiresAt === undefined ||
      secret.oauth.expiresAt > now + 60000
    )
      return { status: 'not_needed' }
    if (!secret.oauth.tokens.refresh_token) {
      await db.execute(
        sql`UPDATE chat_mcp_accounts SET status='needs_auth' WHERE id=${id} AND user_id=${this.scope.userId} AND grant_id=${row.grant_id}`,
      )
      return { status: 'needs_auth' }
    }
    const claimId = crypto.randomUUID(),
      lease = z
        .number()
        .int()
        .min(1000)
        .max(60000)
        .parse(options.leaseMs ?? 30000)
    const [claimed] = await db.execute(
      sql`UPDATE chat_mcp_accounts SET refresh_claim=${claimId},refresh_until=${now + lease} WHERE id=${id} AND user_id=${this.scope.userId} AND grant_id=${row.grant_id} AND token_revision=${row.token_revision} AND revision=${row.revision} AND refresh_claim IS NULL AND enabled=true AND removed=false AND status!='needs_auth' AND ${this.membership()} RETURNING id`,
    )
    if (!claimed) return { status: 'busy' }
    return {
      status: 'claimed',
      id,
      claimId,
      grantId: row.grant_id,
      tokenRevision: row.token_revision,
      secret: secret.oauth,
    }
  }
  async completeRefresh(input: RefreshClaim & { state: McpOAuthState }) {
    const row = await this.required(input.id)
    if (row.grant_id !== input.grantId)
      throw new McpAccountError(
        'This refresh was replaced or disconnected.',
        409,
      )
    if (
      !row.refresh_claim &&
      row.token_revision === input.tokenRevision + 1 &&
      row.enabled
    ) {
      const existing = await this.decrypt(row)
      if (
        existing?.authMode === 'oauth' &&
        canonical(existing.oauth) === canonical(input.state)
      )
        return this.get(row.id)
    }
    const state = this.validateOAuth(input.state, row),
      ciphertext = await this.encrypt(row.id, {
        authMode: 'oauth',
        oauth: state,
      })
    const [saved] = await db.execute(
      sql`UPDATE chat_mcp_accounts SET ciphertext=${ciphertext},token_revision=token_revision+1,status='configured',error=NULL,refresh_claim=NULL,refresh_until=NULL,updated_at=${Date.now()} WHERE id=${row.id} AND user_id=${this.scope.userId} AND grant_id=${input.grantId} AND token_revision=${input.tokenRevision} AND refresh_claim=${input.claimId} AND refresh_until>${Date.now()} AND enabled=true AND removed=false AND ${this.membership()} RETURNING id`,
    )
    if (!saved)
      throw new McpAccountError(
        'This refresh expired or was replaced. Reconnect if needed.',
        409,
      )
    return this.get(row.id)
  }
  async failRefresh(input: RefreshClaim, options: { ambiguous: boolean }) {
    await this.authorize()
    await db.execute(
      sql`UPDATE chat_mcp_accounts SET refresh_claim=NULL,refresh_until=NULL,status=${options.ambiguous ? 'needs_auth' : 'error'},error=${options.ambiguous ? 'Reconnect after an interrupted refresh.' : 'The connection could not refresh. Try again.'} WHERE id=${input.id} AND user_id=${this.scope.userId} AND grant_id=${input.grantId} AND token_revision=${input.tokenRevision} AND refresh_claim=${input.claimId} AND ${this.membership()}`,
    )
  }
  async recordCheck(
    id: string,
    expectedRevision: number,
    result: { ok: boolean; error?: string; code?: keyof typeof mcpCheckErrors },
  ) {
    await this.authorize()
    const [saved] = await db.execute(
      sql`UPDATE chat_mcp_accounts SET status=${result.ok ? 'checked' : 'error'},checked_at=${Date.now()},error=${result.ok ? null : result.code ? mcpCheckErrors[result.code] : 'The connection check failed.'} WHERE id=${uuid.parse(id)} AND user_id=${this.scope.userId} AND revision=${rev.parse(expectedRevision)} AND enabled=true AND removed=false AND status!='needs_auth' AND ${this.membership()} RETURNING id`,
    )
    if (!saved)
      throw new McpAccountError(
        'This connection changed before the check completed.',
        409,
      )
    return this.get(id)
  }
}
