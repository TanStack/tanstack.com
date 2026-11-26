import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  compareFileText,
  maxDiffCharacters,
  maxDiffLines,
  type FileDiffLine,
} from '../../src/chat/core/file-diff'

afterEach(() => vi.restoreAllMocks())
const ending = { lf: '\n', crlf: '\r\n', cr: '\r', none: '' }
const restore = (rows: FileDiffLine[], side: 'before' | 'after') =>
  rows
    .filter((row) => row.kind !== (side === 'before' ? 'added' : 'removed'))
    .map((row) => row.text + ending[row.ending])
    .join('')

describe('saved text comparison', () => {
  it.each([
    ['', ''],
    ['', 'new\n'],
    ['removed\n', ''],
    ['same\n', 'same\n'],
    ['one\ntwo\nthree\n', 'one\nchanged\nthree\nfour\n'],
    ['last line\n', 'last line'],
    ['same\r\n', 'same\n'],
    ['one\rtwo\r', 'one\rtwo'],
    ['\uFEFFHello 🪴\r\n\nBye\n', 'Hello 🪴\r\n \nBye\n'],
    ['a\n\n\n', 'a\n\n'],
  ])(
    'preserves both exact inputs including invisible changes',
    (before, after) => {
      const result = compareFileText(before, after)
      expect(result.status).toBe('ready')
      if (result.status !== 'ready') return
      expect(restore(result.rows, 'before')).toBe(before)
      expect(restore(result.rows, 'after')).toBe(after)
      expect(result.equal).toBe(before === after)
      expect(
        result.rows
          .filter((row) => row.beforeLine)
          .map((row) => row.beforeLine),
      ).toEqual(
        result.rows.filter((row) => row.beforeLine).map((_, i) => i + 1),
      )
      expect(
        result.rows.filter((row) => row.afterLine).map((row) => row.afterLine),
      ).toEqual(result.rows.filter((row) => row.afterLine).map((_, i) => i + 1))
    },
  )

  it('reports line edits without dropping their terminators', () => {
    const result = compareFileText(
      'one\ntwo\nthree\n',
      'one\nchanged\nthree\nfour',
    )
    expect(result).toEqual({
      status: 'ready',
      equal: false,
      additions: 2,
      deletions: 1,
      rows: [
        {
          kind: 'context',
          beforeLine: 1,
          afterLine: 1,
          text: 'one',
          ending: 'lf',
        },
        { kind: 'removed', beforeLine: 2, text: 'two', ending: 'lf' },
        { kind: 'added', afterLine: 2, text: 'changed', ending: 'lf' },
        {
          kind: 'context',
          beforeLine: 3,
          afterLine: 3,
          text: 'three',
          ending: 'lf',
        },
        { kind: 'added', afterLine: 4, text: 'four', ending: 'none' },
      ],
    })
  })

  it('does not claim equality or render a partial comparison beyond its bounds', () => {
    for (const input of [
      'x'.repeat(maxDiffCharacters + 1),
      '\n'.repeat(maxDiffLines + 1),
    ]) {
      expect(compareFileText(input, input)).toMatchObject({ status: 'limited' })
      expect(compareFileText('', input)).not.toHaveProperty('equal')
      expect(compareFileText(input, '')).not.toHaveProperty('rows')
    }
  })

  it('reports an aborted calculation without presenting it as no changes', () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValue(1_101)
    expect(compareFileText('before', 'after')).toEqual({
      status: 'limited',
      reason:
        'These files took too long to compare. Download them to compare locally.',
    })
  })
})
