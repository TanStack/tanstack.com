import type { ExampleConsoleLevel } from './example-sandbox.client'

export const exampleWorkbenchRunFailurePhases = [
  'aborted',
  'compile',
  'runtime',
  'superseded',
  'timeout',
  'unsupported',
] as const

export type ExampleWorkbenchRunFailurePhase =
  (typeof exampleWorkbenchRunFailurePhases)[number]

export type ExampleEnvironmentSnapshot = {
  runId: string
  workspaceRevision: number
  runtime: 'client' | 'webcontainer'
  preview: {
    observed: boolean
    title: string
    url: string
  }
  console: {
    entries: ReadonlyArray<{
      level: ExampleConsoleLevel
      text: string
    }>
    omittedEntries: number
  }
  process: {
    omittedCharacters: number
    tail: string
  } | null
}

export type ExampleWorkbenchRunOutcome =
  | { ok: true }
  | {
      ok: false
      phase: ExampleWorkbenchRunFailurePhase
      message: string
    }

export type ExampleWorkbenchRunResult = ExampleWorkbenchRunOutcome & {
  snapshot: ExampleEnvironmentSnapshot
}

export function createEmptyExampleEnvironmentSnapshot({
  runId,
  runtime,
  workspaceRevision = 0,
}: {
  runId: string
  runtime: ExampleEnvironmentSnapshot['runtime']
  workspaceRevision?: number
}): ExampleEnvironmentSnapshot {
  return {
    runId,
    workspaceRevision,
    runtime,
    preview: { observed: false, title: '', url: '' },
    console: { entries: [], omittedEntries: 0 },
    process:
      runtime === 'webcontainer' ? { omittedCharacters: 0, tail: '' } : null,
  }
}
