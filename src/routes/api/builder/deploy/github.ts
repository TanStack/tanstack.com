import { createFileRoute } from "@tanstack/react-router";
import {
  jsonResponse,
  readJsonBody,
  validateJsonRequest,
} from "~/utils/api-boundary.server";
import {
  builderDeployBodySchema,
  parseBuilderRequest,
} from "~/builder/api/request-schema.server";

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
    | "COMPILE_FAILED"
    | "INVALID_REQUEST";
}

function deployErrorResponse(error: DeployError, status: number, headers?: Headers) {
  return jsonResponse(error, { status, headers });
}

export const Route = createFileRoute("/api/builder/deploy/github")({
  server: {
    handlers: {
      /**
       * GET: Check GitHub auth state for current user
       */
      GET: async ({ request }: { request: Request }) => {
        const [{ getAuthService }, { getGitHubAuthState }] = await Promise.all([
          import("~/auth/index.server"),
          import("~/auth/github.server"),
        ]);
        const authService = getAuthService();
        const user = await authService.getCurrentUser(request);

        if (!user) {
          return jsonResponse({
            authenticated: false,
            hasGitHubAccount: false,
            hasRepoScope: false,
          });
        }

        const authState = await getGitHubAuthState(user.userId);

        return jsonResponse({
          authenticated: true,
          ...authState,
        });
      },

      /**
       * POST: Create GitHub repo and push project files
       */
      POST: async ({ request }: { request: Request }) => {
        const [authIndex, authGithub, githubRepo, rateLimitModule] =
          await Promise.all([
            import("~/auth/index.server"),
            import("~/auth/github.server"),
            import("~/utils/github-repo.server"),
            import("~/utils/rateLimit.server"),
          ]);
        const { getAuthService } = authIndex;
        const { getGitHubAuthState } = authGithub;
        const {
          createRepository,
          pushFiles,
          validateRepoName,
          validateGitHubFiles,
          generateRepoDescription,
        } = githubRepo;
        const { checkIpRateLimit, rateLimitedResponse, RATE_LIMITS } =
          rateLimitModule;
        // Rate limiting (10 requests/minute per IP)
        const rateLimit = await checkIpRateLimit(request, RATE_LIMITS.deploy);
        if (!rateLimit.allowed) {
          return rateLimitedResponse(rateLimit);
        }

        const guardError = validateJsonRequest(request, {
          maxContentLength: 1024 * 1024,
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
          console.log("[Deploy] Auth state check failed:", {
            hasRepoScope: authState.hasRepoScope,
            hasToken: !!authState.accessToken,
          });
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
        console.log(
          "[Deploy] Auth state OK, hasRepoScope:",
          authState.hasRepoScope,
        );

        let body;
        try {
          const bodyResult = await readJsonBody(request, {
            maxContentLength: 1024 * 1024,
          });
          if (!bodyResult.success) {
            throw new Error(bodyResult.error.message);
          }
          body = parseBuilderRequest(builderDeployBodySchema, bodyResult.body);
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
          projectName,
          framework,
          packageManager,
          features,
          featureOptions,
          tailwind,
          files,
        } = body;
        const safeFeatureOptions = featureOptions ?? {};

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

        // Compile the project, or use files generated by the client-only builder.
        let compiledFiles: Record<string, string>;
        if (files) {
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
          compiledFiles = files;
        } else {
          try {
            const { compileHandler } = await import("~/builder/api/compile");
            const result = await compileHandler({
              name: projectName,
              framework,
              packageManager,
              tailwind,
              features,
              featureOptions: safeFeatureOptions,
            });
            compiledFiles = result.files;
          } catch (error) {
            console.error("[Deploy] Compile failed:", error);
            return deployErrorResponse(
              {
                success: false,
                error: "Failed to compile project",
                code: "COMPILE_FAILED",
              },
              500,
              rateLimit.headers,
            );
          }
        }

        const compiledFileValidation = validateGitHubFiles(compiledFiles);
        if (!compiledFileValidation.valid) {
          return deployErrorResponse(
            {
              success: false,
              error: compiledFileValidation.error,
              code: "INVALID_REQUEST",
            },
            400,
            rateLimit.headers,
          );
        }

        // Create the repository
        const description = generateRepoDescription(features);
        console.log("[Deploy] Creating repository:", {
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
          console.error("[Deploy] Repository creation failed:", {
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
        console.log("[Deploy] Repository created:", createResult.repoUrl);

        // Push files to the repository
        const pushResult = await pushFiles(authState.accessToken, {
          owner: createResult.owner,
          repo: createResult.name,
          files: compiledFiles,
          message: "Initial commit from TanStack Builder",
        });

        if (!pushResult.success) {
          console.error("[Deploy] Push failed:", pushResult.error);
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
