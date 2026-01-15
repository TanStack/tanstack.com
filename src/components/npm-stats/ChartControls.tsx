import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { EllipsisVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu'
import { Tooltip } from '~/components/Tooltip'
import {
  type TimeRange,
  type BinType,
  type TransformMode,
  type ShowDataMode,
  type FacetValue,
  timeRanges,
  binningOptions,
  isBinningOptionValidForRange,
} from './NPMStatsChart'

const dropdownButtonStyles = {
  base: 'bg-gray-500/10 rounded-md px-2 py-1 text-sm flex items-center gap-1',
  active: 'bg-gray-500/20',
} as const

const transformOptions = [
  { value: 'none', label: 'Actual Values' },
  { value: 'normalize-y', label: 'Relative Change' },
] as const

const showDataModeOptions = [
  { value: 'all', label: 'All Data' },
  { value: 'complete', label: 'Hide Partial Data' },
] as const

const facetOptions = [{ value: 'name', label: 'Package' }] as const

export type ChartControlsProps = {
  range: TimeRange
  binType: BinType
  transform: TransformMode
  showDataMode: ShowDataMode
  onRangeChange: (range: TimeRange) => void
  onBinTypeChange: (binType: BinType) => void
  onTransformChange: (transform: TransformMode) => void
  onShowDataModeChange: (mode: ShowDataMode) => void
  // Optional facet controls (main page only)
  facetX?: FacetValue
  facetY?: FacetValue
  onFacetXChange?: (value: FacetValue | undefined) => void
  onFacetYChange?: (value: FacetValue | undefined) => void
}

export function ChartControls({
  range,
  binType,
  transform,
  showDataMode,
  onRangeChange,
  onBinTypeChange,
  onTransformChange,
  onShowDataModeChange,
  facetX,
  facetY,
  onFacetXChange,
  onFacetYChange,
}: ChartControlsProps) {
  const showFacets = onFacetXChange && onFacetYChange

  return (
    <>
      {/* Time Range */}
      <DropdownMenu>
        <Tooltip content="Select time range">
          <DropdownMenuTrigger asChild>
            <button className={twMerge(dropdownButtonStyles.base)}>
              {timeRanges.find((r) => r.value === range)?.label}
              <EllipsisVertical className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent className="min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Time Range</span>
          </div>
          {timeRanges.map(({ value, label }) => (
            <DropdownMenuItem
              key={value}
              onSelect={() => onRangeChange(value)}
              className={twMerge(
                'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                value === range ? 'text-blue-500 bg-blue-500/10' : '',
                'data-highlighted:bg-gray-500/20 data-highlighted:text-blue-500',
              )}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Binning Interval */}
      <DropdownMenu>
        <Tooltip content="Select binning interval">
          <DropdownMenuTrigger asChild>
            <button
              className={twMerge(
                dropdownButtonStyles.base,
                binType !== 'weekly' && dropdownButtonStyles.active,
              )}
            >
              {binningOptions.find((b) => b.value === binType)?.label}
              <EllipsisVertical className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent className="min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Binning Interval</span>
          </div>
          {binningOptions.map(({ label, value }) => (
            <DropdownMenuItem
              key={value}
              onSelect={() => onBinTypeChange(value)}
              disabled={!isBinningOptionValidForRange(range, value)}
              className={twMerge(
                'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                binType === value ? 'text-blue-500 bg-blue-500/10' : '',
                'data-highlighted:bg-gray-500/20 data-highlighted:text-blue-500',
                !isBinningOptionValidForRange(range, value)
                  ? 'opacity-50 cursor-not-allowed'
                  : '',
              )}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Y-Axis Transform */}
      <DropdownMenu>
        <Tooltip content="Transform the Y-axis to show relative changes between packages. 'None' shows actual download numbers, while 'Normalize Y' shows percentage changes relative to the first data point.">
          <DropdownMenuTrigger asChild>
            <button
              className={twMerge(
                dropdownButtonStyles.base,
                transform !== 'none' && dropdownButtonStyles.active,
              )}
            >
              {transformOptions.find((opt) => opt.value === transform)?.label}
              <EllipsisVertical className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent className="min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Y-Axis Transform</span>
          </div>
          {transformOptions.map(({ value, label }) => (
            <DropdownMenuItem
              key={value}
              onSelect={() => onTransformChange(value as TransformMode)}
              className={twMerge(
                'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                transform === value ? 'text-blue-500 bg-blue-500/10' : '',
                'data-highlighted:bg-gray-500/20 data-highlighted:text-blue-500',
              )}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Facet X (optional) */}
      {showFacets && (
        <DropdownMenu>
          <Tooltip content="Split the visualization horizontally by package">
            <DropdownMenuTrigger asChild>
              <button
                className={twMerge(
                  dropdownButtonStyles.base,
                  facetX && dropdownButtonStyles.active,
                )}
              >
                {facetX
                  ? `Facet X by ${facetOptions.find((opt) => opt.value === facetX)?.label}`
                  : 'No Facet X'}
                <EllipsisVertical className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent className="min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Horizontal Facet</span>
            </div>
            <DropdownMenuItem
              onSelect={() => onFacetXChange(undefined)}
              className={twMerge(
                'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                !facetX ? 'text-blue-500 bg-blue-500/10' : '',
                'data-highlighted:bg-gray-500/20 data-highlighted:text-blue-500',
              )}
            >
              No Facet
            </DropdownMenuItem>
            {facetOptions.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onSelect={() => onFacetXChange(value)}
                className={twMerge(
                  'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                  facetX === value ? 'text-blue-500 bg-blue-500/10' : '',
                  'data-highlighted:bg-gray-500/20 data-highlighted:text-blue-500',
                )}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Facet Y (optional) */}
      {showFacets && (
        <DropdownMenu>
          <Tooltip content="Split the visualization vertically by package">
            <DropdownMenuTrigger asChild>
              <button
                className={twMerge(
                  dropdownButtonStyles.base,
                  facetY && dropdownButtonStyles.active,
                )}
              >
                {facetY
                  ? `Facet Y by ${facetOptions.find((opt) => opt.value === facetY)?.label}`
                  : 'No Facet Y'}
                <EllipsisVertical className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent className="min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Vertical Facet</span>
            </div>
            <DropdownMenuItem
              onSelect={() => onFacetYChange(undefined)}
              className={twMerge(
                'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                !facetY ? 'text-blue-500 bg-blue-500/10' : '',
                'data-highlighted:bg-gray-500/20 data-highlighted:text-blue-500',
              )}
            >
              No Facet
            </DropdownMenuItem>
            {facetOptions.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onSelect={() => onFacetYChange(value)}
                className={twMerge(
                  'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                  facetY === value ? 'text-blue-500 bg-blue-500/10' : '',
                  'data-highlighted:bg-gray-500/20 data-highlighted:text-blue-500',
                )}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Show Data Mode */}
      <DropdownMenu>
        <Tooltip
          content={
            transform === 'normalize-y'
              ? 'Only complete data is shown when using relative change'
              : 'Control how data is displayed'
          }
        >
          <DropdownMenuTrigger asChild>
            <button
              className={twMerge(
                dropdownButtonStyles.base,
                showDataMode !== 'all' && dropdownButtonStyles.active,
                transform === 'normalize-y' && 'opacity-50 cursor-not-allowed',
              )}
              disabled={transform === 'normalize-y'}
            >
              {
                showDataModeOptions.find((opt) => opt.value === showDataMode)
                  ?.label
              }
              <EllipsisVertical className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent className="min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Data Display Mode</span>
          </div>
          {showDataModeOptions.map(({ value, label }) => (
            <DropdownMenuItem
              key={value}
              onSelect={() => onShowDataModeChange(value)}
              disabled={transform === 'normalize-y'}
              className={twMerge(
                'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                showDataMode === value ? 'text-blue-500 bg-blue-500/10' : '',
                'data-highlighted:bg-gray-500/20 data-highlighted:text-blue-500',
                transform === 'normalize-y'
                  ? 'opacity-50 cursor-not-allowed'
                  : '',
              )}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
