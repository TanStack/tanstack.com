import { LoadingState } from './ui/LoadingState'
import { Button } from './ui/Button'
import { SelectField } from './SelectField'
import { useEffect, useId, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  defaultResponsePreferences,
  responseLanguages,
  type AccountPreferences,
  type ResponsePreferences as ResponseStyle,
} from '../core/account-preferences'
import {
  accountPreferencesKey,
  accountPreferencesAccessDenied,
  mergeAccountPreferences,
  saveAccountPreferences,
  useAccountPreferences,
} from './account-preferences-client'
import { ApiError } from './WorkspaceApi'
import './response-preferences.css'

function sameResponse(a: ResponseStyle, b: ResponseStyle) {
  return a.language === b.language && a.tone === b.tone && a.detail === b.detail
}

export function ResponsePreferences({ userId }: { userId: string }) {
  const query = useAccountPreferences(userId)
  if (
    query.isError &&
    (!query.data || accountPreferencesAccessDenied(query.error))
  )
    return (
      <div className="settings-row response-preferences-loading">
        <p role="alert">Could not load your response preferences.</p>
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
      <LoadingState className="settings-row">
        Loading response preferences…
      </LoadingState>
    )
  return (
    <ResponsePreferencesForm
      key={userId}
      userId={userId}
      preferences={query.data}
      reload={query.refetch}
      refreshError={query.isError}
      refreshing={query.isFetching}
    />
  )
}

function ResponsePreferencesForm({
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
  const [draft, setDraft] = useState<{
    response: ResponseStyle
    revision: number
  } | null>(null)
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
  const response = draft?.response ?? preferences.response
  const unchanged = sameResponse(response, preferences.response)
  const defaults = sameResponse(response, defaultResponsePreferences)

  function edit(next: ResponseStyle) {
    setDraft({
      response: next,
      revision: draft?.revision ?? preferences.revision,
    })
    setNotice('')
    setError('')
  }

  async function save() {
    if (locked.current || unchanged) return
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
        revision: draft?.revision ?? preferences.revision,
        response,
      })
      queries.setQueryData<AccountPreferences>(
        accountPreferencesKey(userId),
        (previous) => mergeAccountPreferences(previous, saved),
      )
      if (mounted.current) {
        setDraft(null)
        setNotice('Saved')
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not save your response preferences.',
        )
        if (cause instanceof ApiError && cause.status === 409) {
          const refreshed = await reload()
          if (mounted.current && !refreshed.isError) {
            setDraft(null)
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
      className="settings-row response-preferences"
      aria-label="Response preferences"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <div className="response-preferences-fields">
        <div>
          <label htmlFor={`${id}-language`}>Language</label>
          <SelectField
            id={`${id}-language`}
            value={response.language ?? ''}
            aria-describedby={`${id}-description`}
            disabled={busy}
            onValueChange={(value) =>
              edit({
                ...response,
                language: value || null,
              })
            }
            items={[
              ...responseLanguageItems({
                language: response.language,
                savedLanguage: preferences.response.language,
              }),
            ]}
          />
        </div>
        <div>
          <label htmlFor={`${id}-tone`}>Tone</label>
          <SelectField
            id={`${id}-tone`}
            value={response.tone}
            aria-describedby={`${id}-description`}
            disabled={busy}
            onValueChange={(value) =>
              edit({
                ...response,
                tone: value as ResponseStyle['tone'],
              })
            }
            items={[
              {
                value: 'default',
                label: 'Match the task',
              },
              {
                value: 'warm',
                label: 'Warm',
              },
              {
                value: 'direct',
                label: 'Direct',
              },
              {
                value: 'formal',
                label: 'Formal',
              },
            ]}
          />
        </div>
        <div>
          <label htmlFor={`${id}-detail`}>Detail</label>
          <SelectField
            id={`${id}-detail`}
            value={response.detail}
            aria-describedby={`${id}-description`}
            disabled={busy}
            onValueChange={(value) =>
              edit({
                ...response,
                detail: value as ResponseStyle['detail'],
              })
            }
            items={[
              {
                value: 'default',
                label: 'Match the task',
              },
              {
                value: 'brief',
                label: 'Brief',
              },
              {
                value: 'thorough',
                label: 'Thorough',
              },
            ]}
          />
        </div>
      </div>
      <p id={`${id}-description`}>
        Used for new tasks. You can ask for a different style in any message.
      </p>
      <div className="response-preferences-actions">
        <Button
          type="button"
          variant="ghost"
          disabled={busy || defaults}
          onClick={() => edit({ ...defaultResponsePreferences })}
        >
          Reset to defaults
        </Button>
        <Button type="submit" variant="secondary" disabled={busy || unchanged}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {refreshError && (
        <p className="response-preferences-feedback" role="alert">
          Could not refresh response preferences.{' '}
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
        <p className="response-preferences-feedback" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="response-preferences-feedback" role="status">
          {notice}
        </p>
      )}
    </form>
  )
}

export function responseLanguageItems({
  language,
  savedLanguage,
}: {
  language: string | null
  savedLanguage: string | null
}) {
  const extraLanguages = [...new Set([savedLanguage, language])].filter(
    (value): value is string =>
      value !== null &&
      !responseLanguages.some((option) => option.value === value),
  )
  return [
    { value: '', label: 'Match my message' },
    ...extraLanguages.map((value) => ({ value, label: value })),
    ...responseLanguages,
  ]
}
