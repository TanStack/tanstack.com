import { isChartsCatalogEmbedPath } from './charts-catalog-embed'

export function isFrameEmbeddingAllowed(pathname: string) {
  return (
    pathname === '/partners-embed' ||
    pathname === '/sponsors-embed' ||
    pathname === '/stats/npm/embed' ||
    isChartsCatalogEmbedPath(pathname) ||
    isChartsCatalogEmbedPath(`${pathname}/`)
  )
}

export const allowsFrameEmbedding = isFrameEmbeddingAllowed
