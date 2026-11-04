import { LoadingState } from './ui/LoadingState'
import { useEffect, useId, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import {
  onboardingInputSchema,
  onboardingSchema,
  type Onboarding as OnboardingSnapshot,
  type OnboardingInput,
} from '../core/onboarding'
import { ApiError, workspaceApi } from './WorkspaceApi'
import { IconButton } from './IconButton'
import { useSidebarDensity, type SidebarDensity } from './sidebar-density'
import './onboarding.css'

const accountApi = workspaceApi()
const uses = [
  ['everyday', 'Everyday'],
  ['work', 'Work'],
  ['building', 'Building software'],
] as const

export const accountOnboardingKey = (userId: string) =>
  ['account-onboarding', userId] as const

export function mergeAccountOnboarding(
  previous: OnboardingSnapshot | undefined,
  incoming: OnboardingSnapshot,
) {
  return previous && previous.revision > incoming.revision ? previous : incoming
}

export function accountOnboardingQueryOptions(userId: string) {
  return {
    queryKey: accountOnboardingKey(userId),
    queryFn: async () =>
      onboardingSchema.parse(await accountApi.request('account/onboarding')),
    staleTime: 0,
    retry: false,
    structuralSharing: (previous: unknown, incoming: unknown) =>
      mergeAccountOnboarding(
        previous as OnboardingSnapshot | undefined,
        incoming as OnboardingSnapshot,
      ),
  }
}

export function useAccountOnboarding(userId: string) {
  return useQuery(accountOnboardingQueryOptions(userId))
}

export async function saveAccountOnboarding(input: OnboardingInput) {
  return onboardingSchema.parse(
    await accountApi.request(
      'account/onboarding',
      onboardingInputSchema.parse(input),
    ),
  )
}

export function densityForUse(
  useCase: OnboardingSnapshot['useCase'],
): SidebarDensity | undefined {
  return useCase === 'building'
    ? 'compact'
    : useCase === null
      ? undefined
      : 'comfortable'
}

const accessDenied = (error: unknown) =>
  error instanceof ApiError && [401, 403, 404].includes(error.status)
const definiteRejection = (error: unknown) =>
  error instanceof ApiError &&
  error.status >= 400 &&
  error.status < 500 &&
  ![408, 429].includes(error.status)
const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

type SavedCallback = (snapshot: OnboardingSnapshot) => void | Promise<void>
export interface OnboardingProps {
  userId: string
  snapshot: OnboardingSnapshot
  onSaved: SavedCallback
  onCancel?: () => void
  compact?: boolean
}

export function Onboarding(props: OnboardingProps) {
  return (
    <OnboardingForm
      key={`${props.userId}:${props.snapshot.workspaceId}`}
      {...props}
    />
  )
}

function OnboardingForm({
  userId,
  snapshot,
  onSaved,
  onCancel,
  compact = false,
}: OnboardingProps) {
  const id = useId()
  const queries = useQueryClient()
  const [deviceDensity, applyDensity] = useSidebarDensity(userId)
  const [workspaceName, setWorkspaceName] = useState(snapshot.workspaceName)
  const [useCase, setUseCase] = useState(snapshot.useCase)
  const [draftRevision] = useState(snapshot.revision)
  const [density, setDensity] = useState<SidebarDensity | null>(null)
  const [latest, setLatest] = useState<OnboardingSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [attempt, setAttempt] = useState<{
    command: OnboardingInput
    density: SidebarDensity
  } | null>(null)
  const [confirmed, setConfirmed] = useState<OnboardingSnapshot | null>(null)
  const mounted = useRef(true)
  const locked = useRef(false)
  const errorRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const latestRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    mounted.current = true
    if (compact || document.activeElement === document.body)
      headingRef.current?.focus()
    return () => {
      mounted.current = false
    }
  }, [compact])
  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])
  useEffect(() => {
    if (latest) latestRef.current?.focus()
  }, [latest])
  const selectedDensity = density ?? deviceDensity
  const frozen = busy || !!attempt || !!confirmed
  const revision = latest?.revision ?? draftRevision
  const Surface = compact ? 'section' : 'main'

  async function finish(saved: OnboardingSnapshot) {
    try {
      await onSaved(saved)
    } catch {
      if (mounted.current)
        setError('Saved, but the workspace could not refresh. Try again.')
    }
  }

  async function submit(action: 'save' | 'skip') {
    if (locked.current) return
    if (confirmed) {
      void finish(confirmed)
      return
    }
    const next = attempt ?? {
      command:
        action === 'skip'
          ? { action, commandId: crypto.randomUUID(), revision }
          : {
              action,
              commandId: crypto.randomUUID(),
              revision,
              workspaceName,
              useCase,
            },
      density: selectedDensity,
    }
    const parsed = onboardingInputSchema.safeParse(next.command)
    if (!parsed.success) {
      setError('Use a workspace name with 1 to 80 characters.')
      return
    }
    locked.current = true
    setBusy(true)
    setAttempt({ ...next, command: parsed.data })
    setError('')
    setConflict(false)
    try {
      await queries.cancelQueries({
        queryKey: accountOnboardingKey(userId),
        exact: true,
      })
      if (!mounted.current) return
      const saved = await saveAccountOnboarding(parsed.data)
      if (saved.workspaceId !== snapshot.workspaceId)
        throw new Error(
          'Your account changed. Reload before saving these settings.',
        )
      const current =
        queries.setQueryData<OnboardingSnapshot>(
          accountOnboardingKey(userId),
          (previous) => mergeAccountOnboarding(previous, saved),
        ) ?? saved
      if (parsed.data.action === 'save') applyDensity(next.density)
      if (mounted.current) {
        setAttempt(null)
        setConfirmed(current)
        await finish(current)
      }
    } catch (cause) {
      if (mounted.current) {
        setError(errorMessage(cause, 'Could not save your workspace settings.'))
        const rejected = definiteRejection(cause)
        if (rejected) setAttempt(null)
        if (cause instanceof ApiError && cause.status === 409) {
          setConflict(true)
          setError(
            'These settings changed elsewhere. Reload to review the latest values.',
          )
        }
      }
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }

  async function reload() {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    try {
      const fresh = await queries.fetchQuery(
        accountOnboardingQueryOptions(userId),
      )
      if (fresh.workspaceId !== snapshot.workspaceId)
        throw new Error('Your account changed. Reload this page to continue.')
      if (mounted.current) {
        setLatest(fresh)
        setError('')
        setConflict(false)
      }
    } catch (cause) {
      if (mounted.current)
        setError(errorMessage(cause, 'Could not reload these settings.'))
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <Surface className={`onboarding${compact ? ' onboarding-compact' : ''}`}>
      <form
        className="onboarding-form"
        aria-label="Workspace setup"
        onSubmit={(event) => {
          event.preventDefault()
          void submit('save')
        }}
      >
        {compact ? (
          <h3 ref={headingRef} tabIndex={-1}>
            Personal workspace
          </h3>
        ) : (
          <h1 ref={headingRef} tabIndex={-1}>
            Set up your workspace
          </h1>
        )}
        <div className="onboarding-name">
          <label htmlFor={`${id}-name`}>Workspace name</label>
          <input
            id={`${id}-name`}
            value={workspaceName}
            maxLength={80}
            required
            disabled={frozen}
            autoComplete="off"
            onChange={(event) => setWorkspaceName(event.target.value)}
          />
        </div>
        <fieldset className="onboarding-use" disabled={frozen}>
          <legend>
            Mostly for <span className="onboarding-optional">(optional)</span>
          </legend>
          <div className="onboarding-choices">
            {uses.map(([value, label]) => (
              <label className="onboarding-choice" key={value}>
                <input
                  type="radio"
                  name={`${id}-use`}
                  value={value}
                  checked={useCase === value}
                  onChange={() => {
                    setUseCase(value)
                    setDensity(densityForUse(value)!)
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
            {useCase && (
              <IconButton
                label="Clear use choice"
                disabled={frozen}
                onClick={() => setUseCase(null)}
              >
                <X size={15} />
              </IconButton>
            )}
          </div>
        </fieldset>
        <fieldset
          className="onboarding-density"
          disabled={frozen}
          aria-describedby={`${id}-device`}
        >
          <legend>Display</legend>
          <p id={`${id}-device`}>On this device only.</p>
          <div className="onboarding-density-choices">
            {(['comfortable', 'compact'] as const).map((value) => (
              <label
                key={value}
                className={`onboarding-density-choice onboarding-preview-${value}`}
              >
                <span className="onboarding-preview" aria-hidden="true">
                  {[0, 1, 2].map((row) => (
                    <span className="onboarding-preview-row" key={row}>
                      <i />
                      <b />
                    </span>
                  ))}
                </span>
                <span className="onboarding-density-label">
                  <input
                    type="radio"
                    name={`${id}-density`}
                    value={value}
                    checked={selectedDensity === value}
                    onChange={() => setDensity(value)}
                  />
                  {value === 'comfortable' ? 'Comfortable' : 'Compact'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {latest && (
          <div ref={latestRef} className="onboarding-latest" tabIndex={-1}>
            <p>
              Saved elsewhere: <strong>{latest.workspaceName}</strong>
              {latest.useCase &&
                ` · ${uses.find(([value]) => value === latest.useCase)?.[1]}`}
              .
            </p>
            <button
              type="button"
              className="quiet-button"
              disabled={frozen}
              onClick={() => {
                setWorkspaceName(latest.workspaceName)
                setUseCase(latest.useCase)
                setDensity(null)
              }}
            >
              Use latest choices
            </button>
          </div>
        )}
        {error && (
          <div
            ref={errorRef}
            className="onboarding-error"
            role="alert"
            tabIndex={-1}
          >
            <p>{error}</p>
            {conflict && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void reload()}
              >
                Reload latest
              </button>
            )}
          </div>
        )}
        <div className="onboarding-actions">
          {compact && onCancel ? (
            <button
              type="button"
              className="quiet-button"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </button>
          ) : (
            !compact && (
              <button
                type="button"
                className="quiet-button"
                disabled={frozen}
                onClick={() => void submit('skip')}
              >
                Skip for now
              </button>
            )
          )}
          <button
            type="submit"
            className="primary"
            disabled={
              busy ||
              (!attempt && !confirmed && (!workspaceName.trim() || conflict))
            }
          >
            {busy
              ? 'Saving…'
              : attempt || confirmed
                ? 'Try again'
                : latest
                  ? 'Save my changes'
                  : compact
                    ? 'Save'
                    : 'Continue'}
          </button>
        </div>
      </form>
    </Surface>
  )
}

export function AccountSetupSettings({
  userId,
  onSaved,
}: {
  userId: string
  onSaved: SavedCallback
}) {
  const query = useAccountOnboarding(userId)
  const [editing, setEditing] = useState(false)
  const editButton = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  useEffect(() => {
    if (!editing && wasEditing.current) editButton.current?.focus()
    wasEditing.current = editing
  }, [editing])
  if (query.isError && (!query.data || accessDenied(query.error)))
    return (
      <div className="settings-row onboarding-settings">
        <p role="alert">Could not load workspace setup.</p>
        <button
          type="button"
          className="secondary"
          onClick={() => void query.refetch()}
        >
          Retry
        </button>
      </div>
    )
  if (!query.data)
    return (
      <LoadingState className="settings-row">
        Loading workspace setup…
      </LoadingState>
    )
  if (editing)
    return (
      <Onboarding
        userId={userId}
        snapshot={query.data}
        compact
        onCancel={() => setEditing(false)}
        onSaved={async (saved) => {
          await onSaved(saved)
          setEditing(false)
        }}
      />
    )
  return (
    <div className="settings-row onboarding-settings">
      <div>
        <strong>Personal workspace</strong>
        <p>{query.data.workspaceName}</p>
      </div>
      <button
        ref={editButton}
        type="button"
        className="secondary"
        onClick={() => setEditing(true)}
      >
        Edit
      </button>
      {query.isError && (
        <p role="alert">
          Could not refresh workspace setup.{' '}
          <button
            type="button"
            className="quiet-button"
            onClick={() => void query.refetch()}
          >
            Retry
          </button>
        </p>
      )}
    </div>
  )
}
