import { diffArrays } from 'diff'

export const maxDiffCharacters = 65_536
export const maxDiffLines = 2_000
export type FileDiffLine = {
  kind: 'context' | 'removed' | 'added'
  beforeLine?: number
  afterLine?: number
  text: string
  ending: 'lf' | 'crlf' | 'cr' | 'none'
}
export type FileTextComparison =
  | {
      status: 'ready'
      rows: FileDiffLine[]
      additions: number
      deletions: number
      equal: boolean
    }
  | { status: 'limited'; reason: string }

/** Keep terminators in each token so a changed final newline is a real edit. */
function lines(text: string) {
  return text.match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/g) ?? []
}

export function compareFileText(
  before: string,
  after: string,
): FileTextComparison {
  if (before.length > maxDiffCharacters || after.length > maxDiffCharacters)
    return {
      status: 'limited',
      reason:
        'Comparison supports up to 65,536 characters per file. Download the files to compare them locally.',
    }
  const beforeLines = lines(before)
  const afterLines = lines(after)
  if (beforeLines.length + afterLines.length > maxDiffLines)
    return {
      status: 'limited',
      reason:
        'Comparison supports up to 2,000 lines across both files. Download the files to compare them locally.',
    }
  const changes = diffArrays(beforeLines, afterLines, {
    timeout: 100,
    maxEditLength: maxDiffLines,
  })
  if (!changes)
    return {
      status: 'limited',
      reason:
        'These files took too long to compare. Download them to compare locally.',
    }
  let beforeLine = 1
  let afterLine = 1
  let additions = 0
  let deletions = 0
  const rows: FileDiffLine[] = []
  for (const change of changes) {
    const kind = change.added ? 'added' : change.removed ? 'removed' : 'context'
    for (const raw of change.value) {
      const ending = raw.endsWith('\r\n')
        ? 'crlf'
        : raw.endsWith('\n')
          ? 'lf'
          : raw.endsWith('\r')
            ? 'cr'
            : 'none'
      rows.push({
        kind,
        ...(kind !== 'added' ? { beforeLine: beforeLine++ } : {}),
        ...(kind !== 'removed' ? { afterLine: afterLine++ } : {}),
        text: raw.slice(
          0,
          raw.length - (ending === 'crlf' ? 2 : ending === 'none' ? 0 : 1),
        ),
        ending,
      })
      if (kind === 'added') additions++
      if (kind === 'removed') deletions++
    }
  }
  return {
    status: 'ready',
    rows,
    additions,
    deletions,
    equal: before === after,
  }
}
