/**
 * Builder Store (v2)
 *
 * Local state management for the new builder using Zustand.
 * No external CTA dependencies.
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type {
  FeatureId,
  FeatureInfo,
  ProjectDefinition,
  AttributedCompileOutput,
  TemplateInfo,
  IntegrationCompiled,
  CustomTemplateCompiled,
} from '~/builder/api'

type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'

interface BuilderState {
  // Project configuration
  projectName: string
  tailwind: boolean
  features: Array<FeatureId>
  featureOptions: Record<string, Record<string, unknown>>

  // CLI options
  packageManager: PackageManager
  skipInstall: boolean
  skipGit: boolean

  // Custom integrations/templates (loaded from URLs)
  customIntegrations: Array<IntegrationCompiled>
  customTemplate: CustomTemplateCompiled | null

  // Registry data (loaded from API)
  availableFeatures: Array<FeatureInfo>
  availableTemplates: Array<TemplateInfo>
  featuresLoaded: boolean

  // UI state
  integrationSearch: string

  // Compilation output (with line attribution data)
  compiledOutput: AttributedCompileOutput | null
  isCompiling: boolean
  compileError: string | null

  // Actions
  setProjectName: (name: string) => void
  setTailwind: (enabled: boolean) => void
  toggleFeature: (id: FeatureId) => void
  setFeatureOption: (
    featureId: FeatureId,
    optionKey: string,
    value: unknown,
  ) => void
  setFeatures: (features: Array<FeatureId>) => void
  setPackageManager: (pm: PackageManager) => void
  setSkipInstall: (skip: boolean) => void
  setSkipGit: (skip: boolean) => void
  applyTemplate: (template: TemplateInfo) => void
  addCustomIntegration: (integration: IntegrationCompiled) => void
  removeCustomIntegration: (id: string) => void
  setCustomTemplate: (template: CustomTemplateCompiled | null) => void
  setIntegrationSearch: (search: string) => void
  loadFeatures: () => Promise<void>
  compile: () => Promise<void>
  reset: () => void

  // Derived state helpers
  hasFeature: (id: FeatureId) => boolean
  getFeatureInfo: (id: FeatureId) => FeatureInfo | undefined
  getDefinition: () => ProjectDefinition
}

const initialState = {
  projectName: 'my-tanstack-app',
  tailwind: true,
  features: [] as Array<FeatureId>,
  featureOptions: {} as Record<string, Record<string, unknown>>,
  packageManager: 'pnpm' as PackageManager,
  skipInstall: false,
  skipGit: false,
  customIntegrations: [] as Array<IntegrationCompiled>,
  customTemplate: null as CustomTemplateCompiled | null,
  availableFeatures: [] as Array<FeatureInfo>,
  availableTemplates: [] as Array<TemplateInfo>,
  integrationSearch: '',
  featuresLoaded: false,
  compiledOutput: null as AttributedCompileOutput | null,
  isCompiling: false,
  compileError: null as string | null,
}

export const useBuilderStore = create<BuilderState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setProjectName: (name) => set({ projectName: name }),

    setTailwind: (enabled) => {
      const { features, availableFeatures } = get()
      if (!enabled) {
        // Remove features that require Tailwind
        const filtered = features.filter((id) => {
          const feature = availableFeatures.find((f) => f.id === id)
          return !feature?.requiresTailwind
        })
        set({ tailwind: enabled, features: filtered })
      } else {
        set({ tailwind: enabled })
      }
    },

    toggleFeature: (id) => {
      const { features, availableFeatures } = get()
      const isSelected = features.includes(id)

      if (isSelected) {
        // Remove feature and any features that required it
        const toRemove = new Set([id])
        for (const f of availableFeatures) {
          if (f.requires.includes(id) && features.includes(f.id)) {
            toRemove.add(f.id)
          }
        }
        set({ features: features.filter((f) => !toRemove.has(f)) })
      } else {
        // Add feature and its requirements
        const feature = availableFeatures.find((f) => f.id === id)
        if (!feature) return

        // Find features that share exclusive types with the new feature
        const exclusiveConflicts = new Set<FeatureId>()
        if (feature.exclusive.length > 0) {
          for (const existingId of features) {
            const existing = availableFeatures.find((f) => f.id === existingId)
            if (
              existing?.exclusive.some((e) => feature.exclusive.includes(e))
            ) {
              exclusiveConflicts.add(existingId)
            }
          }
        }

        if (exclusiveConflicts.size > 0) {
          // Remove features with overlapping exclusive types
          const withoutConflicts = features.filter(
            (f) => !exclusiveConflicts.has(f),
          )
          set({
            features: [...withoutConflicts, ...feature.requires, id],
          })
        } else {
          // Add feature with requirements
          const newFeatures = new Set([...features, ...feature.requires, id])
          set({ features: Array.from(newFeatures) })
        }
      }
    },

    setFeatureOption: (featureId, optionKey, value) => {
      const { featureOptions } = get()
      set({
        featureOptions: {
          ...featureOptions,
          [featureId]: {
            ...featureOptions[featureId],
            [optionKey]: value,
          },
        },
      })
    },

    setFeatures: (features) => set({ features }),

    setPackageManager: (pm) => set({ packageManager: pm }),
    setSkipInstall: (skip) => set({ skipInstall: skip }),
    setSkipGit: (skip) => set({ skipGit: skip }),

    applyTemplate: (template) => {
      set({
        tailwind: template.tailwind ?? true,
        features: template.features ?? [],
        featureOptions: {},
      })
    },

    addCustomIntegration: (integration) => {
      const { customIntegrations, features, availableFeatures } = get()
      // Don't add duplicates
      if (customIntegrations.some((i) => i.id === integration.id)) return

      // Convert to FeatureInfo for UI compatibility
      const featureInfo: FeatureInfo = {
        id: integration.id,
        name: integration.name,
        description: integration.description,
        category: integration.category ?? 'other',
        requires: integration.dependsOn ?? [],
        exclusive: integration.exclusive ?? [],
        hasOptions: !!integration.options,
        link: integration.link,
        color: '#8B5CF6', // Purple for custom integrations
        requiresTailwind: integration.requiresTailwind,
        demoRequiresTailwind: integration.demoRequiresTailwind,
      }

      set({
        customIntegrations: [...customIntegrations, integration],
        availableFeatures: [...availableFeatures, featureInfo],
        features: [...features, integration.id],
      })
    },

    removeCustomIntegration: (id) => {
      const { customIntegrations, features, availableFeatures } = get()
      set({
        customIntegrations: customIntegrations.filter((i) => i.id !== id),
        availableFeatures: availableFeatures.filter((f) => f.id !== id),
        features: features.filter((f) => f !== id),
      })
    },

    setCustomTemplate: (template) => {
      set({ customTemplate: template })
    },

    setIntegrationSearch: (search) => {
      set({ integrationSearch: search })
    },

    loadFeatures: async () => {
      try {
        const response = await fetch('/api/builder/features')
        if (!response.ok) throw new Error('Failed to load features')
        const data = await response.json()
        set({
          availableFeatures: data.features,
          availableTemplates: data.templates || [],
          featuresLoaded: true,
        })
      } catch (error) {
        console.error('Failed to load features:', error)
        set({ featuresLoaded: true })
      }
    },

    compile: async () => {
      const {
        projectName,
        tailwind,
        features,
        featureOptions,
        customIntegrations,
        customTemplate,
      } = get()

      set({ isCompiling: true, compileError: null })

      try {
        // Use attributed endpoint to get line-by-line contribution tracking
        const response = await fetch('/api/builder/compile-attributed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            definition: {
              name: projectName,
              tailwind,
              features,
              featureOptions,
              customIntegrations,
              customTemplate,
            },
            format: 'full',
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Compilation failed')
        }

        const output = await response.json()
        set({ compiledOutput: output, isCompiling: false })
      } catch (error) {
        set({
          compileError:
            error instanceof Error ? error.message : 'Unknown error',
          isCompiling: false,
        })
      }
    },

    reset: () => set(initialState),

    hasFeature: (id) => get().features.includes(id),

    getFeatureInfo: (id) => get().availableFeatures.find((f) => f.id === id),

    getDefinition: () => ({
      name: get().projectName,
      features: get().features,
      featureOptions: get().featureOptions,
    }),
  })),
)

// Selector hooks for common patterns
export const useProjectName = () => useBuilderStore((s) => s.projectName)
export const useTailwind = () => useBuilderStore((s) => s.tailwind)
export const useFeatures = () => useBuilderStore((s) => s.features)
export const useFeatureOptions = () => useBuilderStore((s) => s.featureOptions)
export const usePackageManager = () => useBuilderStore((s) => s.packageManager)
export const useSkipInstall = () => useBuilderStore((s) => s.skipInstall)
export const useSkipGit = () => useBuilderStore((s) => s.skipGit)
export const useAvailableFeatures = () =>
  useBuilderStore((s) => s.availableFeatures)
export const useAvailableTemplates = () =>
  useBuilderStore((s) => s.availableTemplates)
export const useFeaturesLoaded = () => useBuilderStore((s) => s.featuresLoaded)
export const useCompiledOutput = () => useBuilderStore((s) => s.compiledOutput)
export const useIsCompiling = () => useBuilderStore((s) => s.isCompiling)
export const useCompileError = () => useBuilderStore((s) => s.compileError)
export const useCustomIntegrations = () =>
  useBuilderStore((s) => s.customIntegrations)
export const useCustomTemplate = () => useBuilderStore((s) => s.customTemplate)
export const useIntegrationSearch = () =>
  useBuilderStore((s) => s.integrationSearch)

// Feature state with exclusive/requirement analysis
export function useFeatureState(id: FeatureId) {
  const features = useBuilderStore((s) => s.features)
  const tailwind = useBuilderStore((s) => s.tailwind)
  const availableFeatures = useBuilderStore((s) => s.availableFeatures)

  const feature = availableFeatures.find((f) => f.id === id)
  if (!feature) {
    return {
      selected: false,
      enabled: false,
      disabledReason: null as string | null,
      exclusiveConflict: null as FeatureId | null,
      requiredBy: null as FeatureId | null,
    }
  }

  const selected = features.includes(id)

  // Check if disabled due to Tailwind requirement
  const needsTailwind = feature.requiresTailwind && !tailwind

  // Check if there's a feature with overlapping exclusive type selected
  const exclusiveConflict =
    feature.exclusive.length > 0
      ? (availableFeatures.find(
          (f) =>
            f.id !== id &&
            features.includes(f.id) &&
            f.exclusive.some((e) => feature.exclusive.includes(e)),
        )?.id as FeatureId | null)
      : null

  // Check if required by another selected feature (truly disables toggling off)
  const requiredBy = availableFeatures.find(
    (f) => features.includes(f.id) && f.requires.includes(id),
  )?.id

  // Determine disabled reason
  const disabledReason = needsTailwind
    ? 'Requires Tailwind CSS'
    : requiredBy
      ? `Required by ${availableFeatures.find((f) => f.id === requiredBy)?.name ?? requiredBy}`
      : null

  return {
    selected,
    enabled: !needsTailwind,
    disabledReason,
    exclusiveConflict,
    requiredBy: requiredBy || null,
  }
}
