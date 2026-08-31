import {
  chartsCatalogCurrentPreviewRevision,
  getChartsCatalogPreviewUrl,
} from '~/utils/charts-catalog-preview'

export function ChartsCatalogPreview({
  caseId,
  revision = chartsCatalogCurrentPreviewRevision,
}: {
  caseId: string
  revision?: string
}) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className="block h-full w-full object-contain"
      data-catalog-preview-case={caseId}
      decoding="async"
      height={192}
      loading="lazy"
      src={getChartsCatalogPreviewUrl(revision, caseId)}
      width={288}
    />
  )
}
