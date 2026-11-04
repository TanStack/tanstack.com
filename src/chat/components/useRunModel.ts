import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  runModelSchema,
  type RunModelCatalog,
  type RunModelSelection,
} from '../core/run-model'
import { useWorkspaceApi } from './WorkspaceApi'

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>
export const runModelPreferenceKey = (
  userId: string,
  workspaceId: string | undefined,
  resourcePath: string,
) => JSON.stringify(['gum', 'run-model', 1, userId, workspaceId, resourcePath])

export function readRunModelPreference(
  storage: PreferenceStorage,
  key: string,
): RunModelSelection | undefined {
  const raw = storage.getItem(key)
  if (raw === null) return undefined
  if (raw.length > 2000)
    throw new Error('The saved model choice is invalid. Choose a model again.')
  const parsed = runModelSchema.safeParse(JSON.parse(raw))
  if (!parsed.success)
    throw new Error('The saved model choice is invalid. Choose a model again.')
  return parsed.data
}

export function writeRunModelPreference(
  storage: PreferenceStorage,
  key: string,
  selection: RunModelSelection,
) {
  const next = runModelSchema.parse(selection)
  const value = JSON.stringify(next)
  storage.setItem(key, value)
  if (storage.getItem(key) !== value)
    throw new Error('The model choice could not be saved on this device.')
  return next
}

/** Seed a newly created conversation without replacing a later explicit choice. */
export function seedRunModelPreference(
  storage: PreferenceStorage,
  key: string,
  selection: RunModelSelection,
) {
  return (
    readRunModelPreference(storage, key) ??
    writeRunModelPreference(storage, key, selection)
  )
}

export function resolveRunModelChoice(
  selection: RunModelSelection | undefined,
  catalog: RunModelCatalog | undefined,
) {
  if (!selection) return { choice: undefined, error: 'Choose a model.' }
  const choice = catalog?.choices.find(
    (item) =>
      item.selection.provider === selection.provider &&
      item.selection.model === selection.model,
  )
  if (!choice)
    return { choice, error: 'This model is unavailable. Choose another model.' }
  if (choice.unavailableReason)
    return { choice, error: choice.unavailableReason }
  if (
    selection.reasoning &&
    selection.reasoning !== 'default' &&
    !choice.reasoning.some((mode) => mode.value === selection.reasoning)
  )
    return {
      choice,
      error:
        'This reasoning mode is unavailable. Choose another mode or model.',
    }
  return { choice, error: '' }
}

type PreferenceState = {
  key: string
  loaded: boolean
  selection?: RunModelSelection
  error: string
}

export function useRunModel({
  userId,
  resourcePath,
  readOnly = false,
}: {
  userId: string
  resourcePath: string
  readOnly?: boolean
}) {
  const { request, workspaceId } = useWorkspaceApi()
  const key = runModelPreferenceKey(userId, workspaceId, resourcePath)
  const [state, setState] = useState<PreferenceState>({
    key,
    loaded: false,
    error: '',
  })
  const current = useRef(state)
  const query = useQuery({
    queryKey: ['run-model-options', workspaceId, userId],
    queryFn: () => request<RunModelCatalog>('model-options'),
    staleTime: 30_000,
    refetchOnMount: 'always',
    retry: false,
  })
  const update = useCallback((value: PreferenceState) => {
    current.current = value
    setState(value)
  }, [])
  useEffect(() => {
    const load = () => {
      try {
        update({
          key,
          loaded: true,
          selection: readRunModelPreference(localStorage, key),
          error: '',
        })
      } catch {
        update({
          key,
          loaded: true,
          error:
            'The saved model choice could not be read. Choose a model again.',
        })
      }
    }
    load()
    const changed = (event: StorageEvent) => {
      if (event.key === key || event.key === null) load()
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [key, update])
  const catalog = query.data
  const catalogReady =
    query.isFetchedAfterMount && !query.isError && !query.isFetching
  useEffect(() => {
    if (
      !catalogReady ||
      !catalog ||
      current.current.key !== key ||
      !current.current.loaded ||
      current.current.selection ||
      current.current.error
    )
      return
    try {
      // Read again before seeding so another tab's explicit choice wins.
      const selection = seedRunModelPreference(
        localStorage,
        key,
        catalog.defaultSelection,
      )
      update({ key, loaded: true, selection, error: '' })
    } catch {
      update({
        key,
        loaded: true,
        error:
          'The model choice could not be saved on this device. Choose a model again.',
      })
    }
  }, [
    catalogReady,
    catalog,
    key,
    state.loaded,
    state.selection,
    state.error,
    update,
  ])
  const selection = state.key === key ? state.selection : undefined
  const resolved = resolveRunModelChoice(selection, catalog)
  const loading =
    state.key !== key ||
    !state.loaded ||
    query.isPending ||
    (!query.isError && !query.isFetchedAfterMount)
  const error = query.error
    ? query.error.message
    : state.key === key && state.error
      ? state.error
      : loading
        ? ''
        : resolved.error
  const select = (next: RunModelSelection) => {
    if (readOnly || !catalogReady || resolveRunModelChoice(next, catalog).error)
      return false
    try {
      update({
        key,
        loaded: true,
        selection: writeRunModelPreference(localStorage, key, next),
        error: '',
      })
      return true
    } catch {
      update({
        key,
        loaded: true,
        selection,
        error:
          'The model choice could not be saved on this device. Try choosing it again.',
      })
      return false
    }
  }
  const carryToConversation = useCallback(
    (botId: string, chosen: RunModelSelection | undefined) => {
      if (!chosen) return
      seedRunModelPreference(
        localStorage,
        runModelPreferenceKey(
          userId,
          workspaceId,
          `bots/${encodeURIComponent(botId)}`,
        ),
        chosen,
      )
    },
    [userId, workspaceId],
  )
  return {
    selection,
    choice: resolved.choice,
    catalog,
    catalogReady,
    valid: catalogReady && !loading && !error,
    loading,
    refreshing: query.isFetching,
    error,
    select,
    refetch: query.refetch,
    carryToConversation,
  }
}

export type RunModelController = ReturnType<typeof useRunModel>
