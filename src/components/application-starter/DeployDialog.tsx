/**
 * Deploy Dialog Component
 *
 * Dialog for deploying a project to GitHub and then to a cloud provider.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  CircleNotchIcon,
  ArrowSquareOutIcon,
  WarningCircleIcon,
  CheckIcon,
  LockIcon,
  GlobeIcon,
  RocketIcon,
} from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import { useAsyncDebouncer } from '@tanstack/react-pacer'
import { Button, GitHub } from '~/ui'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogStatus,
} from '~/components/ds/ui'
import { useDeployAuth } from './useDeployAuth'
import {
  useFeatures,
  useFeatureOptions,
  useFramework,
  usePackageManager,
  useTailwind,
  useProjectName,
} from './store'
import {
  type DeployProvider,
  type DeployState,
  type RepoNameStatus,
  PROVIDER_INFO,
  checkRepoNameAvailability,
  validateRepoNameFormat,
} from '../deploy/shared'
import {
  getRecipeApplicationStarterFeatures,
  type ApplicationStarterRecipe,
} from '~/utils/application-starter'
import type { ApplicationStarterAction } from '~/utils/analytics'
import { compileApplicationStarterProject } from './client-generation'

interface DeployDialogProps {
  isOpen: boolean
  onClose: () => void
  provider?: DeployProvider | null
  starterRecipe?: ApplicationStarterRecipe | null
  /**
   * Fires `application_starter_activated` events with the parent's session context
   * (mode_used, idea_used). Optional so the dialog can render outside the
   * applicationStarter flow without an analytics trail.
   */
  onTrackActivation?: (params: {
    action: ApplicationStarterAction
    surface: 'deploy_dialog'
    provider?: string
    automatic?: boolean
  }) => void
}

export function DeployDialog({
  isOpen,
  onClose,
  provider,
  starterRecipe,
  onTrackActivation,
}: DeployDialogProps) {
  const auth = useDeployAuth()
  const applicationStarterFeatures = useFeatures()
  const applicationStarterFeatureOptions = useFeatureOptions()
  const applicationStarterFramework = useFramework()
  const applicationStarterPackageManager = usePackageManager()
  const applicationStarterTailwind = useTailwind()
  const applicationStarterProjectName = useProjectName()

  const features = starterRecipe
    ? getRecipeApplicationStarterFeatures(starterRecipe)
    : applicationStarterFeatures
  const featureOptions =
    starterRecipe?.featureOptions ?? applicationStarterFeatureOptions
  const framework = starterRecipe?.framework ?? applicationStarterFramework
  const packageManager =
    starterRecipe?.packageManager ?? applicationStarterPackageManager
  const tailwind = starterRecipe?.tailwind ?? applicationStarterTailwind
  const projectName =
    starterRecipe?.projectName ?? applicationStarterProjectName

  const [state, setState] = useState<DeployState>({ step: 'auth-check' })
  const [repoName, setRepoName] = useState(projectName)
  const [isPrivate, setIsPrivate] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [repoNameStatus, setRepoNameStatus] = useState<RepoNameStatus>('idle')
  const [repoNameError, setRepoNameError] = useState<string | null>(null)

  const providerInfo = provider ? PROVIDER_INFO[provider] : null

  const trackDialogLinkClick = useCallback(
    (
      action: 'repo' | 'provider_auto_redirect' | 'provider_manual_redirect',
    ) => {
      const applicationStarterAction: ApplicationStarterAction =
        action === 'repo'
          ? 'open_repo'
          : action === 'provider_auto_redirect'
            ? 'provider_redirect_auto'
            : 'provider_redirect_manual'
      onTrackActivation?.({
        action: applicationStarterAction,
        surface: 'deploy_dialog',
        provider: provider ?? undefined,
        automatic: action === 'provider_auto_redirect',
      })
    },
    [onTrackActivation, provider],
  )

  // Debounced repo name availability check
  const nameCheckDebouncer = useAsyncDebouncer(
    async (name: string) => {
      const result = await checkRepoNameAvailability(name)
      if (result.available) {
        setRepoNameStatus('available')
        setRepoNameError(null)
      } else {
        setRepoNameStatus('taken')
        setRepoNameError('Repository name already exists')
      }
    },
    {
      wait: 500,
      onError: () => {
        // On error, reset to idle (don't block the user)
        setRepoNameStatus('idle')
        setRepoNameError(null)
      },
    },
  )

  // Update repo name when project name changes
  useEffect(() => {
    setRepoName(projectName)
  }, [projectName])

  // Validate and check repo name
  useEffect(() => {
    // Reset error
    setRepoNameError(null)

    // Validate format first
    const validation = validateRepoNameFormat(repoName)
    if (!validation.valid) {
      setRepoNameStatus(validation.error ? 'invalid' : 'idle')
      setRepoNameError(validation.error ?? null)
      return
    }

    // Only check availability if authenticated with repo scope
    if (!auth.hasRepoScope) {
      setRepoNameStatus('idle')
      return
    }

    setRepoNameStatus('checking')
    nameCheckDebouncer.maybeExecute(repoName)
  }, [repoName, auth.hasRepoScope]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh auth state when dialog opens
  useEffect(() => {
    if (isOpen) {
      auth.refresh()
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check auth state when dialog opens or auth changes
  useEffect(() => {
    if (!isOpen) {
      setState({ step: 'auth-check' })
      setCountdown(null)
      return
    }

    if (auth.isLoading) {
      setState({ step: 'auth-check' })
      return
    }

    if (!auth.authenticated || !auth.hasGitHubAccount || !auth.hasRepoScope) {
      setState({ step: 'needs-auth' })
      return
    }

    setState({ step: 'form' })
  }, [
    isOpen,
    auth.isLoading,
    auth.authenticated,
    auth.hasGitHubAccount,
    auth.hasRepoScope,
  ])

  // Auto-redirect countdown (only when there's a provider)
  useEffect(() => {
    if (state.step !== 'success' || countdown === null || !providerInfo) return

    if (countdown <= 0) {
      // Redirect to provider deploy page
      setCountdown(null) // Prevent double-open
      const deployUrl = providerInfo.deployUrl(state.owner, state.repoName)
      trackDialogLinkClick('provider_auto_redirect')
      window.open(deployUrl, '_blank')
      return
    }

    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, onClose, providerInfo, state, trackDialogLinkClick])

  const handleDeploy = useCallback(async () => {
    setState({ step: 'deploying', message: 'Generating project...' })

    try {
      const files = await compileApplicationStarterProject({
        name: projectName,
        framework,
        packageManager,
        tailwind,
        features,
        featureOptions,
      })

      setState({ step: 'deploying', message: 'Creating repository...' })

      const response = await fetch('/api/application-starter/deploy/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoName,
          isPrivate,
          projectName,
          framework,
          packageManager,
          features,
          featureOptions,
          tailwind,
          files,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        setState({
          step: 'error',
          message: data.error ?? 'Deployment failed',
          code: data.code,
        })
        return
      }

      setState({
        step: 'success',
        repoUrl: data.repoUrl,
        owner: data.owner,
        repoName: data.repoName,
      })
      // Only start countdown if there's a provider to redirect to
      if (providerInfo) {
        setCountdown(3)
      }
    } catch (error) {
      setState({
        step: 'error',
        message: error instanceof Error ? error.message : 'Deployment failed',
      })
    }
  }, [
    repoName,
    isPrivate,
    projectName,
    framework,
    packageManager,
    features,
    featureOptions,
    tailwind,
    providerInfo,
  ])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader
          title={
            providerInfo
              ? `Deploy to ${providerInfo.name}`
              : 'Create GitHub Repository'
          }
          description={
            providerInfo
              ? 'Create a GitHub repo and deploy'
              : 'Push your project to GitHub'
          }
          media={
            providerInfo ? (
              <RocketIcon className="w-5 h-5 text-white" />
            ) : (
              <GitHub className="w-5 h-5 text-white" />
            )
          }
          tint={providerInfo ? providerInfo.color : '#332d24'}
        />

        <DialogBody className="py-6">
          <div key={state.step} data-ds-dialog-step="">
            {state.step === 'auth-check' && (
              <DialogStatus
                tone="loading"
                description="Checking authentication..."
              />
            )}

            {state.step === 'needs-auth' && (
              <DialogStatus
                tone="neutral"
                icon={<GitHub />}
                title="GitHub Authorization Required"
                description="To deploy, we need permission to create repositories on your GitHub account."
                actions={
                  <Button
                    variant="primary"
                    onClick={auth.redirectToGitHubAuth}
                    className="gap-2"
                  >
                    <GitHub className="w-4 h-4" />
                    Connect GitHub
                  </Button>
                }
              />
            )}

            {state.step === 'form' && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="repo-name"
                    className="block text-sm font-medium text-text-secondary mb-1.5"
                  >
                    Repository Name
                  </label>
                  <div className="relative">
                    <input
                      id="repo-name"
                      type="text"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder="my-tanstack-app"
                      aria-invalid={
                        repoNameStatus === 'taken' ||
                        repoNameStatus === 'invalid'
                      }
                      aria-describedby={
                        repoNameError ? 'repo-name-error' : undefined
                      }
                      className={twMerge(
                        'w-full px-3 py-2 pr-9 text-sm bg-background-default border rounded-lg focus:outline-none focus:ring-2',
                        repoNameStatus === 'taken' ||
                          repoNameStatus === 'invalid'
                          ? 'border-border-error focus:ring-status-error'
                          : repoNameStatus === 'available'
                            ? 'border-border-success focus:ring-status-success'
                            : 'border-border-default focus:ring-border-focus',
                      )}
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      {repoNameStatus === 'checking' && (
                        <CircleNotchIcon className="w-4 h-4 animate-spin text-icon-muted" />
                      )}
                      {repoNameStatus === 'available' && (
                        <CheckIcon className="w-4 h-4 text-icon-success" />
                      )}
                      {(repoNameStatus === 'taken' ||
                        repoNameStatus === 'invalid') && (
                        <WarningCircleIcon className="w-4 h-4 text-icon-error" />
                      )}
                    </div>
                  </div>
                  {repoNameError && (
                    <p
                      id="repo-name-error"
                      className="mt-1 text-xs text-text-error"
                    >
                      {repoNameError}
                    </p>
                  )}
                </div>

                <div>
                  <span className="block text-sm font-medium text-text-secondary mb-1.5">
                    Visibility
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsPrivate(false)}
                      aria-pressed={!isPrivate}
                      className={twMerge(
                        'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                        !isPrivate
                          ? 'bg-status-info-bg border-border-focus text-text-accent'
                          : 'bg-background-default border-border-default text-text-secondary hover:bg-surface-state-hover',
                      )}
                    >
                      <GlobeIcon className="w-4 h-4" />
                      Public
                    </button>
                    <button
                      onClick={() => setIsPrivate(true)}
                      aria-pressed={isPrivate}
                      className={twMerge(
                        'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                        isPrivate
                          ? 'bg-status-info-bg border-border-focus text-text-accent'
                          : 'bg-background-default border-border-default text-text-secondary hover:bg-surface-state-hover',
                      )}
                    >
                      <LockIcon className="w-4 h-4" />
                      Private
                    </button>
                  </div>
                </div>

                {features.length > 0 && (
                  <div className="text-xs text-text-muted bg-background-subtle rounded-lg p-3">
                    <span className="font-medium">Integrations: </span>
                    {features.join(', ')}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="secondary"
                    onClick={onClose}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleDeploy}
                    disabled={
                      !repoName.trim() ||
                      repoNameStatus === 'taken' ||
                      repoNameStatus === 'invalid' ||
                      repoNameStatus === 'checking'
                    }
                    className="flex-1 gap-2"
                  >
                    <GitHub className="w-4 h-4" />
                    {providerInfo ? 'Create & Deploy' : 'Create Repository'}
                  </Button>
                </div>
              </div>
            )}

            {state.step === 'deploying' && (
              <DialogStatus tone="loading" description={state.message} />
            )}

            {state.step === 'success' && (
              <DialogStatus
                tone="success"
                icon={<CheckIcon />}
                title="Repository Created!"
                actions={
                  providerInfo ? (
                    <Button
                      as="a"
                      variant="primary"
                      href={providerInfo.deployUrl(state.owner, state.repoName)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        setCountdown(null) // Cancel auto-redirect
                        trackDialogLinkClick('provider_manual_redirect')
                      }}
                      className="gap-2"
                      style={{ backgroundColor: providerInfo.color }}
                    >
                      <RocketIcon className="w-4 h-4" />
                      Deploy Now
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={onClose}>
                      Done
                    </Button>
                  )
                }
              >
                <a
                  href={state.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackDialogLinkClick('repo')
                  }}
                  className="text-sm text-text-accent hover:underline flex items-center gap-1"
                >
                  {state.owner}/{state.repoName}
                  <ArrowSquareOutIcon className="w-3 h-3" />
                </a>
                {providerInfo && countdown !== null && countdown > 0 && (
                  <p className="mt-4 text-sm text-text-muted">
                    Redirecting to {providerInfo.name} in {countdown}state...
                  </p>
                )}
              </DialogStatus>
            )}

            {state.step === 'error' && (
              <DialogStatus
                tone="error"
                icon={<WarningCircleIcon />}
                title="Deployment Failed"
                description={state.message}
                actions={
                  <>
                    <Button variant="secondary" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => setState({ step: 'form' })}
                    >
                      Try Again
                    </Button>
                  </>
                }
              />
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
