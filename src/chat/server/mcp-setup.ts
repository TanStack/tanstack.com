import { z } from 'zod'
import {
  exchangeAuthorization,
  registerClient,
  startAuthorization,
} from '@modelcontextprotocol/sdk/client/auth.js'
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import {
  prepareMcpSetupSchema,
  mcpSetupSummarySchema,
  type McpSetupSummary,
} from '../core/mcp-setup'
import { sql } from 'drizzle-orm'
import { db } from '~/db/client'
import { readWorkspacePolicy } from '../workspace-policy.server'
import type { CredentialEnv } from './credentials'
import type { McpEgressEnvironment } from './mcp-public-fetch'
import { hash, seal, unseal, b64 } from './crypto'
import { McpAccounts } from './mcp-accounts'
import type { McpAccountScope } from './mcp-account-contract'
import { Plugins } from './plugins'
import { authorizationFetch, McpAuthorizationError } from './mcp-auth-network'
import {
  discoverMcpSetup,
  validateDiscoveredOAuth,
  type DiscoveredMcpOAuth,
} from './mcp-oauth-discovery'
import { validateMcpEndpoint } from './public-endpoint'
import { publicMcpFetch } from './mcp-public-fetch'
import { withMcpClient } from './mcp'

type Input = z.infer<typeof prepareMcpSetupSchema>
interface Secret {
  schemaVersion: 1
  userId: string
  workspaceId: string
  id: string
  origin: string
  input: Input
  accountId: string
  expectedRevision: number
  label: string
  url: string
  oauth?: DiscoveredMcpOAuth
  client?: OAuthClientInformationMixed
  verifier?: string
  browserNonce?: string
  grantId?: string
  grantRevision?: number
  state?: string
}
interface Row extends Record<string, unknown> {
  id: string
  user_id: string
  workspace_id: string
  request_hash: string
  status: McpSetupSummary['status']
  summary: string
  ciphertext: string
  state_hash: string | null
  browser_hash: string | null
  expires_at: number
}
const lifespan = 10 * 60 * 1000
const cookieName = (id: string) => `gum_mcp_${id}`
function cookie(request: Request, name: string) {
  return request.headers
    .get('cookie')
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(name + '='))
    ?.slice(name.length + 1)
}
export function setupCookie(
  request: Request,
  id: string,
  nonce: string,
  clear = false,
) {
  return `${cookieName(id)}=${nonce}; HttpOnly; SameSite=Lax; Path=/auth/mcp/; Max-Age=${clear ? 0 : 600}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`
}
export function mcpClientMetadata(
  origin: string,
): OAuthClientMetadata & { application_type: 'web' | 'native' } {
  const hostname = new URL(origin).hostname.toLowerCase().replace(/\.$/, '')
  const loopback =
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '[::1]' ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname)
  return {
    client_name: 'TanChat',
    client_uri: origin,
    redirect_uris: [origin + '/auth/mcp/callback'],
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_method: 'none',
    // Application type describes where the app runs, independently of whether
    // this origin qualifies as a publicly fetchable client metadata URL.
    application_type: loopback ? 'native' : 'web',
  }
}
function hasPublicMetadata(origin: string) {
  try {
    validateMcpEndpoint(origin)
    return true
  } catch {
    return false
  }
}
function safeFailure(error: unknown) {
  return error instanceof McpAuthorizationError
    ? error.message
    : 'Could not connect this service. Start a new connection attempt.'
}
export class McpSetups {
  constructor(
    private env: CredentialEnv & McpEgressEnvironment,
    private scope: McpAccountScope,
    private options: { fetch?: typeof fetch } = {},
  ) {}
  private async authorize() {
    const policy = await readWorkspacePolicy(
      this.scope.workspaceId,
      this.scope.userId,
    )
    if (!policy?.allowMcp)
      throw new McpAuthorizationError(
        'Connection setup is unavailable in this workspace.',
        403,
      )
  }
  private network() {
    return this.options.fetch ?? publicMcpFetch(this.env)
  }
  private async read(id: string, allowExpired = false) {
    await this.authorize()
    z.string().uuid().parse(id)
    const [row] = await db.execute<Row>(
      sql`SELECT *, summary::text AS summary, expires_at::double precision AS expires_at FROM chat_mcp_setup_attempts WHERE id=${id} AND user_id=${this.scope.userId} AND workspace_id=${this.scope.workspaceId}`,
    )
    if (!row)
      throw new McpAuthorizationError('Connection setup was not found.', 404)
    if (
      !allowExpired &&
      row.status !== 'complete' &&
      row.expires_at <= Date.now()
    )
      throw new McpAuthorizationError(
        'This connection attempt expired. Start a new one.',
        410,
      )
    const secret = await unseal<Secret>(row.ciphertext, this.env.ENCRYPTION_KEY)
    if (
      secret.schemaVersion !== 1 ||
      secret.id !== id ||
      secret.userId !== this.scope.userId ||
      secret.workspaceId !== this.scope.workspaceId
    )
      throw new McpAuthorizationError(
        'Connection setup data is unavailable.',
        409,
      )
    return {
      row,
      secret,
      summary: mcpSetupSummarySchema.parse({
        ...JSON.parse(row.summary),
        status: row.status,
      }),
    }
  }
  private async plugin(input: Input) {
    if (!input.plugin) return
    const value = await new Plugins(this.env, this.scope).inspect(
      input.plugin.installationId,
      input.plugin.version,
    )
    if (
      value.removed ||
      value.revision !== input.plugin.revision ||
      value.currentVersion !== input.plugin.version
    )
      throw new McpAuthorizationError(
        'The package changed. Review its current connection requirements.',
        409,
      )
    const requirement = value.package.mcpServers.find(
      (item) => item.key === input.plugin!.requirementKey,
    )
    if (!requirement?.supported || !requirement.url)
      throw new McpAuthorizationError(
        'This package connection is not supported.',
      )
    return {
      label: `${value.name} · ${requirement.key}`.slice(0, 80),
      url: requirement.url,
      name: value.name,
    }
  }
  async get(id: string) {
    const value = await this.read(id)
    return value.summary
  }
  async prepare(raw: unknown, origin: string, signal?: AbortSignal) {
    const input = prepareMcpSetupSchema.parse(raw)
    await this.authorize()
    await db.execute(
      sql`DELETE FROM chat_mcp_setup_attempts WHERE user_id=${this.scope.userId} AND expires_at<${Date.now() - 86400000}`,
    )
    const requestHash = await hash(JSON.stringify([origin, input]))
    const [existing] = await db.execute<{ request_hash: string }>(
      sql`SELECT request_hash FROM chat_mcp_setup_attempts WHERE id=${input.id} AND user_id=${this.scope.userId} AND workspace_id=${this.scope.workspaceId}`,
    )
    if (existing) {
      if (existing.request_hash !== requestHash)
        throw new McpAuthorizationError(
          'This connection attempt belongs to a different request.',
          409,
        )
      return this.get(input.id)
    }
    const [recent] = await db.execute<{ count: number }>(
      sql`SELECT COUNT(*)::integer AS count FROM chat_mcp_setup_attempts WHERE user_id=${this.scope.userId} AND created_at>${Date.now() - lifespan}`,
    )
    if ((recent?.count ?? 0) >= 20)
      throw new McpAuthorizationError(
        'Too many connection attempts. Try again in a few minutes.',
        429,
      )
    const requirement = await this.plugin(input)
    const account = input.accountId
      ? await new McpAccounts(this.env, this.scope).get(input.accountId)
      : undefined
    if (account && input.expectedRevision !== account.revision)
      throw new McpAuthorizationError(
        'This connection changed. Review it again.',
        409,
      )
    const label = requirement?.label ?? account?.label ?? input.label!
    const endpoint = validateMcpEndpoint(
      requirement?.url ?? account?.url ?? input.url!,
    )
    if (requirement && account && account.url !== endpoint)
      throw new McpAuthorizationError(
        'The selected account belongs to another service.',
        409,
      )
    const secret: Secret = {
      schemaVersion: 1,
      id: input.id,
      userId: this.scope.userId,
      workspaceId: this.scope.workspaceId,
      origin,
      input,
      label,
      url: endpoint,
      accountId: account?.id ?? crypto.randomUUID(),
      expectedRevision: account?.revision ?? 0,
    }
    let summary: McpSetupSummary = {
      id: input.id,
      accountId: secret.accountId,
      label,
      url: endpoint,
      status: 'review',
      kind: 'unsupported',
      scopes: [],
      expiresAt: Date.now() + lifespan,
      ...(requirement && input.plugin
        ? { plugin: { ...input.plugin, name: requirement.name } }
        : {}),
    }
    try {
      const result = await discoverMcpSetup(endpoint, {
        fetch: this.network(),
        signal,
        clientMetadataAvailable: hasPublicMetadata(origin),
      })
      if (result.kind === 'public')
        summary = { ...summary, kind: 'public', checkedAt: result.checkedAt }
      else {
        secret.oauth = result.oauth
        summary = {
          ...summary,
          kind: 'oauth',
          issuer: result.oauth.issuer,
          scopes: result.oauth.scope.split(' ').filter(Boolean),
          registration: result.oauth.registration,
        }
      }
    } catch (error) {
      summary = { ...summary, error: safeFailure(error) }
    }
    await this.authorize()
    const encrypted = await seal(secret, this.env.ENCRYPTION_KEY)
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM users WHERE id=${this.scope.userId} FOR UPDATE`,
      )
      const [existing] = await tx.execute<{ request_hash: string }>(
        sql`SELECT request_hash FROM chat_mcp_setup_attempts WHERE id=${input.id} AND user_id=${this.scope.userId} AND workspace_id=${this.scope.workspaceId}`,
      )
      if (existing) {
        if (existing.request_hash !== requestHash)
          throw new McpAuthorizationError(
            'This connection attempt belongs to a different request.',
            409,
          )
        return
      }
      const [recent] = await tx.execute<{ count: number }>(
        sql`SELECT COUNT(*)::integer AS count FROM chat_mcp_setup_attempts WHERE user_id=${this.scope.userId} AND created_at>${Date.now() - lifespan}`,
      )
      if ((recent?.count ?? 0) >= 20)
        throw new McpAuthorizationError(
          'Too many connection attempts. Try again in a few minutes.',
          429,
        )
      await tx.execute(
        sql`INSERT INTO chat_mcp_setup_attempts(id,user_id,workspace_id,request_hash,status,summary,ciphertext,expires_at,created_at) VALUES(${input.id},${this.scope.userId},${this.scope.workspaceId},${requestHash},${summary.status},${JSON.stringify(summary)}::jsonb,${encrypted},${summary.expiresAt},${Date.now()}) ON CONFLICT DO NOTHING`,
      )
    })
    const [accepted] = await db.execute<{ request_hash: string }>(
      sql`SELECT request_hash FROM chat_mcp_setup_attempts WHERE id=${input.id} AND user_id=${this.scope.userId} AND workspace_id=${this.scope.workspaceId}`,
    )
    if (accepted?.request_hash !== requestHash)
      throw new McpAuthorizationError(
        'This connection attempt belongs to a different request.',
        409,
      )
    return this.get(input.id)
  }
  async start(
    id: string,
    request: Request,
  ): Promise<{ summary: McpSetupSummary; cookie?: string }> {
    const { row, secret, summary } = await this.read(id)
    if (new URL(request.url).origin !== secret.origin)
      throw new McpAuthorizationError(
        'Return to the TanChat address where setup began.',
        403,
      )
    if (summary.status === 'complete') return { summary }
    if (summary.status === 'authorize' && secret.browserNonce)
      return { summary, cookie: setupCookie(request, id, secret.browserNonce) }
    if (summary.status !== 'review')
      throw new McpAuthorizationError(
        'This connection attempt cannot be restarted. Start a new one.',
        409,
      )
    if (summary.kind === 'unsupported')
      throw new McpAuthorizationError(
        summary.error ?? 'This service requires a different setup method.',
      )
    await this.plugin(secret.input)
    const [claimed] = await db.execute(
      sql`UPDATE chat_mcp_setup_attempts SET status='starting' WHERE id=${id} AND user_id=${this.scope.userId} AND workspace_id=${this.scope.workspaceId} AND status='review' AND expires_at>${Date.now()} RETURNING id`,
    )
    if (!claimed)
      throw new McpAuthorizationError(
        'This connection attempt is already starting. Check its status.',
        409,
      )
    const accounts = new McpAccounts(this.env, this.scope)
    try {
      if (summary.kind === 'public') {
        await withMcpClient(
          { id: 'setup', label: secret.label, url: secret.url },
          async () => {},
          request.signal,
          {
            fetch: authorizationFetch({
              fetch: this.network(),
              signal: request.signal,
              allowedGets: [secret.url],
              allowedPosts: [secret.url],
            }),
          },
        )
        const saved = await accounts.command({
          type: 'save',
          id: secret.accountId,
          commandId: id,
          expectedRevision: secret.expectedRevision,
          label: secret.label,
          url: secret.url,
          authMode: 'none',
        })
        if (
          saved.url !== secret.url ||
          saved.authMode !== 'none' ||
          !saved.enabled
        )
          throw new McpAuthorizationError(
            'This connection changed. Review it again.',
            409,
          )
        // The probe belongs to the exact saved receipt, never a later account
        // revision that could name a different service after this await.
        const checked = await accounts.recordCheck(saved.id, saved.revision, {
          ok: true,
        })
        const done = {
          ...summary,
          status: 'complete' as const,
          checkedAt: checked.checkedAt,
        }
        await this.save(row, secret, done, 'starting')
        return { summary: done }
      }
      const oauth = validateDiscoveredOAuth(secret.oauth!, secret.url)
      const grant = await accounts.beginOAuth({
        id: secret.accountId,
        commandId: id,
        expectedRevision: secret.expectedRevision,
        label: secret.label,
        url: secret.url,
      })
      secret.grantId = grant.grantId
      secret.grantRevision = grant.summary.revision
      const metadata = mcpClientMetadata(secret.origin)
      secret.client =
        oauth.registration === 'metadata'
          ? { client_id: secret.origin + '/auth/mcp/client-metadata' }
          : await registerClient(oauth.issuer, {
              metadata: oauth.metadata,
              clientMetadata: metadata,
              scope: oauth.scope,
              fetchFn: authorizationFetch({
                fetch: this.network(),
                allowedPosts: [oauth.metadata.registration_endpoint!],
                allowedGets: [],
                signal: request.signal,
              }),
            })
      if (!secret.client.client_id || secret.client.client_id.length > 4096)
        throw new McpAuthorizationError(
          'The sign-in provider returned an invalid client identity.',
        )
      secret.state = b64(crypto.getRandomValues(new Uint8Array(32)))
      secret.browserNonce = b64(crypto.getRandomValues(new Uint8Array(32)))
      const authorization = await startAuthorization(oauth.issuer, {
        metadata: oauth.metadata,
        clientInformation: secret.client,
        redirectUrl: secret.origin + '/auth/mcp/callback',
        scope: oauth.scope,
        state: secret.state,
        resource: new URL(oauth.resource),
      })
      secret.verifier = authorization.codeVerifier
      const next = {
        ...summary,
        status: 'authorize' as const,
        authorizationUrl: authorization.authorizationUrl.href,
      }
      await this.save(row, secret, next, 'starting')
      return {
        summary: next,
        cookie: setupCookie(request, id, secret.browserNonce),
      }
    } catch (error) {
      const failed = {
        ...summary,
        status: 'failed' as const,
        error: safeFailure(error),
      }
      delete secret.verifier
      delete secret.browserNonce
      delete secret.client
      delete secret.state
      await this.save(row, secret, failed, 'starting')
      return { summary: failed }
    }
  }
  private async save(
    row: Row,
    secret: Secret,
    summary: McpSetupSummary,
    expected: Row['status'],
  ) {
    await this.authorize()
    const encrypted = await seal(secret, this.env.ENCRYPTION_KEY)
    const stateHash = secret.state ? await hash(secret.state) : null
    const browserHash = secret.browserNonce
      ? await hash(secret.browserNonce)
      : null
    const [result] = await db.execute(
      sql`UPDATE chat_mcp_setup_attempts SET status=${summary.status},summary=${JSON.stringify(summary)}::jsonb,ciphertext=${encrypted},state_hash=${stateHash},browser_hash=${browserHash} WHERE id=${row.id} AND user_id=${this.scope.userId} AND workspace_id=${this.scope.workspaceId} AND status=${expected} RETURNING id`,
    )
    if (!result)
      throw new McpAuthorizationError(
        'Connection setup changed. Review its current status.',
        409,
      )
  }
  async callback(id: string, request: Request) {
    const { row, secret, summary } = await this.read(id)
    const url = new URL(request.url)
    const state = url.searchParams.get('state'),
      browser = cookie(request, cookieName(id))
    if (
      url.origin !== secret.origin ||
      !state ||
      !browser ||
      (await hash(state)) !== row.state_hash ||
      (await hash(browser)) !== row.browser_hash
    )
      throw new McpAuthorizationError(
        'This sign-in response does not match the browser that started it.',
        403,
      )
    if (row.status !== 'authorize')
      throw new McpAuthorizationError(
        'This sign-in response has already been used.',
        409,
      )
    const [claimed] = await db.execute(
      sql`UPDATE chat_mcp_setup_attempts SET status='starting' WHERE id=${id} AND user_id=${this.scope.userId} AND workspace_id=${this.scope.workspaceId} AND status='authorize' AND expires_at>${Date.now()} RETURNING id`,
    )
    if (!claimed)
      throw new McpAuthorizationError(
        'This sign-in response has already been used.',
        409,
      )
    let next: McpSetupSummary
    try {
      const oauth = validateDiscoveredOAuth(secret.oauth!, secret.url)
      // Validate issuer on success and error responses before exchanging any code.
      if (
        url.searchParams.getAll('iss').length !== 1 ||
        url.searchParams.get('iss') !== oauth.issuer
      )
        throw new McpAuthorizationError(
          'The sign-in provider did not return the expected issuer. No code was exchanged.',
        )
      if (url.searchParams.has('error'))
        throw new McpAuthorizationError(
          'Sign-in was declined or could not be completed.',
        )
      const codes = url.searchParams.getAll('code')
      if (codes.length !== 1 || !codes[0] || codes[0].length > 8192)
        throw new McpAuthorizationError(
          'The sign-in provider returned an invalid authorization code.',
        )
      await this.plugin(secret.input)
      const account = await new McpAccounts(this.env, this.scope).read(
        secret.accountId,
      )
      if (
        !account.summary.enabled ||
        account.grantId !== secret.grantId ||
        account.summary.revision !== secret.grantRevision
      )
        throw new McpAuthorizationError(
          'This connection changed. Start a new sign-in attempt.',
          409,
        )
      const tokens = await exchangeAuthorization(oauth.issuer, {
        metadata: oauth.metadata,
        clientInformation: secret.client!,
        authorizationCode: codes[0],
        codeVerifier: secret.verifier!,
        redirectUri: secret.origin + '/auth/mcp/callback',
        resource: new URL(oauth.resource),
        fetchFn: authorizationFetch({
          fetch: this.network(),
          allowedPosts: [oauth.metadata.token_endpoint],
          allowedCredentialUrls: [oauth.metadata.token_endpoint],
          allowedGets: [],
          signal: request.signal,
        }),
      })
      tokens.scope ??= oauth.scope
      const reviewedScopes = new Set(oauth.scope.split(' ').filter(Boolean))
      if (
        tokens.scope
          .split(' ')
          .some((scope) => scope && !reviewedScopes.has(scope))
      )
        throw new McpAuthorizationError(
          'The sign-in provider granted permissions that were not reviewed. Start a new connection attempt.',
        )
      if (
        tokens.token_type.toLowerCase() !== 'bearer' ||
        !tokens.access_token ||
        tokens.access_token.length > 16000 ||
        (tokens.expires_in !== undefined &&
          (!Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0))
      )
        throw new McpAuthorizationError(
          'The sign-in provider returned an unsupported token.',
        )
      await new McpAccounts(this.env, this.scope).completeOAuth({
        id: secret.accountId,
        expectedRevision: secret.grantRevision!,
        grantId: secret.grantId!,
        state: {
          grantId: secret.grantId!,
          clientInformation: secret.client!,
          authorizationServerUrl: oauth.issuer,
          authorizationServerMetadata: oauth.metadata,
          resource: oauth.resource,
          tokens,
          ...(tokens.expires_in === undefined
            ? {}
            : { expiresAt: Date.now() + tokens.expires_in * 1000 }),
          redirectUri: secret.origin + '/auth/mcp/callback',
        },
      })
      next = { ...summary, status: 'complete', authorizationUrl: undefined }
    } catch (error) {
      next = {
        ...summary,
        status: 'failed',
        authorizationUrl: undefined,
        error: safeFailure(error),
      }
    }
    delete secret.verifier
    delete secret.browserNonce
    delete secret.client
    delete secret.state
    await this.save(row, secret, next, 'starting')
    const target = secret.input.returnBotId
      ? `/chat/b/${encodeURIComponent(secret.input.returnBotId)}`
      : `/chat/w/${encodeURIComponent(this.scope.workspaceId)}`
    return {
      summary: next,
      location:
        target + '?settings=mcp&connectionSetup=' + encodeURIComponent(id),
      cookie: setupCookie(request, id, '', true),
    }
  }
}
