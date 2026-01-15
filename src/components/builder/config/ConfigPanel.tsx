/**
 * ConfigPanel - Left panel containing all configuration options
 */

import * as React from 'react'
import { StarterCarousel } from './StarterCarousel'
import { ProjectConfig } from './ProjectConfig'
import { AddOnSection } from './AddOnSection'
import { ExportDropdown } from '../export/ExportDropdown'
import {
  useAddOns,
  useProjectName,
  setProjectName,
} from '@tanstack/cta-ui-base/dist/store/project'
import {
  getAddOnCategory,
  ADD_ON_CATEGORIES,
  type AddOnCategory,
} from '../types'
import { partners } from '~/utils/partners'

// Get partner IDs for filtering
const partnerIds = new Set(partners.map((p) => p.id.toLowerCase()))

export function ConfigPanel() {
  const { availableAddOns } = useAddOns()
  const projectName = useProjectName()

  // Featured add-ons (only actual partners, sorted by their score)
  const featuredAddOns = React.useMemo(() => {
    return availableAddOns
      .filter((addon) => partnerIds.has(addon.id.toLowerCase()))
      .sort((a, b) => {
        // Sort by partner score (from partners list)
        const partnerA = partners.find(
          (p) => p.id.toLowerCase() === a.id.toLowerCase(),
        )
        const partnerB = partners.find(
          (p) => p.id.toLowerCase() === b.id.toLowerCase(),
        )
        return (partnerB?.score ?? 0) - (partnerA?.score ?? 0)
      })
  }, [availableAddOns])

  // Group add-ons by category (partners appear in both Featured AND their category)
  const addOnsByCategory = React.useMemo(() => {
    const grouped = new Map<AddOnCategory, typeof availableAddOns>()

    for (const addon of availableAddOns) {
      const category = getAddOnCategory(addon.type, addon.id)

      if (!grouped.has(category)) {
        grouped.set(category, [])
      }
      grouped.get(category)!.push(addon)
    }

    // Sort categories by predefined order, with "other" at the end
    const categoryOrder: AddOnCategory[] = [
      'database',
      'auth',
      'ui',
      'tooling',
      'deployment',
      'example',
      'other',
    ]

    return categoryOrder
      .filter((cat) => grouped.has(cat) && grouped.get(cat)!.length > 0)
      .map((cat) => ({
        category: cat,
        label: ADD_ON_CATEGORIES[cat].label,
        description: ADD_ON_CATEGORIES[cat].description,
        addons: grouped.get(cat)!,
      }))
  }, [availableAddOns])

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Project name + Export button */}
      <div>
        <label
          htmlFor="project-name-input"
          className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
        >
          Project Name
        </label>
        <div className="flex gap-2">
          <input
            id="project-name-input"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="my-tanstack-app"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
          <ExportDropdown large />
        </div>
      </div>

      {/* Project Configuration */}
      <ProjectConfig hideProjectName />

      {/* Starter Selection */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Starter Template
        </h2>
        <StarterCarousel />
      </section>

      {/* Featured Add-ons (Partners) */}
      {featuredAddOns.length > 0 && (
        <AddOnSection
          title="Featured"
          description="Popular integrations from our partners"
          addons={featuredAddOns}
          defaultExpanded
        />
      )}

      {/* Add-ons by Category */}
      {addOnsByCategory.map(({ category, label, description, addons }) => (
        <AddOnSection
          key={category}
          title={label}
          description={description}
          addons={addons}
        />
      ))}

      {/* Empty state if no add-ons */}
      {addOnsByCategory.length === 0 && availableAddOns.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p className="text-sm">Loading add-ons...</p>
        </div>
      )}
    </div>
  )
}
