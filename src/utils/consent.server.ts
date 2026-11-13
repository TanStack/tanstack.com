import type { ResolveConsentOptions } from '@c15t/tanstack-start/server'
import { scheduleHostRuntimeTask } from '~/server/runtime/host.server'

// The backend URL and policy snapshot come from consentManifest() in
// vite.config.ts.
export const consentOptions = {
  // Session reports run after the response. Keep the Worker alive for them.
  onBackgroundRevalidate: (task) => {
    scheduleHostRuntimeTask(() => task)
  },
} satisfies ResolveConsentOptions
