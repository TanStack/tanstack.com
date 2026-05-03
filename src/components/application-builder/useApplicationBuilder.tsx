import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { useCurrentUser } from '~/hooks/useCurrentUser'
import { useLoginModal } from '~/contexts/LoginModalContext'
import { useToast } from '~/components/ToastProvider'
import {
  trackEvent,
  defaultBuilderSessionContext,
  type BuilderAction,
  type BuilderMode,
  type BuilderSessionContext,
} from '~/utils/analytics'
import {
  extractMigrationRepositoryUrl,
  type ApplicationStarterAnalysis,
  getApplicationStarterSuggestions,
  type ApplicationStarterContext,
  type ApplicationStarterRequest,
  type ApplicationStarterResult,
} from '~/utils/application-starter'
import {
  getApplicationStarterInferredPartnerIds,
  getApplicationStarterPartnerSuggestions,
  getApplicationStarterSelectedPartnerIds,
  type ApplicationStarterPartnerSuggestion,
} from '~/utils/partners'
import type { LibraryId } from '~/libraries'
import {
  analyzeApplicationStarter,
  type ApplicationStarterAnonymousQuota,
  ApplicationStarterError,
  composeStarterInput,
  isApplicationStarterStatusResponse,
  isNextJsMigrationInput,
  isPinnedStarterLibrary,
  isValidMigrationRepositoryUrl,
  normalizeMigrationRepositoryUrl,
  resolveApplicationStarter,
  type StarterPackageManager,
  starterAddonLibraryIds,
  starterLoadingPhrases,
  starterPinnedLibraryIds,
  type StarterToolchain,
  type ApplicationStarterBuilderIntegration,
  type StarterDeployProvider,
} from './shared'

interface UseApplicationBuilderOptions {
  builderIntegration?: ApplicationStarterBuilderIntegration
  context: ApplicationStarterContext
  forceRouterOnly?: boolean
  mode: 'compact' | 'full'
  onDirtyStateChange?: (dirty: boolean) => void
  onResolvedResult?: (result: ApplicationStarterResult | null) => void
  suggestionContext?: ApplicationStarterContext
}

type CopyTrigger = 'automatic' | 'user'

const starterFeatureLibraryMap: Record<string, LibraryId | undefined> = {
  ai: 'ai',
  form: 'form',
  hotkeys: 'hotkeys',
  pacer: 'pacer',
  store: 'store',
  table: 'table',
  'tanstack-query': 'query',
  virtual: 'virtual',
}

function getGeneratedLibraryIds({
  featureIds,
  promptText,
}: {
  featureIds: Array<string>
  promptText: string
}) {
  const libraryIds = Array<LibraryId>()

  for (const featureId of featureIds) {
    const libraryId = starterFeatureLibraryMap[featureId]

    if (!libraryId || libraryIds.includes(libraryId)) {
      continue
    }

    libraryIds.push(libraryId)
  }

  if (promptText.includes('tanstack db') && !libraryIds.includes('db')) {
    libraryIds.push('db')
  }

  return libraryIds
}

export function useApplicationBuilder({
  builderIntegration,
  context,
  forceRouterOnly = false,
  mode,
  onDirtyStateChange,
  onResolvedResult,
  suggestionContext = context,
}: UseApplicationBuilderOptions) {
  const { notify } = useToast()
  const currentUser = useCurrentUser()
  const { openLoginModal } = useLoginModal()
  const suggestions = getApplicationStarterSuggestions(suggestionContext)
  const partnerSuggestions = getApplicationStarterPartnerSuggestions()
  const [input, setInput] = React.useState(() => suggestions[0]?.input ?? '')
  const [analysis, setAnalysis] =
    React.useState<ApplicationStarterAnalysis | null>(null)
  const [isAnalysisStale, setIsAnalysisStale] = React.useState(false)
  const [result, setResult] = React.useState<ApplicationStarterResult | null>(
    null,
  )
  const [copiedKind, setCopiedKind] = React.useState<string | null>(null)
  const [showLuckyActions, setShowLuckyActions] = React.useState(false)
  const [showPromptCopyNotice, setShowPromptCopyNotice] = React.useState(false)
  const [loadingPhrase, setLoadingPhrase] = React.useState(
    starterLoadingPhrases[0]!,
  )
  const [deployDialogProvider, setDeployDialogProvider] =
    React.useState<StarterDeployProvider | null>(null)
  const [isDeployDialogOpen, setIsDeployDialogOpen] = React.useState(false)
  const [isDirtySinceLastResult, setIsDirtySinceLastResult] =
    React.useState(false)
  const [isModHeld, setIsModHeld] = React.useState(false)
  const [isLocked, setIsLocked] = React.useState(false)
  const [lockMessage, setLockMessage] = React.useState<string | null>(null)
  const [anonymousGenerationQuota, setAnonymousGenerationQuota] =
    React.useState<ApplicationStarterAnonymousQuota | null>(null)
  const [migrationRepositoryUrl, setMigrationRepositoryUrl] = React.useState(
    () => extractMigrationRepositoryUrl(suggestions[0]?.input ?? '') ?? '',
  )
  const [explicitLibrarySelections, setExplicitLibrarySelections] =
    React.useState<Partial<Record<LibraryId, boolean>>>({})
  const [explicitPartnerSelections, setExplicitPartnerSelections] =
    React.useState<Record<string, boolean>>({})
  const [selectedPackageManager, setSelectedPackageManager] = React.useState<
    StarterPackageManager | undefined
  >(undefined)
  const [selectedToolchain, setSelectedToolchain] = React.useState<
    StarterToolchain | undefined
  >(undefined)
  const latestRequestIdRef = React.useRef(0)
  const generationCountRef = React.useRef(0)
  const migrationRepositoryInputRef = React.useRef<HTMLInputElement | null>(
    null,
  )
  const analyzedPartnerIds = React.useMemo(
    () => analysis?.inferredPartnerIds ?? [],
    [analysis],
  )
  const analyzedLibraryIds = React.useMemo(
    () => analysis?.inferredLibraryIds ?? [],
    [analysis],
  )
  const effectiveInferredPartners = React.useMemo(
    () =>
      analyzedPartnerIds.filter(
        (partnerId) => explicitPartnerSelections[partnerId] === undefined,
      ),
    [analyzedPartnerIds, explicitPartnerSelections],
  )
  const explicitlySelectedPartners = React.useMemo(
    () =>
      partnerSuggestions.flatMap((partner) =>
        explicitPartnerSelections[partner.id] === true ? [partner.id] : [],
      ),
    [explicitPartnerSelections, partnerSuggestions],
  )
  const selectedPartners = React.useMemo(
    () => [
      ...new Set([...explicitlySelectedPartners, ...effectiveInferredPartners]),
    ],
    [effectiveInferredPartners, explicitlySelectedPartners],
  )
  const effectiveInferredLibraries = React.useMemo(
    () =>
      analyzedLibraryIds.filter(
        (libraryId) => explicitLibrarySelections[libraryId] === undefined,
      ),
    [analyzedLibraryIds, explicitLibrarySelections],
  )
  const explicitlySelectedLibraries = React.useMemo(
    () =>
      starterAddonLibraryIds.flatMap((libraryId) =>
        explicitLibrarySelections[libraryId] === true ? [libraryId] : [],
      ),
    [explicitLibrarySelections],
  )
  const selectedLibraries = React.useMemo(
    () => [
      ...starterPinnedLibraryIds,
      ...new Set([
        ...explicitlySelectedLibraries,
        ...effectiveInferredLibraries,
      ]),
    ],
    [effectiveInferredLibraries, explicitlySelectedLibraries],
  )
  // Session context (mode_used, idea_used) is stamped on every builder
  // event so any breakdown works without joining sessions in BigQuery.
  // Stored in a ref because mutations don't need to trigger re-renders.
  const sessionContextRef = React.useRef<BuilderSessionContext>(
    defaultBuilderSessionContext,
  )

  const setSessionMode = React.useCallback((nextMode: BuilderMode) => {
    sessionContextRef.current = {
      ...sessionContextRef.current,
      mode_used: nextMode,
    }
  }, [])

  const setSessionIdea = React.useCallback((label: string) => {
    sessionContextRef.current = {
      ...sessionContextRef.current,
      idea_used: label,
    }
  }, [])

  const invalidateResult = React.useCallback(() => {
    latestRequestIdRef.current += 1

    if (result) {
      setIsDirtySinceLastResult(true)
    }

    setResult(null)
    setShowPromptCopyNotice(false)
    onResolvedResult?.(null)
  }, [onResolvedResult, result])

  const markAnalysisStale = React.useCallback(() => {
    invalidateResult()

    if (analysis) {
      setIsAnalysisStale(true)
    }
  }, [analysis, invalidateResult])

  React.useEffect(() => {
    onDirtyStateChange?.(isDirtySinceLastResult)
  }, [isDirtySinceLastResult, onDirtyStateChange])

  const normalizedMigrationRepositoryUrl = normalizeMigrationRepositoryUrl(
    migrationRepositoryUrl,
  )
  const showMigrationRepositoryInput =
    isNextJsMigrationInput(input) || normalizedMigrationRepositoryUrl.length > 0
  const hasMigrationRepositoryUrlError =
    normalizedMigrationRepositoryUrl.length > 0 &&
    !isValidMigrationRepositoryUrl(normalizedMigrationRepositoryUrl)

  React.useEffect(() => {
    if (!showMigrationRepositoryInput) {
      return
    }

    const timeout = window.setTimeout(() => {
      migrationRepositoryInputRef.current?.focus()
    }, 0)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [showMigrationRepositoryInput])

  const buildSubmittedInput = React.useCallback(
    (
      nextSelectedPartners: Array<string> = explicitlySelectedPartners,
      nextInferredPartners: Array<string> = effectiveInferredPartners,
      nextSelectedLibraries: Array<LibraryId> = selectedLibraries,
    ) =>
      composeStarterInput({
        forceRouterOnly,
        inferredPartners: nextInferredPartners,
        input,
        migrationRepositoryUrl,
        packageManager: selectedPackageManager,
        selectedLibraries: nextSelectedLibraries,
        selectedPartners: nextSelectedPartners,
        toolchain: selectedToolchain,
      }),
    [
      effectiveInferredPartners,
      explicitlySelectedPartners,
      forceRouterOnly,
      input,
      migrationRepositoryUrl,
      selectedPackageManager,
      selectedLibraries,
      selectedToolchain,
    ],
  )

  const toggleLibrary = React.useCallback(
    (libraryId: LibraryId) => {
      if (isPinnedStarterLibrary(libraryId)) {
        return
      }

      invalidateResult()
      const selected = selectedLibraries.includes(libraryId)

      setExplicitLibrarySelections((current) => ({
        ...current,
        [libraryId]: !selected,
      }))
    },
    [invalidateResult, selectedLibraries],
  )

  const togglePartner = React.useCallback(
    (partner: ApplicationStarterPartnerSuggestion, selected: boolean) => {
      invalidateResult()
      setExplicitPartnerSelections((current) => ({
        ...current,
        [partner.id]: !selected,
      }))
    },
    [invalidateResult],
  )

  const togglePackageManager = React.useCallback(
    (packageManager: StarterPackageManager) => {
      invalidateResult()

      setSelectedPackageManager((current) =>
        current === packageManager ? undefined : packageManager,
      )
    },
    [invalidateResult],
  )

  const toggleToolchain = React.useCallback(
    (toolchain: StarterToolchain) => {
      invalidateResult()

      setSelectedToolchain((current) =>
        current === toolchain ? undefined : toolchain,
      )
    },
    [invalidateResult],
  )

  React.useEffect(() => {
    if (currentUser) {
      setIsLocked(false)
      setLockMessage(null)
    }
  }, [currentUser])

  const refreshAnonymousQuota = React.useCallback(async () => {
    if (currentUser) {
      setAnonymousGenerationQuota(null)
      return
    }

    try {
      const response = await fetch('/api/application-starter/resolve', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        return
      }

      const payload = await response.json()

      if (!isApplicationStarterStatusResponse(payload)) {
        return
      }

      setAnonymousGenerationQuota(payload.anonymousGenerationQuota)
    } catch {
      // Ignore silent status refresh failures and fall back to existing UI.
    }
  }, [currentUser])

  React.useEffect(() => {
    void refreshAnonymousQuota()
  }, [refreshAnonymousQuota])

  const dismissPromptCopyNotice = React.useCallback(() => {
    setShowPromptCopyNotice(false)
  }, [])

  const revealPromptCopyNotice = React.useCallback(() => {
    setShowPromptCopyNotice(true)
  }, [])

  const markCopied = React.useCallback(
    (
      kind: string,
      options?: { showPromptNotice?: boolean; trigger?: CopyTrigger },
    ) => {
      setCopiedKind(kind)
      setTimeout(
        () => setCopiedKind((current) => (current === kind ? null : current)),
        1800,
      )

      if (kind === 'prompt' && options?.showPromptNotice) {
        revealPromptCopyNotice()
      }

      // Only treat user-driven copies as activation. Automatic copies that
      // fire as a side-effect of generation are not activation signals.
      const trigger = options?.trigger ?? 'user'
      if (trigger === 'user' && kind === 'prompt') {
        trackEvent('builder_activated', {
          ...sessionContextRef.current,
          action: 'copy_prompt',
          surface: 'result_panel',
          automatic: false,
        })
      }
    },
    [revealPromptCopyNotice],
  )

  const handleCopy = React.useCallback(
    async (
      value: string,
      kind: string,
      options?: {
        notify?: boolean
        showPromptNotice?: boolean
        trigger?: CopyTrigger
      },
    ) => {
      await navigator.clipboard.writeText(value)
      markCopied(kind, {
        showPromptNotice: options?.showPromptNotice,
        trigger: options?.trigger,
      })

      if (options?.notify === false) {
        return
      }

      notify(
        <div>
          <div className="font-medium">Copied {kind}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Paste it into your AI tool or terminal.
          </div>
        </div>,
      )
    },
    [markCopied, notify],
  )

  const finishWithResult = React.useCallback(
    async (nextResult: ApplicationStarterResult) => {
      setIsDirtySinceLastResult(false)
      setResult(nextResult)
      onResolvedResult?.(nextResult)

      if (mode !== 'compact') {
        void handleCopy(nextResult.prompt, 'prompt', {
          notify: false,
          trigger: 'automatic',
        })
      }

      if (!builderIntegration) {
        return
      }

      const applied = await builderIntegration.applyResult(nextResult)

      if (applied) {
        notify(
          <div>
            <div className="font-medium">Builder configured</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              The prompt was applied to the builder immediately.
            </div>
          </div>,
        )
      }
    },
    [builderIntegration, handleCopy, mode, notify, onResolvedResult],
  )

  const handleResolveMutate = React.useCallback(() => {
    const phraseIndex = Math.floor(Math.random() * starterLoadingPhrases.length)
    setLoadingPhrase(starterLoadingPhrases[phraseIndex]!)
  }, [])

  const handleAnalysisError = React.useCallback(
    (error: unknown, variables: { requestId: number }) => {
      if (variables.requestId !== latestRequestIdRef.current) {
        return
      }

      trackEvent('builder_failed', {
        ...sessionContextRef.current,
        stage: 'analysis',
        error_message: error instanceof Error ? error.message : 'unknown_error',
      })

      notify(
        <div>
          <div className="font-medium">Could not analyze the prompt</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {error instanceof Error ? error.message : 'Please try again.'}
          </div>
        </div>,
      )
    },
    [notify],
  )

  const handleAnalysisSuccess = React.useCallback(
    (
      nextAnalysis: ApplicationStarterAnalysis,
      variables: { requestId: number },
    ) => {
      if (variables.requestId !== latestRequestIdRef.current) {
        return
      }

      setAnalysis(nextAnalysis)
      setIsAnalysisStale(false)
      setIsLocked(false)
      setLockMessage(null)

      trackEvent('builder_analyzed', {
        ...sessionContextRef.current,
        analysis_deployment: nextAnalysis.recipe.deployment,
        inferred_library_count: nextAnalysis.inferredLibraryIds.length,
        inferred_partner_count: nextAnalysis.inferredPartnerIds.length,
        feature_count: nextAnalysis.recipe.features?.length ?? 0,
      })
    },
    [],
  )

  const handleResolveError = React.useCallback(
    (error: unknown, variables: { requestId: number }) => {
      if (variables.requestId !== latestRequestIdRef.current) {
        return
      }

      void refreshAnonymousQuota()

      notify(
        <div>
          <div className="font-medium">Could not generate a prompt</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {error instanceof Error ? error.message : 'Please try again.'}
          </div>
        </div>,
      )

      const isLoginRequired =
        error instanceof ApplicationStarterError && !!error.loginRequired

      // login_blocked is a more specific failure than generation — emit
      // only one event per failure to avoid double-counting in dashboards.
      if (isLoginRequired && !currentUser) {
        setIsLocked(true)
        setLockMessage(
          error.retryAfter
            ? `Anonymous generations are limited. Sign in to unlock more, or wait about ${Math.max(1, Math.ceil(error.retryAfter / 60))} minute${Math.ceil(error.retryAfter / 60) === 1 ? '' : 's'}.`
            : 'Anonymous generations are limited. Sign in to unlock more.',
        )

        trackEvent('builder_failed', {
          ...sessionContextRef.current,
          stage: 'login_blocked',
          retry_after: error.retryAfter,
        })
      } else {
        trackEvent('builder_failed', {
          ...sessionContextRef.current,
          stage: 'generation',
          error_message:
            error instanceof Error ? error.message : 'unknown_error',
        })
      }
    },
    [currentUser, notify, refreshAnonymousQuota],
  )

  const handleResolveSuccess = React.useCallback(
    async (
      nextResult: ApplicationStarterResult,
      variables: { request: ApplicationStarterRequest; requestId: number },
    ) => {
      if (variables.requestId !== latestRequestIdRef.current) {
        return
      }

      setIsLocked(false)
      setLockMessage(null)
      void refreshAnonymousQuota()
      generationCountRef.current += 1

      const selectedPartnerIds = getApplicationStarterSelectedPartnerIds(
        variables.request.input,
      )
      const inferredPartnerIds = getApplicationStarterInferredPartnerIds(
        variables.request.input,
      )
      const finalPartnerIds = [
        ...new Set([...selectedPartnerIds, ...inferredPartnerIds]),
      ]
      const finalFeatureIds = [
        ...new Set(
          [
            ...nextResult.recipe.features,
            nextResult.recipe.deployment,
            nextResult.recipe.toolchain,
          ].filter((feature): feature is string => !!feature),
        ),
      ]
      const promptText =
        `${nextResult.prompt}\n${nextResult.cliCommand}`.toLowerCase()
      const finalPromptPartnerIds = partnerSuggestions
        .filter((partner) => {
          const needles = [partner.id, partner.label].map((value) =>
            value.toLowerCase(),
          )

          return needles.some((needle) => promptText.includes(needle))
        })
        .map((partner) => partner.id)
      const finalPromptFeatureIds = finalFeatureIds.filter((featureId) =>
        promptText.includes(featureId.toLowerCase()),
      )

      if (!analysis || isAnalysisStale) {
        const generatedLibraryIds = getGeneratedLibraryIds({
          featureIds: finalPromptFeatureIds,
          promptText,
        })
        const generatedPartnerIds = Array.from(
          new Set(
            [...finalPromptPartnerIds, nextResult.recipe.deployment].filter(
              (partnerId): partnerId is string => !!partnerId,
            ),
          ),
        )

        if (generatedLibraryIds.length > 0) {
          setExplicitLibrarySelections((current) => {
            const next = { ...current }

            for (const libraryId of generatedLibraryIds) {
              next[libraryId] = true
            }

            return next
          })
        }

        if (generatedPartnerIds.length > 0) {
          setExplicitPartnerSelections((current) => {
            const next = { ...current }

            for (const partnerId of generatedPartnerIds) {
              next[partnerId] = true
            }

            return next
          })
        }

        setSelectedPackageManager(nextResult.recipe.packageManager)

        if (nextResult.recipe.toolchain) {
          setSelectedToolchain(nextResult.recipe.toolchain)
        }
      }

      trackEvent('builder_generated', {
        ...sessionContextRef.current,
        final_deployment: nextResult.recipe.deployment,
        final_package_manager: nextResult.recipe.packageManager,
        final_library_count: selectedLibraries.length,
        final_partner_count: finalPartnerIds.length,
        final_addon_count: finalPromptFeatureIds.length,
        // Joined arrays — use SPLIT() in BigQuery for top-N analysis.
        library_ids: selectedLibraries.join(','),
        partner_ids: finalPartnerIds.join(','),
        addon_ids: finalPromptFeatureIds.join(','),
      })

      await finishWithResult(nextResult)
    },
    [
      analysis,
      finishWithResult,
      isAnalysisStale,
      partnerSuggestions,
      refreshAnonymousQuota,
      selectedLibraries,
    ],
  )

  const promptResolveMutation = useMutation({
    mutationFn: async ({
      request,
    }: {
      request: ApplicationStarterRequest
      requestId: number
    }) => resolveApplicationStarter(request),
    onMutate: handleResolveMutate,
    onError: handleResolveError,
    onSuccess: handleResolveSuccess,
  })

  const analysisMutation = useMutation({
    mutationFn: async ({
      request,
    }: {
      request: ApplicationStarterRequest
      requestId: number
    }) => analyzeApplicationStarter(request),
    onMutate: handleResolveMutate,
    onError: handleAnalysisError,
    onSuccess: handleAnalysisSuccess,
  })

  const netlifyResolveMutation = useMutation({
    mutationFn: async ({
      request,
    }: {
      request: ApplicationStarterRequest
      requestId: number
    }) => resolveApplicationStarter(request),
    onMutate: handleResolveMutate,
    onError: handleResolveError,
    onSuccess: handleResolveSuccess,
  })

  const submit = React.useCallback(
    async (submittedInput: string) => {
      const trimmed = submittedInput.trim()
      if (!trimmed) {
        return null
      }

      const requestId = latestRequestIdRef.current + 1
      latestRequestIdRef.current = requestId

      try {
        const nextResult = await promptResolveMutation.mutateAsync({
          request: {
            context,
            input: trimmed,
          },
          requestId,
        })

        if (requestId !== latestRequestIdRef.current) {
          return null
        }

        return nextResult
      } catch {
        return null
      }
    },
    [context, promptResolveMutation],
  )

  const submitAnalysis = React.useCallback(async () => {
    const trimmedInput = input.trim()

    if (!trimmedInput) {
      return null
    }

    const requestId = latestRequestIdRef.current + 1
    latestRequestIdRef.current = requestId

    try {
      const nextAnalysis = await analysisMutation.mutateAsync({
        request: {
          context,
          input: trimmedInput,
        },
        requestId,
      })

      if (requestId !== latestRequestIdRef.current) {
        return null
      }

      return nextAnalysis
    } catch {
      return null
    }
  }, [analysisMutation, context, input])

  const handleNetlifySubmit = React.useCallback(
    async (submittedInput: string) => {
      const trimmed = submittedInput.trim()
      if (!trimmed) {
        return null
      }

      const requestId = latestRequestIdRef.current + 1
      latestRequestIdRef.current = requestId

      try {
        const nextResult = await netlifyResolveMutation.mutateAsync({
          request: {
            context,
            input: trimmed,
          },
          requestId,
        })

        if (requestId !== latestRequestIdRef.current) {
          return null
        }

        return nextResult
      } catch {
        return null
      }
    },
    [context, netlifyResolveMutation],
  )

  const selectSuggestion = React.useCallback(
    async ({
      suggestion,
    }: {
      suggestion: { input: string; label: string }
    }) => {
      markAnalysisStale()
      setInput(suggestion.input)

      if (!isNextJsMigrationInput(suggestion.input)) {
        setMigrationRepositoryUrl('')
      }

      // Stamp the idea on subsequent builder events so any downstream
      // outcome (analyzed/generated/activated) carries this attribution.
      setSessionIdea(suggestion.label)
    },
    [markAnalysisStale, setSessionIdea],
  )

  const ensureResolvedResult = React.useCallback(async () => {
    if ((!analysis || isAnalysisStale) && !showLuckyActions) {
      notify(
        <div>
          <div className="font-medium">Refresh recommendations first</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Analyze again to refresh integrations and libraries before
            generating.
          </div>
        </div>,
      )

      return null
    }

    const submittedInput = buildSubmittedInput()

    if (!submittedInput.trim()) {
      return null
    }

    if (result && !isDirtySinceLastResult) {
      return result
    }

    return submit(submittedInput)
  }, [
    analysis,
    buildSubmittedInput,
    isAnalysisStale,
    isDirtySinceLastResult,
    notify,
    result,
    showLuckyActions,
    submit,
  ])

  const copyResultValue = React.useCallback(
    async (kind: 'command' | 'prompt') => {
      const nextResult = await ensureResolvedResult()

      if (!nextResult) {
        return
      }

      await handleCopy(
        kind === 'prompt' ? nextResult.prompt : nextResult.cliCommand,
        kind,
        kind === 'prompt'
          ? {
              notify: false,
            }
          : undefined,
      )
    },
    [ensureResolvedResult, handleCopy],
  )

  // Generic activation tracker used both inside the hook and passed to the
  // DeployDialog so dialog actions carry the same session context as
  // result-panel actions.
  const trackActivation = React.useCallback(
    (params: {
      action: BuilderAction
      surface: 'result_panel' | 'deploy_dialog'
      provider?: string
      automatic?: boolean
    }) => {
      trackEvent('builder_activated', {
        ...sessionContextRef.current,
        action: params.action,
        surface: params.surface,
        provider: params.provider,
        automatic: params.automatic ?? false,
      })
    },
    [],
  )

  const trackAction = React.useCallback(
    (action: BuilderAction, provider?: StarterDeployProvider | null) => {
      trackActivation({
        action,
        surface: 'result_panel',
        provider: provider ?? undefined,
      })
    },
    [trackActivation],
  )

  const withResolvedResult = React.useCallback(
    async (
      run: (nextResult: ApplicationStarterResult) => void | Promise<void>,
    ) => {
      const nextResult = await ensureResolvedResult()

      if (!nextResult) {
        return null
      }

      return run(nextResult)
    },
    [ensureResolvedResult],
  )

  const withResolvedPrompt = React.useCallback(
    async (
      run: (nextResult: ApplicationStarterResult) => void | Promise<void>,
    ) => {
      return withResolvedResult(async (nextResult) => {
        if (!nextResult.prompt) {
          return
        }

        return run(nextResult)
      })
    },
    [withResolvedResult],
  )

  const navigateToResult = React.useCallback(
    async (kind: 'advanced' | 'download') => {
      await withResolvedResult((nextResult) => {
        trackAction(kind === 'advanced' ? 'open_advanced' : 'download')

        const destination =
          kind === 'download'
            ? nextResult.downloadUrl
            : nextResult.advancedBuilderUrl

        if (!destination) {
          return
        }

        window.location.assign(destination)
      })
    },
    [trackAction, withResolvedResult],
  )

  const openDeployDialog = React.useCallback(
    async (provider: StarterDeployProvider | null) => {
      await withResolvedResult((nextResult) => {
        if (nextResult.recipe.target !== 'start') {
          return
        }

        trackAction(provider ? 'deploy' : 'clone_repo', provider)
        setDeployDialogProvider(provider)
        setIsDeployDialogOpen(true)
      })
    },
    [trackAction, withResolvedResult],
  )

  const openNetlifyStart = React.useCallback(async () => {
    const nextSelectedPartners = explicitlySelectedPartners.filter(
      (partnerId) => partnerId !== 'cloudflare',
    )
    const nextInferredPartners = effectiveInferredPartners.filter(
      (partnerId) => partnerId !== 'cloudflare',
    )
    const removedCloudflare =
      nextSelectedPartners.length !== explicitlySelectedPartners.length ||
      nextInferredPartners.length !== effectiveInferredPartners.length

    if (removedCloudflare) {
      setExplicitPartnerSelections((current) => ({
        ...current,
        cloudflare: false,
      }))
      invalidateResult()
    }

    const nextSelectedLibraries = selectedLibraries
    const submittedInput = buildSubmittedInput(
      nextSelectedPartners,
      nextInferredPartners,
      nextSelectedLibraries,
    )

    if (!submittedInput.trim()) {
      return
    }

    const nextResult =
      !removedCloudflare && result
        ? result
        : await handleNetlifySubmit(submittedInput)

    if (!nextResult?.prompt) {
      return
    }

    trackEvent('builder_activated', {
      ...sessionContextRef.current,
      action: 'netlify_start',
      surface: 'result_panel',
      provider: 'netlify',
      automatic: false,
    })

    window.open(
      `https://app.netlify.com/start?prompt=${encodeURIComponent(nextResult.prompt)}&utm_source=tanstack`,
      '_blank',
      'noopener,noreferrer',
    )
  }, [
    buildSubmittedInput,
    effectiveInferredPartners,
    explicitlySelectedPartners,
    handleNetlifySubmit,
    invalidateResult,
    result,
    selectedLibraries,
  ])

  const openCodexStart = React.useCallback(async () => {
    await withResolvedPrompt((nextResult) => {
      trackAction('open_codex')
      window.location.assign(
        `codex://new?prompt=${encodeURIComponent(nextResult.prompt)}`,
      )
    })
  }, [trackAction, withResolvedPrompt])

  const openClaudeStart = React.useCallback(async () => {
    await withResolvedPrompt((nextResult) => {
      trackAction('open_claude')
      window.open(
        `https://claude.ai/code?q=${encodeURIComponent(nextResult.prompt)}`,
        '_blank',
        'noopener,noreferrer',
      )
    })
  }, [trackAction, withResolvedPrompt])

  const openCursorStart = React.useCallback(async () => {
    await withResolvedPrompt((nextResult) => {
      trackAction('open_cursor')
      window.open(
        `cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(nextResult.prompt)}`,
        '_blank',
        'noopener,noreferrer',
      )
    })
  }, [trackAction, withResolvedPrompt])

  const generatePrompt = React.useCallback(async () => {
    if ((!analysis || isAnalysisStale) && !showLuckyActions) {
      await submitAnalysis()
      return
    }

    const nextResult = await submit(buildSubmittedInput())

    if (!nextResult) {
      return
    }

    await handleCopy(nextResult.prompt, 'prompt', {
      notify: false,
      showPromptNotice: true,
    })
  }, [
    analysis,
    buildSubmittedInput,
    handleCopy,
    isAnalysisStale,
    showLuckyActions,
    submit,
    submitAnalysis,
  ])

  const enableLuckyActions = React.useCallback(() => {
    setShowLuckyActions(true)
  }, [])

  const hasInput = buildSubmittedInput().trim().length > 0
  const hasFreshAnalysis = !!analysis && !isAnalysisStale
  const hasGeneratedPrompt = !!result?.prompt
  const isAnalyzing = analysisMutation.isPending
  const isGeneratingPrompt = promptResolveMutation.isPending
  const isGeneratingNetlify = netlifyResolveMutation.isPending
  const isGenerating = isAnalyzing || isGeneratingPrompt || isGeneratingNetlify

  const updateInput = React.useCallback(
    (value: string) => {
      markAnalysisStale()
      setInput(value)
    },
    [markAnalysisStale],
  )

  const updateMigrationRepositoryUrl = React.useCallback(
    (value: string) => {
      invalidateResult()
      setMigrationRepositoryUrl(value)
    },
    [invalidateResult],
  )

  const submitCurrentInput = React.useCallback(async () => {
    await submitAnalysis()
  }, [submitAnalysis])

  const openLogin = React.useCallback(
    (onSuccess?: () => void) => {
      openLoginModal({
        onSuccess: () => {
          setIsLocked(false)
          setLockMessage(null)
          setAnonymousGenerationQuota(null)
          onSuccess?.()
        },
      })
    },
    [openLoginModal],
  )

  return {
    anonymousGenerationQuota,
    copiedKind,
    copyResultValue,
    dismissPromptCopyNotice,
    deployDialogProvider,
    enableLuckyActions,
    generatePrompt,
    hasGeneratedPrompt,
    hasInput,
    hasMigrationRepositoryUrlError,
    input,
    isDeployDialogOpen,
    isGenerating,
    isGeneratingNetlify,
    isGeneratingPrompt,
    isLocked,
    isModHeld,
    loadingPhrase,
    lockMessage,
    migrationRepositoryInputRef,
    migrationRepositoryUrl,
    navigateToResult,
    openClaudeStart,
    openCursorStart,
    openCodexStart,
    openDeployDialog,
    openLogin,
    openNetlifyStart,
    partnerSuggestions,
    promptCopyNotice: showPromptCopyNotice,
    result,
    selectSuggestion,
    analysis,
    hasFreshAnalysis,
    isAnalysisStale,
    isAnalyzing,
    showLuckyActions,
    selectedPackageManager,
    selectedLibraries,
    selectedPartners,
    selectedToolchain,
    setIsDeployDialogOpen,
    setIsModHeld,
    setSessionMode,
    showMigrationRepositoryInput,
    trackActivation,
    submitCurrentInput,
    suggestions,
    toggleLibrary,
    togglePackageManager,
    togglePartner,
    toggleToolchain,
    updateInput,
    updateMigrationRepositoryUrl,
  }
}
