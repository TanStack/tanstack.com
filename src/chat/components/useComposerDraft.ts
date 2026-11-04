import { useCloudDraft } from './useCloudDraft'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type SetStateAction,
} from 'react'

const draftChanged = 'gum:draft-changed'

function readDraft(key: string) {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function writeDraft(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
    window.dispatchEvent(new CustomEvent(draftChanged, { detail: key }))
  } catch {
    // Sending still works when device storage is unavailable.
  }
}

export function useComposerDraft(
  scope: string,
  userId: string,
  visible = true,
) {
  const key = `gum.draft:${scope}`
  const [draft, setDraftState] = useState<{
    key: string
    value: string
  } | null>(null)
  const cloud = useCloudDraft(
    userId,
    key,
    () => readDraft(key),
    (value) => writeDraft(key, value),
    visible,
  )
  const cloudChanged = cloud.changed
  const current = useRef(draft)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    const load = () => {
      const next = { key, value: readDraft(key) }
      current.current = next
      setDraftState(next)
    }
    load()
    const localChange = (event: Event) => {
      if ((event as CustomEvent<string>).detail === key) load()
    }
    const storageChange = (event: StorageEvent) => {
      if (event.key === key || event.key === null) load()
    }
    window.addEventListener(draftChanged, localChange)
    window.addEventListener('storage', storageChange)
    return () => {
      window.removeEventListener(draftChanged, localChange)
      window.removeEventListener('storage', storageChange)
    }
  }, [key])
  const setDraft = useCallback(
    (update: SetStateAction<string>) => {
      const previous =
        current.current?.key === key ? current.current.value : readDraft(key)
      const value = typeof update === 'function' ? update(previous) : update
      current.current = { key, value }
      if (mounted.current) setDraftState(current.current)
      writeDraft(key, value)
      cloudChanged(value)
    },
    [key, cloudChanged],
  )
  const clearSubmitted = useCallback(
    (text: string) => {
      // The original conversation may have unmounted while sending. Compare the
      // scoped persisted value before clearing it, including edits in another tab.
      if (readDraft(key) === text) {
        writeDraft(key, '')
        cloudChanged('')
      }
      if (current.current?.key === key && current.current.value === text) {
        current.current = { key, value: '' }
        if (mounted.current) setDraftState(current.current)
      }
      try {
        return localStorage.getItem(key) !== text
      } catch {
        return false
      }
    },
    [key, cloudChanged],
  )
  return [
    draft?.key === key ? draft.value : '',
    setDraft,
    clearSubmitted,
    cloud,
  ] as const
}

export type SendBehavior = 'queue' | 'interrupt'
const sendBehaviorKey = 'gum.sendBehavior'
const sendBehaviorChanged = 'gum:send-behavior'
let currentSendBehavior: SendBehavior | undefined

function readSendBehavior(): SendBehavior {
  if (currentSendBehavior === undefined) {
    try {
      currentSendBehavior =
        localStorage.getItem(sendBehaviorKey) === 'interrupt'
          ? 'interrupt'
          : 'queue'
    } catch {
      currentSendBehavior = 'queue'
    }
  }
  return currentSendBehavior
}

function subscribeSendBehavior(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key !== sendBehaviorKey && event.key !== null) return
    currentSendBehavior = undefined
    notify()
  }
  window.addEventListener('storage', storage)
  window.addEventListener(sendBehaviorChanged, notify)
  return () => {
    window.removeEventListener('storage', storage)
    window.removeEventListener(sendBehaviorChanged, notify)
  }
}

export function useSendBehavior() {
  const behavior = useSyncExternalStore(
    subscribeSendBehavior,
    readSendBehavior,
    () => 'queue' as SendBehavior,
  )
  return [
    behavior,
    (next: SendBehavior) => {
      currentSendBehavior = next
      try {
        localStorage.setItem(sendBehaviorKey, next)
      } catch {
        // Keep the choice for every open composer even without device storage.
      }
      window.dispatchEvent(new Event(sendBehaviorChanged))
    },
  ] as const
}
