import type { Partner } from '~/utils/partners'

export type PartnerLifecycle = Pick<Partner, 'endDate' | 'startDate' | 'status'>

export function getPartnerWindowLabel(partner: PartnerLifecycle) {
  if (partner.startDate && partner.endDate) {
    return `${partner.startDate} - ${partner.endDate}`
  }

  if (partner.startDate) {
    return partner.status === 'active'
      ? `${partner.startDate} - Present`
      : `${partner.startDate} - End date unknown`
  }

  if (partner.endDate) {
    return `Start date unknown - ${partner.endDate}`
  }

  return partner.status === 'inactive' ? 'Dates unavailable' : undefined
}
