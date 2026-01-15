import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { X, Plus, Eye, EyeOff, Pin, EllipsisVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu'
import { Tooltip } from '~/components/Tooltip'
import { type PackageGroup, getPackageColor } from './NPMStatsChart'

export type PackagePillProps = {
  packageGroup: PackageGroup
  index: number
  allPackageGroups: PackageGroup[]
  error?: string
  onColorClick: (packageName: string, event: React.MouseEvent) => void
  onToggleVisibility: (index: number, packageName: string) => void
  onRemove: (index: number) => void
  // Optional advanced features (main page only)
  onBaselineChange?: (packageName: string) => void
  onCombinePackage?: (packageName: string) => void
  onRemoveFromGroup?: (mainPackage: string, subPackage: string) => void
  openMenuPackage?: string | null
  onMenuOpenChange?: (packageName: string, open: boolean) => void
}

export function PackagePill({
  packageGroup,
  index,
  allPackageGroups,
  error,
  onColorClick,
  onToggleVisibility,
  onRemove,
  onBaselineChange,
  onCombinePackage,
  onRemoveFromGroup,
  openMenuPackage,
  onMenuOpenChange,
}: PackagePillProps) {
  const mainPackage = packageGroup.packages[0]
  if (!mainPackage) return null

  const packageList = packageGroup.packages
  const isCombined = packageList.length > 1
  const subPackages = packageList.filter((p) => p.name !== mainPackage.name)
  const color = getPackageColor(mainPackage.name, allPackageGroups)

  const showAdvancedMenu =
    onBaselineChange && onCombinePackage && onMenuOpenChange

  return (
    <div
      className={`flex flex-col items-start
        rounded-md text-gray-900
        px-1 py-0.5
        sm:px-2 sm:py-1
        dark:text-gray-100 text-xs sm:text-sm`}
      style={{
        backgroundColor: `${color}20`,
      }}
    >
      <div className="flex items-center gap-1 w-full">
        {packageGroup.baseline ? (
          <>
            <Tooltip content="Remove baseline">
              <button
                onClick={() => onBaselineChange?.(mainPackage.name)}
                className="hover:text-blue-500"
              >
                <Pin className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
              </button>
            </Tooltip>
            <span>{mainPackage.name}</span>
          </>
        ) : (
          <>
            <Tooltip content="Change color">
              <button
                onClick={(e) => onColorClick(mainPackage.name, e)}
                className="hover:opacity-80"
              >
                <div
                  className="w-3 h-3 sm:w-4 sm:h-4 rounded"
                  style={{ backgroundColor: color }}
                />
              </button>
            </Tooltip>
            <Tooltip content="Toggle package visibility">
              <button
                onClick={() => onToggleVisibility(index, mainPackage.name)}
                className={twMerge(
                  'hover:text-blue-500 flex items-center gap-1',
                  mainPackage.hidden ? 'opacity-50' : '',
                )}
              >
                {mainPackage.name}
                {mainPackage.hidden ? (
                  <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" />
                ) : null}
              </button>
            </Tooltip>
          </>
        )}
        {isCombined ? (
          <span className="text-black/70 dark:text-white/70 text-[.7em] font-black py-0.5 px-1 leading-none rounded-md border-[1.5px] border-current opacity-80">
            + {subPackages.length}
          </span>
        ) : null}

        {/* Advanced dropdown menu (main page only) */}
        {showAdvancedMenu && (
          <div className="relative flex items-center">
            <DropdownMenu
              open={openMenuPackage === mainPackage.name}
              onOpenChange={(open) => onMenuOpenChange(mainPackage.name, open)}
            >
              <Tooltip content="More options">
                <DropdownMenuTrigger asChild>
                  <button className="px-0.5 sm:px-1 hover:text-blue-500">
                    <EllipsisVertical className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent
                className="min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-50"
                sideOffset={5}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Options</span>
                </div>
                <div className="space-y-1">
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      onToggleVisibility(index, mainPackage.name)
                    }}
                    className="w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer"
                  >
                    {mainPackage.hidden ? (
                      <EyeOff className="text-sm" />
                    ) : (
                      <Eye className="text-sm" />
                    )}
                    {mainPackage.hidden ? 'Show Package' : 'Hide Package'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      onBaselineChange(mainPackage.name)
                    }}
                    className={twMerge(
                      'w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer',
                      packageGroup.baseline ? 'text-blue-500' : '',
                    )}
                  >
                    <Pin className="text-sm" />
                    {packageGroup.baseline
                      ? 'Remove Baseline'
                      : 'Set as Baseline'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      onColorClick(
                        mainPackage.name,
                        e as unknown as React.MouseEvent,
                      )
                    }}
                    className="w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    Change Color
                  </DropdownMenuItem>
                  {isCombined && onRemoveFromGroup && (
                    <>
                      <div className="h-px bg-gray-500/20 my-1" />
                      <div className="px-2 py-1 text-xs font-medium text-gray-500">
                        Sub-packages
                      </div>
                      {subPackages.map((subPackage) => (
                        <DropdownMenuItem
                          key={subPackage.name}
                          onSelect={(e) => {
                            e.preventDefault()
                            onToggleVisibility(index, subPackage.name)
                          }}
                          className="w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer"
                        >
                          <div className="flex-1 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {subPackage.hidden ? (
                                <EyeOff className="text-sm" />
                              ) : (
                                <Eye className="text-sm" />
                              )}
                              <span
                                className={
                                  subPackage.hidden ? 'opacity-50' : ''
                                }
                              >
                                {subPackage.name}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onRemoveFromGroup(
                                  mainPackage.name,
                                  subPackage.name,
                                )
                              }}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      onCombinePackage(mainPackage.name)
                    }}
                    className="w-full px-2 py-1.5 text-left text-sm rounded hover:bg-gray-500/20 flex items-center gap-2 outline-none cursor-pointer"
                  >
                    <Plus className="text-sm" />
                    Add Packages
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <button
          onClick={() => onRemove(index)}
          className="ml-auto pl-0.5 sm:pl-1 text-gray-500 hover:text-red-500"
        >
          <X className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>
      </div>
      {error && (
        <div className="mt-1 text-xs font-mono text-red-500 px-1 font-medium bg-red-500/10 rounded">
          {error}
        </div>
      )}
    </div>
  )
}

export type PackagePillsProps = {
  packageGroups: PackageGroup[]
  queryData?: Array<{ error?: string } | undefined>
  onColorClick: (packageName: string, event: React.MouseEvent) => void
  onToggleVisibility: (index: number, packageName: string) => void
  onRemove: (index: number) => void
  // Optional advanced features (main page only)
  onBaselineChange?: (packageName: string) => void
  onCombinePackage?: (packageName: string) => void
  onRemoveFromGroup?: (mainPackage: string, subPackage: string) => void
  openMenuPackage?: string | null
  onMenuOpenChange?: (packageName: string, open: boolean) => void
}

export function PackagePills({
  packageGroups,
  queryData,
  onColorClick,
  onToggleVisibility,
  onRemove,
  onBaselineChange,
  onCombinePackage,
  onRemoveFromGroup,
  openMenuPackage,
  onMenuOpenChange,
}: PackagePillsProps) {
  return (
    <div className="flex flex-wrap gap-1 sm:gap-2">
      {packageGroups.map((pkg, index) => (
        <PackagePill
          key={pkg.packages[0]?.name ?? index}
          packageGroup={pkg}
          index={index}
          allPackageGroups={packageGroups}
          error={queryData?.[index]?.error}
          onColorClick={onColorClick}
          onToggleVisibility={onToggleVisibility}
          onRemove={onRemove}
          onBaselineChange={onBaselineChange}
          onCombinePackage={onCombinePackage}
          onRemoveFromGroup={onRemoveFromGroup}
          openMenuPackage={openMenuPackage}
          onMenuOpenChange={onMenuOpenChange}
        />
      ))}
    </div>
  )
}
