import { trackEvent, type PartnerPlacement } from '~/utils/analytics'

export const PARTNER_INQUIRY_HREF =
  'mailto:partners@tanstack.com?subject=TanStack%20Partnership%20Inquiry'

export function trackPartnerInquiry(placement: PartnerPlacement) {
  trackEvent('partner_inquiry_started', { placement })
}
