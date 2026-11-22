import {
  useCloudDraft,
  cloudDraftChanged,
  applyCloudSelection,
} from './useCloudDraft'
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { maxFileBytes } from '../core/files'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import {
  persistGeneratedFile,
  readGeneratedFile,
  removeGeneratedFile,
} from './generated-file-cache'
import {
  conversationResourcePath,
  savedFileQueryKey,
  type ConversationResource,
  type ConversationDestination,
} from '../core/conversation-destination'

export const maxComposerAttachments = 5
const storedFile = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  size: z.number().int().min(0).max(maxFileBytes),
  mediaType: z.string().max(200),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  generated: z.literal(true).optional(),
})
const storedSelection = z.array(storedFile).max(maxComposerAttachments)
const metadata = storedFile.extend({
  state: z.enum(['pending', 'ready']),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
})
type StoredAttachment = z.infer<typeof storedFile>

export interface ComposerAttachment extends StoredAttachment {
  status: 'uploading' | 'ready' | 'error'
  phase?: 'checking' | 'uploading'
  error?: string
  needsFile?: boolean
}

function readSelection(key: string): StoredAttachment[] {
  try {
    const value = storedSelection.safeParse(
      JSON.parse(localStorage.getItem(key) ?? '[]'),
    )
    if (!value.success) return []
    return value.data.filter(
      (item, index, all) =>
        all.findIndex((candidate) => candidate.id === item.id) === index,
    )
  } catch {
    return []
  }
}
function writeSelection(key: string, items: StoredAttachment[]) {
  try {
    const selection = items.map(
      ({ id, name, size, mediaType, sha256, generated }) => ({
        id,
        name,
        size,
        mediaType,
        ...(sha256 ? { sha256 } : {}),
        ...(generated ? { generated } : {}),
      }),
    )
    if (selection.length) {
      const serialized = JSON.stringify(selection)
      localStorage.setItem(key, serialized)
      cloudDraftChanged(key, serialized)
      return localStorage.getItem(key) === serialized
    }
    localStorage.removeItem(key)
    cloudDraftChanged(key, '')
    return localStorage.getItem(key) === null
  } catch {
    // Selection still works for this page when device storage is unavailable.
    return false
  }
}

export class AttachmentContentMismatch extends Error {
  constructor() {
    super(
      'This is a different file. Choose the original, or remove this attachment and attach the new file.',
    )
  }
}

export async function verifyComposerOriginal(
  file: File,
  expected: { name: string; size: number; sha256?: string },
) {
  if (file.name !== expected.name || file.size !== expected.size)
    throw new AttachmentContentMismatch()
  if (file.size > maxFileBytes)
    throw new Error('Each attachment must be 2 MB or smaller.')
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  const digest = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  if (expected.sha256 && expected.sha256 !== digest)
    throw new AttachmentContentMismatch()
  return digest
}

export function composerAttachmentStoragePath(input: {
  botId: string
  resourcePath?: string
  destination?: ConversationResource & {
    compatibility?: ConversationDestination['compatibility']
  }
}) {
  return input.destination
    ? (input.destination.compatibility?.resourcePath ??
        conversationResourcePath(input.destination))
    : (input.resourcePath ?? `bots/${encodeURIComponent(input.botId)}`)
}

export function useComposerAttachments({
  botId,
  userId,
  readOnly = false,
  visible = true,
  resourcePath,
  destination,
}: {
  botId: string
  userId: string
  visible?: boolean
  readOnly?: boolean
  /** Workspace-relative owner, including bot-drafts/:draftId before first send. */
  resourcePath?: string
  /** Exact API owner; resourcePath remains the existing device storage alias. */
  destination?: ConversationResource & {
    compatibility?: ConversationDestination['compatibility']
  }
}) {
  const api = useWorkspaceApi()
  const queryClient = useQueryClient()
  const storagePath = composerAttachmentStoragePath({
    botId,
    resourcePath,
    destination,
  })
  const basePath = destination
    ? conversationResourcePath(destination)
    : storagePath
  const generatedScope = JSON.stringify([userId, api.workspaceId, basePath])
  const key = JSON.stringify([
    'gum',
    'composer-attachments',
    1,
    userId,
    api.workspaceId,
    storagePath,
  ])
  const sync = useCloudDraft(
    userId,
    key,
    () => localStorage.getItem(key) ?? '',
    (value) => {
      if (value) storedSelection.parse(JSON.parse(value))
      applyCloudSelection(key, value)
    },
    visible,
  )
  const scope = useRef(key)
  scope.current = key
  const writable = useRef(!readOnly)
  writable.current = !readOnly
  const mounted = useRef(false)
  const current = useRef<{ key: string; items: ComposerAttachment[] } | null>(
    null,
  )
  const [selection, setSelection] = useState<typeof current.current>(null)
  const [errorState, setErrorState] = useState<{
    key: string
    message: string
  } | null>(null)
  const originals = useRef(new Map<string, File>())
  const operations = useRef(new Map<string, AbortController>())
  const liveItems = () =>
    current.current?.key === key ? current.current.items : []

  function update(
    change: (items: ComposerAttachment[]) => ComposerAttachment[],
    persist = true,
  ) {
    if (!mounted.current || scope.current !== key) return
    const next = { key, items: change(liveItems()) }
    current.current = next
    setSelection(next)
    if (persist) writeSelection(key, next.items)
  }
  function setError(message: string) {
    if (mounted.current && scope.current === key)
      setErrorState({ key, message })
  }
  function stillSelected(id: string, controller: AbortController) {
    return (
      mounted.current &&
      scope.current === key &&
      operations.current.get(id) === controller &&
      liveItems().some((item) => item.id === id)
    )
  }
  async function responseMetadata(response: Response, id: string) {
    const value = (await response.json()) as unknown
    if (!response.ok) {
      const message =
        value &&
        typeof value === 'object' &&
        'error' in value &&
        typeof value.error === 'string'
          ? value.error
          : 'The attachment could not be loaded.'
      throw new ApiError(message, response.status)
    }
    const saved = metadata.parse(value)
    if (saved.id !== id)
      throw new Error('The attachment could not be verified.')
    return saved
  }
  async function getMetadata(id: string, signal: AbortSignal) {
    return responseMetadata(
      await fetch(api.url(`${basePath}/files/${encodeURIComponent(id)}`), {
        signal,
      }),
      id,
    )
  }
  async function putFile(id: string, original: File, signal: AbortSignal) {
    return responseMetadata(
      await fetch(api.url(`${basePath}/files/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: {
          'Content-Type': original.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(original.name),
        },
        body: original,
        signal,
      }),
      id,
    )
  }

  async function run(id: string, action: 'upload' | 'check') {
    if (
      operations.current.has(id) ||
      !liveItems().some((item) => item.id === id)
    )
      return
    const controller = new AbortController()
    operations.current.set(id, controller)
    let original = originals.current.get(id)
    update(
      (items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                status: 'uploading',
                phase: action === 'upload' ? 'uploading' : 'checking',
                error: undefined,
                needsFile: false,
              }
            : item,
        ),
      false,
    )
    let attemptedUpload = false
    const finish = (saved: z.infer<typeof metadata>) => {
      if (!stillSelected(id, controller)) return
      const expected = liveItems().find((item) => item.id === id)?.sha256
      if (expected && expected !== saved.sha256)
        throw new AttachmentContentMismatch()
      update((items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...saved,
                status: saved.state === 'ready' ? 'ready' : 'error',
                ...(saved.state === 'pending'
                  ? {
                      ...(item.generated ? { generated: true as const } : {}),
                      error: 'Upload unfinished. Try again.',
                      needsFile: !original,
                    }
                  : {}),
              }
            : item,
        ),
      )
      if (saved.state === 'ready')
        void removeGeneratedFile(generatedScope, id).catch(() => {
          // The verified server file is durable even if local cleanup fails.
        })
    }
    try {
      if (original) {
        const selected = liveItems().find((item) => item.id === id)!
        const sha256 = await verifyComposerOriginal(original, selected)
        if (!stillSelected(id, controller) || controller.signal.aborted) return
        update((items) =>
          items.map((item) => (item.id === id ? { ...item, sha256 } : item)),
        )
      }
      let saved: z.infer<typeof metadata> | undefined
      let missing: ApiError | undefined
      if (action === 'check') {
        try {
          saved = await getMetadata(id, controller.signal)
        } catch (cause) {
          if (!(cause instanceof ApiError && cause.status === 404)) throw cause
          missing = cause
        }
      }
      if (
        saved?.state !== 'ready' &&
        !original &&
        liveItems().find((item) => item.id === id)?.generated
      ) {
        const cached = await readGeneratedFile(generatedScope, id)
        if (!stillSelected(id, controller) || controller.signal.aborted) return
        if (cached) {
          const selected = liveItems().find((item) => item.id === id)!
          await verifyComposerOriginal(cached, selected)
          if (!stillSelected(id, controller) || controller.signal.aborted)
            return
          original = cached
          originals.current.set(id, cached)
        }
      }
      if (missing && !original) throw missing
      if (saved?.state !== 'ready' && original && writable.current) {
        if (!stillSelected(id, controller) || controller.signal.aborted) return
        attemptedUpload = true
        update(
          (items) =>
            items.map((item) =>
              item.id === id ? { ...item, phase: 'uploading' } : item,
            ),
          false,
        )
        saved = await putFile(id, original, controller.signal)
      }
      if (saved) finish(saved)
      else throw new Error('Upload unfinished. Choose the original file again.')
    } catch (cause) {
      if (!stillSelected(id, controller) || controller.signal.aborted) return
      if (cause instanceof AttachmentContentMismatch)
        originals.current.delete(id)
      // A lost upload response is not proof that storage rejected the file.
      if (attemptedUpload) {
        update(
          (items) =>
            items.map((item) =>
              item.id === id ? { ...item, phase: 'checking' } : item,
            ),
          false,
        )
        try {
          const saved = await getMetadata(id, controller.signal)
          if (saved.state === 'ready') {
            finish(saved)
            return
          }
        } catch {
          /* Keep the original upload error and immutable retry ID. */
        }
      }
      if (!stillSelected(id, controller) || controller.signal.aborted) return
      update(
        (items) =>
          items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: 'error',
                  phase: undefined,
                  error:
                    !original &&
                    cause instanceof ApiError &&
                    cause.status === 404
                      ? 'Upload unfinished. Choose the original file again.'
                      : cause instanceof Error
                        ? cause.message
                        : 'Upload unfinished. Try again.',
                  needsFile:
                    !original || cause instanceof AttachmentContentMismatch,
                }
              : item,
          ),
        false,
      )
    } finally {
      if (operations.current.get(id) === controller)
        operations.current.delete(id)
      if (attemptedUpload && (destination || !resourcePath)) {
        void queryClient.invalidateQueries({
          queryKey: savedFileQueryKey(
            api.workspaceId,
            userId,
            destination ?? { botId },
          ),
        })
        void queryClient.invalidateQueries({
          queryKey: savedFileQueryKey(
            api.workspaceId,
            userId,
            destination ?? { botId },
            id,
          ),
        })
      }
    }
  }

  useEffect(() => {
    mounted.current = true
    const restore = () => {
      const stored = readSelection(key)
      const existing = current.current?.key === key ? current.current.items : []
      for (const id of originals.current.keys())
        if (!stored.some((item) => item.id === id)) originals.current.delete(id)
      for (const [id, controller] of operations.current)
        if (!stored.some((item) => item.id === id)) {
          controller.abort()
          operations.current.delete(id)
          originals.current.delete(id)
        }
      const next = {
        key,
        items: stored.map(
          (item): ComposerAttachment =>
            existing.find((candidate) => candidate.id === item.id) ?? {
              ...item,
              status: 'uploading',
              phase: 'checking',
            },
        ),
      }
      current.current = next
      setSelection(next)
      for (const item of stored)
        if (!existing.some((candidate) => candidate.id === item.id))
          void run(item.id, 'check')
    }
    restore()
    const storage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) restore()
    }
    window.addEventListener('storage', storage)
    return () => {
      mounted.current = false
      window.removeEventListener('storage', storage)
      for (const controller of operations.current.values()) controller.abort()
      operations.current.clear()
      originals.current.clear()
      current.current = null
    }
  }, [key])

  function addFiles(files: FileList | File[], retryId?: string) {
    if (!writable.current || !mounted.current || scope.current !== key)
      return false
    const incoming = Array.from(files)
    if (!incoming.length) return false
    setError('')
    if (incoming.some((file) => file.size > maxFileBytes)) {
      setError('Each attachment must be 2 MB or smaller.')
      return false
    }
    if (retryId) {
      const selected = liveItems().find((item) => item.id === retryId)
      const original = incoming[0]
      if (
        !selected ||
        selected.status !== 'error' ||
        incoming.length !== 1 ||
        selected.name !== original.name ||
        selected.size !== original.size
      ) {
        setError('Choose the original file to finish this upload.')
        return false
      }
      originals.current.set(retryId, original)
      void run(retryId, 'check')
      return true
    }
    if (liveItems().length + incoming.length > maxComposerAttachments) {
      setError(`Attach up to ${maxComposerAttachments} files at a time.`)
      return false
    }
    const additions = incoming.map((file): ComposerAttachment => {
      const id = crypto.randomUUID()
      originals.current.set(id, file)
      return {
        id,
        name: file.name,
        size: file.size,
        mediaType: file.type || 'application/octet-stream',
        status: 'uploading',
        phase: 'uploading',
      }
    })
    update((items) => [...items, ...additions])
    for (const item of additions) void run(item.id, 'upload')
    return true
  }
  async function addGeneratedFile(
    file: File,
    canAccept: () => boolean = () => true,
  ) {
    const allowed = () =>
      mounted.current &&
      scope.current === key &&
      writable.current &&
      liveItems().length < maxComposerAttachments &&
      canAccept()
    if (!allowed()) return false
    const id = crypto.randomUUID()
    let accepted = false
    try {
      const sha256 = await verifyComposerOriginal(file, file)
      if (!allowed()) return false
      await persistGeneratedFile(generatedScope, id, file, sha256)
      if (!allowed()) return false
      const addition: ComposerAttachment = {
        id,
        name: file.name,
        size: file.size,
        mediaType: file.type || 'application/octet-stream',
        sha256,
        generated: true,
        status: 'uploading',
        phase: 'uploading',
      }
      if (!writeSelection(key, [...liveItems(), addition]))
        throw new Error(
          'The sketch could not be saved on this device. Keep it open and try again.',
        )
      originals.current.set(id, file)
      update((items) => [...items, addition], false)
      accepted = true
      setError('')
      void run(id, 'upload')
      return true
    } catch (cause) {
      const error =
        cause instanceof Error
          ? cause
          : new Error(
              'The sketch could not be saved on this device. Try again.',
            )
      setError(error.message)
      throw error
    } finally {
      if (!accepted)
        await removeGeneratedFile(generatedScope, id).catch(() => {})
    }
  }
  function remove(id: string) {
    operations.current.get(id)?.abort()
    operations.current.delete(id)
    originals.current.delete(id)
    update((items) => items.filter((item) => item.id !== id))
    void removeGeneratedFile(generatedScope, id).catch(() => {})
  }
  function retry(id: string) {
    if (!readOnly) void run(id, 'check')
  }
  function clearSubmitted(ids: string[]) {
    const submitted = new Set(ids)
    for (const id of ids)
      void removeGeneratedFile(generatedScope, id).catch(() => {})
    // This may run after the original composer unmounted while a send completed.
    writeSelection(
      key,
      readSelection(key).filter((item) => !submitted.has(item.id)),
    )
    if (scope.current === key && mounted.current) {
      for (const id of ids) {
        operations.current.get(id)?.abort()
        operations.current.delete(id)
        originals.current.delete(id)
      }
      update((items) => items.filter((item) => !submitted.has(item.id)), false)
    }
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return true
      const parsed = storedSelection.safeParse(JSON.parse(raw))
      return (
        parsed.success && !parsed.data.some((item) => submitted.has(item.id))
      )
    } catch {
      return false
    }
  }
  const items = selection?.key === key ? selection.items : []
  return {
    /** Includes the viewer and exact conversation or unsent draft owner. */
    scopeKey: generatedScope,
    sync,
    items,
    readyIds: items
      .filter((item) => item.status === 'ready')
      .map((item) => item.id),
    busy:
      selection?.key !== key ||
      items.some((item) => item.status === 'uploading'),
    hasAttachments: items.length > 0,
    error: errorState?.key === key ? errorState.message || null : null,
    clearError: () => setError(''),
    addFiles,
    addGeneratedFile,
    remove,
    retry,
    clearSubmitted,
    onDragOver(event: DragEvent<HTMLElement>) {
      if (!event.dataTransfer.types.includes('Files')) return
      event.preventDefault()
      event.dataTransfer.dropEffect = readOnly ? 'none' : 'copy'
    },
    onDrop(event: DragEvent<HTMLElement>) {
      if (!event.dataTransfer.types.includes('Files')) return
      event.preventDefault()
      addFiles(event.dataTransfer.files)
    },
    onPaste(event: ClipboardEvent<HTMLElement>) {
      if (!event.clipboardData.files.length) return
      if (!event.clipboardData.getData('text/plain')) event.preventDefault()
      addFiles(event.clipboardData.files)
    },
  }
}

export type ComposerAttachmentsController = ReturnType<
  typeof useComposerAttachments
>
