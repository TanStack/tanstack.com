import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null

function getPostHogClient(): PostHog | null {
  if (!posthogClient) {
    const apiKey = process.env.POSTHOG_API_KEY
    if (!apiKey) {
      return null
    }

    posthogClient = new PostHog(apiKey, {
      host: 'https://us.i.posthog.com',
      // Serverless optimizations: flush immediately
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return posthogClient
}

export function captureEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  try {
    const client = getPostHogClient()
    if (client) {
      client.capture({ distinctId, event, properties })
    }
  } catch {
    // PostHog errors should never break the app
  }
}

export async function flushPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.flush()
  }
}
