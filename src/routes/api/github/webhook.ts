import { createFileRoute } from "@tanstack/react-router";
import { isWatchedDocsWebhookSource } from "~/utils/docs-webhook-sources";
import {
  isRecord,
  jsonError,
  jsonResponse,
  readTextBody,
} from "~/utils/api-boundary.server";

const MAX_GITHUB_WEBHOOK_BYTES = 256 * 1024;
const GITHUB_SIGNATURE_PATTERN = /^sha256=[a-f0-9]{64}$/i;

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

function hasOptionalStringArray(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  )
}

function isPushEventPayload(value: unknown): value is PushEventPayload {
  if (!isRecord(value)) {
    return false;
  }

  const repository = value.repository

  return (
    typeof value.ref === "string" &&
    isRecord(repository) &&
    typeof repository.full_name === "string" &&
    Array.isArray(value.commits) &&
    value.commits.every(
      (commit) =>
        isRecord(commit) &&
        hasOptionalStringArray(commit, "added") &&
        hasOptionalStringArray(commit, "modified") &&
        hasOptionalStringArray(commit, "removed"),
    )
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
        const [
          { markDocsArtifactsStale, markGitHubContentStale },
          { env },
          { libraries },
          { purgeHostingCacheTags },
        ] = await Promise.all([
          import("~/utils/github-content-cache.server"),
          import("~/utils/env"),
          import("~/libraries"),
          import("~/utils/hosting-cache.server"),
        ]);
        const bodyResult = await readTextBody(request, MAX_GITHUB_WEBHOOK_BYTES);
        if (!bodyResult.success) {
          return jsonError(bodyResult.error.message, bodyResult.error.status);
        }
        const rawBody = bodyResult.text;

        const event = request.headers.get("x-github-event");
        const signature = request.headers.get("x-hub-signature-256");

        if (!env.GITHUB_WEBHOOK_SECRET) {
          console.error("[GitHub webhook] GITHUB_WEBHOOK_SECRET is not configured");
          return jsonError("Webhook secret is not configured", 500);
        }

        if (
          !signature ||
          !GITHUB_SIGNATURE_PATTERN.test(signature) ||
          !(await verifyGitHubSignature(
            rawBody,
            signature,
            env.GITHUB_WEBHOOK_SECRET,
          ))
        ) {
          return jsonError("Invalid webhook signature", 401);
        }

        if (event === "ping") {
          return jsonResponse({ ok: true });
        }

        if (event !== "push") {
          return jsonResponse({ ok: true, ignored: true, event });
        }

        let payload: unknown;

        try {
          payload = JSON.parse(rawBody);
        } catch {
          return jsonError("Invalid JSON payload", 400);
        }

        if (!isPushEventPayload(payload)) {
          return jsonError("Invalid push payload", 400);
        }

        const gitRef = payload.ref.replace(/^refs\/heads\//, "");
        const repo = payload.repository.full_name.toLowerCase();

        if (!isWatchedDocsWebhookSource(repo, gitRef)) {
          return jsonResponse({
            ok: true,
            ignored: true,
            reason: "unwatched repo/ref",
            repo,
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
          markGitHubContentStale({ repo, gitRef }),
          markDocsArtifactsStale({ repo, gitRef }),
        ]);

        const tags = [
          `docs-config:${repo}:${gitRef}`,
          ...libraries
            .filter(
              (library) =>
                library.repo === repo && library.latestBranch === gitRef,
            )
            .map((library) => `docs:${library.id}:branch:${gitRef}`),
        ];

        const purge = await purgeHostingCacheTags(tags);

        return jsonResponse({
          ok: true,
          gitRef,
          changedPathCount: changedPaths.length,
          staleArtifactCount,
          staleContentCount,
          purge,
        });
      },
    },
  },
});
