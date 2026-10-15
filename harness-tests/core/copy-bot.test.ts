import { describe, expect, it } from 'vitest'
import {
  copyBotName,
  copyBotPlacement,
  copyRequestStorageKey,
  parseSavedCopyRequest,
  parseSavedCopyAttempt,
} from '../../src/chat/core/copy-bot'
import type { WorkspaceBot } from '../../src/chat/core/bot-workspace'

const bot = (
  id: string,
  changes: Partial<WorkspaceBot> = {},
): WorkspaceBot => ({
  id,
  mainConversationId: `main:${id}`,
  name: id,
  workspace_id: 'workspace',
  parent_id: null,
  purpose: '',
  created_at: 1,
  updated_at: 1,
  version: 1,
  archived_at: null,
  deleted_at: null,
  pinned: false,
  position: 0,
  section_id: null,
  tags: [],
  ...changes,
})

describe('copy bot review', () => {
  it('keeps the generated name within the bot limit without truncating a surrogate pair', () => {
    expect(copyBotName('Kody', 'duplicate')).toBe('Kody copy')
    expect(copyBotName('x'.repeat(54) + '😀', 'fork')).toBe(
      'x'.repeat(54) + ' fork',
    )
    expect(copyBotName('x'.repeat(60), 'duplicate')).toHaveLength(60)
  })
  it('places beside the nearest active ancestor and permits sub-bots only under active sources', () => {
    const root = bot('root'),
      archived = bot('archived', { archived_at: 2, parent_id: 'root' })
    const source = bot('source', { parent_id: 'archived' })
    expect(copyBotPlacement(source, [root, archived, source])).toEqual({
      siblingParent: root,
      canBeChild: true,
    })
    expect(copyBotPlacement(archived, [root, archived])).toEqual({
      siblingParent: root,
      canBeChild: false,
    })
    expect(copyBotPlacement(bot('deleted', { deleted_at: 2 }), [])).toEqual({
      siblingParent: null,
      canBeChild: false,
    })
  })
  it('does not loop through an invalid parent cycle', () => {
    const source = bot('source', { parent_id: 'parent', archived_at: 1 })
    const parent = bot('parent', { parent_id: 'source', archived_at: 1 })
    expect(copyBotPlacement(source, [source, parent]).siblingParent).toBeNull()
  })
  it('recovers only an exact frozen request for this operation kind and message', () => {
    const request = {
      idempotencyKey: '82db50ef-dcae-438c-a34c-cf380b88c135',
      kind: 'fork',
      boundary: {
        kind: 'message',
        epoch: 'epoch',
        messageId: 'message',
        expectedDigest: 'digest',
      },
      name: 'A fork',
      parentId: 'source',
    }
    expect(parseSavedCopyRequest(JSON.stringify(request), 'message')).toEqual(
      request,
    )
    expect(parseSavedCopyRequest(JSON.stringify(request), 'another')).toBeNull()
    expect(parseSavedCopyRequest(JSON.stringify(request))).toBeNull()
    expect(
      parseSavedCopyRequest(
        JSON.stringify({ ...request, kind: 'duplicate' }),
        'message',
      ),
    ).toBeNull()
    expect(parseSavedCopyRequest('{malformed', 'message')).toBeNull()
  })
  it('isolates ambiguous request recovery by account, workspace, bot, and selected message', () => {
    const source = bot('source')
    const keys = [
      copyRequestStorageKey('a', source),
      copyRequestStorageKey('b', source),
      copyRequestStorageKey('a', { ...source, workspace_id: 'other' }),
      copyRequestStorageKey('a', bot('other')),
      copyRequestStorageKey('a', source, 'message'),
    ]
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('recovers a confirmed operation address without replacing its frozen request', () => {
    const request = {
      idempotencyKey: '82db50ef-dcae-438c-a34c-cf380b88c135',
      kind: 'duplicate',
      boundary: { kind: 'end', epoch: 'epoch', expectedRevision: 3 },
      name: 'A copy',
      parentId: null,
    }
    const saved = { request, operationId: 'operation' }
    expect(parseSavedCopyAttempt(JSON.stringify(saved))).toEqual(saved)
    expect(
      parseSavedCopyAttempt(JSON.stringify(saved), 'other-message'),
    ).toBeNull()
    expect(parseSavedCopyAttempt(JSON.stringify(request))).toEqual({ request })
    expect(
      parseSavedCopyAttempt(JSON.stringify({ ...saved, operationId: '' })),
    ).toBeNull()
  })
})

it('isolates source copy attempts and accepts legacy recovery only for the declared main', () => {
  const source = bot('source')
  const main = copyRequestStorageKey('viewer', source)
  const sibling = copyRequestStorageKey('viewer', source, undefined, 'sibling')
  expect(sibling).not.toBe(main)
  expect(
    copyRequestStorageKey(
      'viewer',
      source,
      undefined,
      source.mainConversationId,
    ),
  ).toBe(main)
  expect(() =>
    copyRequestStorageKey('viewer', {
      id: 'source',
      workspace_id: 'workspace',
    }),
  ).toThrow('Resolve')
  const request = {
    idempotencyKey: crypto.randomUUID(),
    kind: 'duplicate',
    boundary: { kind: 'end', epoch: 'epoch', expectedRevision: 1 },
    name: 'Copy',
    parentId: null,
  }
  const legacy = JSON.stringify({ request, operationId: 'existing-operation' })
  expect(
    parseSavedCopyAttempt(legacy, undefined, {
      conversationId: source.mainConversationId!,
      allowLegacy: true,
    }),
  ).toMatchObject({ operationId: 'existing-operation' })
  expect(
    parseSavedCopyAttempt(legacy, undefined, {
      conversationId: 'sibling',
      allowLegacy: false,
    }),
  ).toBeNull()
  const exact = JSON.stringify({
    request,
    operationId: 'sibling-operation',
    sourceConversationId: 'sibling',
  })
  expect(
    parseSavedCopyAttempt(exact, undefined, {
      conversationId: 'sibling',
      allowLegacy: false,
    }),
  ).toMatchObject({ operationId: 'sibling-operation' })
  expect(
    parseSavedCopyAttempt(exact, undefined, {
      conversationId: 'other',
      allowLegacy: false,
    }),
  ).toBeNull()
})

it('keeps before-message recovery separate from ordinary inclusive forks', () => {
  const source = bot('source')
  const exclusive = {
    idempotencyKey: crypto.randomUUID(),
    kind: 'fork',
    boundary: {
      kind: 'message',
      epoch: 'epoch',
      messageId: 'prompt',
      expectedDigest: 'digest',
      side: 'before',
    },
    name: 'Retry',
    parentId: null,
  }
  expect(parseSavedCopyRequest(JSON.stringify(exclusive), 'prompt')).toBeNull()
  expect(
    parseSavedCopyRequest(JSON.stringify(exclusive), 'prompt', 'before'),
  ).toEqual(exclusive)
  const saved = {
    sourceConversationId: source.mainConversationId,
    request: exclusive,
    operationId: 'operation',
  }
  expect(
    parseSavedCopyAttempt(JSON.stringify(saved), 'prompt', {
      conversationId: source.mainConversationId!,
      allowLegacy: true,
    }),
  ).toBeNull()
  expect(
    parseSavedCopyAttempt(
      JSON.stringify(saved),
      'prompt',
      { conversationId: source.mainConversationId!, allowLegacy: true },
      'before',
    ),
  ).toEqual(saved)
  expect(
    copyRequestStorageKey(
      'u',
      source,
      'prompt',
      source.mainConversationId,
      'before',
    ),
  ).not.toBe(copyRequestStorageKey('u', source, 'prompt'))
})
