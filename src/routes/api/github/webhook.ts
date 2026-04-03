import { createFileRoute } from "@tanstack/react-router";
import { isWatchedDocsWebhookSource } from "~/utils/docs-webhook-sources";

type PushEventPayload = {
  ref: string;
  repository: {
    full_name: string;
  };
  commits: Array<{
    added?: Array<string>;
    modified?: Array<string>;
    removed?: Array<string>;
  }>;
};

function isPushEventPayload(value: unknown): value is PushEventPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as {
    commits?: unknown;
    ref?: unknown;
    repository?: { full_name?: unknown };
  };

  return (
    typeof candidate.ref === "string" &&
    typeof candidate.repository?.full_name === "string" &&
    Array.isArray(candidate.commits)
  );
}

async function verifyGitHubSignature(
  rawBody: string,
  signature: string,
  secret: string,
) {
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expectedSignature = `sha256=${createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;
  const encoder = new TextEncoder();
  const received = encoder.encode(signature);
  const expected = encoder.encode(expectedSignature);

  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

export const Route = createFileRoute("/api/github/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const [{ markDocsArtifactsStale, markGitHubContentStale }, { env }] =
          await Promise.all([
            import("~/utils/github-content-cache.server"),
            import("~/utils/env"),
          ]);
        const rawBody = await request.text();
        const event = request.headers.get("x-github-event");
        const signature = request.headers.get("x-hub-signature-256");

        if (env.GITHUB_WEBHOOK_SECRET) {
          if (
            !signature ||
            !(await verifyGitHubSignature(
              rawBody,
              signature,
              env.GITHUB_WEBHOOK_SECRET,
            ))
          ) {
            return Response.json(
              { error: "Invalid webhook signature" },
              { status: 401 },
            );
          }
        }

        if (event === "ping") {
          return Response.json({ ok: true });
        }

        if (event !== "push") {
          return Response.json({ ok: true, ignored: true, event });
        }

        let payload: unknown;

        try {
          payload = JSON.parse(rawBody) as unknown;
        } catch {
          return Response.json(
            { error: "Invalid JSON payload" },
            { status: 400 },
          );
        }

        if (!isPushEventPayload(payload)) {
          return Response.json(
            { error: "Invalid push payload" },
            { status: 400 },
          );
        }

        const gitRef = payload.ref.replace(/^refs\/heads\//, "");

        if (!isWatchedDocsWebhookSource(payload.repository.full_name, gitRef)) {
          return Response.json({
            ok: true,
            ignored: true,
            reason: "unwatched repo/ref",
            repo: payload.repository.full_name,
            gitRef,
          });
        }

        const changedPaths = Array.from(
          new Set(
            payload.commits.flatMap((commit) => [
              ...(commit.added ?? []),
              ...(commit.modified ?? []),
              ...(commit.removed ?? []),
            ]),
          ),
        );

        const [staleContentCount, staleArtifactCount] = await Promise.all([
          markGitHubContentStale({
            repo: payload.repository.full_name,
            gitRef,
          }),
          markDocsArtifactsStale({
            repo: payload.repository.full_name,
            gitRef,
          }),
        ]);

        return Response.json({
          ok: true,
          gitRef,
          changedPathCount: changedPaths.length,
          staleArtifactCount,
          staleContentCount,
        });
      },
    },
  },
});
