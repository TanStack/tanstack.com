import * as React from 'react'
import * as d3 from 'd3'
import { X, EyeOff } from 'lucide-react'
import { Tooltip } from '~/components/Tooltip'
import {
  type PackageGroup,
  type TransformMode,
  type NpmQueryData,
  type BinType,
  binningOptionsByType,
  getPackageColor,
  formatNumber,
} from './NPMStatsChart'

export interface StatsTableProps {
  queryData: NpmQueryData | undefined
  packageGroups: PackageGroup[]
  binOption: (typeof binningOptionsByType)[BinType]
  transform: TransformMode
  onColorClick: (packageName: string, event: React.MouseEvent) => void
  onToggleVisibility: (index: number, packageName: string) => void
  onRemove: (index: number) => void
}

interface PackageStat {
  package: string
  totalDownloads: number
  binDownloads: number
  growth: number
  growthPercentage: number
  color: string
  hidden: boolean | undefined
  index: number
}

/**
 * Calculates package statistics from query data for display in the stats table.
 */
function calculateStats(
  queryData: NpmQueryData | undefined,
  packageGroups: PackageGroup[],
  binOption: StatsTableProps['binOption'],
): PackageStat[] {
  if (!queryData) return []

  return queryData
    .map((packageGroupDownloads, index) => {
      if (!packageGroupDownloads.packages.some((p) => p.downloads.length)) {
        return null
      }

      const firstPackage = packageGroupDownloads.packages[0]
      if (!firstPackage?.name) return null

      const sortedDownloads = packageGroupDownloads.packages
        .flatMap((p) => p.downloads)
        .sort(
          (a, b) =>
            d3.utcDay(new Date(a.day)).getTime() -
            d3.utcDay(new Date(b.day)).getTime(),
        )

      const binUnit = binOption.bin
      const now = d3.utcDay(new Date())
      const partialBinEnd = binUnit.floor(now)

      const filteredDownloads = sortedDownloads.filter(
        (d) => d3.utcDay(new Date(d.day)) < partialBinEnd,
      )

      const binnedDownloads = d3.sort(
        d3.rollup(
          filteredDownloads,
          (v) => d3.sum(v, (d) => d.downloads),
          (d) => binUnit.floor(new Date(d.day)),
        ),
        (d) => d[0],
      )

      const color = getPackageColor(firstPackage.name, packageGroups)

      const firstBin = binnedDownloads[0]
      const lastBin = binnedDownloads[binnedDownloads.length - 1]

      if (!firstBin || !lastBin) return null

      const growth = lastBin[1] - firstBin[1]
      const growthPercentage = growth / (firstBin[1] || 1)

      return {
        package: firstPackage.name,
        totalDownloads: d3.sum(binnedDownloads, (d) => d[1]),
        binDownloads: lastBin[1],
        growth,
        growthPercentage,
        color,
        hidden: firstPackage.hidden,
        index,
      }
    })
    .filter((stat): stat is PackageStat => stat != null)
}

/**
 * A table showing download statistics for packages.
 * Displays package name, total downloads, and downloads per period.
 */
export function StatsTable({
  queryData,
  packageGroups,
  binOption,
  transform,
  onColorClick,
  onToggleVisibility,
  onRemove,
}: StatsTableProps) {
  const stats = calculateStats(queryData, packageGroups, binOption)
  const sortedStats = [...stats].sort((a, b) =>
    transform === 'normalize-y'
      ? b.growth - a.growth
      : b.binDownloads - a.binDownloads,
  )

  return (
    <div className="overflow-x-auto rounded-xl">
      <table className="min-w-full">
        <thead className="bg-gray-500/10">
          <tr>
            <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Package Name
            </th>
            <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total Period Downloads
            </th>
            <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Downloads last {binOption.single}
            </th>
          </tr>
        </thead>
        <tbody className="bg-gray-500/5 divide-y divide-gray-500/10">
          {sortedStats.map((stat) => (
            <tr key={stat.package}>
              <td className="px-3 sm:px-6 py-1 sm:py-2 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                <div className="flex items-center gap-2">
                  <Tooltip content="Change color">
                    <button
                      onClick={(e) => onColorClick(stat.package, e)}
                      className="hover:opacity-80"
                    >
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: stat.color }}
                      />
                    </button>
                  </Tooltip>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-0.5">
                      <Tooltip content="Toggle visibility">
                        <button
                          onClick={() =>
                            onToggleVisibility(stat.index, stat.package)
                          }
                          className="p-0.5 hover:text-blue-500 flex items-center gap-1"
                        >
                          <span className={stat.hidden ? 'opacity-50' : ''}>
                            {stat.package}
                          </span>
                          {stat.hidden ? <EyeOff className="" /> : null}
                        </button>
                      </Tooltip>
                      <Tooltip content="Remove package">
                        <button
                          onClick={() => onRemove(stat.index)}
                          className="p-0.5 text-gray-500 hover:text-red-500"
                        >
                          <X className="" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 sm:px-6 py-1 sm:py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-right">
                {formatNumber(stat.totalDownloads)}
              </td>
              <td className="px-3 sm:px-6 py-1 sm:py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-right">
                {formatNumber(stat.binDownloads)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
