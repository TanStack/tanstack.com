import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import type { DeployProvider } from "~/utils/provider-config.server";
import {
  jsonResponse,
  readJsonBody,
  validateJsonRequest,
} from "~/utils/api-boundary.server";
import { parseBuilderRequest } from "~/builder/api/request-schema.server";

interface DeployRequest {
  repoName: string;
  isPrivate: boolean;
  sourceRepo: string;
  branch: string;
  examplePath: string;
  provider: DeployProvider;
  libraryName: string;
  exampleName: string;
}

interface DeployResponse {
  success: true;
  repoUrl: string;
  owner: string;
  repoName: string;
}

interface DeployError {
  success: false;
  error: string;
  code:
    | "NOT_AUTHENTICATED"
    | "NO_GITHUB_ACCOUNT"
    | "MISSING_REPO_SCOPE"
    | "INVALID_REPO_NAME"
    | "REPO_NAME_TAKEN"
    | "REPO_CREATION_FAILED"
    | "PUSH_FAILED"
    | "FETCH_FAILED"
    | "INVALID_REQUEST";
}

const exampleDeployBodySchema = v.object({
  repoName: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  isPrivate: v.boolean(),
  sourceRepo: v.pipe(v.string(), v.minLength(3), v.maxLength(200)),
  branch: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  examplePath: v.pipe(v.string(), v.minLength(1), v.maxLength(260)),
  provider: v.picklist(["cloudflare", "netlify", "railway"]),
  libraryName: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
  exampleName: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
});

function deployErrorResponse(error: DeployError, status: number, headers?: Headers) {
  return jsonResponse(error, { status, headers });
}

function isSafeSourceRepo(repo: string) {
  return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo);
}

function isSafeGitRef(ref: string) {
  return !ref.startsWith("/") && !ref.includes("..") && !ref.includes("\\");
}

function isSafeExamplePath(path: string) {
  return (
    !path.startsWith("/") &&
    !path.includes("..") &&
    !path.includes("\\") &&
    !path.split("/").some((segment) => !segment || segment === ".")
  );
}

export const Route = createFileRoute("/api/example/deploy")({
  server: {
    handlers: {
      /**
       * POST: Create GitHub repo from example files and push with provider config
       */
      POST: async ({ request }: { request: Request }) => {
        const [
          authIndex,
          authGithub,
          githubRepo,
          githubExample,
          providerConfig,
          rateLimitModule,
        ] = await Promise.all([
          import("~/auth/index.server"),
          import("~/auth/github.server"),
          import("~/utils/github-repo.server"),
          import("~/utils/github-example.server"),
          import("~/utils/provider-config.server"),
          import("~/utils/rateLimit.server"),
        ]);
        const { getAuthService } = authIndex;
        const { getGitHubAuthState } = authGithub;
        const {
          createRepository,
          pushFiles,
          validateGitHubFiles,
          validateRepoName,
        } = githubRepo;
        const { fetchExampleFiles, filterExcludedFiles } = githubExample;
        const {
          applyProviderConfig,
          generateExampleDescription,
          isStartApp: _isStartApp,
        } = providerConfig;
        const { checkIpRateLimit, rateLimitedResponse, RATE_LIMITS } =
          rateLimitModule;
        // Rate limiting (10 requests/minute per IP)
        const rateLimit = await checkIpRateLimit(request, RATE_LIMITS.deploy);
        if (!rateLimit.allowed) {
          return rateLimitedResponse(rateLimit);
        }

        const guardError = validateJsonRequest(request, {
          maxContentLength: 64 * 1024,
        });
        if (guardError) {
          return deployErrorResponse(
            {
              success: false,
              error: guardError.message,
              code: "INVALID_REQUEST",
            },
            guardError.status,
            rateLimit.headers,
          );
        }

        const authService = getAuthService();
        const user = await authService.getCurrentUser(request);

        if (!user) {
          return deployErrorResponse(
            {
              success: false,
              error: "You must be logged in to deploy",
              code: "NOT_AUTHENTICATED",
            },
            401,
            rateLimit.headers,
          );
        }

        const authState = await getGitHubAuthState(user.userId);

        if (!authState.hasGitHubAccount) {
          return deployErrorResponse(
            {
              success: false,
              error: "No GitHub account linked",
              code: "NO_GITHUB_ACCOUNT",
            },
            403,
            rateLimit.headers,
          );
        }

        if (!authState.hasRepoScope || !authState.accessToken) {
          return deployErrorResponse(
            {
              success: false,
              error:
                "Missing public_repo scope. Please re-authenticate with GitHub.",
              code: "MISSING_REPO_SCOPE",
            },
            403,
            rateLimit.headers,
          );
        }

        let body: DeployRequest;
        try {
          const bodyResult = await readJsonBody(request, {
            maxContentLength: 64 * 1024,
          });
          if (!bodyResult.success) {
            throw new Error(bodyResult.error.message);
          }
          body = parseBuilderRequest(exampleDeployBodySchema, bodyResult.body);
        } catch {
          return deployErrorResponse(
            {
              success: false,
              error: "Invalid request body",
              code: "INVALID_REQUEST",
            },
            400,
            rateLimit.headers,
          );
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
        } = body;

        if (
          !isSafeSourceRepo(sourceRepo) ||
          !isSafeGitRef(branch) ||
          !isSafeExamplePath(examplePath)
        ) {
          return deployErrorResponse(
            {
              success: false,
              error: "Invalid source repository, branch, or example path",
              code: "INVALID_REQUEST",
            },
            400,
            rateLimit.headers,
          );
        }

        // Validate repo name
        const validation = validateRepoName(repoName);
        if (!validation.valid) {
          return deployErrorResponse(
            {
              success: false,
              error: validation.error ?? "Invalid repository name",
              code: "INVALID_REPO_NAME",
            },
            400,
            rateLimit.headers,
          );
        }

        // Fetch example files from source repo
        console.log("[ExampleDeploy] Fetching example files:", {
          sourceRepo,
          branch,
          examplePath,
        });

        const fetchResult = await fetchExampleFiles(
          sourceRepo,
          branch,
          `examples/${examplePath}`,
        );

        if (!fetchResult.success) {
          console.error("[ExampleDeploy] Fetch failed:", fetchResult.error);
          return deployErrorResponse(
            {
              success: false,
              error: `Failed to fetch example files: ${fetchResult.error}`,
              code: "FETCH_FAILED",
            },
            500,
            rateLimit.headers,
          );
        }

        // Filter out excluded files (node_modules, dist, etc.)
        let files = filterExcludedFiles(fetchResult.files);

        // Apply provider-specific configuration (only modifies Start apps)
        console.log("[ExampleDeploy] Applying provider config:", provider);
        files = applyProviderConfig(files, provider, repoName);

        const fileValidation = validateGitHubFiles(files);
        if (!fileValidation.valid) {
          return deployErrorResponse(
            {
              success: false,
              error: fileValidation.error,
              code: "INVALID_REQUEST",
            },
            400,
            rateLimit.headers,
          );
        }

        // Create the repository
        const description = generateExampleDescription(
          libraryName,
          exampleName,
          provider,
        );
        console.log("[ExampleDeploy] Creating repository:", {
          repoName,
          isPrivate,
          description,
        });

        const createResult = await createRepository(authState.accessToken, {
          name: repoName,
          description,
          isPrivate,
        });

        if (!createResult.success) {
          console.error("[ExampleDeploy] Repository creation failed:", {
            error: createResult.error,
            code: createResult.code,
          });
          const code =
            createResult.code === "NAME_TAKEN"
              ? "REPO_NAME_TAKEN"
              : "REPO_CREATION_FAILED";
          return deployErrorResponse(
            {
              success: false,
              error: createResult.error,
              code,
            },
            code === "REPO_NAME_TAKEN" ? 409 : 500,
            rateLimit.headers,
          );
        }
        console.log(
          "[ExampleDeploy] Repository created:",
          createResult.repoUrl,
        );

        // Push files to the repository
        const pushResult = await pushFiles(authState.accessToken, {
          owner: createResult.owner,
          repo: createResult.name,
          files,
          message: `Initial commit from TanStack ${libraryName} example`,
        });

        if (!pushResult.success) {
          console.error("[ExampleDeploy] Push failed:", pushResult.error);
          return deployErrorResponse(
            {
              success: false,
              error: `Repository created but failed to push files: ${pushResult.error}`,
              code: "PUSH_FAILED",
            },
            500,
            rateLimit.headers,
          );
        }

        console.log("[ExampleDeploy] Success!");

        return jsonResponse(
          {
            success: true,
            repoUrl: createResult.repoUrl,
            owner: createResult.owner,
            repoName: createResult.name,
          } satisfies DeployResponse,
          { headers: rateLimit.headers },
        );
      },
    },
  },
});
