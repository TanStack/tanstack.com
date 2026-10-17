import { LoadingState } from './ui/LoadingState'
import { Button } from './ui/Button'
import { useEffect, useId, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import type { AccountPreferences } from '../core/account-preferences'
import { ApiError } from './WorkspaceApi'
import {
  accountPreferencesAccessDenied,
  accountPreferencesKey,
  mergeAccountPreferences,
  saveAccountPreferences,
  useAccountPreferences,
} from './account-preferences-client'
import './account-timezone.css'

export {
  accountPreferencesAccessDenied,
  accountPreferencesKey,
  accountPreferencesQueryOptions,
  confirmedAccountTimezone,
  mergeAccountPreferences,
  saveAccountPreferences,
  useAccountPreferences,
} from './account-preferences-client'

function browserTimezone() {
  if (typeof window === 'undefined') return ''
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  } catch {
    return ''
  }
}

export function AccountTimezone({ userId }: { userId: string }) {
  const query = useAccountPreferences(userId)
  if (
    query.isError &&
    (!query.data || accountPreferencesAccessDenied(query.error))
  )
    return (
      <div className="settings-row account-timezone">
        <p role="alert">Could not load your timezone.</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void query.refetch()}
        >
          Retry
        </Button>
      </div>
    )
  if (!query.data)
    return (
      <LoadingState className="settings-row account-timezone">
        Loading timezone…
      </LoadingState>
    )
  return (
    <AccountTimezoneField
      key={userId}
      userId={userId}
      preferences={query.data}
      reload={query.refetch}
      refreshError={query.isError}
      refreshing={query.isFetching}
    />
  )
}

function AccountTimezoneField({
  userId,
  preferences,
  reload,
  refreshError,
  refreshing,
}: {
  userId: string
  preferences: AccountPreferences
  reload: () => Promise<{ isError: boolean }>
  refreshError: boolean
  refreshing: boolean
}) {
  const queries = useQueryClient()
  const id = useId()
  const [suggestion] = useState(browserTimezone)
  const [edit, setEdit] = useState<{ value: string; revision: number } | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const locked = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const value = edit?.value ?? preferences.timezone ?? suggestion
  const timezone = value.trim() || null
  const suggested = !edit && preferences.timezone === null && !!suggestion
  async function save() {
    if (locked.current || timezone === preferences.timezone) return
    locked.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await queries.cancelQueries({
        queryKey: accountPreferencesKey(userId),
        exact: true,
      })
      if (!mounted.current) return
      const saved = await saveAccountPreferences({
        timezone,
        revision: edit?.revision ?? preferences.revision,
      })
      const latest =
        queries.setQueryData<AccountPreferences>(
          accountPreferencesKey(userId),
          (previous) => mergeAccountPreferences(previous, saved),
        ) ?? saved
      if (mounted.current) {
        setEdit(
          latest.timezone === null
            ? { value: '', revision: latest.revision }
            : null,
        )
        setNotice(latest.timezone === null ? 'Timezone cleared.' : 'Saved')
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof z.ZodError
            ? (cause.issues[0]?.message ?? 'Choose a valid timezone.')
            : cause instanceof Error
              ? cause.message
              : 'Could not save your timezone.',
        )
        if (cause instanceof ApiError && cause.status === 409) {
          const refreshed = await reload()
          if (mounted.current && !refreshed.isError) {
            setEdit(null)
            setError(
              'Your preferences changed elsewhere. The latest values are shown.',
            )
          }
        }
      }
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return (
    <form
      className="settings-row account-timezone"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <div className="account-timezone-label">
        <label htmlFor={id}>Timezone</label>
        <p id={`${id}-description`}>
          {suggested
            ? 'Suggested by this device. Save to use for schedules.'
            : 'Used for new schedules.'}
        </p>
      </div>
      <div className="account-timezone-controls">
        <input
          id={id}
          aria-describedby={`${id}-description`}
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          value={value}
          placeholder="America/Denver"
          disabled={busy}
          onChange={(event) => {
            setEdit({
              value: event.target.value,
              revision: edit?.revision ?? preferences.revision,
            })
            setNotice('')
            setError('')
          }}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={busy || timezone === preferences.timezone}
        >
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {refreshError && (
        <p className="account-timezone-feedback" role="alert">
          Could not refresh timezone.{' '}
          <Button
            type="button"
            variant="ghost"
            disabled={busy || refreshing}
            onClick={() => void reload()}
          >
            Retry
          </Button>
        </p>
      )}
      {error && (
        <p className="account-timezone-feedback" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="account-timezone-feedback" role="status">
          {notice}
        </p>
      )}
    </form>
  )
}
