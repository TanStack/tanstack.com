const HTML_ID_SEGMENT_PATTERN = /[^a-zA-Z0-9_-]+/g

export function encodePackageNameSlug(packageName: string) {
  return encodeURIComponent(packageName)
}

export function decodePackageNameSlug(slug: string) {
  let next = slug

  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(next)
      if (decoded === next) {
        break
      }
      next = decoded
    } catch {
      return slug
    }
  }

  // Back-compat: legacy links encoded the scope separator as `__`
  // (`@scope/name` -> `@scope__name`). Those URLs are still indexed, so
  // restore the separator instead of failing package-name validation.
  // Matches the stats route (`src/routes/stats/npm/-utils.ts`).
  if (next.startsWith('@') && next.includes('__') && !next.includes('/')) {
    return next.replace('__', '/')
  }

  return next
}

export function getRowFieldId(
  scope: string,
  rowId: string | number,
  field: string,
) {
  return [scope, rowId, field].map(sanitizeHtmlIdSegment).join('-')
}

function sanitizeHtmlIdSegment(value: string | number) {
  const segment = String(value).trim().replace(HTML_ID_SEGMENT_PATTERN, '-')
  return segment.replace(/^-+|-+$/g, '') || 'item'
}
