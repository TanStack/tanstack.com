import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  ComposerAttachments,
  composerSketchDisabledReason,
} from '../../src/chat/components/ComposerAttachments'
import {
  AttachmentContentMismatch,
  verifyComposerOriginal,
  type ComposerAttachmentsController,
} from '../../src/chat/components/useComposerAttachments'
import { maxFileBytes } from '../../src/chat/core/files'

describe('immutable attachment retries', () => {
  const sha256 =
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  it('fingerprints original bytes and accepts the same file after reload', async () => {
    const file = new File(['abc'], 'notes.txt', { type: 'text/plain' })
    expect(
      await verifyComposerOriginal(file, { name: 'notes.txt', size: 3 }),
    ).toBe(sha256)
    expect(
      await verifyComposerOriginal(file, {
        name: 'notes.txt',
        size: 3,
        sha256,
      }),
    ).toBe(sha256)
  })
  it('rejects changed bytes even when name and size match', async () => {
    await expect(
      verifyComposerOriginal(new File(['abd'], 'notes.txt'), {
        name: 'notes.txt',
        size: 3,
        sha256,
      }),
    ).rejects.toBeInstanceOf(AttachmentContentMismatch)
  })
  it('rejects another name, size, or a file above the upload limit', async () => {
    await expect(
      verifyComposerOriginal(new File(['abc'], 'other.txt'), {
        name: 'notes.txt',
        size: 3,
        sha256,
      }),
    ).rejects.toBeInstanceOf(AttachmentContentMismatch)
    await expect(
      verifyComposerOriginal(new File(['abcd'], 'notes.txt'), {
        name: 'notes.txt',
        size: 3,
        sha256,
      }),
    ).rejects.toBeInstanceOf(AttachmentContentMismatch)
    const large = new File([new Uint8Array(maxFileBytes + 1)], 'large.txt')
    await expect(
      verifyComposerOriginal(large, { name: large.name, size: large.size }),
    ).rejects.toThrow('2 MB')
  })
})

function controller(
  items: ComposerAttachmentsController['items'],
): ComposerAttachmentsController {
  return {
    scopeKey: JSON.stringify(['user', 'workspace', 'conversations/main']),
    sync: {
      changed: vi.fn(),
      conflict: undefined,
      error: false,
      resolve: vi.fn(),
    },
    items,
    readyIds: items
      .filter((item) => item.status === 'ready')
      .map((item) => item.id),
    busy: items.some((item) => item.status === 'uploading'),
    hasAttachments: items.length > 0,
    error: null,
    clearError: vi.fn(),
    addFiles: vi.fn(),
    addGeneratedFile: vi.fn(),
    remove: vi.fn(),
    retry: vi.fn(),
    clearSubmitted: vi.fn(),
    onDragOver: vi.fn(),
    onDrop: vi.fn(),
    onPaste: vi.fn(),
  }
}
describe('composer attachment controls', () => {
  it('renders filenames as text and exposes upload, retry, and remove states accessibly', () => {
    const attachments = controller([
      {
        id: 'one',
        name: '<img src=x onerror=alert(1)>.txt',
        size: 3,
        mediaType: 'text/plain',
        status: 'uploading',
        phase: 'checking',
      },
      {
        id: 'two',
        name: 'retry.txt',
        size: 3,
        mediaType: 'text/plain',
        status: 'error',
        needsFile: true,
        error: 'Upload unfinished.',
      },
    ])
    const html = renderToStaticMarkup(
      createElement(ComposerAttachments, { attachments }),
    )
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
    expect(html).toContain('Checking…')
    expect(html).toContain('aria-label="Attach files"')
    expect(html).toContain('aria-label="Choose original file for retry.txt"')
    expect(html).toContain('aria-label="Remove attachment retry.txt"')
    expect(html).toContain('Upload unfinished.')
  })
  it('disables adding at the five-file limit while keeping removal available', () => {
    const attachments = controller(
      Array.from({ length: 5 }, (_, index) => ({
        id: String(index),
        name: `file-${index}.txt`,
        size: 3,
        mediaType: 'text/plain',
        status: 'ready' as const,
      })),
    )
    const html = renderToStaticMarkup(
      createElement(ComposerAttachments, { attachments }),
    )
    expect(
      html.match(/<button[^>]*aria-label="Attach files"[^>]*>/)?.[0],
    ).toContain('aria-disabled="true"')
    expect(
      html.match(
        /<button[^>]*aria-label="Remove attachment file-0.txt"[^>]*>/,
      )?.[0],
    ).not.toContain('aria-disabled="true"')
  })
})

describe('sketch attachment admission', () => {
  const choice = {
    selection: {
      provider: 'included' as const,
      model: '@cf/moonshotai/kimi-k2.6',
    },
    label: 'Kimi K2.6',
    providerLabel: 'Included',
    attachments: ['image' as const],
    reasoning: [],
  }
  const model = { valid: true, loading: false, error: '', choice }
  it('requires a verified image choice and never infers image support from a model name', () => {
    expect(
      composerSketchDisabledReason({ fileCount: 0, model }),
    ).toBeUndefined()
    expect(
      composerSketchDisabledReason({
        fileCount: 0,
        model: { ...model, choice: { ...choice, attachments: [] } },
      }),
    ).toMatch(/supports images/)
    expect(
      composerSketchDisabledReason({
        fileCount: 0,
        model: { ...model, choice: undefined },
      }),
    ).toMatch(/supports images/)
  })
  it('rejects policy restrictions, loading, read-only conversations and unresolved sends', () => {
    expect(
      composerSketchDisabledReason({
        fileCount: 0,
        model: {
          ...model,
          valid: false,
          error: 'Your workspace does not allow this model.',
        },
      }),
    ).toBe('Your workspace does not allow this model.')
    expect(
      composerSketchDisabledReason({
        fileCount: 0,
        model: { ...model, loading: true },
      }),
    ).toMatch(/Loading/)
    expect(
      composerSketchDisabledReason({ fileCount: 0, model, readOnly: true }),
    ).toMatch(/read-only/)
    expect(
      composerSketchDisabledReason({ fileCount: 0, model, locked: true }),
    ).toMatch(/pending send/)
    expect(
      composerSketchDisabledReason({
        fileCount: 0,
        model,
        assistantMode: false,
      }),
    ).toMatch(/Assistant mode/)
  })
  it('counts uploaded files and saved-file references against the same five-file limit', () => {
    const uploadedFiles = 2
    const savedFileReferences = 3
    expect(
      composerSketchDisabledReason({
        fileCount: uploadedFiles + savedFileReferences,
        model,
      }),
    ).toMatch(/limit is 5/)
    expect(
      composerSketchDisabledReason({
        fileCount: uploadedFiles + savedFileReferences - 1,
        model,
      }),
    ).toBeUndefined()
  })
})
