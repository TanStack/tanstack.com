import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'

/**
 * Netlify Scheduled Function - Trigger stats cache refresh
 *
 * This scheduled function (30s timeout) acts as a cron trigger that invokes
 * the background function to do the actual work (15 minute timeout).
 *
 * Pattern:
 * 1. Scheduled function runs on cron schedule
 * 2. Invokes background function via HTTP
 * 3. Returns immediately (202)
 * 4. Background function processes for up to 15 minutes
 *
 * Schedule: Configured in netlify.toml
 */
export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
) => {
  console.log('[refresh-stats-cache] Triggering background stats refresh...')

  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      throw new Error('CRON_SECRET not configured')
    }

    // Invoke the background function
    const functionUrl = `${process.env.URL}/.netlify/functions/refresh-stats-cache-background`

    console.log(
      '[refresh-stats-cache] Invoking background function:',
      functionUrl
    )

    // Fire and forget - background function will run independently
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({
        source: 'scheduled-function',
        triggeredAt: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Background function invocation failed: ${response.status} - ${errorText}`
      )
    }

    console.log(
      '[refresh-stats-cache] Background function invoked successfully'
    )

    return {
      statusCode: 202, // Accepted - processing in background
      body: JSON.stringify({
        success: true,
        message: 'Stats refresh triggered successfully',
        background: true,
        triggeredAt: new Date().toISOString(),
      }),
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[refresh-stats-cache] Error:', errorMessage)

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
      }),
    }
  }
}
