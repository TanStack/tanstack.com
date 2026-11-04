import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  messageAttachmentMetadata,
  messageAttachmentsSchema,
  parseAttachmentFileIds,
  readMessageAttachments,
  type MessageAttachment,
} from '../../src/chat/core/message-attachments'
import { resolveMessageAttachments } from '../../src/chat/server/message-attachments'
import { SavedFileError, SavedFiles } from '../../src/chat/server/saved-files'
import { maxFileBytes } from '../../src/chat/core/files'

const fileEnvironment = {
  FILES: {
    async put() {
      throw new Error('Unexpected file write in metadata resolution')
    },
    async head() {
      throw new Error('Unexpected file lookup in metadata resolution')
    },
    async get() {
      throw new Error('Unexpected file read in metadata resolution')
    },
  },
}

const id = 'abcdef00-1234-4567-89ab-012345678901'
const second = 'abcdef00-1234-4567-89ab-012345678902'
const scope = { workspaceId: 'workspace', userId: 'user', botId: 'bot' }
const attachment: MessageAttachment = {
  id,
  botId: 'bot',
  name: 'notes.txt',
  mediaType: 'text/plain',
  size: 12,
  sha256: 'a'.repeat(64),
  source: 'upload',
  state: 'ready',
  createdAt: 100,
}
afterEach(() => vi.restoreAllMocks())

describe('message attachment references', () => {
  it('accepts bounded unique IDs in user order and normalizes UUID casing', () => {
    expect(parseAttachmentFileIds(undefined)).toEqual([])
    expect(parseAttachmentFileIds([second, id.toUpperCase()])).toEqual([
      second,
      id,
    ])
    expect(
      parseAttachmentFileIds(
        Array.from({ length: 5 }, () => crypto.randomUUID()),
      ),
    ).toHaveLength(5)
  })
  it('rejects duplicate aliases, excessive refs, and arbitrary URL/path payloads before fetching', async () => {
    const get = vi.spyOn(SavedFiles.prototype, 'get')
    for (const refs of [
      null,
      id,
      [id, id.toUpperCase()],
      Array.from({ length: 6 }, () => crypto.randomUUID()),
      ['https://private.example/file'],
      ['../../secret'],
      [{ id, url: 'https://evil.example' }],
    ])
      await expect(
        resolveMessageAttachments(fileEnvironment, scope, refs),
      ).rejects.toThrow()
    expect(get).not.toHaveBeenCalled()
  })
  it('resolves trusted ready metadata in reference order and strips extra payloads', async () => {
    const get = vi
      .spyOn(SavedFiles.prototype, 'get')
      .mockImplementation(async (fileId) => ({
        ...attachment,
        id: fileId,
        url: 'https://private.example/key',
        bytes: 'private contents',
      }))
    const resolved = await resolveMessageAttachments(fileEnvironment, scope, [
      second,
      id,
    ])
    expect(resolved).toEqual([{ ...attachment, id: second }, attachment])
    expect(get.mock.calls).toEqual([[second], [id]])
    const metadata = messageAttachmentMetadata(resolved)
    expect(JSON.stringify(metadata)).not.toMatch(/private|https|bytes|url/)
    expect(readMessageAttachments({ metadata })).toEqual(resolved)
    expect(readMessageAttachments({ metadata })[0]).not.toBe(resolved[0])
  })
  it('propagates denied access and rejects pending or inconsistent scoped metadata', async () => {
    const get = vi.spyOn(SavedFiles.prototype, 'get')
    get.mockRejectedValueOnce(new SavedFileError('File not found.', 404))
    await expect(
      resolveMessageAttachments(fileEnvironment, scope, [id]),
    ).rejects.toMatchObject({ status: 404 })
    get.mockResolvedValueOnce({ ...attachment, state: 'pending' })
    await expect(
      resolveMessageAttachments(fileEnvironment, scope, [id]),
    ).rejects.toMatchObject({ status: 409 })
    for (const file of [
      { ...attachment, botId: 'other' },
      { ...attachment, id: second },
      { ...attachment, size: maxFileBytes + 1 },
    ]) {
      get.mockResolvedValueOnce(file)
      await expect(
        resolveMessageAttachments(fileEnvironment, scope, [id]),
      ).rejects.toMatchObject({ status: 503 })
    }
  })
  it('reads old or malformed history safely without making metadata into authority', () => {
    for (const message of [
      null,
      {},
      { metadata: null },
      { metadata: 'private' },
      { metadata: { gumAttachments: 'https://evil.example' } },
      { metadata: { gumAttachments: Array(6).fill(attachment) } },
    ])
      expect(readMessageAttachments(message)).toEqual([])
    const malformed = [
      null,
      { ...attachment, state: 'pending' },
      { ...attachment, name: '../escape' },
      { ...attachment, botId: 'https://evil.example' },
      { ...attachment, mediaType: 'text/html\r\nx: bad' },
      { ...attachment, sha256: 'not-a-hash' },
      { ...attachment, size: -1 },
      { ...attachment, createdAt: Infinity },
    ]
    for (const bad of malformed)
      expect(
        readMessageAttachments({
          metadata: { gumAttachments: [bad, attachment] },
        }),
      ).toEqual([attachment])
    expect(
      readMessageAttachments({
        metadata: {
          gumAttachments: [attachment, { ...attachment, id: id.toUpperCase() }],
        },
      }),
    ).toEqual([attachment])
  })
  it('strict metadata materialization rejects duplicates and invalid snapshots', () => {
    expect(messageAttachmentMetadata([])).toBeUndefined()
    expect(() => messageAttachmentMetadata([attachment, attachment])).toThrow()
    expect(() =>
      messageAttachmentsSchema.parse([{ ...attachment, state: 'pending' }]),
    ).toThrow()
  })
})
