import { useCallback, useMemo, useState } from 'react'
import { QuestionIcon, XIcon } from '@phosphor-icons/react'
import { useApplicationStarterStore } from './store'
import { useApplicationStarterUrl } from './useApplicationStarterUrl'
import {
  ApplicationStarterSummaryPanel,
  useApplicationStarterSummaryData,
} from './ApplicationStarterSummary'
import { ApplicationStarter } from '~/components/ApplicationStarter'
import { useToast } from '~/components/ToastProvider'
import type { ApplicationStarterResult } from '~/utils/application-starter'
import { downloadApplicationStarterResult } from './client-generation'

export function ApplicationStarterWorkspace() {
  useApplicationStarterUrl()

  const [showIntro, setShowIntro] = useState(false)
  const [
    lastGeneratedApplicationStarterSignature,
    setLastGeneratedApplicationStarterSignature,
  ] = useState<string | null>(null)
  const [isPromptDirtySinceGenerate, setIsPromptDirtySinceGenerate] =
    useState(false)
  const [latestStarterResult, setLatestStarterResult] =
    useState<ApplicationStarterResult | null>(null)
  const features = useApplicationStarterStore((state) => state.features)
  const featureOptions = useApplicationStarterStore(
    (state) => state.featureOptions,
  )
  const framework = useApplicationStarterStore((state) => state.framework)
  const packageManager = useApplicationStarterStore(
    (state) => state.packageManager,
  )
  const projectName = useApplicationStarterStore((state) => state.projectName)
  const selectedTemplate = useApplicationStarterStore(
    (state) => state.selectedTemplate,
  )
  const tailwind = useApplicationStarterStore((state) => state.tailwind)
  const applyStarterRecipe = useApplicationStarterStore(
    (state) => state.applyStarterRecipe,
  )
  const summary = useApplicationStarterSummaryData()
  const { notify } = useToast()
  const displayedSummary = useMemo(
    () =>
      latestStarterResult
        ? {
            ...summary,
            cliCommand: latestStarterResult.cliCommand,
            prompt: latestStarterResult.prompt,
          }
        : summary,
    [latestStarterResult, summary],
  )

  const currentApplicationStarterSignature = useMemo(
    () =>
      createApplicationStarterSignature({
        featureOptions,
        features,
        framework,
        packageManager,
        projectName,
        selectedTemplate,
        tailwind,
      }),
    [
      featureOptions,
      features,
      framework,
      packageManager,
      projectName,
      selectedTemplate,
      tailwind,
    ],
  )

  const summaryOverlay =
    isPromptDirtySinceGenerate ||
    (lastGeneratedApplicationStarterSignature !== null &&
      currentApplicationStarterSignature !==
        lastGeneratedApplicationStarterSignature)
      ? {
          title: 'Summary out of date',
          description:
            'The prompt or application starter options changed. Copy the prompt again to refresh this summary.',
        }
      : null

  const applyStarterResult = useCallback(
    async (
      result: ApplicationStarterResult,
      options?: { silent?: boolean },
    ) => {
      if (result.recipe.target === 'router') {
        if (!options?.silent) {
          notify(
            <div>
              <div className="font-medium">Router-only stays prompt-first</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                `/application-starter` remains a TanStack Start advanced
                surface.
              </div>
            </div>,
          )
        }

        return false
      }

      await applyStarterRecipe(result.recipe)
      setLastGeneratedApplicationStarterSignature(
        createApplicationStarterSignatureFromStore(
          useApplicationStarterStore.getState(),
        ),
      )
      setIsPromptDirtySinceGenerate(false)
      return true
    },
    [applyStarterRecipe, notify],
  )
  const starterApplicationStarterIntegration = useMemo(
    () => ({
      applyResult: applyStarterResult,
      downloadResult: downloadApplicationStarterResult,
    }),
    [applyStarterResult],
  )

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto grid w-full max-w-[1760px] gap-6 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.82fr)] 2xl:grid-cols-[minmax(0,1.5fr)_minmax(24rem,0.75fr)]">
        <div className="min-w-0">
          {showIntro ? (
            <div className="mb-4 rounded-[28px] border border-cyan-200/60 bg-linear-to-br from-cyan-50 via-white to-white px-5 py-5 shadow-sm dark:border-cyan-900/60 dark:from-cyan-950/30 dark:via-gray-950 dark:to-gray-950 lg:px-7 lg:py-6">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-600/80 dark:text-cyan-300/80">
                TanStack Application Starter
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-gray-950 dark:text-white lg:text-3xl">
                Describe the app. Keep the tuning light.
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300 lg:text-base">
                <span className="mt-3 block">
                  Start with the agentic application starter flow. If you need a
                  CLI-first, ZIP, or deployable approximation instead, open CLI
                  mode and use the scaffoldable subset of the stack.
                </span>
              </p>
            </div>
          ) : null}

          <ApplicationStarter
            applicationStarterIntegration={starterApplicationStarterIntegration}
            className="rounded-[28px]"
            context="application-starter"
            enableHotkeys
            headerAction={
              <button
                type="button"
                onClick={() => setShowIntro((current) => !current)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:border-cyan-300 hover:text-cyan-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 dark:hover:border-cyan-800 dark:hover:text-cyan-300"
                aria-expanded={showIntro}
                aria-label={
                  showIntro
                    ? 'Hide application starter help'
                    : 'Show application starter help'
                }
                title={
                  showIntro
                    ? 'Hide application starter help'
                    : 'Show application starter help'
                }
              >
                {showIntro ? (
                  <XIcon className="h-4 w-4" />
                ) : (
                  <QuestionIcon className="h-4 w-4" />
                )}
              </button>
            }
            onDirtyStateChange={(dirty) => {
              if (lastGeneratedApplicationStarterSignature !== null) {
                setIsPromptDirtySinceGenerate(dirty)
              }
            }}
            onResolvedResult={setLatestStarterResult}
            revealOptionsImmediately
            showPromptPreview={false}
            tone="cyan"
          />
        </div>

        <div className="min-w-0 xl:sticky xl:top-0 xl:self-start">
          <ApplicationStarterSummaryPanel
            overlay={summaryOverlay}
            summary={displayedSummary}
            compact
          />
        </div>
      </div>
    </div>
  )
}

function createApplicationStarterSignature({
  featureOptions,
  features,
  framework,
  packageManager,
  projectName,
  selectedTemplate,
  tailwind,
}: {
  featureOptions: Record<string, Record<string, unknown>>
  features: Array<string>
  framework: string
  packageManager: string
  projectName: string
  selectedTemplate: string | null
  tailwind: boolean
}) {
  const normalizedFeatureOptions = Object.fromEntries(
    Object.entries(featureOptions)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([featureId, options]) => [
        featureId,
        Object.fromEntries(
          Object.entries(options).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        ),
      ]),
  )

  return JSON.stringify({
    featureOptions: normalizedFeatureOptions,
    features: [...features].sort(),
    framework,
    packageManager,
    projectName,
    selectedTemplate,
    tailwind,
  })
}

function createApplicationStarterSignatureFromStore(
  state: ReturnType<typeof useApplicationStarterStore.getState>,
) {
  return createApplicationStarterSignature({
    featureOptions: state.featureOptions,
    features: state.features,
    framework: state.framework,
    packageManager: state.packageManager,
    projectName: state.projectName,
    selectedTemplate: state.selectedTemplate,
    tailwind: state.tailwind,
  })
}
