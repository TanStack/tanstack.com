import {
  type ExampleEnvironmentSnapshot,
  type ExampleWorkbenchRunResult,
} from './example-run-observation'
import {
  serializeNotebookAiExecution,
  type NotebookAiExecution,
} from './notebook-ai'

const maxDiagnosticCharacters = 4_000
const maxEvidenceCharacters = 16_000
const maxConsoleEntries = 50

export type NotebookAiEnvironmentSnapshot = {
  expectedRuntime: ExampleEnvironmentSnapshot['runtime']
  executionMatches: boolean
  run: ExampleWorkbenchRunResult
}

export type NotebookAiCompletionDecision =
  | { status: 'complete' }
  | {
      status: 'repair'
      phase: 'compile' | 'runtime'
      diagnostic: string
    }
  | {
      status: 'stop'
      preserveCurrentExecution: boolean
      diagnostic: string
    }

export function createNotebookAiEnvironmentSnapshot({
  actualExecution,
  expectedExecution,
  run,
}: {
  actualExecution: NotebookAiExecution
  expectedExecution: NotebookAiExecution
  run: ExampleWorkbenchRunResult
}): NotebookAiEnvironmentSnapshot {
  return {
    expectedRuntime:
      expectedExecution.runtime?.type === 'webcontainer'
        ? 'webcontainer'
        : 'client',
    executionMatches:
      serializeNotebookAiExecution(expectedExecution) ===
      serializeNotebookAiExecution(actualExecution),
    run: cleanRunResult(run),
  }
}

export function validateNotebookAiCompletion(
  snapshot: NotebookAiEnvironmentSnapshot,
): NotebookAiCompletionDecision {
  if (!snapshot.executionMatches) {
    return {
      status: 'stop',
      preserveCurrentExecution: true,
      diagnostic:
        'The notebook changed while the staged execution was being validated.',
    }
  }

  if (snapshot.expectedRuntime !== snapshot.run.snapshot.runtime) {
    return {
      status: 'stop',
      preserveCurrentExecution: false,
      diagnostic: 'The preview validated a different runtime.',
    }
  }

  const consoleError = snapshot.run.snapshot.console.entries.find(
    (entry) => entry.level === 'error',
  )
  if (snapshot.run.ok && consoleError) {
    return {
      status: 'repair',
      phase: 'runtime',
      diagnostic: consoleError.text || 'The notebook logged an error.',
    }
  }

  if (snapshot.run.ok && !snapshot.run.snapshot.preview.observed) {
    return {
      status: 'stop',
      preserveCurrentExecution: false,
      diagnostic:
        'The preview loaded without establishing the browser observation channel.',
    }
  }

  if (snapshot.run.ok) return { status: 'complete' }

  if (snapshot.run.phase === 'compile' || snapshot.run.phase === 'runtime') {
    return {
      status: 'repair',
      phase: snapshot.run.phase,
      diagnostic: cleanText(snapshot.run.message, maxDiagnosticCharacters),
    }
  }

  return {
    status: 'stop',
    preserveCurrentExecution: false,
    diagnostic: cleanText(snapshot.run.message, maxDiagnosticCharacters),
  }
}

export function shouldRestoreNotebookAiCheckpoint({
  currentExecution,
  lastStagedExecution,
}: {
  currentExecution: NotebookAiExecution
  lastStagedExecution: NotebookAiExecution
}) {
  return (
    serializeNotebookAiExecution(currentExecution) ===
    serializeNotebookAiExecution(lastStagedExecution)
  )
}

export function formatNotebookAiEnvironmentEvidence(
  snapshot: NotebookAiEnvironmentSnapshot,
) {
  const evidence: Array<string> = []
  const preview = snapshot.run.snapshot.preview
  if (preview.observed) {
    evidence.push(
      `Preview: ${preview.title || '(untitled)'} at ${preview.url || '/'}`,
    )
  } else {
    evidence.push('Preview: browser observation unavailable')
  }

  if (snapshot.run.snapshot.console.entries.length) {
    evidence.push(
      `Console:\n${snapshot.run.snapshot.console.entries
        .map((entry) => `[${entry.level}] ${entry.text}`)
        .join('\n')}`,
    )
  }
  if (snapshot.run.snapshot.console.omittedEntries) {
    evidence.push(
      `Console: ${snapshot.run.snapshot.console.omittedEntries} earlier entries omitted`,
    )
  }

  if (snapshot.run.snapshot.process?.tail) {
    evidence.push(`Process output tail:\n${snapshot.run.snapshot.process.tail}`)
  }
  if (snapshot.run.snapshot.process?.omittedCharacters) {
    evidence.push(
      `Process output: ${snapshot.run.snapshot.process.omittedCharacters} earlier characters omitted`,
    )
  }

  return cleanText(evidence.join('\n\n'), maxEvidenceCharacters)
}

function cleanRunResult(
  result: ExampleWorkbenchRunResult,
): ExampleWorkbenchRunResult {
  const snapshot = cleanExampleEnvironmentSnapshot(result.snapshot)
  if (result.ok) return { ok: true, snapshot }
  return {
    ok: false,
    phase: result.phase,
    message: cleanText(result.message, maxDiagnosticCharacters),
    snapshot,
  }
}

function cleanExampleEnvironmentSnapshot(
  snapshot: ExampleEnvironmentSnapshot,
): ExampleEnvironmentSnapshot {
  const entries = snapshot.console.entries
    .slice(-maxConsoleEntries)
    .map((entry) => ({
      level: entry.level,
      text: cleanText(entry.text, maxDiagnosticCharacters),
    }))
  const omittedEntries = Math.max(
    0,
    Math.floor(snapshot.console.omittedEntries) +
      Math.max(0, snapshot.console.entries.length - entries.length),
  )

  return {
    runId: cleanText(snapshot.runId, 128),
    workspaceRevision: Math.max(0, Math.floor(snapshot.workspaceRevision)),
    runtime: snapshot.runtime,
    preview: {
      observed: snapshot.preview.observed,
      title: cleanText(snapshot.preview.title, 512),
      url: cleanText(snapshot.preview.url, 2_048),
    },
    console: { entries, omittedEntries },
    process: snapshot.process
      ? {
          omittedCharacters: Math.max(
            0,
            Math.floor(snapshot.process.omittedCharacters),
          ),
          tail: cleanText(snapshot.process.tail, maxEvidenceCharacters),
        }
      : null,
  }
}

function cleanText(value: string, maxCharacters: number) {
  return value.length <= maxCharacters
    ? value
    : `${value.slice(0, Math.max(0, maxCharacters - 2))}\n…`
}
