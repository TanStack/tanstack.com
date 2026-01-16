/**
 * TemplatePicker - Unified template selection combining starters and addon presets
 */

import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import {
  useRegistry,
  useProjectStarter,
  setProjectStarter,
  useAddOns,
  useReady,
} from '@tanstack/cta-ui-base/dist/store/project'
import { loadRemoteStarter } from '@tanstack/cta-ui-base/dist/lib/api'
import {
  Rocket,
  Bot,
  LayoutDashboard,
  FileText,
  Server,
  Radio,
  Globe,
  HardDrive,
  Plus,
  Package,
} from 'lucide-react'

type TemplatePreset = {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  addons: string[]
}

const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: 'saas',
    name: 'SaaS Starter',
    description: 'Auth, database, monitoring',
    icon: Rocket,
    addons: ['clerk', 'neon', 'sentry', 'shadcn', 'form'],
  },
  {
    id: 'ai-chat',
    name: 'AI Chat',
    description: 'LLM-powered app',
    icon: Bot,
    addons: ['ai', 'store', 'shadcn'],
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Admin panels, data tables',
    icon: LayoutDashboard,
    addons: ['table', 'tanstack-query', 'shadcn', 'form'],
  },
  {
    id: 'blog',
    name: 'Blog / CMS',
    description: 'Content-driven site',
    icon: FileText,
    addons: ['strapi', 'tanstack-query'],
  },
  {
    id: 'api-first',
    name: 'API-First',
    description: 'Type-safe backend APIs',
    icon: Server,
    addons: ['tRPC', 'tanstack-query', 'drizzle'],
  },
  {
    id: 'realtime',
    name: 'Realtime',
    description: 'Live, collaborative features',
    icon: Radio,
    addons: ['convex', 'tanstack-query'],
  },
  {
    id: 'i18n',
    name: 'Multi-Language',
    description: 'Internationalized app',
    icon: Globe,
    addons: ['paraglide', 'shadcn'],
  },
  {
    id: 'local-first',
    name: 'Local-First',
    description: 'Offline-capable, sync-enabled',
    icon: HardDrive,
    addons: ['db', 'tanstack-query', 'store'],
  },
]

type RegistryStarter = {
  name: string
  description: string
  url: string
  banner?: string
  framework?: string
}

export function TemplatePicker() {
  const ready = useReady()
  const registry = useRegistry()
  const projectStarter = useProjectStarter((s) => s.projectStarter)
  const { availableAddOns, chosenAddOns, toggleAddOn } = useAddOns()
  const [loading, setLoading] = React.useState<string | null>(null)

  const remoteStarters = React.useMemo(
    () => (registry?.starters ?? []) as RegistryStarter[],
    [registry?.starters],
  )

  const selectedStarterUrl = projectStarter?.url ?? 'blank'

  // Check if current selection matches a preset
  const activePresetId = React.useMemo(() => {
    if (!ready || selectedStarterUrl !== 'blank') return null

    for (const preset of TEMPLATE_PRESETS) {
      const presetSet = new Set(
        preset.addons.filter((id) => availableAddOns.some((a) => a.id === id)),
      )
      const chosenSet = new Set(chosenAddOns)

      if (presetSet.size === chosenSet.size) {
        let matches = true
        for (const id of presetSet) {
          if (!chosenSet.has(id)) {
            matches = false
            break
          }
        }
        if (matches) return preset.id
      }
    }
    return null
  }, [ready, selectedStarterUrl, availableAddOns, chosenAddOns])

  const isBlankSelected =
    selectedStarterUrl === 'blank' && chosenAddOns.length === 0

  const handleSelectBlank = () => {
    setProjectStarter(undefined)
    // Turn off all currently selected addons
    for (const addonId of chosenAddOns) {
      toggleAddOn(addonId)
    }
  }

  const handleSelectPreset = (preset: TemplatePreset) => {
    if (!ready) return

    // Reset to blank starter
    setProjectStarter(undefined)

    // Clear existing addons
    for (const addonId of chosenAddOns) {
      if (!preset.addons.includes(addonId)) {
        toggleAddOn(addonId)
      }
    }

    // Enable preset addons
    for (const addonId of preset.addons) {
      const isAvailable = availableAddOns.some((a) => a.id === addonId)
      const isChosen = chosenAddOns.includes(addonId)
      if (isAvailable && !isChosen) {
        toggleAddOn(addonId)
      }
    }
  }

  const handleSelectRemoteStarter = async (url: string) => {
    setLoading(url)
    try {
      const starterData = await loadRemoteStarter(url)
      if ('error' in starterData) {
        console.error('Failed to load starter:', starterData.error)
      } else {
        setProjectStarter(starterData)
      }
    } catch (error) {
      console.error('Failed to load starter:', error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Main templates grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Blank option */}
        <TemplateCard
          name="Blank"
          description="Start from scratch"
          icon={Plus}
          isSelected={isBlankSelected}
          onClick={handleSelectBlank}
        />

        {/* Preset templates */}
        {TEMPLATE_PRESETS.map((preset) => (
          <TemplateCard
            key={preset.id}
            name={preset.name}
            description={preset.description}
            icon={preset.icon}
            isSelected={activePresetId === preset.id}
            onClick={() => handleSelectPreset(preset)}
          />
        ))}
      </div>

      {/* Remote starters (if any) */}
      {remoteStarters.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Community Starters
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {remoteStarters.map((starter) => (
              <TemplateCard
                key={starter.url}
                name={starter.name}
                description={starter.description}
                icon={Package}
                isSelected={selectedStarterUrl === starter.url}
                isLoading={loading === starter.url}
                onClick={() => handleSelectRemoteStarter(starter.url)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

type TemplateCardProps = {
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  isSelected: boolean
  isLoading?: boolean
  onClick: () => void
}

function TemplateCard({
  name,
  description,
  icon: Icon,
  isSelected,
  isLoading,
  onClick,
}: TemplateCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={twMerge(
        'flex items-center gap-2.5 p-2.5 rounded-lg border transition-all text-left',
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800',
        isLoading && 'opacity-50 cursor-wait',
      )}
      title={description}
    >
      <div
        className={twMerge(
          'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
          isSelected
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
        )}
      >
        {isLoading ? (
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <Icon className="w-4 h-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={twMerge(
            'text-sm font-medium truncate',
            isSelected
              ? 'text-blue-700 dark:text-blue-300'
              : 'text-gray-900 dark:text-white',
          )}
        >
          {name}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {description}
        </div>
      </div>
    </button>
  )
}
