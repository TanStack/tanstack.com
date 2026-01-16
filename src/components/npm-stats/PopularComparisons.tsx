import * as React from 'react'
import { Link } from '@tanstack/react-router'
import type { PackageGroup } from './NPMStatsChart'
import { defaultColors } from '~/utils/npm-packages'

export type ComparisonGroup = {
  title: string
  packageGroups: PackageGroup[]
}

type PopularComparisonsProps = {
  comparisons: ComparisonGroup[]
  // Optional: customize the link target
  linkTo?: string
  // Optional: callback when a comparison is clicked
  onSelect?: (comparison: ComparisonGroup) => void
}

export function PopularComparisons({
  comparisons,
  linkTo = '.',
  onSelect,
}: PopularComparisonsProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Popular Comparisons</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {comparisons.map((comparison) => {
          const baselinePackage = comparison.packageGroups.find(
            (pg) => pg.baseline,
          )

          const content = (
            <div className="space-y-4">
              <div className="space-y-2">
                <div>
                  <h3 className="font-medium">{comparison.title}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {comparison.packageGroups
                    .filter((d) => !d.baseline)
                    .map((packageGroup) => (
                      <div
                        key={packageGroup.packages[0]?.name}
                        className="flex items-center gap-1.5 text-sm"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor:
                              packageGroup.color || defaultColors[0],
                          }}
                        />
                        <span>{packageGroup.packages[0]?.name}</span>
                      </div>
                    ))}
                </div>
              </div>
              {baselinePackage && (
                <div className="flex items-center gap-1 text-sm">
                  <div className="font-medium">Baseline:</div>
                  <div className="bg-gray-500/10 rounded-md px-2 py-1 leading-none font-bold text-sm">
                    {baselinePackage.packages[0]?.name}
                  </div>
                </div>
              )}
            </div>
          )

          if (onSelect) {
            return (
              <button
                key={comparison.title}
                onClick={() => onSelect(comparison)}
                className="block p-4 bg-gray-500/10 hover:bg-gray-500/20 rounded-lg transition-colors text-left w-full"
              >
                {content}
              </button>
            )
          }

          return (
            <Link
              key={comparison.title}
              to={linkTo}
              search={(prev: Record<string, unknown>) => ({
                ...prev,
                packageGroups: comparison.packageGroups,
              })}
              resetScroll={false}
              onClick={() => {
                window.scrollTo({
                  top: 0,
                  behavior: 'smooth',
                })
              }}
              className="block p-4 bg-gray-500/10 hover:bg-gray-500/20 rounded-lg transition-colors"
            >
              {content}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
