import type {
  AuthorizationServerMetadata,
  OAuthClientInformationMixed,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'
export class McpAccountError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
    this.name = 'McpAccountError'
  }
}
export interface McpAccountScope {
  workspaceId: string
  userId: string
}
export interface McpOAuthState {
  grantId: string
  clientInformation?: OAuthClientInformationMixed
  authorizationServerUrl: string
  authorizationServerMetadata?: AuthorizationServerMetadata
  resource: string
  tokens?: OAuthTokens
  expiresAt?: number
  redirectUri: string
}
export type McpAccountSecret =
  | { authMode: 'token'; accessToken: string }
  | { authMode: 'oauth'; oauth: McpOAuthState }
export interface RefreshClaim {
  id: string
  claimId: string
  grantId: string
  tokenRevision: number
}
export type RefreshResult =
  | ({ status: 'claimed'; secret: McpOAuthState } & RefreshClaim)
  | { status: 'busy' | 'needs_auth' | 'not_needed' }
