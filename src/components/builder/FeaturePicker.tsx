/**
 * Feature Picker (v2)
 *
 * Component for selecting features in the builder.
 * Shows Framework (locked) -> Styling (Tailwind toggle) -> Add-ons hierarchy.
 * Grouped by category with conflict/dependency handling.
 * Features partner badges, external links, and collapsible sections.
 * Partner features are sorted first by score within categories.
 */

import { useState, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { Star, ExternalLink, ChevronDown } from 'lucide-react'
import { matchSorter } from 'match-sorter'
import {
  useBuilderStore,
  useFeatureState,
  useAvailableFeatures,
  useIntegrationSearch,
} from './store'
import { partners } from '~/utils/partners'
import { Tooltip } from '~/ui/Tooltip'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '~/components/Collapsible'
import type { FeatureId, FeatureInfo } from '~/builder/api'
import { CustomAddonButton } from './CustomAddonDialog'

type FeatureCategory =
  | 'tanstack'
  | 'database'
  | 'orm'
  | 'auth'
  | 'deploy'
  | 'tooling'
  | 'monitoring'
  | 'api'
  | 'i18n'
  | 'cms'
  | 'other'

// Build a map of partner scores by partnerId
const partnerScores = new Map(
  partners.filter((p) => p.score !== undefined).map((p) => [p.id, p.score]),
)

const CATEGORY_INFO: Record<
  FeatureCategory,
  { label: string; description: string }
> = {
  tanstack: {
    label: 'TanStack',
    description: 'Official TanStack libraries',
  },
  database: {
    label: 'Database',
    description: 'Database providers and real-time backends',
  },
  orm: {
    label: 'ORM',
    description: 'Object-relational mapping and query builders',
  },
  auth: {
    label: 'Authentication',
    description: 'User authentication and authorization',
  },
  deploy: {
    label: 'Deployment',
    description: 'Hosting and deployment platforms',
  },
  monitoring: {
    label: 'Monitoring',
    description: 'Observability, error tracking, and performance monitoring',
  },
  cms: {
    label: 'CMS',
    description: 'Content management systems',
  },
  tooling: {
    label: 'Tooling',
    description: 'Development tools, linting, and utilities',
  },
  api: {
    label: 'API',
    description: 'Type-safe APIs and RPC frameworks',
  },
  i18n: {
    label: 'i18n',
    description: 'Internationalization and localization',
  },
  other: {
    label: 'Other',
    description: 'Additional tools and integrations',
  },
}

const CATEGORY_ORDER: Array<FeatureCategory> = [
  'tanstack',
  'deploy',
  'database',
  'orm',
  'auth',
  'monitoring',
  'api',
  'i18n',
  'cms',
  'tooling',
  'other',
]

// Custom addon color used in store.ts addCustomAddon
const CUSTOM_ADDON_COLOR = '#8B5CF6'

// Sort features: partners first (by score descending), then non-partners, custom addons last
function sortFeaturesByPartnerScore(
  features: Array<FeatureInfo>,
): Array<FeatureInfo> {
  return [...features].sort((a, b) => {
    // Custom addons always last
    const aIsCustom = a.color === CUSTOM_ADDON_COLOR
    const bIsCustom = b.color === CUSTOM_ADDON_COLOR
    if (aIsCustom && !bIsCustom) return 1
    if (!aIsCustom && bIsCustom) return -1

    const scoreA = a.partnerId ? (partnerScores.get(a.partnerId) ?? 0) : -1
    const scoreB = b.partnerId ? (partnerScores.get(b.partnerId) ?? 0) : -1
    // Higher scores first, partners before non-partners
    return scoreB - scoreA
  })
}

export function FeaturePicker() {
  const availableFeatures = useAvailableFeatures()
  const search = useIntegrationSearch()

  // Filter features by search
  const filteredFeatures = useMemo(() => {
    if (!search.trim()) return availableFeatures
    return matchSorter(availableFeatures, search, {
      keys: ['name', 'description', 'category'],
    })
  }, [availableFeatures, search])

  // Separate partner features for "Featured" section, sorted by score
  const partnerFeatures = useMemo(
    () =>
      sortFeaturesByPartnerScore(filteredFeatures.filter((f) => f.partnerId)),
    [filteredFeatures],
  )

  // Group features by category, with partners sorted first by score
  const featuresByCategory = useMemo(() => {
    return CATEGORY_ORDER.reduce(
      (acc, category) => {
        const categoryFeatures = filteredFeatures.filter(
          (f) => f.category === category,
        )
        acc[category] = sortFeaturesByPartnerScore(categoryFeatures)
        return acc
      },
      {} as Record<FeatureCategory, Array<FeatureInfo>>,
    )
  }, [filteredFeatures])

  const isSearching = search.trim().length > 0

  return (
    <div className="p-4 space-y-2">
      {/* Featured section */}
      {partnerFeatures.length > 0 && !isSearching && (
        <FeatureSection
          title="Featured"
          description="Popular integrations from our partners"
          features={partnerFeatures}
          defaultOpen
        />
      )}

      {/* Category sections */}
      {CATEGORY_ORDER.map((category) => {
        const features = featuresByCategory[category]
        if (!features || features.length === 0) return null

        const info = CATEGORY_INFO[category]
        return (
          <FeatureSection
            key={category}
            title={info.label}
            description={info.description}
            features={features}
            defaultOpen
            forceOpen={isSearching}
          />
        )
      })}

      {/* No results */}
      {isSearching && filteredFeatures.length === 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">
          No add-ons found for "{search}"
        </div>
      )}

      {/* Custom addon import */}
      <CustomAddonButton />
    </div>
  )
}

interface FeatureSectionProps {
  title: string
  description: string
  features: Array<FeatureInfo>
  defaultOpen?: boolean
  forceOpen?: boolean
}

function FeatureSection({
  title,
  description,
  features,
  defaultOpen = false,
  forceOpen = false,
}: FeatureSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const effectiveOpen = forceOpen || isOpen

  return (
    <Collapsible open={effectiveOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between py-3">
        <div className="text-left">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>
        <ChevronDown
          className={twMerge(
            'w-4 h-4 text-gray-400 transition-transform duration-200',
            effectiveOpen && 'rotate-180',
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-1 px-1 pb-2">
          {features.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

interface FeatureCardProps {
  feature: FeatureInfo
}

function FeatureCard({ feature }: FeatureCardProps) {
  const toggleFeature = useBuilderStore((s) => s.toggleFeature)
  const getFeatureInfo = useBuilderStore((s) => s.getFeatureInfo)
  const { selected, enabled, disabledReason, conflict, requiredBy } =
    useFeatureState(feature.id)

  const handleClick = () => {
    if (enabled && !requiredBy) {
      toggleFeature(feature.id)
    }
  }

  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const isPartner = Boolean(feature.partnerId)
  const isDisabled = !enabled || !!requiredBy

  // Build tooltip content
  const tooltipContent = disabledReason
    ? disabledReason
    : conflict
      ? `Replaces ${getFeatureInfo(conflict)?.name ?? conflict}`
      : null

  const featureColor = feature.color ?? '#6b7280'

  const cardContent = (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={twMerge(
        'relative w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
        selected
          ? 'border-current'
          : enabled
            ? 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
            : 'bg-gray-100 dark:bg-gray-800/30 border-gray-200 dark:border-gray-800 opacity-60 cursor-not-allowed',
      )}
      style={
        selected
          ? {
              borderColor: featureColor,
              backgroundColor: `${featureColor}15`,
            }
          : undefined
      }
    >
      {/* Color dot */}
      <div
        className={twMerge(
          'w-3 h-3 shrink-0 rounded-full',
          !enabled && 'opacity-50',
        )}
        style={{ backgroundColor: featureColor }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3
          className={twMerge(
            'font-medium text-sm',
            selected && 'text-gray-900 dark:text-gray-100',
            !selected && enabled && 'text-gray-900 dark:text-gray-100',
            !selected && !enabled && 'text-gray-500 dark:text-gray-500',
          )}
        >
          {feature.name}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 sm:line-clamp-2 md:line-clamp-1 xl:line-clamp-2">
          {feature.description}
        </p>
      </div>

      {/* Partner badge + External link stacked */}
      {(isPartner || feature.link) && (
        <div className="flex flex-col items-center gap-2 shrink-0">
          {isPartner && (
            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-500 dark:text-amber-400 leading-none">
              <Star className="w-2.5 h-2.5 fill-amber-500 dark:fill-amber-400" />
              Partner
            </span>
          )}
          {feature.link && (
            <a
              href={feature.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLinkClick}
              className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}
    </button>
  )

  if (tooltipContent) {
    return (
      <Tooltip content={tooltipContent} side="top">
        <div>{cardContent}</div>
      </Tooltip>
    )
  }

  return cardContent
}

// Feature options panel
interface FeatureOptionsProps {
  featureId: FeatureId
}

export function FeatureOptions({ featureId }: FeatureOptionsProps) {
  const feature = useBuilderStore((s) => s.getFeatureInfo(featureId))
  const featureOptions = useBuilderStore((s) => s.featureOptions)
  const setFeatureOption = useBuilderStore((s) => s.setFeatureOption)

  if (!feature || !feature.options || feature.options.length === 0) {
    return null
  }

  const currentOptions = featureOptions[featureId] || {}

  return (
    <div className="space-y-3">
      {feature.options.map((option) => (
        <div key={option.key}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {option.label}
          </label>
          {option.type === 'select' && option.choices && (
            <select
              value={String(currentOptions[option.key] ?? option.default)}
              onChange={(e) =>
                setFeatureOption(featureId, option.key, e.target.value)
              }
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {option.choices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          )}
          {option.type === 'boolean' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(currentOptions[option.key] ?? option.default)}
                onChange={(e) =>
                  setFeatureOption(featureId, option.key, e.target.checked)
                }
                className="rounded border-gray-300 dark:border-gray-600 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Enable
              </span>
            </label>
          )}
          {option.type === 'string' && (
            <input
              type="text"
              value={String(currentOptions[option.key] ?? option.default ?? '')}
              onChange={(e) =>
                setFeatureOption(featureId, option.key, e.target.value)
              }
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          )}
          {option.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {option.description}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
