import * as React from 'react'
import { ClientOnly } from '@tanstack/react-router'
import {
  ChevronDown,
  Copy,
  Download,
  Loader2,
  Rocket,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import anthropicDarkLogo from '~/images/anthropic-dark.svg'
import anthropicLightLogo from '~/images/anthropic-light.svg'
import openaiDarkLogo from '~/images/openai-dark.svg'
import openaiLightLogo from '~/images/openai-light.svg'
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
  toneClasses,
  type ApplicationStarterBuilderIntegration,
  type StarterTone,
} from '~/components/application-builder/shared'
import { useApplicationBuilder } from '~/components/application-builder/useApplicationBuilder'
import { Button, GitHub } from '~/ui'
import { trackPostHogEvent } from '~/utils/posthog'

export interface ApplicationStarterProps {
  alwaysShowPostAnalysisSection?: boolean
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
  primaryButtonColor?: 'cyan' | 'emerald' | 'purple' | 'yellow'
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

export function ApplicationStarter({
  alwaysShowPostAnalysisSection = false,
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
  primaryActionLabel = 'Generate Prompt',
  primaryButtonColor,
  secondaryActionLabel = 'Build with Netlify',
  showCliExportActions = true,
  showPromptPreview = true,
  suggestionContext,
  submitButton,
  title = 'What would you like to build?',
  tone = 'cyan',
}: ApplicationStarterProps) {
  const {
    analysis,
    analyticsProperties,
    anonymousGenerationQuota,
    copiedKind,
    copyResultValue,
    dismissPromptCopyNotice,
    deployDialogProvider,
    enableLuckyActions,
    generatePrompt,
    hasGeneratedPrompt,
    hasFreshAnalysis,
    hasInput,
    hasMigrationRepositoryUrlError,
    impressionRef,
    input,
    isDeployDialogOpen,
    isAnalysisStale,
    isAnalyzing,
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
    promptCopyNotice,
    result,
    selectSuggestion,
    selectedPackageManager,
    selectedLibraries,
    selectedPartners,
    selectedToolchain,
    setIsDeployDialogOpen,
    setIsModHeld,
    showMigrationRepositoryInput,
    showLuckyActions,
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
    suggestionContext,
  })

  const palette = toneClasses[tone]
  const compact = mode === 'compact'
  const buttonColor = primaryButtonColor ?? palette.button
  const [showMoreActions, setShowMoreActions] = React.useState(false)
  const [hasFocusedPromptInput, setHasFocusedPromptInput] =
    React.useState(false)
  const [isPromptFocused, setIsPromptFocused] = React.useState(false)
  const [isMacShortcutPlatform, setIsMacShortcutPlatform] =
    React.useState(false)
  const [showConfidentOptions, setShowConfidentOptions] = React.useState(false)
  const [showPackageManagerOptions, setShowPackageManagerOptions] =
    React.useState(false)
  const [showToolchainOptions, setShowToolchainOptions] = React.useState(
    alwaysShowPostAnalysisSection,
  )
  const canContinue =
    hasInput && !hasMigrationRepositoryUrlError && !isGenerating
  const canUseLuckyAction =
    hasInput &&
    !hasMigrationRepositoryUrlError &&
    !isGenerating &&
    (!showLuckyActions || isAnalysisStale)
  const canUseConfidentAction =
    alwaysShowPostAnalysisSection &&
    hasInput &&
    !hasMigrationRepositoryUrlError &&
    !isGenerating &&
    !hasFreshAnalysis &&
    !hasGeneratedPrompt &&
    !showConfidentOptions
  const canUseFinalActions =
    (hasFreshAnalysis || showLuckyActions || showConfidentOptions) &&
    hasInput &&
    !hasMigrationRepositoryUrlError &&
    !isGenerating
  const showPostAnalysisSection =
    alwaysShowPostAnalysisSection || hasFreshAnalysis || hasGeneratedPrompt
  const showActionSection =
    alwaysShowPostAnalysisSection || hasFreshAnalysis || showLuckyActions
  const postAnalysisSectionDisabled =
    !hasFreshAnalysis && !hasGeneratedPrompt && !showConfidentOptions
  const actionSectionDisabled =
    alwaysShowPostAnalysisSection &&
    !hasFreshAnalysis &&
    !showLuckyActions &&
    !showConfidentOptions
  const analysisMessage = isAnalysisStale
    ? 'Prompt changed. Analyze again to refresh recommendations.'
    : analysis
      ? 'Review or adjust the selected chips below, then generate the final prompt.'
      : null

  React.useEffect(() => {
    if (typeof navigator === 'undefined') {
      return
    }

    setIsMacShortcutPlatform(/Mac|iPhone|iPad|iPod/i.test(navigator.platform))
  }, [])

  return (
    <div ref={impressionRef} className={twMerge('relative', className)}>
      {enableHotkeys && !compact && hasFocusedPromptInput ? (
        <ClientOnly>
          <React.Suspense fallback={null}>
            <LazyApplicationStarterHotkeys
              onAnalyze={() => {
                void submitCurrentInput()
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
          onSubmit={async (event) => {
            event.preventDefault()
            await submitCurrentInput()
          }}
        >
          {compact ? (
            <>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-800">
                  <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
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
                    <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
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
                  <div className="px-3 pt-2 text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
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

                <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-800">
                  <Button
                    color={buttonColor}
                    className="pr-1"
                    size="xs"
                    type="submit"
                    disabled={!canContinue}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    {isAnalyzing ? (
                      loadingPhrase
                    ) : (
                      <>
                        Analyze
                        {enableHotkeys ? (
                          <AnalyzeShortcutHint isMac={isMacShortcutPlatform} />
                        ) : null}
                      </>
                    )}
                  </Button>
                  {analysisMessage ? (
                    <div className="mt-2 text-[11px] leading-5 text-gray-500 dark:text-gray-400">
                      {analysisMessage}
                    </div>
                  ) : null}
                </div>
              </div>

              <Collapsible open={showPostAnalysisSection}>
                <CollapsibleContent className="mt-3">
                  <StarterTooltipProvider>
                    <div
                      className={twMerge(
                        'space-y-2 rounded-lg border border-gray-200 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-950',
                        postAnalysisSectionDisabled &&
                          'pointer-events-none opacity-55 saturate-50',
                      )}
                    >
                      <div className="mb-3">
                        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
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

                      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
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
                      <AnonymousGenerationLimitNotice
                        quota={anonymousGenerationQuota}
                      />
                    </div>
                  </StarterTooltipProvider>
                </CollapsibleContent>
              </Collapsible>
            </>
          ) : (
            <div className="relative overflow-hidden rounded-[1rem] border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
              {isLocked ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75 p-6 backdrop-blur-sm dark:bg-gray-950/75">
                  <div className="max-w-sm rounded-2xl border border-gray-200 bg-white p-5 text-center shadow-lg dark:border-gray-800 dark:bg-gray-900">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      Sign in to unlock more generations
                    </div>
                    <div className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                      {lockMessage ||
                        'Anonymous generations are limited. Sign in to keep going.'}
                    </div>
                    <div className="mt-4 flex justify-center">
                      <Button
                        color={buttonColor}
                        size="sm"
                        type="button"
                        onClick={() => {
                          openLogin()
                        }}
                      >
                        <GitHub className="h-4 w-4" />
                        Sign in to continue
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div
                className={twMerge(
                  isLocked && 'blur-sm pointer-events-none select-none',
                )}
              >
                <div className="border-b border-gray-200 bg-gray-50/70 px-5 py-4 dark:border-gray-800 dark:bg-gray-900/50">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold tracking-[-0.04em] text-[1.375rem] md:text-[1.5rem] text-gray-950 dark:text-white">
                      {title}
                    </h3>
                    {headerAction ? (
                      <div className="shrink-0">{headerAction}</div>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                      <StarterChipButton
                        key={suggestion.label}
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

                <div className="relative border-b border-gray-200 dark:border-gray-800">
                  {showMigrationRepositoryInput ? (
                    <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
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

                  <div className="px-5 pt-4 text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
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
                    onClick={(event) => {
                      if (enableHotkeys && isModHeld) {
                        event.preventDefault()
                        void generatePrompt()
                      }
                    }}
                    rows={4}
                    placeholder="Build a SaaS app with auth, Postgres, nested routes, and Sentry. Use pnpm and deploy to Cloudflare."
                    className={twMerge(
                      'w-full min-h-28 bg-transparent px-5 pb-4 pt-1 text-sm leading-6 text-gray-900 outline-none transition-colors dark:text-white',
                      palette.ring,
                    )}
                  />

                  <div className="border-t border-gray-200 px-5 py-4 dark:border-gray-800">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        color={buttonColor}
                        className="pr-1.5"
                        variant={showActionSection ? 'secondary' : 'primary'}
                        size="sm"
                        type="submit"
                        disabled={!canContinue}
                      >
                        {isAnalyzing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
                        )}
                        {isAnalyzing ? (
                          loadingPhrase
                        ) : (
                          <>
                            Analyze
                            {enableHotkeys ? (
                              <AnalyzeShortcutHint
                                isMac={isMacShortcutPlatform}
                              />
                            ) : null}
                          </>
                        )}
                      </Button>
                      {!showActionSection ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          type="button"
                          onClick={() => {
                            trackPostHogEvent(
                              'application_starter_action_clicked',
                              {
                                ...analyticsProperties,
                                action: 'lucky_mode',
                                surface: 'application_starter',
                              },
                            )
                            enableLuckyActions()
                          }}
                          disabled={!canUseLuckyAction}
                        >
                          <Sparkles className="h-4 w-4" />
                          I'm feeling lucky
                        </Button>
                      ) : null}
                      {canUseConfidentAction ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          type="button"
                          onClick={() => {
                            trackPostHogEvent(
                              'application_starter_action_clicked',
                              {
                                ...analyticsProperties,
                                action: 'confident_mode',
                                surface: 'application_starter',
                              },
                            )
                            setShowConfidentOptions(true)
                          }}
                        >
                          <Sparkles className="h-4 w-4" />
                          I'm feeling confident
                        </Button>
                      ) : null}
                      {analysisMessage ? (
                        <div className="text-xs leading-5 text-gray-500 dark:text-gray-400">
                          {analysisMessage}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <Collapsible open={showPostAnalysisSection}>
                  <CollapsibleContent>
                    <div
                      className={twMerge(
                        'bg-gray-50/70 px-5 py-4 dark:bg-gray-900/50',
                        postAnalysisSectionDisabled && 'opacity-55 saturate-50',
                      )}
                    >
                      <StarterTooltipProvider>
                        <div
                          className={twMerge(
                            postAnalysisSectionDisabled &&
                              'pointer-events-none',
                          )}
                        >
                          <div className="mb-4">
                            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                              TanStack Libraries
                            </div>

                            <div className="mt-3 space-y-2.5">
                              <StarterLibraryRows
                                selectedLibraries={selectedLibraries}
                                toggleLibrary={toggleLibrary}
                              />
                            </div>
                          </div>

                          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                            Add Integrations
                          </div>
                          <div className="mt-3">
                            <StarterPartnerRows
                              palette={palette}
                              partnerSuggestions={partnerSuggestions}
                              selectedPartners={selectedPartners}
                              size="compact"
                              togglePartner={togglePartner}
                            />
                          </div>
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
                                  selected={selectedToolchain === toolchain}
                                  size="compact"
                                >
                                  {toolchain}
                                </StarterChipButton>
                              ))}
                            </div>
                          </StarterCustomizationSection>
                          <StarterCustomizationSection
                            onOpenChange={setShowPackageManagerOptions}
                            open={showPackageManagerOptions}
                            title="Package Manager"
                          >
                            <div className="mt-3 flex flex-wrap gap-2">
                              {starterPackageManagers.map((packageManager) => (
                                <StarterChipButton
                                  key={packageManager}
                                  onClick={() => {
                                    togglePackageManager(packageManager)
                                  }}
                                  palette={palette}
                                  selected={
                                    selectedPackageManager === packageManager
                                  }
                                  size="compact"
                                >
                                  {packageManager}
                                </StarterChipButton>
                              ))}
                            </div>
                          </StarterCustomizationSection>
                        </div>
                      </StarterTooltipProvider>

                      <AnonymousGenerationLimitNotice
                        quota={anonymousGenerationQuota}
                      />

                      {footerContent ? (
                        <div className="mt-4">{footerContent}</div>
                      ) : null}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={showActionSection}>
                  <CollapsibleContent>
                    <div
                      className={twMerge(
                        'bg-gray-50/70 px-5 py-4 dark:bg-gray-900/50',
                        actionSectionDisabled && 'opacity-55 saturate-50',
                      )}
                    >
                      <div
                        className={twMerge(
                          'flex flex-col gap-4',
                          actionSectionDisabled && 'pointer-events-none',
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            color={buttonColor}
                            variant={
                              hasGeneratedPrompt ? 'secondary' : 'primary'
                            }
                            size="sm"
                            type="button"
                            onClick={() => void generatePrompt()}
                            disabled={!canUseFinalActions}
                          >
                            {isGeneratingPrompt ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Wand2 className="h-4 w-4" />
                            )}
                            {isGeneratingPrompt
                              ? loadingPhrase
                              : primaryActionLabel}
                          </Button>

                          {showCliExportActions ? (
                            <>
                              <Button
                                size="sm"
                                type="button"
                                onClick={() => {
                                  void openDeployDialog('cloudflare')
                                }}
                                disabled={!canUseFinalActions}
                                className="border-[#F48120] bg-[#F48120] text-white hover:bg-[#E67210]"
                              >
                                <Rocket className="h-4 w-4" />
                                Deploy to Cloudflare
                              </Button>

                              <Button
                                size="sm"
                                type="button"
                                onClick={() => void openNetlifyStart()}
                                disabled={!canUseFinalActions}
                                className="border-[#00AD9F] bg-[#00AD9F] text-white hover:bg-[#009a8e]"
                              >
                                {isGeneratingNetlify ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Rocket className="h-4 w-4" />
                                )}
                                {secondaryActionLabel}
                              </Button>

                              <Button
                                size="sm"
                                type="button"
                                onClick={() => {
                                  void openDeployDialog('railway')
                                }}
                                disabled={!canUseFinalActions}
                                className="border-[#7C66FF] bg-[#7C66FF] text-white hover:bg-[#6A54F0]"
                              >
                                <Rocket className="h-4 w-4" />
                                Deploy to Railway
                              </Button>

                              {!showMoreActions ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  type="button"
                                  onClick={() => setShowMoreActions(true)}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                  Show More
                                </Button>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                type="button"
                                onClick={() => void openNetlifyStart()}
                                disabled={!canUseFinalActions}
                                className="border-[#00AD9F] bg-[#00AD9F] text-white hover:bg-[#009a8e]"
                              >
                                {isGeneratingNetlify ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Rocket className="h-4 w-4" />
                                )}
                                {secondaryActionLabel}
                              </Button>

                              <Button
                                size="sm"
                                type="button"
                                onClick={() => void openCodexStart()}
                                disabled={!canUseFinalActions}
                                className="border-gray-900 bg-gray-900 text-white hover:bg-gray-800 dark:border-gray-100 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-gray-200"
                              >
                                <span className="relative h-4 w-4 shrink-0">
                                  <img
                                    src={openaiDarkLogo}
                                    alt=""
                                    aria-hidden="true"
                                    className="h-4 w-4 dark:hidden"
                                  />
                                  <img
                                    src={openaiLightLogo}
                                    alt=""
                                    aria-hidden="true"
                                    className="hidden h-4 w-4 dark:block"
                                  />
                                </span>
                                Open in Codex
                              </Button>
                            </>
                          )}
                        </div>

                        {showCliExportActions && showMoreActions ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="xs"
                              type="button"
                              onClick={() => void openCodexStart()}
                              disabled={!canUseFinalActions}
                              className="h-6 gap-1 px-2 text-[11px] border-gray-900 bg-gray-900 text-white hover:bg-gray-800 dark:border-gray-100 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-gray-200"
                            >
                              <span className="relative h-3 w-3 shrink-0">
                                <img
                                  src={openaiDarkLogo}
                                  alt=""
                                  aria-hidden="true"
                                  className="h-3 w-3 dark:hidden"
                                />
                                <img
                                  src={openaiLightLogo}
                                  alt=""
                                  aria-hidden="true"
                                  className="hidden h-3 w-3 dark:block"
                                />
                              </span>
                              Open in Codex
                            </Button>

                            <Button
                              size="xs"
                              type="button"
                              onClick={() => void openClaudeStart()}
                              disabled={!canUseFinalActions}
                              className="h-6 gap-1 px-2 text-[11px] border-[#D4A373] bg-[#D4A373] text-white hover:bg-[#C6905C] dark:border-[#E6C49A] dark:bg-[#E6C49A] dark:text-gray-950 dark:hover:bg-[#DBB684]"
                            >
                              <span className="relative h-3 w-3 shrink-0">
                                <img
                                  src={anthropicDarkLogo}
                                  alt=""
                                  aria-hidden="true"
                                  className="h-3 w-3 dark:hidden"
                                />
                                <img
                                  src={anthropicLightLogo}
                                  alt=""
                                  aria-hidden="true"
                                  className="hidden h-3 w-3 dark:block"
                                />
                              </span>
                              Open in Claude
                            </Button>

                            <Button
                              size="xs"
                              type="button"
                              onClick={() => void openCursorStart()}
                              disabled={!canUseFinalActions}
                              className="h-6 gap-1 px-2 text-[11px] border-black bg-black text-white hover:bg-gray-900 dark:border-white dark:bg-white dark:text-black dark:hover:bg-gray-100"
                            >
                              <CursorIcon className="h-3 w-3" />
                              Open in Cursor
                            </Button>

                            <Button
                              variant="secondary"
                              size="xs"
                              type="button"
                              onClick={() => {
                                void copyResultValue('command')
                              }}
                              disabled={!canUseFinalActions}
                              className="h-6 gap-1 px-2 text-[11px]"
                            >
                              <Copy className="h-3 w-3" />
                              Copy CLI Command
                            </Button>

                            <Button
                              variant="secondary"
                              size="xs"
                              type="button"
                              onClick={() => {
                                void openDeployDialog(null)
                              }}
                              disabled={!canUseFinalActions}
                              className="h-6 gap-1 px-2 text-[11px]"
                            >
                              <GitHub className="h-3 w-3" />
                              Clone to GitHub
                            </Button>

                            <Button
                              variant="secondary"
                              size="xs"
                              type="button"
                              onClick={() => {
                                void navigateToResult('download')
                              }}
                              disabled={!canUseFinalActions}
                              className="h-6 gap-1 px-2 text-[11px]"
                            >
                              <Download className="h-3 w-3" />
                              Download ZIP
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
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
                    <GeneratedPromptPreviewBody prompt={result?.prompt ?? ''} />
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {compact ? submitButton : null}
        </form>
      </div>
    </div>
  )
}

function CursorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M22.106 5.68 12.5.135a.998.998 0 0 0-.998 0L1.893 5.68a.84.84 0 0 0-.419.726v11.186c0 .3.16.577.42.727l9.607 5.547a.999.999 0 0 0 .998 0l9.608-5.547a.84.84 0 0 0 .42-.727V6.407a.84.84 0 0 0-.42-.726Zm-.603 1.176-9.275 16.064c-.063.108-.228.064-.228-.061V12.34a.59.59 0 0 0-.295-.51l-9.11-5.26c-.107-.062-.063-.228.062-.228h18.55c.264 0 .428.286.296.514Z" />
    </svg>
  )
}

function AnalyzeShortcutHint({ isMac }: { isMac: boolean }) {
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
            'inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300',
            compact && 'text-[10px]',
          )}
        >
          {title}
          <ChevronDown
            className={twMerge(
              'h-3 w-3 transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>{children}</CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function AnonymousGenerationLimitNotice({
  quota,
}: {
  quota: {
    limit: number
    remaining: number
    resetAt: string
  } | null
}) {
  if (!quota) {
    return null
  }

  if (quota.limit >= 1_000_000) {
    return null
  }

  return (
    <div className="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">
      {quota.remaining > 0
        ? `${quota.remaining} anonymous generation${quota.remaining === 1 ? '' : 's'} left today.`
        : 'No anonymous generations left today.'}{' '}
      <span className="text-gray-700 dark:text-gray-300">
        Sign in to remove the limit.
      </span>
    </div>
  )
}
