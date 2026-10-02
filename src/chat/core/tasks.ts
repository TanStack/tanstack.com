import type { AssistantTask } from './assistant-task'

/** A user step discovered while working on any request, not a provider workflow. */
export interface PendingTask {
  id: string
  kind: 'external-step'
  turnId: string
  request: string
  title: string
  instructions: string
  url: string
  evidenceRef: string
  connection?:
    | { kind: 'kody' }
    | { kind: 'kody-integration'; name: string }
    | { kind: 'mcp'; setupId: string; accountId: string }
}

/** Keep a setup step paired with the document that actually contains its link. */
export function pendingPackageGuide(
  task: PendingTask,
  observations: AssistantTask['observations'] | undefined,
) {
  for (let index = (observations?.length ?? 0) - 1; index >= 0; index--) {
    const guide = observations?.[index]?.packageDocumentation
    if (
      guide &&
      (guide.entity === task.evidenceRef || guide.content.includes(task.url))
    )
      return guide
  }
  return undefined
}
