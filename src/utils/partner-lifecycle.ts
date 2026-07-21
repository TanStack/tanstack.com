import type { Partner } from '~/utils/partners'

export type PartnerLifecycle = {
  endDate?: Partner['endDate']
  startDate?: Partner['startDate']
  status?: Partner['status']
}

export function getPartnerWindowLabel(partner: PartnerLifecycle) {
  if (partner.startDate && partner.endDate) {
    return `${partner.startDate} - ${partner.endDate}`
  }

  if (partner.startDate) {
    return partner.status === 'active'
      ? `${partner.startDate} - Present`
      : `Started ${partner.startDate}`
  }

  return partner.endDate ? `Ended ${partner.endDate}` : undefined
}
