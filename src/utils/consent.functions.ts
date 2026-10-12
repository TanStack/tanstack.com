import { createConsentStateHandler } from '@c15t/tanstack-start/server'
import { createServerFn } from '@tanstack/react-start'
import { consentOptions } from './consent.server'

// Resolves the visitor's consent policy from the bundled manifest, so the
// banner is in the first HTML without a request to the consent backend.
export const getConsentState = createServerFn({ method: 'GET' }).handler(
  createConsentStateHandler(consentOptions),
)
