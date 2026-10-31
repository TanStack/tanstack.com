export type BuilderAiEvalRuntime = 'client' | 'webcontainer'

export type BuilderAiEvalWorkspaceCheck =
  | {
      kind: 'runtime'
      description: string
      runtime: BuilderAiEvalRuntime
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

export type BuilderAiEvalPreviewCheck =
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

export type BuilderAiEvalAction =
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

export type BuilderAiEvalPreviewStep = {
  description: string
  action?: BuilderAiEvalAction
  checks: ReadonlyArray<BuilderAiEvalPreviewCheck>
  documentMustPersist?: boolean
  timeoutMs?: number
}

export type BuilderAiEvalCase = {
  id: string
  title: string
  prompt: string
  tags: ReadonlyArray<string>
  timeoutMs: number
  workspaceChecks: ReadonlyArray<BuilderAiEvalWorkspaceCheck>
  previewSteps: ReadonlyArray<BuilderAiEvalPreviewStep>
}

export type BuilderAiEvalCheckResult = {
  description: string
  passed: boolean
  evidence: string
}

export type BuilderAiEvalAttemptResult = {
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
  checks: ReadonlyArray<BuilderAiEvalCheckResult>
  artifactDirectory: string
}
