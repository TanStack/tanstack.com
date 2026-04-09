import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { useCurrentUser } from '~/hooks/useCurrentUser'
import { useLoginModal } from '~/contexts/LoginModalContext'
import { useToast } from '~/components/ToastProvider'
import { trackPostHogEvent, useTrackedImpression } from '~/utils/posthog'
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
  getStarterAnalyticsProperties,
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
  const analyticsProperties = React.useMemo(
    () =>
      getStarterAnalyticsProperties({
        context,
        generated: !!result?.prompt,
        mode,
        selectedLibraries,
        selectedPartners,
      }),
    [context, mode, result?.prompt, selectedLibraries, selectedPartners],
  )

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

      setExplicitLibrarySelections((current) => {
        const next = { ...current }

        if (selected) {
          next[libraryId] = false
        } else {
          next[libraryId] = true
        }

        trackPostHogEvent('application_starter_library_toggled', {
          ...analyticsProperties,
          library_id: libraryId,
          selected: !selected,
        })

        return next
      })
    },
    [analyticsProperties, invalidateResult, selectedLibraries],
  )

  const togglePartner = React.useCallback(
    (partner: ApplicationStarterPartnerSuggestion, selected: boolean) => {
      invalidateResult()
      trackPostHogEvent('application_starter_integration_toggled', {
        ...analyticsProperties,
        integration: partner.id,
        selected: !selected,
      })

      setExplicitPartnerSelections((current) => ({
        ...current,
        [partner.id]: !selected,
      }))
    },
    [analyticsProperties, invalidateResult],
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
    (kind: string, options?: { showPromptNotice?: boolean }) => {
      setCopiedKind(kind)
      setTimeout(
        () => setCopiedKind((current) => (current === kind ? null : current)),
        1800,
      )

      if (kind === 'prompt' && options?.showPromptNotice) {
        revealPromptCopyNotice()
      }

      trackPostHogEvent('application_starter_value_copied', {
        ...analyticsProperties,
        copied_kind: kind,
      })
    },
    [analyticsProperties, revealPromptCopyNotice],
  )

  const handleCopy = React.useCallback(
    async (
      value: string,
      kind: string,
      options?: { notify?: boolean; showPromptNotice?: boolean },
    ) => {
      await navigator.clipboard.writeText(value)
      markCopied(kind, { showPromptNotice: options?.showPromptNotice })

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
        void handleCopy(nextResult.prompt, 'prompt', { notify: false })
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

      trackPostHogEvent('application_starter_generation_failed', {
        ...analyticsProperties,
        error_message: error instanceof Error ? error.message : 'unknown_error',
        login_required:
          error instanceof ApplicationStarterError
            ? !!error.loginRequired
            : false,
      })

      if (
        error instanceof ApplicationStarterError &&
        error.loginRequired &&
        !currentUser
      ) {
        setIsLocked(true)
        setLockMessage(
          error.retryAfter
            ? `Anonymous generations are limited. Sign in to unlock more, or wait about ${Math.max(1, Math.ceil(error.retryAfter / 60))} minute${Math.ceil(error.retryAfter / 60) === 1 ? '' : 's'}.`
            : 'Anonymous generations are limited. Sign in to unlock more.',
        )

        trackPostHogEvent('application_starter_login_required', {
          ...analyticsProperties,
          retry_after: error.retryAfter,
        })
      }
    },
    [analyticsProperties, currentUser, notify, refreshAnonymousQuota],
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

      trackPostHogEvent('application_starter_generated', {
        ...analyticsProperties,
        final_deployment: nextResult.recipe.deployment,
        final_feature_count: finalFeatureIds.length,
        final_feature_ids: finalFeatureIds,
        final_prompt_feature_count: finalPromptFeatureIds.length,
        final_prompt_feature_ids: finalPromptFeatureIds,
        final_inferred_partner_count: inferredPartnerIds.length,
        final_inferred_partner_ids: inferredPartnerIds,
        final_partner_count: finalPartnerIds.length,
        final_partner_ids: finalPartnerIds,
        final_prompt_partner_count: finalPromptPartnerIds.length,
        final_prompt_partner_ids: finalPromptPartnerIds,
        final_selected_partner_count: selectedPartnerIds.length,
        final_selected_partner_ids: selectedPartnerIds,
        final_toolchain: nextResult.recipe.toolchain,
        generation_index: generationCountRef.current,
        result_type: nextResult.resultType,
      })

      for (const partnerId of finalPromptPartnerIds) {
        trackPostHogEvent('application_starter_final_partner_in_prompt', {
          ...analyticsProperties,
          generation_index: generationCountRef.current,
          inferred: inferredPartnerIds.includes(partnerId),
          partner_id: partnerId,
          selected: selectedPartnerIds.includes(partnerId),
        })
      }

      for (const featureId of finalPromptFeatureIds) {
        trackPostHogEvent('application_starter_final_addon_in_prompt', {
          ...analyticsProperties,
          addon_id: featureId,
          generation_index: generationCountRef.current,
        })
      }

      await finishWithResult(nextResult)
    },
    [
      analysis,
      analyticsProperties,
      finishWithResult,
      isAnalysisStale,
      partnerSuggestions,
      refreshAnonymousQuota,
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

    trackPostHogEvent(
      'application_starter_continue_clicked',
      analyticsProperties,
    )

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
  }, [analyticsProperties, analysisMutation, context, input])

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

      trackPostHogEvent('application_starter_idea_selected', {
        ...analyticsProperties,
        idea_label: suggestion.label,
      })
    },
    [analyticsProperties, markAnalysisStale],
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

  const trackAction = React.useCallback(
    (action: string, provider?: StarterDeployProvider | null) => {
      trackPostHogEvent('application_starter_action_clicked', {
        ...analyticsProperties,
        surface: 'application_starter',
        action,
        provider,
      })
    },
    [analyticsProperties],
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
        trackAction(kind)

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

        trackAction(provider ? 'deploy' : 'clone_github', provider)
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

    trackPostHogEvent('application_starter_action_clicked', {
      ...analyticsProperties,
      surface: 'application_starter',
      action: 'netlify_start',
      cloudflare_removed: removedCloudflare,
    })

    window.open(
      `https://app.netlify.com/start?prompt=${encodeURIComponent(nextResult.prompt)}&utm_source=tanstack`,
      '_blank',
      'noopener,noreferrer',
    )
  }, [
    analyticsProperties,
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
      trackAction('codex_start')
      window.location.assign(
        `codex://new?prompt=${encodeURIComponent(nextResult.prompt)}`,
      )
    })
  }, [trackAction, withResolvedPrompt])

  const openClaudeStart = React.useCallback(async () => {
    await withResolvedPrompt((nextResult) => {
      trackAction('claude_start')
      window.open(
        `https://claude.ai/code?q=${encodeURIComponent(nextResult.prompt)}`,
        '_blank',
        'noopener,noreferrer',
      )
    })
  }, [trackAction, withResolvedPrompt])

  const openCursorStart = React.useCallback(async () => {
    await withResolvedPrompt((nextResult) => {
      trackAction('cursor_start')
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

    trackPostHogEvent(
      'application_starter_generate_clicked',
      analyticsProperties,
    )
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
    analyticsProperties,
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
  const impressionRef = useTrackedImpression<HTMLDivElement>({
    event: 'application_starter_viewed',
    properties: analyticsProperties,
  })

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
      trackPostHogEvent(
        'application_starter_login_clicked',
        analyticsProperties,
      )
      openLoginModal({
        onSuccess: () => {
          setIsLocked(false)
          setLockMessage(null)
          setAnonymousGenerationQuota(null)
          onSuccess?.()
        },
      })
    },
    [analyticsProperties, openLoginModal],
  )

  return {
    analyticsProperties,
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
    impressionRef,
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
    showMigrationRepositoryInput,
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
