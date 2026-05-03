import * as React from 'react'
import { Link } from '@tanstack/react-router'
import type { PackageGroup } from './shared'
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
          const baselinePackages = comparison.packageGroups.filter(
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
              {baselinePackages.length > 0 && (
                <div className="flex items-center gap-1.5 text-sm flex-wrap">
                  <div className="font-medium">Baseline:</div>
                  {baselinePackages.map((pg, i) => (
                    <React.Fragment key={pg.packages[0]?.name ?? i}>
                      {i > 0 && (
                        <span className="text-blue-500/60 text-xs">+</span>
                      )}
                      <div className="bg-blue-500/10 text-blue-700 dark:text-blue-300 rounded-md px-2 py-1 leading-none font-bold text-sm">
                        {pg.packages[0]?.name}
                      </div>
                    </React.Fragment>
                  ))}
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
