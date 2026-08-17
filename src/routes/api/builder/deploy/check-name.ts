import { createFileRoute } from "@tanstack/react-router";
import { validateBuilderGetRequest } from "~/builder/api/request-boundary.server";
import { jsonResponse } from "~/utils/api-boundary.server";
import { RATE_LIMITS } from "~/utils/rateLimit.server";

export const Route = createFileRoute("/api/builder/deploy/check-name")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const requestGuard = await validateBuilderGetRequest(request, {
          rateLimit: RATE_LIMITS.deploy,
        });
        if ("response" in requestGuard) {
          return requestGuard.response;
        }

        const [
          { getAuthService },
          { getGitHubAuthState },
          { checkRepoNameAvailable, validateRepoName },
        ] = await Promise.all([
          import("~/auth/index.server"),
          import("~/auth/github.server"),
          import("~/utils/github-repo.server"),
        ]);
        const url = new URL(request.url);
        const name = url.searchParams.get("name");

        if (!name) {
          return jsonResponse(
            { available: false, error: "Name required" },
            { status: 400, headers: requestGuard.rateLimit.headers },
          );
        }

        const validation = validateRepoName(name);
        if (!validation.valid) {
          return jsonResponse(
            {
              available: false,
              error: validation.error ?? "Invalid repository name",
            },
            { status: 400, headers: requestGuard.rateLimit.headers },
          );
        }

        const authService = getAuthService();
        const user = await authService.getCurrentUser(request);

        if (!user) {
          return jsonResponse(
            { available: false, error: "Not authenticated" },
            { status: 401, headers: requestGuard.rateLimit.headers },
          );
        }

        const authState = await getGitHubAuthState(user.userId);

        if (!authState.hasRepoScope || !authState.accessToken) {
          return jsonResponse(
            { available: false, error: "Missing scope" },
            { status: 403, headers: requestGuard.rateLimit.headers },
          );
        }

        try {
          const available = await checkRepoNameAvailable(
            authState.accessToken,
            name,
          );
          return jsonResponse(
            { available },
            { headers: requestGuard.rateLimit.headers },
          );
        } catch {
          return jsonResponse(
            { available: false, error: "Could not check repository name" },
            { status: 502, headers: requestGuard.rateLimit.headers },
          );
        }
      },
    },
  },
});
