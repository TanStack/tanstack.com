import { canonicalUrl } from './seo'

type PartnerBreadcrumbData = { id: string; name: string }

export function getPartnerBreadcrumbItems(partner: PartnerBreadcrumbData) {
  return [
    { label: 'Partners', to: '/partners' },
    { label: partner.name, to: `/partners/${partner.id}` },
  ]
}

export function getPartnerBreadcrumbJsonLd(partner: PartnerBreadcrumbData) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: getPartnerBreadcrumbItems(partner).map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: canonicalUrl(item.to),
    })),
  }
}
