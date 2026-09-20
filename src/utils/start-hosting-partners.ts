import { partners, type Partner } from '~/utils/partners'

export function getStartHostingPartners(): Array<Partner> {
  return partners.filter(
    (partner) =>
      partner.status === 'active' &&
      partner.uniqueConstraints?.includes('hosting') &&
      partner.relatedProducts?.includes('start'),
  )
}
