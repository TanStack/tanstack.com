import { createFileRoute } from '@tanstack/react-router'
import { getGitHubAuthState } from '~/auth/github.server'
import { ensureForgeMetaSession } from '~/builder/runtime/forge-meta.server'
import { createLocalForgeGitHubExport } from '~/builder/runtime/local-export.server'
import { withLocalForgeRuntimeSession } from '~/builder/runtime/local-store.server'
import {
  checkIpRateLimit,
  RATE_LIMITS,
  rateLimitedResponse,
} from '~/utils/rateLimit.server'
import {
  getForgeAccessErrorResponse,
  isForgeAuthBypassEnabled,
  requireForgeAccess,
} from '~/utils/forge-access.server'
import {
  validateBranchName,
  validateRepoName,
} from '~/utils/github-validation'

interface ForgeGitHubExportRequest {
  branch?: string
  isPrivate: boolean
  manifestVersionId?: string
  repoName: string
}

interface ForgeGitHubExportResponse {
  branch: string
  commitSha: string
  manifestVersionId: string
  owner: string
  repoName: string
  repoUrl: string
  success: true
}

interface ForgeGitHubExportAuthResponse {
  authenticated: boolean
  hasGitHubAccount: boolean
  hasPrivateRepoScope: boolean
  hasRepoScope: boolean
}

interface ForgeGitHubExportError {
  code:
    | 'ACTIVE_RUN'
    | 'ACTIVE_WORKFLOW'
    | 'EXPORT_FAILED'
    | 'INVALID_REQUEST'
    | 'MISSING_REPO_SCOPE'
    | 'NO_GITHUB_ACCOUNT'
    | 'NOT_AUTHENTICATED'
  error: string
  success: false
}

export const Route = createFileRoute('/api/forge/export/github')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        let user: Awaited<ReturnType<typeof requireForgeAccess>>

        try {
          user = await requireForgeAccess(request)
        } catch (error) {
          const response = getForgeAccessErrorResponse(error)

          if (response.status === 401) {
            return Response.json({
              authenticated: false,
              hasGitHubAccount: false,
              hasPrivateRepoScope: false,
              hasRepoScope: false,
            } satisfies ForgeGitHubExportAuthResponse)
          }

          return response
        }

        if (!user) {
          return Response.json({
            authenticated: false,
            hasGitHubAccount: false,
            hasPrivateRepoScope: false,
            hasRepoScope: false,
          } satisfies ForgeGitHubExportAuthResponse)
        }

        if (isForgeAuthBypassEnabled()) {
          return Response.json({
            authenticated: true,
            hasGitHubAccount: false,
            hasPrivateRepoScope: false,
            hasRepoScope: false,
          } satisfies ForgeGitHubExportAuthResponse)
        }

        const authState = await getGitHubAuthState(user.userId)

        return Response.json({
          authenticated: true,
          hasGitHubAccount: authState.hasGitHubAccount,
          hasPrivateRepoScope: authState.hasPrivateRepoScope,
          hasRepoScope: authState.hasRepoScope,
        } satisfies ForgeGitHubExportAuthResponse)
      },

      POST: async ({ request }: { request: Request }) => {
        const rateLimit = await checkIpRateLimit(request, RATE_LIMITS.deploy)

        if (!rateLimit.allowed) {
          return rateLimitedResponse(rateLimit)
        }

        let user: Awaited<ReturnType<typeof requireForgeAccess>>

        try {
          user = await requireForgeAccess(request)
        } catch (error) {
          return getForgeAccessErrorResponse(error)
        }

        const authState = await getGitHubAuthState(user.userId)

        if (!authState.hasGitHubAccount) {
          return Response.json(
            {
              code: 'NO_GITHUB_ACCOUNT',
              error: 'No GitHub account linked',
              success: false,
            } satisfies ForgeGitHubExportError,
            { status: 403 },
          )
        }

        const body = await readGitHubExportRequest(request)

        if (!body) {
          return Response.json(
            {
              code: 'INVALID_REQUEST',
              error: 'Invalid GitHub export request',
              success: false,
            } satisfies ForgeGitHubExportError,
            { status: 400 },
          )
        }

        const repoNameValidation = validateRepoName(body.repoName)

        if (!repoNameValidation.valid) {
          return Response.json(
            {
              code: 'INVALID_REQUEST',
              error: repoNameValidation.error ?? 'Invalid repository name',
              success: false,
            } satisfies ForgeGitHubExportError,
            { status: 400 },
          )
        }

        const branchValidation = body.branch
          ? validateBranchName(body.branch)
          : { valid: true }

        if (!branchValidation.valid) {
          return Response.json(
            {
              code: 'INVALID_REQUEST',
              error: branchValidation.error ?? 'Invalid branch name',
              success: false,
            } satisfies ForgeGitHubExportError,
            { status: 400 },
          )
        }

        const accessToken = authState.accessToken

        if (
          !hasRequiredGitHubRepoScope({
            authState,
            isPrivate: body.isPrivate,
          }) ||
          !accessToken
        ) {
          return Response.json(
            {
              code: 'MISSING_REPO_SCOPE',
              error: body.isPrivate
                ? 'Missing repo scope. Please re-authenticate with GitHub.'
                : 'Missing public_repo scope. Please re-authenticate with GitHub.',
              success: false,
            } satisfies ForgeGitHubExportError,
            { status: 403 },
          )
        }

        try {
          const meta = await ensureForgeMetaSession(user.userId)

          if (!meta.activeChatSession) {
            return Response.json(
              {
                code: 'INVALID_REQUEST',
                error: 'Forge has no active chat.',
                success: false,
              } satisfies ForgeGitHubExportError,
              { status: 404 },
            )
          }

          const result = await withLocalForgeRuntimeSession(
            meta.activeChatSession.runtimeSessionId,
            () =>
              createLocalForgeGitHubExport({
                accessToken,
                branch: body.branch,
                isPrivate: body.isPrivate,
                manifestVersionId: body.manifestVersionId,
                repoName: body.repoName,
              }),
          )

          return Response.json({
            ...result,
            success: true,
          } satisfies ForgeGitHubExportResponse)
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'GitHub export failed'

          if (isActiveRunExportError(errorMessage)) {
            return Response.json(
              {
                code: 'ACTIVE_RUN',
                error: errorMessage,
                success: false,
              } satisfies ForgeGitHubExportError,
              { status: 409 },
            )
          }

          if (isActiveWorkflowExportError(errorMessage)) {
            return Response.json(
              {
                code: 'ACTIVE_WORKFLOW',
                error: errorMessage,
                success: false,
              } satisfies ForgeGitHubExportError,
              { status: 409 },
            )
          }

          return Response.json(
            {
              code: 'EXPORT_FAILED',
              error: errorMessage,
              success: false,
            } satisfies ForgeGitHubExportError,
            { status: 500 },
          )
        }
      },
    },
  },
})

async function readGitHubExportRequest(
  request: Request,
): Promise<ForgeGitHubExportRequest | undefined> {
  try {
    const value: unknown = await request.json()

    if (!isRecord(value)) {
      return undefined
    }

    if (
      typeof value.repoName !== 'string' ||
      typeof value.isPrivate !== 'boolean'
    ) {
      return undefined
    }

    return {
      branch: typeof value.branch === 'string' ? value.branch : undefined,
      isPrivate: value.isPrivate,
      manifestVersionId:
        typeof value.manifestVersionId === 'string'
          ? value.manifestVersionId
          : undefined,
      repoName: value.repoName,
    }
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isActiveRunExportError(errorMessage: string) {
  return errorMessage.startsWith(
    'Cannot export the local Forge workspace to GitHub while Forge run ',
  )
}

function isActiveWorkflowExportError(errorMessage: string) {
  return (
    errorMessage ===
    'Cannot export the local Forge workspace to GitHub while another Forge workflow is active.'
  )
}

function hasRequiredGitHubRepoScope({
  authState,
  isPrivate,
}: {
  authState: {
    hasPrivateRepoScope: boolean
    hasRepoScope: boolean
  }
  isPrivate: boolean
}) {
  return isPrivate ? authState.hasPrivateRepoScope : authState.hasRepoScope
}
