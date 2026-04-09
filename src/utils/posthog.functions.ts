import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import * as v from 'valibot'
import { getAuthService } from '~/auth/index.server'
import { captureEvent, flushPostHog } from '~/utils/posthog.server'

const captureEventInputSchema = v.object({
  anonymousId: v.pipe(v.string(), v.minLength(1)),
  event: v.pipe(v.string(), v.minLength(1)),
  properties: v.optional(v.record(v.string(), v.unknown())),
})

export const capturePostHogEvent = createServerFn({ method: 'POST' })
  .inputValidator((value) => v.parse(captureEventInputSchema, value))
  .handler(async ({ data }) => {
    const request = getRequest()

    try {
      const authService = getAuthService()
      const user = await authService.getCurrentUser(request)

      captureEvent(user?.userId ?? data.anonymousId, data.event, {
        ...data.properties,
        anonymous_id: data.anonymousId,
        authenticated: !!user,
      })
    } finally {
      await flushPostHog()
    }
  })
