import type { BreadcrumbItem } from '~/components/Breadcrumbs'
import { findChartsCatalogCollection } from './charts-catalog'
import { canonicalUrl } from './seo'

type ChartBreadcrumbData = { id: string; title: string; collection?: string }

export function getChartBreadcrumbItems(
  chart: ChartBreadcrumbData,
): Array<BreadcrumbItem> {
  const collection = chart.collection
    ? findChartsCatalogCollection(chart.collection)
    : undefined
  const items: Array<BreadcrumbItem> = [...chartCatalogBreadcrumbItems]
  if (collection) {
    items.push({
      label: collection.title,
      to: `/charts/catalog/collections/${collection.id}`,
      search: true,
      preload: false,
    })
  }
  items.push({ label: chart.title, to: `/charts/catalog/charts/${chart.id}` })
  return items
}

export function getChartBreadcrumbJsonLd(chart: ChartBreadcrumbData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: getChartBreadcrumbItems(chart).map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: canonicalUrl(item.to),
    })),
  }
}

export function getChartCollectionBreadcrumbItems(collection: {
  id: string
  title: string
}): Array<BreadcrumbItem> {
  return [
    ...chartCatalogBreadcrumbItems,
    {
      label: collection.title,
      to: `/charts/catalog/collections/${collection.id}`,
    },
  ]
}

export function getChartCollectionBreadcrumbJsonLd(collection: {
  id: string
  title: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: getChartCollectionBreadcrumbItems(collection).map(
      (item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.label,
        item: canonicalUrl(item.to),
      }),
    ),
  }
}

export const chartCatalogBreadcrumbItems: Array<BreadcrumbItem> = [
  { label: 'Charts', to: '/charts/latest', search: true, preload: false },
  { label: 'Catalog', to: '/charts/catalog', search: true, preload: false },
]

export function getChartCatalogBreadcrumbJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: chartCatalogBreadcrumbItems.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: canonicalUrl(item.to),
    })),
  }
}
