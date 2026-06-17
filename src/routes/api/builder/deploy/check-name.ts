import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/builder/deploy/check-name")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const [
          { getAuthService },
          { getGitHubAuthState },
          { checkRepoNameAvailable },
        ] = await Promise.all([
          import("~/auth/index.server"),
          import("~/auth/github.server"),
          import("~/utils/github-repo.server"),
        ]);
        const url = new URL(request.url);
        const name = url.searchParams.get("name");

        if (!name) {
          return Response.json(
            { available: false, error: "Name required" },
            { status: 400 },
          );
        }

        const authService = getAuthService();
        const user = await authService.getCurrentUser(request);

        if (!user) {
          return Response.json(
            { available: false, error: "Not authenticated" },
            { status: 401 },
          );
        }

        const authState = await getGitHubAuthState(user.userId);

        if (!authState.hasRepoScope || !authState.accessToken) {
          return Response.json(
            { available: false, error: "Missing scope" },
            { status: 403 },
          );
        }

        try {
          const available = await checkRepoNameAvailable(
            authState.accessToken,
            name,
          );
          return Response.json({ available });
        } catch {
          // On error, assume available (don't block the user)
          return Response.json({ available: true });
        }
      },
    },
  },
});
