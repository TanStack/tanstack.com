export interface NpmDailyDownload {
  day: string
  downloads: number
}

interface LocalMedianReplacement {
  kind: 'local-median'
  side?: 'after' | 'before' | 'both'
  windowDays?: number
}

interface FixedReplacement {
  downloads: number
  kind: 'fixed'
}

type NpmDownloadOutlierReplacement = FixedReplacement | LocalMedianReplacement

interface NpmDownloadOutlierOverride {
  dateFrom: string
  dateTo: string
  note: string
  packageName: string
  replacement: NpmDownloadOutlierReplacement
}

const DEFAULT_LOCAL_MEDIAN_WINDOW_DAYS = 7

// Manual registry for npm download spikes that survive in historical cache data
// and squash the chart y-axis. Add new package/date spans here as we discover
// them.
export const npmDownloadOutlierOverrides: NpmDownloadOutlierOverride[] = [
  {
    dateFrom: '2022-11-16',
    dateTo: '2022-11-29',
    note: 'Historical svelte corruption burst in late 2022.',
    packageName: 'svelte',
    replacement: {
      kind: 'local-median',
      windowDays: 14,
    },
  },
  {
    dateFrom: '2023-06-20',
    dateTo: '2023-06-21',
    note: 'Historical svelte spike in June 2023.',
    packageName: 'svelte',
    replacement: {
      kind: 'local-median',
      windowDays: 14,
    },
  },
  {
    dateFrom: '2023-11-19',
    dateTo: '2023-11-20',
    note: 'Historical svelte spike around 2023-11-19 UTC.',
    packageName: 'svelte',
    replacement: {
      kind: 'local-median',
      windowDays: 14,
    },
  },
  {
    dateFrom: '2022-11-28',
    dateTo: '2022-12-22',
    note: 'Historical vue corruption burst in late 2022.',
    packageName: 'vue',
    replacement: {
      kind: 'local-median',
      side: 'before',
      windowDays: 21,
    },
  },
]

const outlierOverridesByPackage = new Map<
  string,
  NpmDownloadOutlierOverride[]
>()

for (const override of npmDownloadOutlierOverrides) {
  let packageOverrides = outlierOverridesByPackage.get(override.packageName)

  if (!packageOverrides) {
    packageOverrides = []
    outlierOverridesByPackage.set(override.packageName, packageOverrides)
  }

  packageOverrides.push(override)
}

function doesDayMatchOverride(
  day: string,
  override: NpmDownloadOutlierOverride,
) {
  return day >= override.dateFrom && day <= override.dateTo
}

function findMatchingOverride(
  day: string,
  packageOverrides: NpmDownloadOutlierOverride[],
) {
  for (const override of packageOverrides) {
    if (doesDayMatchOverride(day, override)) {
      return override
    }
  }

  return undefined
}

function getOverrideKey(override: NpmDownloadOutlierOverride) {
  return `${override.packageName}:${override.dateFrom}:${override.dateTo}`
}

function getDistanceFromOverride(
  day: string,
  override: NpmDownloadOutlierOverride,
  side: 'after' | 'before' | 'both',
) {
  if (side === 'before') {
    return getUtcDayDistance(day, override.dateFrom)
  }

  if (side === 'after') {
    return getUtcDayDistance(day, override.dateTo)
  }

  if (day < override.dateFrom) {
    return getUtcDayDistance(day, override.dateFrom)
  }

  return getUtcDayDistance(day, override.dateTo)
}

function isManualOutlierDay(
  day: string,
  packageOverrides: NpmDownloadOutlierOverride[],
) {
  return findMatchingOverride(day, packageOverrides) !== undefined
}

function getMedian(values: number[]) {
  if (values.length === 0) {
    return undefined
  }

  const sorted = [...values].sort((a, b) => a - b)
  const middleIndex = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 1) {
    return sorted[middleIndex]
  }

  const left = sorted[middleIndex - 1]
  const right = sorted[middleIndex]

  if (left === undefined || right === undefined) {
    return sorted[middleIndex]
  }

  return (left + right) / 2
}

function getUtcDayDistance(left: string, right: string) {
  const leftTime = new Date(`${left}T00:00:00.000Z`).getTime()
  const rightTime = new Date(`${right}T00:00:00.000Z`).getTime()
  return Math.round(Math.abs(leftTime - rightTime) / 86_400_000)
}

function resolveReplacementDownloads(
  override: NpmDownloadOutlierOverride,
  dailyDownloads: NpmDailyDownload[],
  packageOverrides: NpmDownloadOutlierOverride[],
) {
  if (override.replacement.kind === 'fixed') {
    return override.replacement.downloads
  }

  const windowDays =
    override.replacement.windowDays ?? DEFAULT_LOCAL_MEDIAN_WINDOW_DAYS
  const side = override.replacement.side ?? 'both'
  const nearbyDownloads: number[] = []

  for (const point of dailyDownloads) {
    if (isManualOutlierDay(point.day, packageOverrides)) {
      continue
    }

    if (point.downloads <= 0) {
      continue
    }

    if (side === 'before' && point.day >= override.dateFrom) {
      continue
    }

    if (side === 'after' && point.day <= override.dateTo) {
      continue
    }

    if (getDistanceFromOverride(point.day, override, side) > windowDays) {
      continue
    }

    nearbyDownloads.push(point.downloads)
  }

  const localMedian = getMedian(nearbyDownloads)

  if (localMedian === undefined) {
    const originalPoint = dailyDownloads.find((point) =>
      doesDayMatchOverride(point.day, override),
    )
    return originalPoint?.downloads
  }

  return Math.round(localMedian)
}

export function applyManualNpmDownloadOutlierCorrections(
  packageName: string,
  dailyDownloads: NpmDailyDownload[],
) {
  const packageOverrides = outlierOverridesByPackage.get(packageName)

  if (
    !packageOverrides ||
    packageOverrides.length === 0 ||
    dailyDownloads.length === 0
  ) {
    return dailyDownloads
  }

  const replacementDownloadsByOverride = new Map<string, number | undefined>()

  for (const override of packageOverrides) {
    replacementDownloadsByOverride.set(
      getOverrideKey(override),
      resolveReplacementDownloads(override, dailyDownloads, packageOverrides),
    )
  }

  return dailyDownloads.map((point) => {
    const override = findMatchingOverride(point.day, packageOverrides)

    if (!override) {
      return point
    }

    const downloads = replacementDownloadsByOverride.get(
      getOverrideKey(override),
    )

    if (downloads === undefined || downloads === point.downloads) {
      return point
    }

    return {
      ...point,
      downloads,
    }
  })
}
