import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useBlocker } from '@tanstack/react-router'
import type { RetryAttemptView } from '../core/conversation-retry'
import type { ConversationDestination } from '../core/conversation-destination'
import { RetryDraftStore, type RetryDraftSeed } from '../core/retry-draft'
import {
  RetryDraftEditor,
  retryDraftBlocksNavigation,
} from '../core/retry-draft-editor'

const draftChanged = 'gum:retry-draft-changed'

export function useRetryDraft(
  destination: ConversationDestination,
  attempt: RetryAttemptView,
) {
  const editor = useMemo(
    () =>
      new RetryDraftEditor(
        new RetryDraftStore({
          scope: {
            userId: destination.userId,
            workspaceId: destination.workspaceId,
            botId: destination.botId,
            conversationId: destination.conversationId,
          },
          attemptId: attempt.attemptId,
          storage: {
            getItem: (key) => localStorage.getItem(key),
            setItem: (key, value) => localStorage.setItem(key, value),
          },
          lock: (key, operation) => {
            if (!navigator.locks)
              return Promise.reject(
                new Error(
                  'Use an up-to-date browser to save this draft safely.',
                ),
              )
            return navigator.locks.request(key, operation)
          },
        }),
      ),
    [destination.sessionKey, attempt.attemptId],
  )
  const state = useSyncExternalStore(
    editor.subscribe,
    editor.snapshot,
    editor.snapshot,
  )
  const shouldBlockFn = useCallback(async () => {
    if (!(await retryDraftBlocksNavigation(editor))) return false
    // Editors can remain mounted in hidden panes. A browser confirmation stays
    // reachable even when the draft which would be lost is not the active pane.
    return !window.confirm(
      'Your latest retry edits are not saved. Leave without saving them?',
    )
  }, [editor])
  useBlocker({ shouldBlockFn, enableBeforeUnload: false })
  const seedJson =
    attempt.draft && attempt.target
      ? JSON.stringify({
          attemptId: attempt.attemptId,
          target: attempt.target,
          ...attempt.draft,
        })
      : undefined
  const reload = () =>
    editor.load(seedJson ? (JSON.parse(seedJson) as RetryDraftSeed) : undefined)
  useEffect(() => {
    void reload()
  }, [editor, seedJson])
  useEffect(() => {
    const storage = (event: StorageEvent) => {
      if (event.key === editor.store.key || event.key === null) editor.refresh()
    }
    const focus = () => editor.refresh()
    const changed = (event: Event) => {
      const detail = (
        event as CustomEvent<string | { key: string; editor: RetryDraftEditor }>
      ).detail
      if (
        typeof detail === 'string'
          ? detail === editor.store.key
          : detail?.key === editor.store.key && detail.editor !== editor
      )
        void editor.refresh()
    }
    const unload = (event: BeforeUnloadEvent) => {
      if (!editor.snapshot().dirty && !editor.snapshot().saving) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('storage', storage)
    window.addEventListener('focus', focus)
    window.addEventListener(draftChanged, changed)
    window.addEventListener('beforeunload', unload)
    return () => {
      window.removeEventListener('storage', storage)
      window.removeEventListener('focus', focus)
      window.removeEventListener(draftChanged, changed)
      window.removeEventListener('beforeunload', unload)
    }
  }, [editor])
  useEffect(() => {
    if (state.document)
      window.dispatchEvent(
        new CustomEvent(draftChanged, {
          detail: { key: editor.store.key, editor },
        }),
      )
  }, [editor, state.document])
  return { ...state, editor, reload }
}
