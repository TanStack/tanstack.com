/**
 * Example Deploy Dialog Component
 *
 * Dialog for deploying a library example to GitHub and then to a cloud provider.
 * Based on the builder's DeployDialog but fetches example files instead of compiling.
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
import { useDeployAuth } from './application-starter/useDeployAuth'
import {
  type DeployProvider,
  type DeployState,
  type RepoNameStatus,
  PROVIDER_INFO,
  checkRepoNameAvailability,
  validateRepoNameFormat,
} from './deploy/shared'

export type { DeployProvider }

interface ExampleDeployDialogProps {
  isOpen: boolean
  onClose: () => void
  provider: DeployProvider
  repo: string
  branch: string
  examplePath: string
  exampleName: string
  libraryName: string
}

function generateDefaultRepoName(examplePath: string): string {
  const parts = examplePath.split('/')
  return parts[parts.length - 1] || 'my-tanstack-app'
}

export function ExampleDeployDialog({
  isOpen,
  onClose,
  provider,
  repo,
  branch,
  examplePath,
  exampleName,
  libraryName,
}: ExampleDeployDialogProps) {
  const auth = useDeployAuth()
  const providerInfo = PROVIDER_INFO[provider]

  const defaultRepoName = generateDefaultRepoName(examplePath)
  const [state, setState] = useState<DeployState>({ step: 'auth-check' })
  const [repoName, setRepoName] = useState(defaultRepoName)
  const [isPrivate, setIsPrivate] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [repoNameStatus, setRepoNameStatus] = useState<RepoNameStatus>('idle')
  const [repoNameError, setRepoNameError] = useState<string | null>(null)

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
        setRepoNameStatus('idle')
        setRepoNameError(null)
      },
    },
  )

  // Reset repo name when dialog opens with new example
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRepoName(defaultRepoName)
    }
  }, [isOpen, defaultRepoName])

  // Validate and check repo name
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRepoNameError(null)

    const validation = validateRepoNameFormat(repoName)
    if (!validation.valid) {
      setRepoNameStatus(validation.error ? 'invalid' : 'idle')
      setRepoNameError(validation.error ?? null)
      return
    }

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Auto-redirect countdown
  useEffect(() => {
    if (state.step !== 'success' || countdown === null) return

    if (countdown <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCountdown(null)
      const deployUrl = providerInfo.deployUrl(state.owner, state.repoName)
      window.open(deployUrl, '_blank')
      return
    }

    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [state, countdown, providerInfo])

  const handleDeploy = useCallback(async () => {
    setState({ step: 'deploying', message: 'Fetching example files...' })

    try {
      const response = await fetch('/api/example/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoName,
          isPrivate,
          sourceRepo: repo,
          branch,
          examplePath,
          provider,
          libraryName,
          exampleName,
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
      setCountdown(3)
    } catch (error) {
      setState({
        step: 'error',
        message: error instanceof Error ? error.message : 'Deployment failed',
      })
    }
  }, [
    repoName,
    isPrivate,
    repo,
    branch,
    examplePath,
    provider,
    libraryName,
    exampleName,
  ])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader
          title={`Deploy to ${providerInfo.name}`}
          description={exampleName}
          media={<RocketIcon className="w-5 h-5 text-white" />}
          tint={providerInfo.color}
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
                description="To deploy this example, we need permission to create a repository on your GitHub account."
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

                <div className="text-xs text-text-muted bg-background-subtle rounded-lg p-3">
                  <span className="font-medium">Source: </span>
                  {libraryName} / {examplePath}
                </div>

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
                    Create & Deploy
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
                  <Button
                    variant="primary"
                    onClick={() => {
                      setCountdown(null)
                      const deployUrl = providerInfo.deployUrl(
                        state.owner,
                        state.repoName,
                      )
                      window.open(deployUrl, '_blank')
                    }}
                    className="gap-2"
                    style={{ backgroundColor: providerInfo.color }}
                  >
                    <RocketIcon className="w-4 h-4" />
                    Deploy Now
                  </Button>
                }
              >
                <a
                  href={state.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-text-accent hover:underline flex items-center gap-1"
                >
                  {state.owner}/{state.repoName}
                  <ArrowSquareOutIcon className="w-3 h-3" />
                </a>
                {countdown !== null && countdown > 0 && (
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
