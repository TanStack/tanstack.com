export function isNpmStatsPath(pathname: string) {
  return pathname === '/stats/npm' || pathname.startsWith('/stats/npm/')
}

export function cleanStatsLocation(location: string) {
  const url = new URL(location)
  if (!isNpmStatsPath(url.pathname)) return location
  // Search fields owned by the npm stats routes, not campaign attribution.
  for (const key of [
    'packageGroups',
    'range',
    'transform',
    'binType',
    'viewMode',
    'chartType',
    'barOrientation',
    'barSort',
    'bucketOffset',
    'playbackIntervalMs',
    'playbackLoop',
    'playbackPlaying',
    'showDataMode',
    'normalizeBaseline',
    'showBaseline',
    'showLegend',
    'height',
    'width',
    'timelineStart',
    'timelineEnd',
  ])
    url.searchParams.delete(key)
  url.hash = ''
  return url.href
}
