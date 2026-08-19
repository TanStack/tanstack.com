export type NotebookAiEvalRuntime = 'client' | 'webcontainer'

export type NotebookAiEvalWorkspaceCheck =
  | {
      kind: 'runtime'
      description: string
      runtime: NotebookAiEvalRuntime
    }
  | {
      kind: 'module'
      description: string
      specifier: string
    }
  | {
      kind: 'source'
      description: string
      pattern: RegExp
      path?: string
      negate?: boolean
    }
  | {
      kind: 'call'
      description: string
      callee: string
      path?: string
      negate?: boolean
    }
  | {
      kind: 'file'
      description: string
      path: string
    }
  | {
      kind: 'dependency'
      description: string
      packageName: string
    }

export type NotebookAiEvalPreviewCheck =
  | {
      kind: 'selector'
      description: string
      selector: string
      minimum?: number
      maximum?: number
      textIncludes?: ReadonlyArray<string>
    }
  | {
      kind: 'text'
      description: string
      text: string
      absent?: boolean
    }
  | {
      kind: 'texts'
      description: string
      selector: string
      expected: ReadonlyArray<string>
    }
  | {
      kind: 'geometry'
      description: string
      selector: string
      minimum: number
      distinctHeights?: number
    }
  | {
      kind: 'url'
      description: string
      pathname: string
    }
  | {
      kind: 'title'
      description: string
      text: string
    }
  | {
      kind: 'label'
      description: string
      label: string
      minimum?: number
    }

export type NotebookAiEvalAction =
  | {
      kind: 'click'
      selector: string
      text?: string
    }
  | {
      kind: 'clickUntil'
      selector: string
      text?: string
      untilSelector: string
      untilText?: string
      maximumClicks?: number
    }
  | {
      kind: 'fill'
      selector: string
      value: string
    }
  | {
      kind: 'resize'
      width: number
      height: number
    }
  | {
      kind: 'reload'
    }

export type NotebookAiEvalPreviewStep = {
  description: string
  action?: NotebookAiEvalAction
  checks: ReadonlyArray<NotebookAiEvalPreviewCheck>
  documentMustPersist?: boolean
  timeoutMs?: number
}

export type NotebookAiEvalCase = {
  id: string
  title: string
  prompt: string
  tags: ReadonlyArray<string>
  timeoutMs: number
  workspaceChecks: ReadonlyArray<NotebookAiEvalWorkspaceCheck>
  previewSteps: ReadonlyArray<NotebookAiEvalPreviewStep>
}

export type NotebookAiEvalCheckResult = {
  description: string
  passed: boolean
  evidence: string
}

export type NotebookAiEvalAttemptResult = {
  caseId: string
  run: number
  passed: boolean
  durationMs: number
  model: string | null
  connection: string
  agentRequests: number
  toolCalls: ReadonlyArray<string>
  usage: Record<string, number> | null
  assistantMessage: string | null
  assistantError: string | null
  browserErrors: ReadonlyArray<string>
  checks: ReadonlyArray<NotebookAiEvalCheckResult>
  artifactDirectory: string
}
