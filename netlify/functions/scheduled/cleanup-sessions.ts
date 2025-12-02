import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'

/**
 * Netlify Scheduled Function - Session cleanup (no longer needed)
 * 
 * This function is kept for backward compatibility but does nothing.
 * With signed cookies, sessions are stateless and expire automatically
 * based on cookie expiration time. No database cleanup is needed.
 * 
 * Schedule: Daily at 2 AM UTC (can be disabled in Netlify UI)
 */
export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
) => {
  console.log('[cleanup-sessions] No-op: Sessions are now stateless (signed cookies)')
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: 'No cleanup needed - using stateless signed cookies',
    }),
  }
}

