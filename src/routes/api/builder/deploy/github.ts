import { createFileRoute } from '@tanstack/react-router'
import { getAuthService } from '~/auth/index.server'
import { getGitHubAuthState } from '~/auth/github.server'
import { compileHandler } from '~/builder/api'
import {
  createRepository,
  pushFiles,
  validateRepoName,
  generateRepoDescription,
} from '~/utils/github-repo.server'
import { checkIpRateLimit, rateLimitedResponse, RATE_LIMITS } from '~/utils/rateLimit.server'

interface DeployRequest {
  repoName: string
  isPrivate: boolean
  projectName: string
  features: Array<string>
  featureOptions: Record<string, Record<string, unknown>>
  tailwind: boolean
}

interface DeployResponse {
  success: true
  repoUrl: string
  owner: string
  repoName: string
}

interface DeployError {
  success: false
  error: string
  code:
  | 'NOT_AUTHENTICATED'
  | 'NO_GITHUB_ACCOUNT'
  | 'MISSING_REPO_SCOPE'
  | 'INVALID_REPO_NAME'
  | 'REPO_NAME_TAKEN'
  | 'REPO_CREATION_FAILED'
  | 'PUSH_FAILED'
  | 'COMPILE_FAILED'
  | 'INVALID_REQUEST'
}

export const Route = createFileRoute('/api/builder/deploy/github')({
  server: {
    handlers: {
      /**
       * GET: Check GitHub auth state for current user
       */
      GET: async ({ request }: { request: Request }) => {
        const authService = getAuthService()
        const user = await authService.getCurrentUser(request)

        if (!user) {
          return Response.json({
            authenticated: false,
            hasGitHubAccount: false,
            hasRepoScope: false,
          })
        }

        const authState = await getGitHubAuthState(user.userId)

        return Response.json({
          authenticated: true,
          ...authState,
        })
      },

      /**
       * POST: Create GitHub repo and push project files
       */
      POST: async ({ request }: { request: Request }) => {
        // Rate limiting (10 requests/minute per IP)
        const rateLimit = await checkIpRateLimit(request, RATE_LIMITS.deploy)
        if (!rateLimit.allowed) {
          return rateLimitedResponse(rateLimit)
        }

        const authService = getAuthService()
        const user = await authService.getCurrentUser(request)

        if (!user) {
          return Response.json(
            {
              success: false,
              error: 'You must be logged in to deploy',
              code: 'NOT_AUTHENTICATED',
            } satisfies DeployError,
            { status: 401 },
          )
        }

        const authState = await getGitHubAuthState(user.userId)

        if (!authState.hasGitHubAccount) {
          return Response.json(
            {
              success: false,
              error: 'No GitHub account linked',
              code: 'NO_GITHUB_ACCOUNT',
            } satisfies DeployError,
            { status: 403 },
          )
        }

        if (!authState.hasRepoScope || !authState.accessToken) {
          console.log('[Deploy] Auth state check failed:', {
            hasRepoScope: authState.hasRepoScope,
            hasToken: !!authState.accessToken,
          })
          return Response.json(
            {
              success: false,
              error: 'Missing public_repo scope. Please re-authenticate with GitHub.',
              code: 'MISSING_REPO_SCOPE',
            } satisfies DeployError,
            { status: 403 },
          )
        }
        console.log('[Deploy] Auth state OK, hasRepoScope:', authState.hasRepoScope)

        let body: DeployRequest
        try {
          body = await request.json()
        } catch {
          return Response.json(
            {
              success: false,
              error: 'Invalid request body',
              code: 'INVALID_REQUEST',
            } satisfies DeployError,
            { status: 400 },
          )
        }

        const { repoName, isPrivate, projectName, features, featureOptions, tailwind } = body

        // Validate repo name
        const validation = validateRepoName(repoName)
        if (!validation.valid) {
          return Response.json(
            {
              success: false,
              error: validation.error ?? 'Invalid repository name',
              code: 'INVALID_REPO_NAME',
            } satisfies DeployError,
            { status: 400 },
          )
        }

        // Compile the project
        let compiledFiles: Record<string, string>
        try {
          const result = await compileHandler({
            name: projectName,
            tailwind,
            features,
            featureOptions,
          })
          compiledFiles = result.files
        } catch (error) {
          console.error('[Deploy] Compile failed:', error)
          return Response.json(
            {
              success: false,
              error: 'Failed to compile project',
              code: 'COMPILE_FAILED',
            } satisfies DeployError,
            { status: 500 },
          )
        }

        // Create the repository
        const description = generateRepoDescription(features)
        console.log('[Deploy] Creating repository:', { repoName, isPrivate, description })
        const createResult = await createRepository(authState.accessToken, {
          name: repoName,
          description,
          isPrivate,
        })

        if (!createResult.success) {
          console.error('[Deploy] Repository creation failed:', {
            error: createResult.error,
            code: createResult.code,
          })
          const code = createResult.code === 'NAME_TAKEN' ? 'REPO_NAME_TAKEN' : 'REPO_CREATION_FAILED'
          return Response.json(
            {
              success: false,
              error: createResult.error,
              code,
            } satisfies DeployError,
            { status: code === 'REPO_NAME_TAKEN' ? 409 : 500 },
          )
        }
        console.log('[Deploy] Repository created:', createResult.repoUrl)

        // Push files to the repository
        const pushResult = await pushFiles(authState.accessToken, {
          owner: createResult.owner,
          repo: createResult.name,
          files: compiledFiles,
          message: 'Initial commit from TanStack Builder',
        })

        if (!pushResult.success) {
          console.error('[Deploy] Push failed:', pushResult.error)
          return Response.json(
            {
              success: false,
              error: `Repository created but failed to push files: ${pushResult.error}`,
              code: 'PUSH_FAILED',
            } satisfies DeployError,
            { status: 500 },
          )
        }

        return Response.json({
          success: true,
          repoUrl: createResult.repoUrl,
          owner: createResult.owner,
          repoName: createResult.name,
        } satisfies DeployResponse)
      },
    },
  },
})
