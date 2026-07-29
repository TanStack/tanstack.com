import * as React from 'react'
import { ClientOnly } from '@tanstack/react-router'
import {
  ArrowRight,
  Atom,
  Check,
  CaretDown,
  Copy,
  Cube,
  DownloadSimple,
  GithubLogo,
  OpenAiLogo,
  CircleNotch,
  ArrowCounterClockwise,
  Rocket,
} from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import type {
  ApplicationStarterContext,
  ApplicationStarterResult,
} from '~/utils/application-starter'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/Collapsible'
import {
  GeneratedPromptPreviewBody,
  GeneratedPromptPreviewHeader,
  StarterChipButton,
  StarterLibraryRows,
  StarterPartnerRows,
  StarterTooltipProvider,
} from '~/components/application-builder/parts'
import {
  buildStarterPromptDeployUrl,
  toneClasses,
  type ApplicationStarterBuilderIntegration,
  type StarterPromptDeployProvider,
  type StarterTone,
} from '~/components/application-builder/shared'
import { useApplicationBuilder } from '~/components/application-builder/useApplicationBuilder'
import { PixelSpinner } from '~/components/ds/ui/PixelSpinner'
import { usePrefersReducedMotion } from '~/utils/usePrefersReducedMotion'
import { Button, Tooltip } from '~/ui'

export interface ApplicationStarterProps {
  builderIntegration?: ApplicationStarterBuilderIntegration
  className?: string
  context: ApplicationStarterContext
  footerContent?: React.ReactNode
  enableHotkeys?: boolean
  forceRouterOnly?: boolean
  formId?: string
  headerAction?: React.ReactNode
  mode?: 'compact' | 'full'
  onDirtyStateChange?: (dirty: boolean) => void
  onResolvedResult?: (result: ApplicationStarterResult | null) => void
  primaryActionLabel?: string
  revealOptionsImmediately?: boolean
  secondaryActionLabel?: string
  showCliExportActions?: boolean
  showPromptPreview?: boolean
  suggestionContext?: ApplicationStarterContext
  submitButton?: React.ReactNode
  title?: React.ReactNode
  tone?: StarterTone
}

const LazyApplicationStarterHotkeys = React.lazy(() =>
  import('~/components/ApplicationStarterHotkeys.client').then((m) => ({
    default: m.ApplicationStarterHotkeys,
  })),
)

const LazyDeployDialog = React.lazy(() =>
  import('~/components/builder/DeployDialog').then((m) => ({
    default: m.DeployDialog,
  })),
)

const starterPackageManagers = ['pnpm', 'npm', 'yarn', 'bun'] as const
const starterToolchains = ['biome', 'eslint'] as const

type HostingDeployPartnerId = 'cloudflare' | 'lovable' | 'netlify' | 'railway'
type StarterTransientAction =
  | 'claude'
  | 'clone'
  | 'codex'
  | 'cursor'
  | 'deploy'
  | 'download'
  | 'netlify'

const hostingDeployPartnerLabels: Record<HostingDeployPartnerId, string> = {
  cloudflare: 'Cloudflare',
  lovable: 'Lovable',
  netlify: 'Netlify',
  railway: 'Railway',
}

function getHostingDeployPartnerId(
  partnerId: string,
): HostingDeployPartnerId | undefined {
  switch (partnerId) {
    case 'cloudflare':
    case 'lovable':
    case 'netlify':
    case 'railway':
      return partnerId
    default:
      return undefined
  }
}

function getPromptDeployProvider(
  partnerId: HostingDeployPartnerId,
): StarterPromptDeployProvider | undefined {
  switch (partnerId) {
    case 'lovable':
    case 'netlify':
      return partnerId
    case 'cloudflare':
    case 'railway':
      return undefined
  }
}

function buildCodexStartUrl(prompt: string) {
  return `codex://new?prompt=${encodeURIComponent(prompt)}`
}

function buildClaudeStartUrl(prompt: string) {
  return `https://claude.ai/code?q=${encodeURIComponent(prompt)}`
}

function buildCursorStartUrl(prompt: string) {
  return `cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(prompt)}`
}

export function ApplicationStarter({
  builderIntegration,
  className,
  context,
  footerContent,
  enableHotkeys = false,
  forceRouterOnly = false,
  formId,
  headerAction,
  mode = 'full',
  onDirtyStateChange,
  onResolvedResult,
  primaryActionLabel = 'Copy Prompt',
  revealOptionsImmediately = false,
  secondaryActionLabel = 'Build with Netlify',
  showCliExportActions = true,
  showPromptPreview = true,
  suggestionContext,
  submitButton,
  title = 'What would you like to build?',
  tone = 'cyan',
}: ApplicationStarterProps) {
  const {
    copiedKind,
    copyResultValue,
    dismissPromptCopyNotice,
    deployDialogProvider,
    generatePrompt,
    hasGeneratedPrompt,
    hasRevealedOptions,
    hasInput,
    hasMigrationRepositoryUrlError,
    input,
    isDeployDialogOpen,
    isGenerating,
    isGeneratingPrompt,
    isModHeld,
    loadingPhrase,
    migrationRepositoryInputRef,
    migrationRepositoryUrl,
    openDeployDialog,
    partnerSuggestions,
    promptCopyNotice,
    result,
    resetBuilder,
    selectSuggestion,
    selectedPackageManager,
    selectedLibraries,
    selectedPartners,
    selectedToolchain,
    setIsDeployDialogOpen,
    setIsModHeld,
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
  } = useApplicationBuilder({
    builderIntegration,
    context,
    forceRouterOnly,
    mode,
    onDirtyStateChange,
    onResolvedResult,
    revealOptionsImmediately,
    suggestionContext,
  })

  const palette = toneClasses[tone]
  const compact = mode === 'compact'
  const isHomeStarter = context === 'home'
  const [pendingHostingDeployPartner, setPendingHostingDeployPartner] =
    React.useState<HostingDeployPartnerId | null>(null)
  const [transientAction, setTransientAction] =
    React.useState<StarterTransientAction | null>(null)
  const [hasFocusedPromptInput, setHasFocusedPromptInput] =
    React.useState(false)
  const [isPromptFocused, setIsPromptFocused] = React.useState(false)
  const [isMacShortcutPlatform, setIsMacShortcutPlatform] =
    React.useState(false)
  const [showPackageManagerOptions, setShowPackageManagerOptions] =
    React.useState(false)
  const [showToolchainOptions, setShowToolchainOptions] = React.useState(false)

  // Rotating placeholder: cycle the starter suggestions through the empty prompt
  // field (replaces the preset chips). On home the short label shows in an
  // animated overlay that gently dissolves out, then reveals the next
  // left-to-right; elsewhere it's the native placeholder. Pauses once the field
  // has content or focus. Shift+Enter accepts the shown suggestion.
  const reducedMotion = usePrefersReducedMotion() === true
  const [homeSelectionRevealCount, setHomeSelectionRevealCount] =
    React.useState(0)
  const [homeRevealSequenceComplete, setHomeRevealSequenceComplete] =
    React.useState(false)
  const hasPlayedHomeRevealRef = React.useRef(false)
  const homeSelectedOptionCountRef = React.useRef(0)
  homeSelectedOptionCountRef.current =
    selectedLibraries.length + selectedPartners.length
  const [isHomePayoffLoading, setIsHomePayoffLoading] = React.useState(false)
  const homePayoffLoadingRef = React.useRef(false)
  const pendingHomeSubmissionRef = React.useRef<string | undefined>(undefined)
  const submitWithHomePayoff = React.useCallback(
    (overrideInput?: string) => {
      if (!isHomeStarter || reducedMotion) {
        void submitCurrentInput(overrideInput)
        return
      }

      if (homePayoffLoadingRef.current) {
        return
      }

      homePayoffLoadingRef.current = true
      pendingHomeSubmissionRef.current = overrideInput
      setIsHomePayoffLoading(true)
    },
    [isHomeStarter, reducedMotion, submitCurrentInput],
  )
  const completeHomePayoff = React.useCallback(() => {
    if (!homePayoffLoadingRef.current) {
      return
    }

    const overrideInput = pendingHomeSubmissionRef.current
    pendingHomeSubmissionRef.current = undefined
    homePayoffLoadingRef.current = false
    setIsHomePayoffLoading(false)
    void submitCurrentInput(overrideInput)
  }, [submitCurrentInput])
  const resetHomeBuilder = React.useCallback(() => {
    homePayoffLoadingRef.current = false
    pendingHomeSubmissionRef.current = undefined
    setIsHomePayoffLoading(false)
    setHomeSelectionRevealCount(0)
    setHomeRevealSequenceComplete(false)
    hasPlayedHomeRevealRef.current = false
    setShowToolchainOptions(false)
    setShowPackageManagerOptions(false)
    resetBuilder()
  }, [resetBuilder])
  const [placeholderIndex, setPlaceholderIndex] = React.useState(0)
  const [placeholderShowing, setPlaceholderShowing] = React.useState(true)
  React.useEffect(() => {
    if (suggestions.length <= 1 || hasInput || isPromptFocused) {
      return
    }
    let swapTimer: ReturnType<typeof setTimeout>
    const cycle = window.setInterval(() => {
      if (reducedMotion) {
        setPlaceholderIndex((index) => (index + 1) % suggestions.length)
        return
      }
      // Fade the current prompt fully out, then swap + reveal the next.
      setPlaceholderShowing(false)
      swapTimer = setTimeout(() => {
        setPlaceholderIndex((index) => (index + 1) % suggestions.length)
        setPlaceholderShowing(true)
      }, 420)
    }, 4200)
    return () => {
      window.clearInterval(cycle)
      clearTimeout(swapTimer)
    }
  }, [suggestions.length, hasInput, isPromptFocused, reducedMotion])
  const currentSuggestion =
    suggestions.length > 0
      ? suggestions[placeholderIndex % suggestions.length]
      : undefined
  const rotatingPlaceholder =
    currentSuggestion?.input ??
    'Build a SaaS app with auth, Postgres, nested routes, and Sentry. Use pnpm and deploy to Cloudflare.'
  const handlePromptShiftEnter = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key !== 'Enter' || !event.shiftKey) {
      return
    }
    event.preventDefault()
    submitWithHomePayoff(hasInput ? undefined : currentSuggestion?.input)
  }

  const canRevealOptions =
    hasInput &&
    !hasMigrationRepositoryUrlError &&
    !isGenerating &&
    !isHomePayoffLoading
  const canUseFinalActions =
    hasRevealedOptions &&
    hasInput &&
    !hasMigrationRepositoryUrlError &&
    !isGenerating
  const transientActionTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null)
  const showTransientActionFeedback = React.useCallback(
    (action: StarterTransientAction) => {
      if (transientActionTimerRef.current) {
        clearTimeout(transientActionTimerRef.current)
      }

      setTransientAction(action)
      transientActionTimerRef.current = setTimeout(() => {
        setTransientAction((current) => (current === action ? null : current))
        transientActionTimerRef.current = null
      }, 1800)
    },
    [],
  )
  const selectedHostingDeployPartner = React.useMemo(
    () =>
      selectedPartners.flatMap((partnerId) => {
        const hostingPartnerId = getHostingDeployPartnerId(partnerId)

        return hostingPartnerId ? [hostingPartnerId] : []
      })[0],
    [selectedPartners],
  )
  const isSelectedHostingDeployPending =
    pendingHostingDeployPartner !== null &&
    pendingHostingDeployPartner === selectedHostingDeployPartner
  const isDeployFeedbackActive =
    isSelectedHostingDeployPending || transientAction === 'deploy'
  const isPromptCopied = copiedKind === 'prompt'
  const isCommandCopied = copiedKind === 'command'
  const resultPrompt = result?.prompt
  const selectedPromptDeployProvider = selectedHostingDeployPartner
    ? getPromptDeployProvider(selectedHostingDeployPartner)
    : undefined
  const selectedHostingDeployHref = React.useMemo(
    () =>
      selectedPromptDeployProvider && result?.prompt
        ? buildStarterPromptDeployUrl(
            selectedPromptDeployProvider,
            result.prompt,
          )
        : undefined,
    [result?.prompt, selectedPromptDeployProvider],
  )
  const netlifyStartHref = React.useMemo(
    () =>
      resultPrompt
        ? buildStarterPromptDeployUrl('netlify', resultPrompt)
        : undefined,
    [resultPrompt],
  )
  const codexStartHref = React.useMemo(
    () => (resultPrompt ? buildCodexStartUrl(resultPrompt) : undefined),
    [resultPrompt],
  )
  const claudeStartHref = React.useMemo(
    () => (resultPrompt ? buildClaudeStartUrl(resultPrompt) : undefined),
    [resultPrompt],
  )
  const cursorStartHref = React.useMemo(
    () => (resultPrompt ? buildCursorStartUrl(resultPrompt) : undefined),
    [resultPrompt],
  )
  const downloadHref = result?.downloadUrl
  const trackSelectedHostingDeployLink = React.useCallback(() => {
    if (!selectedHostingDeployPartner) {
      return
    }

    trackActivation({
      action:
        selectedHostingDeployPartner === 'netlify' ? 'netlify_start' : 'deploy',
      surface: 'result_panel',
      provider: selectedHostingDeployPartner,
    })
  }, [selectedHostingDeployPartner, trackActivation])
  const deployToSelectedHostingPartner = async () => {
    if (!selectedHostingDeployPartner) {
      return
    }

    setPendingHostingDeployPartner(selectedHostingDeployPartner)

    try {
      switch (selectedHostingDeployPartner) {
        case 'cloudflare':
          await openDeployDialog('cloudflare')
          break
        case 'lovable':
          break
        case 'netlify':
          break
        case 'railway':
          await openDeployDialog('railway')
          break
      }
    } finally {
      setPendingHostingDeployPartner(null)
    }
  }
  const renderCopyPromptButton = () => (
    <Button
      variant="primary"
      size={isHomeStarter ? 'md' : 'sm'}
      className={
        isHomeStarter
          ? 'border-gray-950 bg-gray-950 text-white hover:bg-gray-800 dark:border-white dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200'
          : undefined
      }
      type="button"
      onClick={() => void generatePrompt()}
      disabled={!canUseFinalActions}
    >
      {isGeneratingPrompt ? (
        <CircleNotch className="h-4 w-4 animate-spin" />
      ) : isPromptCopied ? (
        <Check className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {isGeneratingPrompt
        ? loadingPhrase
        : isPromptCopied
          ? 'Copied'
          : primaryActionLabel}
    </Button>
  )
  const renderCopyCliCommandButton = () => (
    <Button
      variant="secondary"
      size={isHomeStarter ? 'md' : 'sm'}
      className={isHomeStarter ? 'border border-transparent' : undefined}
      type="button"
      onClick={() => {
        void copyResultValue('command')
      }}
      disabled={!canUseFinalActions}
    >
      {isGeneratingPrompt ? (
        <CircleNotch className="h-4 w-4 animate-spin" />
      ) : isCommandCopied ? (
        <Check className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {isGeneratingPrompt
        ? 'Preparing...'
        : isCommandCopied
          ? 'Copied'
          : 'Copy CLI Command'}
    </Button>
  )
  const renderActionAnchor = ({
    action,
    className,
    href,
    icon,
    label,
    iconOnly = false,
    onTrack,
    rel = 'noopener noreferrer',
    size,
    target = '_blank',
    variant = 'primary',
  }: {
    action: StarterTransientAction
    className?: string
    href?: string
    icon: React.ReactNode
    label: string
    iconOnly?: boolean
    onTrack: () => void
    rel?: string
    size: 'xs' | 'sm'
    target?: string
    variant?: 'primary' | 'secondary'
  }) => {
    const disabled = !canUseFinalActions || !href || transientAction === action
    const waitingForHref = !href

    const button = (
      <Button
        as="a"
        variant={iconOnly ? 'icon' : variant}
        color={iconOnly ? 'gray' : undefined}
        size={iconOnly ? 'icon-sm' : size}
        href={disabled ? undefined : href}
        target={target}
        rel={rel}
        aria-disabled={disabled}
        aria-label={iconOnly ? label : undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault()
            return
          }

          onTrack()
          showTransientActionFeedback(action)
        }}
        className={twMerge(
          className,
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {transientAction === action || waitingForHref ? (
          <CircleNotch
            className={twMerge(
              'animate-spin',
              iconOnly ? 'h-6 w-6' : size === 'xs' ? 'h-3.5 w-3.5' : 'h-4 w-4',
            )}
          />
        ) : (
          icon
        )}
        {!iconOnly
          ? transientAction === action
            ? 'Opening...'
            : waitingForHref
              ? 'Preparing...'
              : label
          : null}
      </Button>
    )

    return iconOnly ? (
      <Tooltip content={label} side="bottom">
        {button}
      </Tooltip>
    ) : (
      button
    )
  }
  const renderSelectedHostingDeployButton = () => {
    if (!selectedHostingDeployPartner) {
      return null
    }

    if (selectedPromptDeployProvider) {
      const disabled =
        !canUseFinalActions ||
        !selectedHostingDeployHref ||
        transientAction === 'deploy'
      const waitingForHref = !selectedHostingDeployHref

      return (
        <Button
          as="a"
          color="emerald"
          variant="primary"
          size={isHomeStarter ? 'md' : 'sm'}
          href={disabled ? undefined : selectedHostingDeployHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : undefined}
          onClick={(event) => {
            if (disabled) {
              event.preventDefault()
              return
            }

            trackSelectedHostingDeployLink()
            showTransientActionFeedback('deploy')
          }}
          className={disabled ? 'pointer-events-none opacity-50' : undefined}
          aria-label={`Deploy to ${hostingDeployPartnerLabels[selectedHostingDeployPartner]}`}
        >
          {isDeployFeedbackActive || waitingForHref ? (
            <CircleNotch className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          {isDeployFeedbackActive
            ? 'Opening...'
            : waitingForHref
              ? 'Preparing...'
              : 'Deploy'}
        </Button>
      )
    }

    return (
      <Button
        color="emerald"
        variant="primary"
        size={isHomeStarter ? 'md' : 'sm'}
        type="button"
        onClick={() => {
          showTransientActionFeedback('deploy')
          void deployToSelectedHostingPartner()
        }}
        disabled={
          !canUseFinalActions ||
          pendingHostingDeployPartner !== null ||
          transientAction === 'deploy'
        }
        aria-label={`Deploy to ${hostingDeployPartnerLabels[selectedHostingDeployPartner]}`}
      >
        {isDeployFeedbackActive ? (
          <CircleNotch className="h-4 w-4 animate-spin" />
        ) : (
          <Rocket className="h-4 w-4" />
        )}
        {isDeployFeedbackActive ? 'Opening...' : 'Deploy'}
      </Button>
    )
  }
  const showOptionsSection = hasRevealedOptions || hasGeneratedPrompt
  const showActionSection = hasRevealedOptions || hasGeneratedPrompt
  const stagedHomeSelectionCount =
    isHomeStarter &&
    !reducedMotion &&
    showOptionsSection &&
    !homeRevealSequenceComplete
      ? homeSelectionRevealCount
      : undefined
  const showStagedActionSection =
    showActionSection &&
    (!isHomeStarter || reducedMotion || homeRevealSequenceComplete)

  React.useEffect(() => {
    if (
      !isHomeStarter ||
      reducedMotion ||
      !showOptionsSection ||
      hasPlayedHomeRevealRef.current
    ) {
      return
    }

    hasPlayedHomeRevealRef.current = true
    const totalSelections = homeSelectedOptionCountRef.current
    let selectionTimer: number | undefined
    const sectionTimer = window.setTimeout(() => {
      if (totalSelections === 0) {
        setHomeRevealSequenceComplete(true)
        return
      }

      let revealedSelections = 0
      selectionTimer = window.setInterval(() => {
        revealedSelections += 1
        setHomeSelectionRevealCount(revealedSelections)

        if (revealedSelections >= totalSelections) {
          window.clearInterval(selectionTimer)
          setHomeRevealSequenceComplete(true)
        }
      }, 70)
    }, 650)

    return () => {
      window.clearTimeout(sectionTimer)
      if (selectionTimer !== undefined) {
        window.clearInterval(selectionTimer)
      }
    }
  }, [isHomeStarter, reducedMotion, showOptionsSection])

  React.useEffect(() => {
    return () => {
      if (transientActionTimerRef.current) {
        clearTimeout(transientActionTimerRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    if (typeof navigator === 'undefined') {
      return
    }

    setIsMacShortcutPlatform(/Mac|iPhone|iPad|iPod/i.test(navigator.platform))
  }, [])

  return (
    <div
      className={twMerge('relative', className)}
      data-expanded={showOptionsSection || undefined}
    >
      {enableHotkeys && !compact && hasFocusedPromptInput ? (
        <ClientOnly>
          <React.Suspense fallback={null}>
            <LazyApplicationStarterHotkeys
              onSubmit={() => {
                if (showActionSection) {
                  void generatePrompt()
                } else {
                  submitWithHomePayoff()
                }
              }}
              onModKeyChange={setIsModHeld}
              promptFocused={isPromptFocused}
            />
          </React.Suspense>
        </ClientOnly>
      ) : null}

      {isDeployDialogOpen ? (
        <React.Suspense fallback={null}>
          <LazyDeployDialog
            isOpen={isDeployDialogOpen}
            onClose={() => setIsDeployDialogOpen(false)}
            provider={deployDialogProvider}
            starterRecipe={result?.recipe ?? null}
            onTrackActivation={trackActivation}
          />
        </React.Suspense>
      ) : null}

      <div className="relative">
        {compact ? (
          <div className="space-y-2">
            <h3
              className={twMerge(
                'font-semibold tracking-[-0.03em] text-gray-950 dark:text-white',
                'text-base tracking-[-0.02em]',
              )}
            >
              {title}
            </h3>
          </div>
        ) : null}

        <form
          id={formId}
          className={twMerge('space-y-3', compact ? 'mt-3' : 'mt-0')}
          onSubmit={(event) => {
            event.preventDefault()
            submitWithHomePayoff()
          }}
        >
          {compact ? (
            <>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-800">
                  <div className="font-ds-mono text-ds-mono-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Ideas
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                      <StarterChipButton
                        key={suggestion.label}
                        compact
                        onClick={() => {
                          void selectSuggestion({ suggestion })
                        }}
                        palette={palette}
                        selected={input === suggestion.input}
                      >
                        {suggestion.label}
                      </StarterChipButton>
                    ))}
                  </div>
                </div>

                {showMigrationRepositoryInput ? (
                  <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-800">
                    <div className="font-ds-mono text-ds-mono-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Existing Repository URL
                    </div>
                    <input
                      ref={migrationRepositoryInputRef}
                      type="text"
                      value={migrationRepositoryUrl}
                      onChange={(event) => {
                        updateMigrationRepositoryUrl(event.target.value)
                      }}
                      placeholder="https://github.com/acme/legacy-next-app"
                      className={twMerge(
                        'mt-2 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-xs text-gray-900 outline-none transition-colors placeholder:text-gray-400 dark:border-gray-800 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-500',
                        palette.ring,
                        hasMigrationRepositoryUrlError &&
                          'border-red-300 dark:border-red-800',
                      )}
                    />
                    {hasMigrationRepositoryUrlError ? (
                      <div className="mt-2 text-[11px] text-red-600 dark:text-red-400">
                        Enter a valid Git or GitHub repository URL.
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="relative">
                  <div className="px-3 pt-2 font-ds-mono text-ds-mono-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Prompt
                  </div>
                  <textarea
                    value={input}
                    onChange={(event) => {
                      updateInput(event.target.value)
                    }}
                    onFocus={() => {
                      setHasFocusedPromptInput(true)
                      setIsPromptFocused(true)
                    }}
                    onBlur={() => {
                      setIsPromptFocused(false)
                    }}
                    rows={3}
                    placeholder="Build a SaaS app with auth, Postgres, nested routes, and Sentry. Use pnpm and deploy to Cloudflare."
                    className={twMerge(
                      'w-full min-h-20 bg-transparent px-3 pb-2 pt-1 text-xs leading-5 text-gray-900 outline-none transition-colors dark:text-white',
                      palette.ring,
                    )}
                  />
                </div>

                {!showOptionsSection ? (
                  <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-800">
                    <Button
                      color="emerald"
                      className="pr-1"
                      size="xs"
                      type="submit"
                      disabled={!canRevealOptions}
                    >
                      <ArrowRight className="h-4 w-4" />
                      Next
                      {enableHotkeys ? (
                        <SubmitShortcutHint isMac={isMacShortcutPlatform} />
                      ) : null}
                    </Button>
                  </div>
                ) : null}
              </div>

              <Collapsible open={showOptionsSection}>
                <CollapsibleContent className="mt-3">
                  {showOptionsSection ? (
                    <StarterTooltipProvider>
                      <div className="space-y-2 rounded-lg border border-gray-200 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-950">
                        <div className="mb-3">
                          <div className="font-ds-mono text-ds-mono-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            TanStack Libraries
                          </div>

                          <div className="mt-2 space-y-2">
                            <StarterLibraryRows
                              compact
                              selectedLibraries={selectedLibraries}
                              toggleLibrary={toggleLibrary}
                            />
                          </div>
                        </div>

                        <div className="font-ds-mono text-ds-mono-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          Partner Integrations
                        </div>
                        <StarterPartnerRows
                          compact
                          palette={palette}
                          partnerSuggestions={partnerSuggestions}
                          selectedPartners={selectedPartners}
                          togglePartner={togglePartner}
                        />
                        <StarterCustomizationSection
                          compact
                          onOpenChange={setShowToolchainOptions}
                          open={showToolchainOptions}
                          title="Toolchain"
                        >
                          <div className="mt-2 flex flex-wrap gap-2">
                            {starterToolchains.map((toolchain) => (
                              <StarterChipButton
                                key={toolchain}
                                compact
                                onClick={() => {
                                  toggleToolchain(toolchain)
                                }}
                                palette={palette}
                                selected={selectedToolchain === toolchain}
                              >
                                {toolchain}
                              </StarterChipButton>
                            ))}
                          </div>
                        </StarterCustomizationSection>
                        <StarterCustomizationSection
                          compact
                          onOpenChange={setShowPackageManagerOptions}
                          open={showPackageManagerOptions}
                          title="Package Manager"
                        >
                          <div className="mt-2 flex flex-wrap gap-2">
                            {starterPackageManagers.map((packageManager) => (
                              <StarterChipButton
                                key={packageManager}
                                compact
                                onClick={() => {
                                  togglePackageManager(packageManager)
                                }}
                                palette={palette}
                                selected={
                                  selectedPackageManager === packageManager
                                }
                              >
                                {packageManager}
                              </StarterChipButton>
                            ))}
                          </div>
                        </StarterCustomizationSection>
                      </div>
                    </StarterTooltipProvider>
                  ) : null}
                </CollapsibleContent>
              </Collapsible>
            </>
          ) : (
            <>
              {/* Figma StackBuilder: the heading floats above the box. */}
              {isHomeStarter ? (
                <p className="mx-auto mb-6 max-w-4xl text-balance text-center font-ds-display text-ds-heading-3 font-light leading-tight text-gray-950 dark:text-white">
                  {title}
                </p>
              ) : null}
              <div
                className={twMerge(
                  'relative overflow-hidden rounded-[1rem] border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950',
                  // Home: 36px full-squircle corners and a tight terracotta glow.
                  isHomeStarter &&
                    'rounded-[36px] [corner-shape:squircle] shadow-[0px_21px_39.2px_-38px_var(--color-ds-terracotta-300)] dark:border-transparent dark:bg-[#171717]',
                )}
              >
                <div>
                  {/* Home renders its heading above the box (see the fragment
                    above); other contexts keep the in-box header bar. */}
                  {isHomeStarter ? null : (
                    <div className="border-b border-gray-200 bg-gray-50/70 px-5 py-4 dark:border-gray-800 dark:bg-gray-900/50">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold tracking-[-0.04em] text-[1.375rem] md:text-[1.5rem] text-gray-950 dark:text-white">
                          {title}
                        </h3>
                        {headerAction ? (
                          <div className="shrink-0">{headerAction}</div>
                        ) : null}
                      </div>
                    </div>
                  )}

                  <div
                    className={twMerge(
                      'relative border-b border-gray-200 dark:border-gray-800',
                      isHomeStarter && 'rounded-[36px] border-b-0',
                    )}
                  >
                    {showMigrationRepositoryInput ? (
                      <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                        <div className="font-ds-mono text-ds-mono-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          Existing Repository URL
                        </div>
                        <input
                          ref={migrationRepositoryInputRef}
                          type="text"
                          value={migrationRepositoryUrl}
                          onChange={(event) => {
                            updateMigrationRepositoryUrl(event.target.value)
                          }}
                          placeholder="https://github.com/acme/legacy-next-app"
                          className={twMerge(
                            'mt-3 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 dark:border-gray-800 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-500',
                            palette.ring,
                            hasMigrationRepositoryUrlError &&
                              'border-red-300 dark:border-red-800',
                          )}
                        />
                        {hasMigrationRepositoryUrlError ? (
                          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                            Enter a valid Git or GitHub repository URL.
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {isHomeStarter ? null : (
                      <div className="px-5 pt-4 font-ds-mono text-ds-mono-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Prompt
                      </div>
                    )}
                    <textarea
                      value={input}
                      onChange={(event) => {
                        updateInput(event.target.value)
                      }}
                      onFocus={() => {
                        setHasFocusedPromptInput(true)
                        setIsPromptFocused(true)
                      }}
                      onBlur={() => {
                        setIsPromptFocused(false)
                      }}
                      onClick={(event) => {
                        if (enableHotkeys && isModHeld) {
                          event.preventDefault()
                          if (showActionSection) {
                            void generatePrompt()
                          } else {
                            submitWithHomePayoff()
                          }
                        }
                      }}
                      onKeyDown={handlePromptShiftEnter}
                      rows={4}
                      // Home hides the native placeholder — the animated overlay
                      // below renders the rotating (short) suggestion instead.
                      placeholder={isHomeStarter ? '' : rotatingPlaceholder}
                      className={twMerge(
                        'w-full min-h-28 bg-transparent px-5 pb-4 pt-1 text-sm leading-6 text-gray-900 outline-none transition-colors dark:text-white',
                        palette.ring,
                        isHomeStarter &&
                          'resize-none rounded-[36px] px-6 pb-6 pr-40 pt-6 text-base text-gray-900 placeholder:text-gray-500 dark:text-white dark:placeholder:text-[#8f8f98]',
                      )}
                    />

                    {/* Animated rotating placeholder (home): the short suggestion
                      label dissolves out, then the next reveals left-to-right. */}
                    {isHomeStarter && !hasInput ? (
                      <span
                        aria-hidden
                        className={twMerge(
                          'pointer-events-none absolute left-6 top-6 whitespace-nowrap text-base leading-6 text-gray-500 dark:text-[#8f8f98]',
                          !reducedMotion &&
                            (placeholderShowing
                              ? 'home-prompt-ph-in'
                              : 'home-prompt-ph-out'),
                        )}
                      >
                        {currentSuggestion?.label}
                      </span>
                    ) : null}

                    {/* Home: the hint sits lateral to the prompt text (top-right);
                        once the user types, the gradient Go CTA replaces it. */}
                    {isHomeStarter ? (
                      <div className="absolute right-6 top-5 flex items-center">
                        {showActionSection ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={resetHomeBuilder}
                            className="rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-950/5 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                          >
                            <ArrowCounterClockwise className="h-3.5 w-3.5" />
                            Start over
                          </Button>
                        ) : isHomePayoffLoading ? (
                          <PixelSpinner
                            className="h-10 w-10"
                            loops={2}
                            onComplete={completeHomePayoff}
                          />
                        ) : !hasInput ? (
                          <span className="font-ds-display text-sm font-extralight text-gray-500 dark:text-[#8f8f98]">
                            Press Shift + Enter
                          </span>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            type="submit"
                            disabled={!canRevealOptions}
                            className="rounded-[11px] border-transparent bg-[linear-gradient(117deg,#ff5f5f,#ffa05c,#fff27c,#74dcff)] font-ds-display font-bold text-ds-neutral-500 shadow-md transition-[filter] hover:text-ds-neutral-500 hover:brightness-105 disabled:grayscale"
                          >
                            Go
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ) : null}

                    {!isHomeStarter && !showActionSection ? (
                      <div className="border-t border-gray-200 px-5 py-4 dark:border-gray-800">
                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            variant="secondary"
                            size="sm"
                            type="submit"
                            disabled={!canRevealOptions}
                            className="rounded-[11px] border-transparent bg-[linear-gradient(117deg,#ff5f5f,#ffa05c,#fff27c,#74dcff)] font-ds-display font-bold text-ds-neutral-500 shadow-md transition-[filter] hover:text-ds-neutral-500 hover:brightness-105 disabled:grayscale"
                          >
                            Go
                            <ArrowRight className="h-4 w-4" />
                            {enableHotkeys ? (
                              <SubmitShortcutHint
                                isMac={isMacShortcutPlatform}
                              />
                            ) : null}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <Collapsible open={showOptionsSection}>
                    <CollapsibleContent
                      className={twMerge(
                        isHomeStarter &&
                          'duration-[350ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                      )}
                    >
                      {showOptionsSection ? (
                        <div
                          className={twMerge(
                            'bg-gray-50/70 px-5 py-4 dark:bg-gray-900/50',
                            isHomeStarter &&
                              'bg-transparent dark:bg-transparent',
                          )}
                        >
                          <StarterTooltipProvider>
                            <div>
                              <div
                                className={twMerge(
                                  'mb-4',
                                  isHomeStarter &&
                                    !reducedMotion &&
                                    'home-stack-builder-section-reveal',
                                )}
                              >
                                <div className="font-ds-mono text-ds-mono-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                  TanStack Libraries
                                </div>

                                <div className="mt-3 space-y-2.5">
                                  <StarterLibraryRows
                                    revealedSelectionCount={
                                      stagedHomeSelectionCount
                                    }
                                    selectedLibraries={selectedLibraries}
                                    size={isHomeStarter ? 'large' : 'default'}
                                    toggleLibrary={toggleLibrary}
                                  />
                                </div>
                              </div>

                              <div
                                className={twMerge(
                                  isHomeStarter &&
                                    !reducedMotion &&
                                    'home-stack-builder-section-reveal home-stack-builder-section-reveal-delayed',
                                )}
                              >
                                <div className="font-ds-mono text-ds-mono-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                  Add Integrations
                                </div>
                                <div className="mt-3 w-full">
                                  <StarterPartnerRows
                                    palette={palette}
                                    partnerSuggestions={partnerSuggestions}
                                    revealedSelectionCount={
                                      stagedHomeSelectionCount === undefined
                                        ? undefined
                                        : Math.max(
                                            0,
                                            stagedHomeSelectionCount -
                                              selectedLibraries.length,
                                          )
                                    }
                                    selectedPartners={selectedPartners}
                                    size={isHomeStarter ? 'large' : 'compact'}
                                    togglePartner={togglePartner}
                                  />
                                </div>
                              </div>
                              <div
                                className={twMerge(
                                  isHomeStarter &&
                                    !reducedMotion &&
                                    'home-stack-builder-section-reveal home-stack-builder-section-reveal-third',
                                )}
                              >
                                <StarterCustomizationSection
                                  onOpenChange={setShowToolchainOptions}
                                  open={showToolchainOptions}
                                  title="Toolchain"
                                >
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {starterToolchains.map((toolchain) => (
                                      <StarterChipButton
                                        key={toolchain}
                                        onClick={() => {
                                          toggleToolchain(toolchain)
                                        }}
                                        palette={palette}
                                        selected={
                                          selectedToolchain === toolchain
                                        }
                                        size={
                                          isHomeStarter ? 'large' : 'compact'
                                        }
                                      >
                                        {toolchain}
                                      </StarterChipButton>
                                    ))}
                                  </div>
                                </StarterCustomizationSection>
                              </div>
                              <div
                                className={twMerge(
                                  isHomeStarter &&
                                    !reducedMotion &&
                                    'home-stack-builder-section-reveal home-stack-builder-section-reveal-fourth',
                                )}
                              >
                                <StarterCustomizationSection
                                  onOpenChange={setShowPackageManagerOptions}
                                  open={showPackageManagerOptions}
                                  title="Package Manager"
                                >
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {starterPackageManagers.map(
                                      (packageManager) => (
                                        <StarterChipButton
                                          key={packageManager}
                                          onClick={() => {
                                            togglePackageManager(packageManager)
                                          }}
                                          palette={palette}
                                          selected={
                                            selectedPackageManager ===
                                            packageManager
                                          }
                                          size={
                                            isHomeStarter ? 'large' : 'compact'
                                          }
                                        >
                                          {packageManager}
                                        </StarterChipButton>
                                      ),
                                    )}
                                  </div>
                                </StarterCustomizationSection>
                              </div>
                            </div>
                          </StarterTooltipProvider>

                          {footerContent ? (
                            <div className="mt-4">{footerContent}</div>
                          ) : null}
                        </div>
                      ) : null}
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible open={showStagedActionSection}>
                    <CollapsibleContent
                      className={twMerge(
                        isHomeStarter &&
                          'duration-[350ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                      )}
                    >
                      {showStagedActionSection ? (
                        <div
                          className={twMerge(
                            'bg-gray-50/70 px-5 py-4 dark:bg-gray-900/50',
                            isHomeStarter &&
                              'home-stack-builder-reveal home-stack-builder-reveal-delayed bg-transparent dark:bg-transparent',
                          )}
                        >
                          <div
                            className={twMerge(
                              'flex flex-col gap-4',
                              isHomeStarter && 'items-end',
                            )}
                          >
                            {!showCliExportActions ? (
                              <div className="flex flex-wrap items-center gap-3">
                                {!selectedHostingDeployPartner
                                  ? renderActionAnchor({
                                      action: 'netlify',
                                      className:
                                        'border-[#00AD9F] bg-[#00AD9F] text-white hover:bg-[#009a8e]',
                                      href: netlifyStartHref,
                                      icon: <Rocket className="h-4 w-4" />,
                                      label: secondaryActionLabel,
                                      onTrack: () => {
                                        trackActivation({
                                          action: 'netlify_start',
                                          surface: 'result_panel',
                                          provider: 'netlify',
                                        })
                                      },
                                      size: 'sm',
                                    })
                                  : null}

                                {renderActionAnchor({
                                  action: 'codex',
                                  className:
                                    'border-gray-900 bg-gray-900 text-white hover:bg-gray-800 dark:border-gray-100 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-gray-200',
                                  href: codexStartHref,
                                  icon: <OpenAiLogo className="h-4 w-4" />,
                                  label: 'Open in Codex',
                                  onTrack: () => {
                                    trackActivation({
                                      action: 'open_codex',
                                      surface: 'result_panel',
                                    })
                                  },
                                  size: 'sm',
                                })}
                              </div>
                            ) : null}

                            <div
                              className={twMerge(
                                'flex flex-wrap items-center gap-3',
                                isHomeStarter && 'justify-end',
                              )}
                            >
                              {renderSelectedHostingDeployButton()}
                              {showCliExportActions
                                ? renderCopyCliCommandButton()
                                : null}
                              {renderCopyPromptButton()}
                            </div>

                            {showCliExportActions ? (
                              <div
                                className={twMerge(
                                  'flex flex-wrap items-center gap-2',
                                  isHomeStarter && 'justify-end',
                                )}
                              >
                                {renderActionAnchor({
                                  action: 'codex',
                                  className:
                                    'text-text-secondary hover:text-text-primary',
                                  href: codexStartHref,
                                  icon: (
                                    <OpenAiLogo
                                      className="h-6 w-6"
                                      weight="regular"
                                    />
                                  ),
                                  iconOnly: true,
                                  label: 'Open in Codex',
                                  onTrack: () => {
                                    trackActivation({
                                      action: 'open_codex',
                                      surface: 'result_panel',
                                    })
                                  },
                                  size: 'xs',
                                })}

                                {renderActionAnchor({
                                  action: 'claude',
                                  className:
                                    'text-text-secondary hover:text-text-primary',
                                  href: claudeStartHref,
                                  icon: (
                                    <Atom
                                      className="h-6 w-6"
                                      weight="regular"
                                    />
                                  ),
                                  iconOnly: true,
                                  label: 'Open in Claude',
                                  onTrack: () => {
                                    trackActivation({
                                      action: 'open_claude',
                                      surface: 'result_panel',
                                    })
                                  },
                                  size: 'xs',
                                })}

                                {renderActionAnchor({
                                  action: 'cursor',
                                  className:
                                    'text-text-secondary hover:text-text-primary',
                                  href: cursorStartHref,
                                  icon: (
                                    <Cube
                                      className="h-6 w-6"
                                      weight="regular"
                                    />
                                  ),
                                  iconOnly: true,
                                  label: 'Open in Cursor',
                                  onTrack: () => {
                                    trackActivation({
                                      action: 'open_cursor',
                                      surface: 'result_panel',
                                    })
                                  },
                                  size: 'xs',
                                })}

                                <Tooltip
                                  content="Clone to GitHub"
                                  side="bottom"
                                >
                                  <Button
                                    variant="icon"
                                    color="gray"
                                    size="icon-sm"
                                    type="button"
                                    aria-label="Clone to GitHub"
                                    onClick={() => {
                                      showTransientActionFeedback('clone')
                                      void openDeployDialog(null)
                                    }}
                                    disabled={
                                      !canUseFinalActions ||
                                      transientAction === 'clone'
                                    }
                                    className="text-text-secondary hover:text-text-primary"
                                  >
                                    {transientAction === 'clone' ? (
                                      <CircleNotch className="h-6 w-6 animate-spin" />
                                    ) : (
                                      <GithubLogo
                                        className="h-6 w-6"
                                        weight="regular"
                                      />
                                    )}
                                  </Button>
                                </Tooltip>

                                {renderActionAnchor({
                                  action: 'download',
                                  className:
                                    'text-text-secondary hover:text-text-primary',
                                  href: downloadHref,
                                  icon: (
                                    <DownloadSimple
                                      className="h-6 w-6"
                                      weight="regular"
                                    />
                                  ),
                                  iconOnly: true,
                                  label: 'Download ZIP',
                                  onTrack: () => {
                                    trackActivation({
                                      action: 'download',
                                      surface: 'result_panel',
                                    })
                                  },
                                  size: 'xs',
                                  variant: 'secondary',
                                })}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </CollapsibleContent>
                  </Collapsible>

                  {showPromptPreview && hasGeneratedPrompt ? (
                    <div className="border-t border-gray-200 dark:border-gray-800">
                      <GeneratedPromptPreviewHeader
                        copiedPrompt={copiedKind === 'prompt'}
                        copyNotice={promptCopyNotice}
                        onDismissCopyNotice={dismissPromptCopyNotice}
                        onCopyPrompt={() => {
                          void copyResultValue('prompt')
                        }}
                      />
                      <GeneratedPromptPreviewBody
                        prompt={result?.prompt ?? ''}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}

          {compact ? submitButton : null}
        </form>
      </div>
    </div>
  )
}

function SubmitShortcutHint({ isMac }: { isMac: boolean }) {
  return (
    <span className="ml-1 inline-flex items-center gap-0.5">
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-white px-1 text-[10px] leading-none text-gray-950 dark:bg-gray-900 dark:text-white">
        {isMac ? '⌘' : '⌃'}
      </span>
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-white px-1 text-[10px] leading-none text-gray-950 dark:bg-gray-900 dark:text-white">
        ↵
      </span>
    </span>
  )
}

function StarterCustomizationSection({
  children,
  compact = false,
  onOpenChange,
  open,
  title,
}: {
  children: React.ReactNode
  compact?: boolean
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className={twMerge(compact ? 'pt-1' : 'pt-2')}>
        <CollapsibleTrigger
          className={twMerge(
            'inline-flex items-center gap-1 font-ds-mono text-ds-mono-xs uppercase tracking-wider text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300',
          )}
        >
          {title}
          <CaretDown
            className={twMerge(
              'h-3 w-3 transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>{open ? children : null}</CollapsibleContent>
      </div>
    </Collapsible>
  )
}
