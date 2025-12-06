import type { Config } from "@netlify/functions";
import { syncGitHubReleases } from "~/server/feed/github.functions";

/**
 * Netlify Scheduled Function - Sync GitHub releases
 *
 * This function syncs GitHub releases from all TanStack repos:
 * - Fetches new releases since last sync
 * - Creates/updates feed items in the database
 * - Marks releases as synced to avoid duplicates
 *
 * Scheduled: Runs automatically every 6 hours
 */
const handler = async (req: Request) => {
  const { next_run } = await req.json();

  console.log(
    "[sync-github-releases-background] Starting GitHub release sync..."
  );

  const startTime = Date.now();

  try {
    const result = await syncGitHubReleases();

    const duration = Date.now() - startTime;
    console.log(
      `[sync-github-releases-background] ✓ Completed in ${duration}ms - Synced: ${result.syncedCount}, Skipped: ${result.skippedCount}, Errors: ${result.errorCount}`
    );
    console.log(
      "[sync-github-releases-background] Next invocation at:",
      next_run
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(
      `[sync-github-releases-background] ✗ Failed after ${duration}ms:`,
      errorMessage
    );
    if (errorStack) {
      console.error("[sync-github-releases-background] Stack:", errorStack);
    }
  }
};

export default handler;

export const config: Config = {
  schedule: "0 */6 * * *", // Every 6 hours
};
