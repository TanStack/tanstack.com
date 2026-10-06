/** Only digests and counters survive with the task, never tool bodies. */
export interface AssistantProgress {
  version: 1
  revision: number
  entries: Array<{
    call: string
    outcome: string
    revision: number
    repeats: number
  }>
}
export const progressLimit = 96
export const noProgressReason =
  'The task stopped repeating operations that produced no new evidence.'
/** Called after observing an outcome. Never authorizes or suppresses an effect. */
export function recordAssistantProgress(
  state: AssistantProgress,
  observation: { call: string; outcome: string; advances: boolean },
): string | undefined {
  if (
    ![observation.call, observation.outcome].every((value) =>
      /^[A-Za-z0-9_-]{43}$/.test(value),
    )
  )
    throw new Error('Progress evidence must be a SHA-256 digest.')
  const entry = state.entries.find(
    (item) =>
      item.call === observation.call && item.outcome === observation.outcome,
  )
  if (!entry) {
    if (state.entries.length >= progressLimit)
      return 'The task reached its progress observation limit.'
    if (observation.advances) state.revision++
    state.entries.push({
      call: observation.call,
      outcome: observation.outcome,
      revision: state.revision,
      repeats: 0,
    })
    return
  }
  if (entry.revision !== state.revision) {
    entry.revision = state.revision
    entry.repeats = 0
  }
  entry.repeats++
  if (entry.repeats >= 3) return noProgressReason
}
