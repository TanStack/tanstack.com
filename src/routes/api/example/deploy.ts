import { createFileRoute } from '@tanstack/react-router'
import { getAuthService } from '~/auth/index.server'
import { getGitHubAuthState } from '~/auth/github.server'
import {
  createRepository,
  pushFiles,
  validateRepoName,
} from '~/utils/github-repo.server'
import {
  fetchExampleFiles,
  filterExcludedFiles,
} from '~/utils/github-example.server'
import {
  applyProviderConfig,
  generateExampleDescription,
  isStartApp as _isStartApp,
  type DeployProvider,
} from '~/utils/provider-config.server'
import {
  checkIpRateLimit,
  rateLimitedResponse,
  RATE_LIMITS,
} from '~/utils/rateLimit.server'

interface DeployRequest {
  repoName: string
  isPrivate: boolean
  sourceRepo: string
  branch: string
  examplePath: string
  provider: DeployProvider
  libraryName: string
  exampleName: string
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
  | 'FETCH_FAILED'
  | 'INVALID_REQUEST'
}

export const Route = createFileRoute('/api/example/deploy')({
  server: {
    handlers: {
      /**
       * POST: Create GitHub repo from example files and push with provider config
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
          return Response.json(
            {
              success: false,
              error:
                'Missing public_repo scope. Please re-authenticate with GitHub.',
              code: 'MISSING_REPO_SCOPE',
            } satisfies DeployError,
            { status: 403 },
          )
        }

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

        const {
          repoName,
          isPrivate,
          sourceRepo,
          branch,
          examplePath,
          provider,
          libraryName,
          exampleName,
        } = body

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

        // Fetch example files from source repo
        console.log('[ExampleDeploy] Fetching example files:', {
          sourceRepo,
          branch,
          examplePath,
        })

        const fetchResult = await fetchExampleFiles(
          sourceRepo,
          branch,
          `examples/${examplePath}`,
        )

        if (!fetchResult.success) {
          console.error('[ExampleDeploy] Fetch failed:', fetchResult.error)
          return Response.json(
            {
              success: false,
              error: `Failed to fetch example files: ${fetchResult.error}`,
              code: 'FETCH_FAILED',
            } satisfies DeployError,
            { status: 500 },
          )
        }

        // Filter out excluded files (node_modules, dist, etc.)
        let files = filterExcludedFiles(fetchResult.files)

        // Apply provider-specific configuration (only modifies Start apps)
        console.log('[ExampleDeploy] Applying provider config:', provider)
        files = applyProviderConfig(files, provider, repoName)

        // Create the repository
        const description = generateExampleDescription(
          libraryName,
          exampleName,
          provider,
        )
        console.log('[ExampleDeploy] Creating repository:', {
          repoName,
          isPrivate,
          description,
        })

        const createResult = await createRepository(authState.accessToken, {
          name: repoName,
          description,
          isPrivate,
        })

        if (!createResult.success) {
          console.error('[ExampleDeploy] Repository creation failed:', {
            error: createResult.error,
            code: createResult.code,
          })
          const code =
            createResult.code === 'NAME_TAKEN'
              ? 'REPO_NAME_TAKEN'
              : 'REPO_CREATION_FAILED'
          return Response.json(
            {
              success: false,
              error: createResult.error,
              code,
            } satisfies DeployError,
            { status: code === 'REPO_NAME_TAKEN' ? 409 : 500 },
          )
        }
        console.log('[ExampleDeploy] Repository created:', createResult.repoUrl)

        // Push files to the repository
        const pushResult = await pushFiles(authState.accessToken, {
          owner: createResult.owner,
          repo: createResult.name,
          files,
          message: `Initial commit from TanStack ${libraryName} example`,
        })

        if (!pushResult.success) {
          console.error('[ExampleDeploy] Push failed:', pushResult.error)
          return Response.json(
            {
              success: false,
              error: `Repository created but failed to push files: ${pushResult.error}`,
              code: 'PUSH_FAILED',
            } satisfies DeployError,
            { status: 500 },
          )
        }

        console.log('[ExampleDeploy] Success!')

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
