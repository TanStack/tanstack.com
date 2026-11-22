/**
 * ApplicationStarter Store (v2)
 *
 * Local state management for the new applicationStarter using TanStack Store.
 * No external CTA dependencies.
 */

import { createStore, useSelector } from '@tanstack/react-store'
import type {
  FeatureId,
  FeatureInfo,
  ProjectDefinition,
  IntegrationCompiled,
  CustomTemplateCompiled,
} from '~/application-starter/api'
import type { FrameworkId } from '~/application-starter/frameworks'
import {
  getRecipeApplicationStarterFeatures,
  isCliTemplateId,
  type ApplicationStarterRecipe,
} from '~/utils/application-starter'
import { TEMPLATES } from '~/application-starter/templates'

type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'

type ApplicationStarterState = {
  // Project configuration
  projectName: string
  framework: FrameworkId
  tailwind: boolean
  features: Array<FeatureId>
  featureOptions: Record<string, Record<string, unknown>>

  // Selected example (single-select, locks its dependencies)
  selectedExample: FeatureId | null

  // Selected template preset
  selectedTemplate: string | null

  // CLI options
  packageManager: PackageManager
  skipInstall: boolean
  skipGit: boolean

  // Custom integrations/templates (loaded from URLs)
  customIntegrations: Array<IntegrationCompiled>
  customTemplate: CustomTemplateCompiled | null

  // Registry data (loaded from API)
  availableFeatures: Array<FeatureInfo>
  availableExamples: Array<FeatureInfo>
  featuresLoaded: boolean

  // UI state
  integrationSearch: string
}

const initialState: ApplicationStarterState = {
  projectName: 'my-tanstack-app',
  framework: 'react',
  tailwind: true,
  features: [],
  featureOptions: {},
  selectedExample: null,
  selectedTemplate: 'blank',
  packageManager: 'pnpm',
  skipInstall: false,
  skipGit: false,
  customIntegrations: [],
  customTemplate: null,
  availableFeatures: [],
  availableExamples: [],
  integrationSearch: '',
  featuresLoaded: false,
}

export const applicationStarterStore = createStore(
  initialState,
  ({ setState, get }) => {
    const set = (partial: Partial<ApplicationStarterState>) =>
      setState((prev) => ({ ...prev, ...partial }))

    const actions = {
      setProjectName: (name: string) => set({ projectName: name }),

      setFramework: (framework: FrameworkId): void => {
        set({
          framework,
          features: [],
          featureOptions: {},
          selectedExample: null,
          selectedTemplate: 'blank',
          availableFeatures: [],
          availableExamples: [],
          featuresLoaded: false,
        })
        actions.loadFeatures()
      },

      setTailwind: (enabled: boolean) => {
        const { features, availableFeatures } = get()
        if (!enabled) {
          const filtered = features.filter((id) => {
            const feature = availableFeatures.find((f) => f.id === id)
            return !feature?.requiresTailwind
          })
          set({ tailwind: enabled, features: filtered })
        } else {
          set({ tailwind: enabled })
        }
      },

      toggleFeature: (id: FeatureId) => {
        const {
          features,
          availableFeatures,
          selectedExample,
          availableExamples,
        } = get()

        // Check if this feature is locked by selected example
        if (selectedExample) {
          const example = availableExamples.find(
            (e) => e.id === selectedExample,
          )
          if (example?.requires.includes(id)) {
            return // Can't toggle features locked by example
          }
        }

        const isSelected = features.includes(id)

        if (isSelected) {
          const toRemove = new Set([id])
          for (const f of availableFeatures) {
            if (f.requires.includes(id) && features.includes(f.id)) {
              toRemove.add(f.id)
            }
          }
          set({ features: features.filter((f) => !toRemove.has(f)) })
        } else {
          const feature = availableFeatures.find((f) => f.id === id)
          if (!feature) return

          const exclusiveConflicts = new Set<FeatureId>()
          if (feature.exclusive.length > 0) {
            for (const existingId of features) {
              const existing = availableFeatures.find(
                (f) => f.id === existingId,
              )
              if (
                existing?.exclusive.some((e) => feature.exclusive.includes(e))
              ) {
                exclusiveConflicts.add(existingId)
              }
            }
          }

          if (exclusiveConflicts.size > 0) {
            const withoutConflicts = features.filter(
              (f) => !exclusiveConflicts.has(f),
            )
            set({
              features: [...withoutConflicts, ...feature.requires, id],
            })
          } else {
            const newFeatures = new Set([...features, ...feature.requires, id])
            set({ features: Array.from(newFeatures) })
          }
        }
      },

      setFeatureOption: (
        featureId: FeatureId,
        optionKey: string,
        value: unknown,
      ) => {
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

      setFeatures: (features: Array<FeatureId>) => set({ features }),

      selectExample: (id: FeatureId | null) => {
        const { availableExamples, features } = get()

        if (id === null) {
          // Deselecting example - remove its locked dependencies from features
          const currentExample = get().selectedExample
          if (currentExample) {
            const example = availableExamples.find(
              (e) => e.id === currentExample,
            )
            if (example) {
              const lockedFeatures = new Set(example.requires)
              set({
                selectedExample: null,
                features: features.filter((f) => !lockedFeatures.has(f)),
              })
              return
            }
          }
          set({ selectedExample: null })
          return
        }

        const example = availableExamples.find((e) => e.id === id)
        if (!example) return

        // Add example's required features (locked)
        const newFeatures = new Set([...features, ...example.requires])

        set({
          selectedExample: id,
          features: Array.from(newFeatures),
        })
      },

      setPackageManager: (pm: PackageManager) => set({ packageManager: pm }),
      setSkipInstall: (skip: boolean) => set({ skipInstall: skip }),
      setSkipGit: (skip: boolean) => set({ skipGit: skip }),

      addCustomIntegration: (integration: IntegrationCompiled) => {
        const { customIntegrations, features, availableFeatures } = get()
        if (customIntegrations.some((i) => i.id === integration.id)) return

        const featureInfo: FeatureInfo = {
          id: integration.id,
          name: integration.name,
          description: integration.description,
          category: 'other',
          requires: integration.dependsOn ?? [],
          exclusive: [],
          hasOptions: !!integration.options,
          link: integration.link,
          color: '#8B5CF6',
          requiresTailwind: integration.tailwind === false ? true : undefined,
        }

        set({
          customIntegrations: [...customIntegrations, integration],
          availableFeatures: [...availableFeatures, featureInfo],
          features: [...features, integration.id],
        })
      },

      removeCustomIntegration: (id: string) => {
        const { customIntegrations, features, availableFeatures } = get()
        set({
          customIntegrations: customIntegrations.filter((i) => i.id !== id),
          availableFeatures: availableFeatures.filter((f) => f.id !== id),
          features: features.filter((f) => f !== id),
        })
      },

      setCustomTemplate: (template: CustomTemplateCompiled | null) => {
        set({ customTemplate: template })
      },

      setIntegrationSearch: (search: string) => {
        set({ integrationSearch: search })
      },

      setTemplate: (id: string | null) => {
        const template = TEMPLATES.find((t) => t.id === id)
        if (!template) return

        const { availableFeatures, availableExamples } = get()

        // Filter to only features that exist in current framework
        const validFeatures = template.features.filter((f) =>
          availableFeatures.some((af) => af.id === f),
        )

        const example = template.exampleId
          ? availableExamples.find((e) => e.id === template.exampleId)
          : undefined
        const exampleLockedFeatures = example?.requires ?? []
        const featuresWithExampleDeps = Array.from(
          new Set([...validFeatures, ...exampleLockedFeatures]),
        ).filter((f) => availableFeatures.some((af) => af.id === f))

        set({
          selectedTemplate: id,
          features: featuresWithExampleDeps,
          featureOptions: {},
          selectedExample: example?.id ?? null,
        })
      },

      applyStarterRecipe: async (
        recipe: ApplicationStarterRecipe,
      ): Promise<void> => {
        if (get().framework !== recipe.framework) {
          set({
            framework: recipe.framework,
            features: [],
            featureOptions: {},
            selectedExample: null,
            selectedTemplate: 'blank',
            availableFeatures: [],
            availableExamples: [],
            featuresLoaded: false,
          })
          await actions.loadFeatures()
        } else if (!get().featuresLoaded) {
          await actions.loadFeatures()
        }

        const { availableFeatures, availableExamples, projectName } = get()
        const validFeatures = getRecipeApplicationStarterFeatures(
          recipe,
        ).filter((featureId) =>
          availableFeatures.some((feature) => feature.id === featureId),
        )

        const recipeTemplateIsExample = isCliTemplateId(recipe.template)
        const exampleLockedFeatures = recipeTemplateIsExample
          ? (availableExamples.find((e) => e.id === recipe.template)
              ?.requires ?? [])
          : []

        // featureOptions are valid for any add-on the project will end up with —
        // either explicitly chosen features or those locked by the selected example.
        const optionEligibleFeatures = new Set([
          ...validFeatures,
          ...exampleLockedFeatures,
        ])
        const nextFeatureOptions = Object.fromEntries(
          Object.entries(recipe.featureOptions).filter(([featureId]) =>
            optionEligibleFeatures.has(featureId),
          ),
        )

        set({
          projectName: recipe.projectName ?? projectName,
          tailwind: recipe.tailwind,
          features: validFeatures,
          featureOptions: nextFeatureOptions,
          selectedExample: recipeTemplateIsExample ? recipe.template! : null,
          selectedTemplate: recipeTemplateIsExample
            ? null
            : (recipe.template ?? null),
          packageManager: recipe.packageManager,
          skipInstall: false,
          skipGit: false,
        })
      },

      loadFeatures: async (): Promise<void> => {
        try {
          if (import.meta.env.SSR) {
            throw new Error(
              'Application Starter features are only loaded in the browser',
            )
          }

          const { framework } = get()
          const { getFeaturesHandler } =
            await import('~/application-starter/api/features')
          const data = await getFeaturesHandler(framework)
          set({
            availableFeatures: data.features,
            availableExamples: data.examples || [],
            featuresLoaded: true,
          })
          // Apply blank template after features load to set default features
          actions.setTemplate('blank')
        } catch (error) {
          console.error('Failed to load features:', error)
          set({ featuresLoaded: true })
        }
      },

      reset: () => set(initialState),

      hasFeature: (id: FeatureId) => get().features.includes(id),

      getFeatureInfo: (id: FeatureId) =>
        get().availableFeatures.find((f) => f.id === id),

      getExampleInfo: (id: FeatureId) =>
        get().availableExamples.find((e) => e.id === id),

      getDefinition: (): ProjectDefinition => ({
        name: get().projectName,
        framework: get().framework,
        features: get().features,
        featureOptions: get().featureOptions,
        selectedExample: get().selectedExample ?? undefined,
      }),

      isFeatureLockedByExample: (id: FeatureId) => {
        const { selectedExample, availableExamples } = get()
        if (!selectedExample) return false
        const example = availableExamples.find((e) => e.id === selectedExample)
        return example?.requires.includes(id) ?? false
      },
    }

    return actions
  },
)

// Selector hooks for common patterns
export const useProjectName = () =>
  useSelector(applicationStarterStore, (s) => s.projectName)
export const useFramework = () =>
  useSelector(applicationStarterStore, (s) => s.framework)
export const useTailwind = () =>
  useSelector(applicationStarterStore, (s) => s.tailwind)
export const useFeatures = () =>
  useSelector(applicationStarterStore, (s) => s.features)
export const useFeatureOptions = () =>
  useSelector(applicationStarterStore, (s) => s.featureOptions)
export const useSelectedExample = () =>
  useSelector(applicationStarterStore, (s) => s.selectedExample)
export const usePackageManager = () =>
  useSelector(applicationStarterStore, (s) => s.packageManager)
export const useSkipInstall = () =>
  useSelector(applicationStarterStore, (s) => s.skipInstall)
export const useSkipGit = () =>
  useSelector(applicationStarterStore, (s) => s.skipGit)
export const useAvailableFeatures = () =>
  useSelector(applicationStarterStore, (s) => s.availableFeatures)
export const useAvailableExamples = () =>
  useSelector(applicationStarterStore, (s) => s.availableExamples)
export const useFeaturesLoaded = () =>
  useSelector(applicationStarterStore, (s) => s.featuresLoaded)
export const useCustomIntegrations = () =>
  useSelector(applicationStarterStore, (s) => s.customIntegrations)
export const useCustomTemplate = () =>
  useSelector(applicationStarterStore, (s) => s.customTemplate)
export const useIntegrationSearch = () =>
  useSelector(applicationStarterStore, (s) => s.integrationSearch)
export const useSelectExample = () =>
  applicationStarterStore.actions.selectExample
export const useSelectedTemplate = () =>
  useSelector(applicationStarterStore, (s) => s.selectedTemplate)

// Feature state with exclusive/requirement analysis
export function useFeatureState(id: FeatureId) {
  const features = useSelector(applicationStarterStore, (s) => s.features)
  const tailwind = useSelector(applicationStarterStore, (s) => s.tailwind)
  const availableFeatures = useSelector(
    applicationStarterStore,
    (s) => s.availableFeatures,
  )

  const feature = availableFeatures.find((f) => f.id === id)
  if (!feature) {
    return {
      selected: false,
      enabled: false,
      disabledReason: null as string | null,
      exclusiveConflict: null as FeatureId | null,
      requiredBy: null as FeatureId | null,
      lockedByExample: false,
    }
  }

  const selected = features.includes(id)
  const lockedByExample =
    applicationStarterStore.actions.isFeatureLockedByExample(id)

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
    : lockedByExample
      ? 'Required by selected example'
      : requiredBy
        ? `Required by ${availableFeatures.find((f) => f.id === requiredBy)?.name ?? requiredBy}`
        : null

  return {
    selected,
    enabled: !needsTailwind,
    disabledReason,
    exclusiveConflict,
    requiredBy: requiredBy || null,
    lockedByExample,
  }
}
