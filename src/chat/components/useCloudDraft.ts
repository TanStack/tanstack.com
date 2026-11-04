import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import {
  acknowledgeDraft,
  emptyDraft,
  receiveDraft,
  type DraftSyncState,
  type DraftVersion,
} from '../client/composer-draft-sync'

const versionSchema = z.object({
  value: z.string().max(128_000),
  revision: z.number().int().nonnegative(),
})
const stateSchema = z.object({
  base: versionSchema,
  value: z.string().max(128_000),
  dirty: z.boolean(),
  conflict: versionSchema.optional(),
  pending: versionSchema.optional(),
})

const changed = 'gum:cloud-draft'
type Entry = {
  state: DraftSyncState
  error: boolean
  retryDelay?: number
  retryAllowed?: boolean
  timer?: ReturnType<typeof setTimeout>
  running?: Promise<void>
  url: string
  key: string
  apply: (value: string) => void
}
const entries = new Map<string, Entry>()
let listening = false
function listenForReconnect() {
  if (listening) return
  listening = true
  window.addEventListener('online', () => {
    for (const entry of entries.values()) {
      if (entry.state.dirty) void sync(entry)
    }
  })
}
export function cloudDraftChanged(key: string, value: string) {
  const entry = entries.get(key)
  if (!entry || value === entry.state.value) return
  entry.state = { ...entry.state, value, dirty: true }
  publish(entry)
  schedule(entry)
}

export function applyCloudSelection(key: string, value: string) {
  if ((localStorage.getItem(key) ?? '') === value) return
  if (value) localStorage.setItem(key, value)
  else localStorage.removeItem(key)
  window.dispatchEvent(
    new StorageEvent('storage', { key, newValue: value || null }),
  )
}

function publish(entry: Entry) {
  try {
    localStorage.setItem(`gum.cloud:${entry.key}`, JSON.stringify(entry.state))
  } catch {
    /* The current page still keeps the draft. */
  }
  window.dispatchEvent(new CustomEvent(changed, { detail: entry.key }))
}
async function exchange(entry: Entry, body?: unknown) {
  const response = await fetch(entry.url, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
    keepalive: !!body && JSON.stringify(body).length < 20000,
  })
  if (!response.ok)
    throw Object.assign(new Error('Draft sync is unavailable.'), {
      retryAllowed: response.status >= 500 || response.status === 429,
    })
  return response.json()
}
function sync(entry: Entry): Promise<void> {
  if (entry.running) return entry.running
  const execute = async () => {
    const reload = () => {
      try {
        const saved = localStorage.getItem(`gum.cloud:${entry.key}`)
        if (saved) entry.state = stateSchema.parse(JSON.parse(saved))
      } catch {
        /* Retain the in-memory draft when storage is unavailable. */
      }
    }
    reload()
    try {
      const remote = versionSchema.parse(await exchange(entry))
      reload()
      entry.state = receiveDraft(entry.state, remote)
      if (!entry.state.dirty) entry.apply(entry.state.value)
      if (entry.state.dirty && !entry.state.conflict) {
        const sent = entry.state.value
        entry.state = {
          ...entry.state,
          pending: { value: sent, revision: entry.state.base.revision },
        }
        publish(entry)
        const result: { saved: boolean; draft: DraftVersion } = await exchange(
          entry,
          {
            value: sent,
            revision: entry.state.base.revision,
          },
        )
        reload()
        versionSchema.parse(result.draft)
        entry.state = result.saved
          ? acknowledgeDraft(entry.state, sent, result.draft)
          : receiveDraft(entry.state, result.draft)
      }
      entry.error = false
      entry.retryDelay = 0
    } catch (error) {
      entry.error = true
      entry.retryAllowed = !(
        error &&
        typeof error === 'object' &&
        'retryAllowed' in error &&
        !error.retryAllowed
      )
      entry.retryDelay = Math.min(
        60000,
        Math.max(5000, (entry.retryDelay ?? 0) * 2),
      )
    } finally {
      publish(entry)
    }
  }
  // Serialize network reconciliation between tabs, while typing stays immediate.
  entry.running = (
    navigator.locks
      ? navigator.locks.request(`gum.cloud:${entry.key}`, execute)
      : execute()
  ).finally(() => {
    entry.running = undefined
    if (
      entry.state.dirty &&
      !entry.state.conflict &&
      (!entry.error || (entry.retryAllowed && navigator.onLine !== false))
    )
      schedule(entry, entry.error ? entry.retryDelay : undefined)
  })
  return entry.running
}
function schedule(entry: Entry, delay = 600) {
  clearTimeout(entry.timer)
  entry.timer = setTimeout(() => void sync(entry), delay)
}

// Keep queued writes alive when the composer unmounts during navigation.
export function useCloudDraft(
  userId: string,
  key: string,
  read: () => string,
  apply: (value: string) => void,
  visible = true,
) {
  const [, render] = useState(0)
  const entry =
    typeof window === 'undefined'
      ? undefined
      : (() => {
          let found = entries.get(key)
          if (!found) {
            let state = emptyDraft()
            try {
              state = emptyDraft(read())
            } catch {
              /* Keep an in-memory draft. */
            }
            try {
              const saved = stateSchema.safeParse(
                JSON.parse(localStorage.getItem(`gum.cloud:${key}`) ?? 'null'),
              )
              if (saved.success) {
                state = saved.data
              }
            } catch {
              /* Start from the legacy local draft. */
            }
            found = {
              state,
              error: false,
              key,
              apply,
              url: `/api/chat/account/composer-drafts/${encodeURIComponent(userId)}/${encodeURIComponent(key)}`,
            }
            entries.set(key, found)
          }
          found.apply = apply
          return found
        })()
  useQuery({
    queryKey: ['composer-draft', userId, key],
    enabled: visible,
    queryFn: async () => {
      if (entry) await sync(entry)
      return true
    },
    refetchInterval: 3000,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    staleTime: 0,
  })
  useEffect(() => {
    if (!entry) return
    listenForReconnect()
    try {
      const stored = localStorage.getItem(`gum.cloud:${key}`)
      if (stored) entry.state = stateSchema.parse(JSON.parse(stored))
      entry.apply(entry.state.value)
    } catch {
      entry.error = true
    }
    const refresh = (event: Event) => {
      if ((event as CustomEvent).detail === key) render((n) => n + 1)
    }
    const flush = () => {
      if (entry.state.dirty) void sync(entry)
    }
    const storage = (event: StorageEvent) => {
      if (event.key !== `gum.cloud:${key}` || !event.newValue) return
      try {
        entry.state = stateSchema.parse(
          JSON.parse(
            localStorage.getItem(`gum.cloud:${key}`) ?? event.newValue,
          ),
        )
        entry.apply(entry.state.value)
        render((n) => n + 1)
      } catch {
        /* Ignore incomplete browser storage. */
      }
    }
    window.addEventListener(changed, refresh)
    window.addEventListener('storage', storage)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener(changed, refresh)
      window.removeEventListener('storage', storage)
      window.removeEventListener('pagehide', flush)
      if (entry.state.dirty) schedule(entry)
    }
  }, [entry, key])
  const change = useCallback(
    (value: string) => cloudDraftChanged(key, value),
    [key],
  )
  return {
    changed: change,
    conflict: entry?.state.conflict,
    error: entry?.error ?? false,
    resolve(useRemote: boolean) {
      if (!entry?.state.conflict) return
      const remote = entry.state.conflict
      entry.state = {
        base: remote,
        value: useRemote ? remote.value : entry.state.value,
        dirty: !useRemote,
      }
      entry.apply(entry.state.value)
      publish(entry)
      schedule(entry)
    },
  }
}
