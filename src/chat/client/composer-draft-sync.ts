export type DraftVersion = { value: string; revision: number }
export type DraftSyncState = {
  base: DraftVersion
  value: string
  dirty: boolean
  pending?: DraftVersion
  conflict?: DraftVersion
}
export const emptyDraft = (value = ''): DraftSyncState => ({
  base: { value: '', revision: 0 },
  value,
  dirty: !!value,
})

export function receiveDraft(
  state: DraftSyncState,
  remote: DraftVersion,
): DraftSyncState {
  if (
    state.pending &&
    remote.revision === state.pending.revision + 1 &&
    remote.value === state.pending.value
  )
    return acknowledgeDraft(state, state.pending.value, remote)
  if (
    remote.revision <
    Math.max(state.base.revision, state.conflict?.revision ?? 0)
  )
    return state
  if (!state.dirty || state.value === remote.value)
    return { base: remote, value: remote.value, dirty: false }
  if (remote.revision === state.base.revision) return state
  // Even an empty remote value matters: another device may have sent the draft.
  return { ...state, conflict: remote }
}

export function acknowledgeDraft(
  state: DraftSyncState,
  sent: string,
  remote: DraftVersion,
): DraftSyncState {
  return {
    ...state,
    base: remote,
    dirty: state.value !== sent,
    conflict: undefined,
    pending: undefined,
  }
}
