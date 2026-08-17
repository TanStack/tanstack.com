const maxFingerprints = 128
const fingerprintPattern = /^[0-9a-f]{16}$/
const evidenceTools = new Set([
  'inspect_module',
  'read_file',
  'read_package_resource',
  'search_package_resources',
])

export type NotebookAiRepairContext = {
  priorEvidenceFingerprints: Array<string>
  blockedMutationFingerprints: Array<string>
}

export type NotebookAiAttemptTrace = {
  evidenceFingerprints: Array<string>
  mutationFingerprints: Array<string>
}

export type NotebookAiFailureObservation = NotebookAiAttemptTrace & {
  failureFingerprint: string
  executionFingerprint: string
}

export type NotebookAiFailureProgress = {
  history: Array<NotebookAiFailureObservation>
  repair: NotebookAiRepairContext
  repeatedState: boolean
}

export type NotebookAiProgressGate = {
  assertCanMutate: (toolName: string, input: unknown) => string
  recordEvidence: (toolName: string, input: unknown, output: unknown) => void
  recordMutation: (fingerprint: string) => void
  trace: () => NotebookAiAttemptTrace
  required: boolean
}

export function createNotebookAiProgressGate(
  repair: NotebookAiRepairContext | undefined,
): NotebookAiProgressGate {
  const priorEvidence = new Set(repair?.priorEvidenceFingerprints ?? [])
  const blockedMutations = new Set(repair?.blockedMutationFingerprints ?? [])
  const evidenceFingerprints = new Set<string>()
  const mutationFingerprints = new Set<string>()
  const required = repair !== undefined

  return {
    required,
    recordEvidence(toolName, input, output) {
      if (!evidenceTools.has(toolName)) return
      evidenceFingerprints.add(
        fingerprintNotebookAiValue({ toolName, input, output }),
      )
    },
    assertCanMutate(toolName, input) {
      const hasFreshEvidence = Array.from(evidenceFingerprints).some(
        (fingerprint) => !priorEvidence.has(fingerprint),
      )
      if (required && !hasFreshEvidence) {
        throw new Error(
          'Gather new evidence that differs from prior repair attempts before mutating the notebook.',
        )
      }

      const fingerprint = fingerprintNotebookAiValue({ toolName, input })
      if (
        blockedMutations.has(fingerprint) ||
        mutationFingerprints.has(fingerprint)
      ) {
        throw new Error(
          'That exact mutation already ran in this attempt or failed for this validation error. Inspect a different source or make a materially different change.',
        )
      }
      return fingerprint
    },
    recordMutation(fingerprint) {
      mutationFingerprints.add(fingerprint)
    },
    trace() {
      return {
        evidenceFingerprints: Array.from(evidenceFingerprints),
        mutationFingerprints: Array.from(mutationFingerprints),
      }
    },
  }
}

export function parseNotebookAiRepairContext(
  value: unknown,
): NotebookAiRepairContext | undefined {
  if (value === undefined) return undefined
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'priorEvidenceFingerprints',
      'blockedMutationFingerprints',
    ]) ||
    !isFingerprintArray(value.priorEvidenceFingerprints) ||
    !isFingerprintArray(value.blockedMutationFingerprints)
  ) {
    throw new Error('Invalid notebook AI repair context')
  }

  return {
    priorEvidenceFingerprints: Array.from(
      new Set(value.priorEvidenceFingerprints),
    ),
    blockedMutationFingerprints: Array.from(
      new Set(value.blockedMutationFingerprints),
    ),
  }
}

export function parseNotebookAiAttemptTrace(
  value: unknown,
): NotebookAiAttemptTrace {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['evidenceFingerprints', 'mutationFingerprints']) ||
    !isFingerprintArray(value.evidenceFingerprints) ||
    !isFingerprintArray(value.mutationFingerprints)
  ) {
    throw new Error('Notebook AI returned an invalid attempt trace')
  }

  return {
    evidenceFingerprints: Array.from(new Set(value.evidenceFingerprints)),
    mutationFingerprints: Array.from(new Set(value.mutationFingerprints)),
  }
}

export function fingerprintNotebookAiValue(value: unknown) {
  const source = serializeCanonicalValue(value)
  let first = 0x811c9dc5
  let second = 0x9e3779b9

  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ code, 0x85ebca6b)
  }

  return `${toHex(first)}${toHex(second)}`
}

export function fingerprintNotebookAiDiagnostic(
  phase: string,
  message: string,
) {
  return fingerprintNotebookAiValue({
    phase,
    message: message.trim().replace(/\s+/g, ' '),
  })
}

export function recordNotebookAiFailure(
  history: ReadonlyArray<NotebookAiFailureObservation>,
  observation: NotebookAiFailureObservation,
): NotebookAiFailureProgress {
  const repeatedState = history.some(
    (previous) =>
      previous.failureFingerprint === observation.failureFingerprint &&
      previous.executionFingerprint === observation.executionFingerprint,
  )
  const nextHistory = [...history, observation]

  return {
    history: nextHistory,
    repeatedState,
    repair: {
      priorEvidenceFingerprints: uniqueFingerprints(
        nextHistory.flatMap((attempt) => attempt.evidenceFingerprints),
      ),
      blockedMutationFingerprints: uniqueFingerprints(
        nextHistory.flatMap((attempt) =>
          attempt.failureFingerprint === observation.failureFingerprint
            ? attempt.mutationFingerprints
            : [],
        ),
      ),
    },
  }
}

function serializeCanonicalValue(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    return `[${value.map(serializeCanonicalValue).join(',')}]`
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${serializeCanonicalValue(value[key])}`,
      )
      .join(',')}}`
  }

  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN'
    if (value === Infinity) return 'Infinity'
    if (value === -Infinity) return '-Infinity'
    return String(value)
  }
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'undefined') return 'undefined'
  return JSON.stringify(String(value))
}

function isFingerprintArray(value: unknown): value is Array<string> {
  return (
    Array.isArray(value) &&
    value.length <= maxFingerprints &&
    value.every(
      (fingerprint) =>
        typeof fingerprint === 'string' && fingerprintPattern.test(fingerprint),
    )
  )
}

function uniqueFingerprints(fingerprints: Array<string>) {
  return Array.from(new Set(fingerprints)).slice(0, maxFingerprints)
}

function toHex(value: number) {
  return (value >>> 0).toString(16).padStart(8, '0')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}
