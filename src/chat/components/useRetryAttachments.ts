import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from 'react'
import { z } from 'zod'
import type { ConversationDestination } from '../core/conversation-destination'
import { maxFileBytes, uploadMediaType } from '../core/files'
import {
  messageAttachmentSchema,
  type MessageAttachment,
} from '../core/message-attachments'
import type {
  RetryDraftEditor,
  RetryDraftEditorState,
} from '../core/retry-draft-editor'
import type {
  RetryDraftContent,
  RetryPendingAttachment,
} from '../core/retry-draft'
import {
  verifyComposerOriginal,
  type ComposerAttachment,
} from './useComposerAttachments'
import {
  persistGeneratedFile,
  readGeneratedFile,
  removeGeneratedFile,
} from './generated-file-cache'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'

const storedMetadata = messageAttachmentSchema.extend({
  state: z.enum(['pending', 'ready']),
})
export function parseRetryAttachment(
  raw: unknown,
  expected: MessageAttachment | RetryPendingAttachment,
  destination: Pick<ConversationDestination, 'botId' | 'conversationId'>,
) {
  const saved = storedMetadata.parse(raw)
  if (
    saved.id !== expected.id ||
    saved.botId !== destination.botId ||
    saved.conversationId !== destination.conversationId ||
    saved.sha256 !== expected.sha256 ||
    saved.size !== expected.size ||
    saved.name !== expected.name ||
    saved.mediaType !== expected.mediaType ||
    ('source' in expected && saved.source !== expected.source)
  )
    throw new Error('The attachment no longer matches the selected file.')
  return saved
}
const countFiles = (draft: RetryDraftContent) =>
  draft.attachments.length +
  (draft.pendingAttachments?.length ?? 0) +
  draft.references.filter((reference) => reference.kind === 'file').length

export function useRetryAttachments(
  editor: RetryDraftEditor,
  state: RetryDraftEditorState,
  destination: ConversationDestination,
  locked: boolean,
) {
  const api = useWorkspaceApi()
  const scopeKey = editor.store.key
  const [status, setStatus] = useState<
    Record<
      string,
      Pick<ComposerAttachment, 'status' | 'phase' | 'error' | 'needsFile'>
    >
  >({})
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const current = useRef({ state, locked })
  current.current = { state, locked }
  const originals = useRef(new Map<string, File>())
  const operations = useRef(new Map<string, AbortController>())
  const checked = useRef(new Set<string>())
  const mounted = useRef(true)
  const selected = (id: string) => {
    const draft = editor.snapshot().draft
    return (
      draft?.attachments.find((item) => item.id === id) ??
      draft?.pendingAttachments?.find((item) => item.id === id)
    )
  }
  const publish = (id: string, value: (typeof status)[string]) => {
    if (mounted.current) setStatus((previous) => ({ ...previous, [id]: value }))
  }
  const fail = (cause: unknown) => {
    if (mounted.current)
      setError(
        cause instanceof Error
          ? cause.message
          : 'The file could not be attached.',
      )
  }
  async function run(id: string) {
    if (operations.current.has(id) || !selected(id) || current.current.locked)
      return
    const controller = new AbortController()
    operations.current.set(id, controller)
    checked.current.add(id)
    publish(id, { status: 'uploading', phase: 'checking' })
    let original = originals.current.get(id)
    try {
      const expected = selected(id)!
      const path = api.url(
        `${destination.apiPath}/files/${encodeURIComponent(id)}`,
      )
      const parse = async (response: Response) => {
        const raw = await response.json()
        if (!response.ok)
          throw new ApiError(
            typeof raw?.error === 'string'
              ? raw.error
              : 'The attachment could not be loaded.',
            response.status,
          )
        return parseRetryAttachment(raw, expected, destination)
      }
      let saved: z.infer<typeof storedMetadata> | undefined
      try {
        saved = await parse(await fetch(path, { signal: controller.signal }))
      } catch (cause) {
        if (!(cause instanceof ApiError && cause.status === 404)) throw cause
      }
      if (saved?.state !== 'ready') {
        if (!original && 'generated' in expected && expected.generated)
          original = await readGeneratedFile(scopeKey, id)
        if (!original)
          throw new Error('Choose the original file to finish this upload.')
        await verifyComposerOriginal(original, expected)
        if (!(await editor.flush()) || !selected(id) || current.current.locked)
          throw new Error('Save the draft before continuing this upload.')
        publish(id, { status: 'uploading', phase: 'uploading' })
        saved = await parse(
          await fetch(path, {
            method: 'PUT',
            signal: controller.signal,
            headers: {
              'Content-Type': expected.mediaType,
              'X-File-Name': encodeURIComponent(expected.name),
            },
            body: original,
          }),
        )
      }
      if (controller.signal.aborted || !selected(id)) return
      const ready = messageAttachmentSchema.parse(saved)
      if (
        editor
          .snapshot()
          .draft?.pendingAttachments?.some((item) => item.id === id)
      ) {
        const updated = await editor.change((draft) =>
          draft.pendingAttachments?.some((item) => item.id === id)
            ? {
                ...draft,
                attachments: [...draft.attachments, ready],
                pendingAttachments: draft.pendingAttachments.filter(
                  (item) => item.id !== id,
                ),
              }
            : draft,
        )
        if (!updated)
          throw new Error(
            'The file uploaded, but its selection is not saved. Resolve the draft change, then retry.',
          )
      }
      publish(id, { status: 'ready' })
      void removeGeneratedFile(scopeKey, id).catch(() => {})
    } catch (cause) {
      if (!controller.signal.aborted && selected(id))
        publish(id, {
          status: 'error',
          error:
            cause instanceof Error
              ? cause.message
              : 'The attachment could not be verified.',
          needsFile: !original,
        })
    } finally {
      operations.current.delete(id)
    }
  }
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      for (const operation of operations.current.values()) operation.abort()
      operations.current.clear()
    }
  }, [editor])
  useEffect(() => {
    const files = [
      ...(state.draft?.attachments ?? []),
      ...(state.draft?.pendingAttachments ?? []),
    ]
    for (const [id, operation] of operations.current)
      if (!files.some((file) => file.id === id)) operation.abort()
    if (!state.ready || state.saving || state.dirty || state.error || locked)
      return
    for (const file of files)
      if (!checked.current.has(file.id)) void run(file.id)
  }, [state.ready, state.draft, state.saving, state.dirty, state.error, locked])

  async function attach(
    file: File,
    generated: boolean,
    canAccept = () => true,
  ) {
    const allowed = () =>
      mounted.current &&
      !current.current.locked &&
      !editor.snapshot().document?.consumed &&
      !!editor.snapshot().draft &&
      countFiles(editor.snapshot().draft!) < 5 &&
      canAccept()
    if (!allowed()) return false
    const id = crypto.randomUUID()
    const sha256 = await verifyComposerOriginal(file, file)
    if (!allowed()) return false
    const pending: RetryPendingAttachment = {
      id,
      name: file.name,
      size: file.size,
      mediaType: uploadMediaType(file.name, file.type),
      sha256,
      ...(generated ? { generated: true } : {}),
    }
    if (generated) await persistGeneratedFile(scopeKey, id, file, sha256)
    if (!allowed()) {
      if (generated) void removeGeneratedFile(scopeKey, id).catch(() => {})
      return false
    }
    originals.current.set(id, file)
    const added = await editor.change((draft) => ({
      ...draft,
      pendingAttachments: [...(draft.pendingAttachments ?? []), pending],
    }))
    if (!added) return false
    void run(id)
    return true
  }
  function addFiles(files: FileList | File[], retryId?: string) {
    if (current.current.locked || !mounted.current) return false
    const incoming = Array.from(files)
    if (!incoming.length) return false
    if (incoming.some((file) => file.size > maxFileBytes)) {
      setError('Each attachment must be 2 MB or smaller.')
      return false
    }
    if (retryId) {
      if (incoming.length !== 1 || !selected(retryId)) return false
      originals.current.set(retryId, incoming[0])
      void run(retryId)
      return true
    }
    if (
      !editor.snapshot().draft ||
      countFiles(editor.snapshot().draft!) + incoming.length > 5
    ) {
      setError('Select up to 5 files, including references.')
      return false
    }
    setAdding(true)
    setError('')
    void (async () => {
      try {
        for (const file of incoming) if (!(await attach(file, false))) break
      } catch (cause) {
        fail(cause)
      } finally {
        if (mounted.current) setAdding(false)
      }
    })()
    return true
  }
  const remove = async (id: string) => {
    if (current.current.locked) return
    operations.current.get(id)?.abort()
    originals.current.delete(id)
    const removed = await editor.change((draft) => ({
      ...draft,
      attachments: draft.attachments.filter((file) => file.id !== id),
      pendingAttachments: draft.pendingAttachments?.filter(
        (file) => file.id !== id,
      ),
    }))
    if (removed) void removeGeneratedFile(scopeKey, id).catch(() => {})
  }
  const items: ComposerAttachment[] = [
    ...(state.draft?.attachments ?? []),
    ...(state.draft?.pendingAttachments ?? []),
  ].map((file) => ({
    ...file,
    ...(status[file.id] ??
      (locked
        ? 'state' in file
          ? { status: 'ready' as const }
          : {
              status: 'error' as const,
              error: 'Upload not finished.',
              needsFile: true,
            }
        : { status: 'uploading' as const, phase: 'checking' as const })),
  }))
  return {
    scopeKey,
    items,
    error,
    busy: adding || items.some((file) => file.status === 'uploading'),
    valid:
      !adding &&
      !state.draft?.pendingAttachments?.length &&
      items.every((file) => file.status === 'ready'),
    addFiles,
    remove,
    retry: (id: string) => {
      if (!current.current.locked) void run(id)
    },
    addGeneratedFile: async (file: File, canAccept?: () => boolean) => {
      try {
        return await attach(file, true, canAccept)
      } catch (cause) {
        fail(cause)
        throw cause
      }
    },
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (event.dataTransfer.types.includes('Files')) {
        event.preventDefault()
        event.dataTransfer.dropEffect = locked ? 'none' : 'copy'
      }
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      if (event.dataTransfer.types.includes('Files')) {
        event.preventDefault()
        addFiles(event.dataTransfer.files)
      }
    },
    onPaste: (event: ClipboardEvent<HTMLElement>) => {
      if (event.clipboardData.files.length) {
        if (!event.clipboardData.getData('text/plain')) event.preventDefault()
        addFiles(event.clipboardData.files)
      }
    },
  }
}
