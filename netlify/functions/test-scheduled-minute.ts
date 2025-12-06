import type { Config } from "@netlify/functions";

/**
 * Netlify Scheduled Function - Test scheduled function
 *
 * Scheduled: Runs automatically every minute
 */
const handler = async (req: Request) => {
  const { next_run } = await req.json();

  console.log(
    "[test-scheduled-minute] Test message - function executed at:",
    new Date().toISOString()
  );
  console.log("[test-scheduled-minute] Next invocation at:", next_run);
};

export default handler;

export const config: Config = {
  schedule: "* * * * *", // Every minute
};
