import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'

/**
 * Netlify Background + Scheduled Function - Test scheduled function
 *
 * This function combines both background and scheduled execution:
 * - Can be invoked via HTTP POST (returns 202 immediately, runs in background)
 * - Can be triggered on a schedule (runs automatically via cron)
 *
 * Background functions have a 15-minute timeout (vs 30 seconds for regular functions)
 * and return a 202 response immediately while processing continues in the background.
 *
 * Scheduled: Runs automatically every 30 seconds (configured via netlify.toml)
 */
export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  console.log(
    '[test-scheduled] Test message - function executed at',
    new Date().toISOString(),
  )

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: 'Test scheduled function executed',
      timestamp: new Date().toISOString(),
    }),
  }
}
