import { describe, expect, it } from 'vitest'
import {
  acknowledgeDraft,
  emptyDraft,
  receiveDraft,
} from '../../src/chat/client/composer-draft-sync'

describe('cross-device draft reconciliation', () => {
  const remote = { value: 'An idea from the desktop', revision: 1 }
  it('restores a cloud draft on an untouched device', () => {
    expect(receiveDraft(emptyDraft(), remote)).toEqual({
      base: remote,
      value: remote.value,
      dirty: false,
    })
  })
  it('keeps typing during a request and records a competing edit', () => {
    const local = { ...emptyDraft('Phone edit'), base: remote }
    const competing = { value: 'Desktop edit', revision: 2 }
    expect(receiveDraft(local, competing)).toEqual({
      ...local,
      conflict: competing,
    })
  })
  it('does not resurrect a sent draft from a stale read', () => {
    const cleared = { value: '', revision: 3 }
    expect(
      receiveDraft({ base: cleared, value: '', dirty: false }, remote),
    ).toEqual({ base: cleared, value: '', dirty: false })
  })
  it('keeps a local edit when another device sends or clears', () => {
    const state = { ...emptyDraft('New thought'), base: remote }
    expect(receiveDraft(state, { value: '', revision: 2 }).conflict).toEqual({
      value: '',
      revision: 2,
    })
  })
  it('does not discard text typed while a save is in flight', () => {
    const state = emptyDraft('Hello world')
    expect(
      acknowledgeDraft(state, 'Hello', { value: 'Hello', revision: 1 }),
    ).toEqual({
      base: { value: 'Hello', revision: 1 },
      value: 'Hello world',
      dirty: true,
    })
  })
  it('recognizes an accepted save after its response was lost', () => {
    expect(receiveDraft(emptyDraft(remote.value), remote).dirty).toBe(false)
  })
  it('preserves an offline local draft on initial fetch', () => {
    expect(
      receiveDraft(emptyDraft('Offline thought'), { value: '', revision: 0 }),
    ).toEqual(emptyDraft('Offline thought'))
  })
  it('does not replace local edits when the cloud revision is unchanged', () => {
    const state = { ...emptyDraft('Local edits'), base: remote }
    expect(receiveDraft(state, remote)).toBe(state)
  })
})

it('recovers an uncertain save without losing edits made after it', () => {
  const state = {
    ...emptyDraft('Hello world'),
    pending: { value: 'Hello', revision: 0 },
  }
  const result = receiveDraft(state, { value: 'Hello', revision: 1 })
  expect(result.value).toBe('Hello world')
  expect(result.base.revision).toBe(1)
  expect(result.dirty).toBe(true)
  expect(result.conflict).toBeUndefined()
})
