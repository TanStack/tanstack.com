import { LoadingState } from './ui/LoadingState'
import { Button } from './ui/Button'
import { useSavedFiles } from './useSavedFiles'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Menu } from '@base-ui/react/menu'
import { Tooltip } from '@base-ui/react/tooltip'
import {
  Code,
  Download,
  Eye,
  File as FileIcon,
  GitCompareArrows,
  RotateCw,
  Upload,
  X,
} from 'lucide-react'
import {
  isPreviewImage,
  isTextFile,
  maxFileBytes,
  type SavedFile,
} from '../core/files'
import { IconButton } from './IconButton'
import { CopyButton } from './CopyButton'
import { SavedFileText, isHtmlFile, isMarkdownFile } from './SavedFileText'
import { PortalContainer } from './PortalContainer'
import { compareFileText } from '../core/file-diff'
import { ApiError, useWorkspaceApi } from './WorkspaceApi'
import {
  conversationResourcePath,
  conversationFilePath,
  savedFileQueryKey,
  type ConversationResource,
} from '../core/conversation-destination'
import './saved-files.css'

const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : bytes >= 1024
      ? `${Math.ceil(bytes / 1024)} KB`
      : `${bytes} B`
const accessDenied = (error: unknown) =>
  error instanceof ApiError && [401, 403, 404].includes(error.status)

type FilesProps = {
  botId: string
  userId: string
  readOnly: boolean
  onOpen: (id: string) => void
  destination?: ConversationResource
}
type UploadAttempt = {
  id: string
  file: File
  state: 'uploading' | 'checking' | 'unfinished'
  error?: string
}

export function ConversationFiles(props: FilesProps) {
  const { workspaceId } = useWorkspaceApi()
  return (
    <FileLibrary
      key={JSON.stringify([
        workspaceId,
        props.userId,
        conversationResourcePath(props.destination ?? { botId: props.botId }),
      ])}
      {...props}
    />
  )
}

function FileLibrary({
  botId,
  userId,
  readOnly,
  onOpen,
  destination,
}: FilesProps) {
  const source = destination ?? { botId }
  const api = useWorkspaceApi()
  const queryClient = useQueryClient()
  const query = useSavedFiles(botId, userId, source)
  const [attempts, setAttempts] = useState<Record<string, UploadAttempt>>({})
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const retryId = useRef<string | undefined>(undefined)
  const controllers = useRef(new Map<string, AbortController>())
  const mounted = useRef(true)
  const dragDepth = useRef(0)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      for (const controller of controllers.current.values()) controller.abort()
    }
  }, [])
  const files = query.data?.files ?? []
  const busy = Object.values(attempts).some(
    (attempt) => attempt.state !== 'unfinished',
  )

  useEffect(() => {
    const ready = new Set(
      files.filter((file) => file.state === 'ready').map((file) => file.id),
    )
    if (!ready.size) return
    setAttempts((previous) => {
      if (!Object.keys(previous).some((id) => ready.has(id))) return previous
      return Object.fromEntries(
        Object.entries(previous).filter(([id]) => !ready.has(id)),
      )
    })
  }, [query.data])

  async function upload(file: File, id: string = crypto.randomUUID()) {
    if (readOnly || controllers.current.has(id)) return
    setError('')
    if (file.size > maxFileBytes) {
      setError('Choose a file no larger than 2 MB.')
      return
    }
    const controller = new AbortController()
    controllers.current.set(id, controller)
    setAttempts((previous) => ({
      ...previous,
      [id]: { id, file, state: 'uploading' },
    }))
    try {
      const response = await fetch(api.url(conversationFilePath(source, id)), {
        method: 'PUT',
        headers: {
          'X-File-Name': encodeURIComponent(file.name),
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
        signal: controller.signal,
      })
      const saved = (await response.json()) as SavedFile & { error?: string }
      if (!response.ok)
        throw new ApiError(saved.error ?? 'Upload failed.', response.status)
      queryClient.setQueryData(
        savedFileQueryKey(api.workspaceId, userId, source, id),
        saved,
      )
      if (saved.state === 'ready')
        queryClient.setQueryData<{ files: SavedFile[] }>(
          savedFileQueryKey(api.workspaceId, userId, source),
          (previous) => ({
            files: [
              ...(previous?.files ?? []).filter((item) => item.id !== id),
              saved,
            ],
          }),
        )
      if (mounted.current && saved.state === 'ready')
        setAttempts((previous) => {
          const { [id]: _finished, ...rest } = previous
          return rest
        })
    } catch (cause) {
      if (mounted.current)
        setAttempts((previous) => ({
          ...previous,
          [id]: {
            id,
            file,
            state: 'checking',
            error: controller.signal.aborted
              ? undefined
              : cause instanceof Error
                ? cause.message
                : 'Upload failed.',
          },
        }))
    } finally {
      if (mounted.current)
        setAttempts((previous) =>
          previous[id]
            ? {
                ...previous,
                [id]: { ...previous[id], state: 'checking' },
              }
            : previous,
        )
      // A cancelled request may have reached storage. Reconcile without its signal.
      void queryClient.invalidateQueries({
        queryKey: savedFileQueryKey(api.workspaceId, userId, source),
      })
      try {
        const saved = await api.request<SavedFile>(
          conversationFilePath(source, id),
        )
        queryClient.setQueryData(
          savedFileQueryKey(api.workspaceId, userId, source, id),
          saved,
        )
        if (saved.state === 'ready') {
          queryClient.setQueryData<{ files: SavedFile[] }>(
            savedFileQueryKey(api.workspaceId, userId, source),
            (previous) => ({
              files: [
                ...(previous?.files ?? []).filter((item) => item.id !== id),
                saved,
              ],
            }),
          )
          if (mounted.current)
            setAttempts((previous) => {
              const { [id]: _finished, ...rest } = previous
              return rest
            })
        } else if (mounted.current)
          setAttempts((previous) => ({
            ...previous,
            [id]: { ...previous[id], id, file, state: 'unfinished' },
          }))
      } catch {
        if (mounted.current)
          setAttempts((previous) =>
            previous[id]
              ? {
                  ...previous,
                  [id]: { ...previous[id], state: 'unfinished' },
                }
              : previous,
          )
      } finally {
        if (controllers.current.get(id) === controller)
          controllers.current.delete(id)
      }
    }
  }

  function choose(id?: string) {
    retryId.current = id
    input.current?.click()
  }
  function receive(incoming: FileList | null) {
    if (!incoming?.length || readOnly || busy) return
    if (incoming.length !== 1) {
      setError('Choose one file at a time.')
      return
    }
    const id = retryId.current
    retryId.current = undefined
    void upload(incoming[0], id)
  }
  const rows = [
    ...files,
    ...Object.values(attempts)
      .filter((attempt) => !files.some((file) => file.id === attempt.id))
      .map((attempt) => ({
        id: attempt.id,
        name: attempt.file.name,
        size: attempt.file.size,
        state: 'pending' as const,
        mediaType: attempt.file.type,
      })),
  ]
  if (accessDenied(query.error))
    return (
      <div className="saved-files">
        <p role="alert">Files are unavailable.</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void query.refetch()}
        >
          Retry
        </Button>
      </div>
    )
  return (
    <div
      className={`saved-files${dragging ? ' is-dragging' : ''}`}
      onDragEnter={(event) => {
        if (readOnly || busy || !event.dataTransfer.types.includes('Files'))
          return
        event.preventDefault()
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        event.dataTransfer.dropEffect = readOnly || busy ? 'none' : 'copy'
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (!dragDepth.current) setDragging(false)
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        retryId.current = undefined
        receive(event.dataTransfer.files)
      }}
    >
      <div className="saved-files-toolbar">
        {!readOnly && (
          <>
            <input
              ref={input}
              type="file"
              hidden
              onChange={(event) => {
                receive(event.target.files)
                event.target.value = ''
              }}
            />
            <Button
              variant="secondary"
              className="saved-files-upload"
              type="button"
              disabled={busy}
              onClick={() => choose()}
            >
              <Upload size={15} aria-hidden /> Upload
            </Button>
          </>
        )}
        <IconButton
          label="Refresh files"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RotateCw size={15} aria-hidden />
        </IconButton>
      </div>
      {!readOnly && (
        <p className="saved-files-note">
          2 MB per file · 100 files · 50 MB total
        </p>
      )}
      {!readOnly && (
        <p className="saved-files-note">
          Saving a file does not attach it to a message.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {query.isPending && <LoadingState>Loading files…</LoadingState>}
      {query.error && (
        <p className="error" role="alert">
          Files could not be refreshed. {query.error.message}
        </p>
      )}
      {!query.isPending && !query.error && !rows.length && (
        <p className="saved-files-empty">No files saved.</p>
      )}
      {!!rows.length && (
        <ul className="saved-file-list">
          {rows.map((file) => {
            const attempt = attempts[file.id]
            const uploading = attempt?.state === 'uploading'
            const checking = attempt?.state === 'checking'
            return (
              <li key={file.id}>
                <FileIcon size={17} aria-hidden />
                <div className="saved-file-info">
                  {file.state === 'ready' ? (
                    <button
                      type="button"
                      className="saved-file-name"
                      onClick={() => onOpen(file.id)}
                    >
                      {file.name}
                    </button>
                  ) : (
                    <span className="saved-file-name">{file.name}</span>
                  )}
                  <span className="saved-file-meta">
                    {file.state === 'ready'
                      ? fileSize(file.size)
                      : uploading
                        ? 'Uploading…'
                        : checking
                          ? 'Checking upload…'
                          : 'Upload unfinished'}
                  </span>
                  {attempt?.error && (
                    <span className="saved-file-error" role="alert">
                      {attempt.error}
                    </span>
                  )}
                </div>
                {file.state === 'ready' ? (
                  <FileDownload
                    name={file.name}
                    url={api.url(
                      conversationFilePath(source, file.id) +
                        '/content?download=1',
                    )}
                  />
                ) : (
                  !readOnly &&
                  (uploading ? (
                    <IconButton
                      label={`Cancel upload of ${file.name}`}
                      onClick={() => controllers.current.get(file.id)?.abort()}
                    >
                      <X size={15} aria-hidden />
                    </IconButton>
                  ) : (
                    <IconButton
                      label={`Retry upload of ${file.name}`}
                      disabled={busy}
                      onClick={() =>
                        attempt
                          ? void upload(attempt.file, attempt.id)
                          : choose(file.id)
                      }
                    >
                      <RotateCw size={15} aria-hidden />
                    </IconButton>
                  ))
                )}
              </li>
            )
          })}
        </ul>
      )}
      <span className="saved-files-status" role="status">
        {dragging ? 'Drop a file to save it.' : busy ? 'Uploading file.' : ''}
      </span>
    </div>
  )
}

function FileDownload({ name, url }: { name: string; url: string }) {
  return (
    <IconButton
      label={`Download ${name}`}
      onClick={() => {
        const link = document.createElement('a')
        link.href = url
        link.download = name
        link.click()
      }}
    >
      <Download size={16} aria-hidden />
    </IconButton>
  )
}

async function readContent(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal })
  if (!response.ok)
    throw new ApiError('File could not be loaded.', response.status)
  if (Number(response.headers.get('Content-Length')) > maxFileBytes) {
    await response.body?.cancel()
    throw new Error('File exceeds the 2 MB preview limit.')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('File content is unavailable.')
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxFileBytes)
        throw new Error('File exceeds the 2 MB preview limit.')
      chunks.push(value)
    }
  } finally {
    await reader.cancel()
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export type SavedFileViewerProps = {
  botId: string
  userId: string
  fileId: string
  destination?: ConversationResource
  mode?: 'preview' | 'source'
  onSource?: (id: string) => void
  onPreview?: (id: string) => void
  onCompare?: (left: string, right: string) => void
}

/** The same authorization gate protects preview, source and both diff inputs. */
export function useSavedFileResource({
  botId,
  userId,
  fileId,
  destination,
}: Pick<SavedFileViewerProps, 'botId' | 'userId' | 'fileId' | 'destination'>) {
  const source = destination ?? { botId }
  const api = useWorkspaceApi()
  const file = useQuery({
    queryKey: savedFileQueryKey(api.workspaceId, userId, source, fileId),
    queryFn: () => api.request<SavedFile>(conversationFilePath(source, fileId)),
    retry: false,
    refetchOnMount: 'always',
    refetchInterval: (query) =>
      query.state.data?.state === 'pending' ? 5000 : false,
    refetchIntervalInBackground: false,
  })
  const metadata = file.data
  const authorized = file.isFetchedAfterMount && !file.isFetching && !file.error
  const previewImage = !!metadata && isPreviewImage(metadata.mediaType)
  const previewText = !!metadata && isTextFile(metadata.mediaType)
  const content = useQuery({
    queryKey: [
      'saved-file-content',
      api.workspaceId,
      userId,
      conversationResourcePath(source),
      fileId,
      metadata?.sha256,
      metadata?.mediaType,
    ],
    enabled:
      authorized &&
      metadata?.state === 'ready' &&
      (previewImage || previewText),
    queryFn: async ({ signal }) => {
      const bytes = await readContent(
        api.url(conversationFilePath(source, fileId) + '/content'),
        signal,
      )
      if (previewImage)
        return { image: new Blob([bytes], { type: metadata!.mediaType }) }
      try {
        // Preserve a leading BOM and fail instead of replacing invalid bytes.
        return {
          text: new TextDecoder('utf-8', {
            fatal: true,
            ignoreBOM: true,
          }).decode(bytes),
        }
      } catch {
        throw new Error(
          'This file is not valid UTF-8 text. Download it to open it.',
        )
      }
    },
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
  })
  const unavailable =
    !!file.error ||
    accessDenied(content.error) ||
    (!metadata && !file.isPending)
  const saved = authorized && !unavailable ? metadata : undefined
  return {
    saved,
    data: saved && !content.error ? content.data : undefined,
    unavailable,
    loading: !unavailable && !saved,
    contentLoading: content.isPending,
    contentError: content.error,
    downloadUrl: api.url(
      conversationFilePath(source, fileId) + '/content?download=1',
    ),
    retry: async () => {
      await file.refetch()
      if (content.error) await content.refetch()
    },
  }
}

type FileResource = ReturnType<typeof useSavedFileResource>

function FileUnavailable({ retry }: { retry: () => Promise<unknown> }) {
  return (
    <div className="saved-file-viewer">
      <p role="alert">This file is unavailable.</p>
      <Button type="button" variant="secondary" onClick={() => void retry()}>
        Retry
      </Button>
    </div>
  )
}

function ContentError({ resource }: { resource: FileResource }) {
  return resource.contentError ? (
    <p role="alert">
      {resource.contentError.message}{' '}
      <Button
        type="button"
        variant="ghost"
        onClick={() => void resource.retry()}
      >
        Retry
      </Button>
    </p>
  ) : null
}

function FileCompareMenu({
  botId,
  userId,
  fileId,
  destination,
  onCompare,
}: SavedFileViewerProps & {
  onCompare: NonNullable<SavedFileViewerProps['onCompare']>
}) {
  const container = useContext(PortalContainer)
  const files = useSavedFiles(botId, userId, destination)
  const authorized =
    files.isFetchedAfterMount && !files.isFetching && !files.error
  const candidates = authorized
    ? (files.data?.files ?? []).filter(
        (file) =>
          file.id !== fileId &&
          file.state === 'ready' &&
          isTextFile(file.mediaType),
      )
    : []
  return (
    <Menu.Root>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Menu.Trigger
              className="icon-button"
              aria-label="Compare with another file"
            />
          }
        >
          <GitCompareArrows size={16} aria-hidden />
        </Tooltip.Trigger>
        <Tooltip.Portal container={container}>
          <Tooltip.Positioner
            className="action-tooltip-positioner"
            sideOffset={6}
          >
            <Tooltip.Popup className="action-tooltip">
              Compare with another file
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
      <Menu.Portal container={container}>
        <Menu.Positioner
          className="saved-file-menu-positioner"
          align="end"
          sideOffset={5}
        >
          <Menu.Popup
            className="saved-file-menu"
            aria-label="Compare with another file"
          >
            {files.error ? (
              <Menu.Item
                className="saved-file-menu-item"
                onClick={() => void files.refetch()}
              >
                Files unavailable. Retry
              </Menu.Item>
            ) : !authorized ? (
              <LoadingState>Loading files…</LoadingState>
            ) : candidates.length ? (
              candidates.map((file) => (
                <Menu.Item
                  key={file.id}
                  className="saved-file-menu-item"
                  onClick={() => {
                    const current = files.data?.files.find(
                      (candidate) => candidate.id === fileId,
                    )
                    if (
                      current &&
                      (file.createdAt < current.createdAt ||
                        (file.createdAt === current.createdAt &&
                          file.id.localeCompare(current.id) < 0))
                    ) {
                      onCompare(file.id, fileId)
                    } else {
                      onCompare(fileId, file.id)
                    }
                  }}
                >
                  <span>{file.name}</span>
                  <small>
                    {fileSize(file.size)}
                    {candidates.some(
                      (other) =>
                        other.id !== file.id && other.name === file.name,
                    ) &&
                      ` · ${new Date(file.createdAt).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}`}
                  </small>
                </Menu.Item>
              ))
            ) : (
              <p>No other text files.</p>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function FileActions({
  resource,
  mode,
  onSource,
  onPreview,
}: {
  resource: FileResource
  mode?: 'preview' | 'source'
  onSource?: (id: string) => void
  onPreview?: (id: string) => void
}) {
  const saved = resource.saved
  if (saved?.state !== 'ready') return null
  return (
    <>
      {isTextFile(saved.mediaType) &&
        mode !== 'source' &&
        (mode === undefined || isMarkdownFile(saved) || isHtmlFile(saved)) &&
        onSource && (
          <IconButton
            label={`View source of ${saved.name}`}
            onClick={() => onSource(saved.id)}
          >
            <Code size={16} aria-hidden />
          </IconButton>
        )}
      {mode === 'source' &&
        (isMarkdownFile(saved) ||
          isHtmlFile(saved) ||
          isPreviewImage(saved.mediaType)) &&
        onPreview && (
          <IconButton
            label={`Preview ${saved.name}`}
            onClick={() => onPreview(saved.id)}
          >
            <Eye size={16} aria-hidden />
          </IconButton>
        )}
      {isTextFile(saved.mediaType) && resource.data?.text !== undefined && (
        <CopyButton
          label={`Copy full text of ${saved.name}`}
          text={resource.data.text}
        />
      )}
      <FileDownload name={saved.name} url={resource.downloadUrl} />
    </>
  )
}

export function SavedFileViewer(props: SavedFileViewerProps) {
  const { mode = 'preview' } = props
  const resource = useSavedFileResource(props)
  const { saved } = resource
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [imageError, setImageError] = useState(false)
  const imageBlob = resource.data?.image
  useEffect(() => {
    setImageError(false)
    if (!imageBlob) {
      setImage(null)
      return
    }
    const url = URL.createObjectURL(imageBlob)
    setImage({ blob: imageBlob, url })
    return () => URL.revokeObjectURL(url)
  }, [imageBlob])
  if (resource.unavailable) return <FileUnavailable retry={resource.retry} />
  if (!saved)
    return (
      <div className="saved-file-viewer">
        <LoadingState>Loading file…</LoadingState>
      </div>
    )
  const previewText = isTextFile(saved.mediaType)
  const previewImage = mode === 'preview' && isPreviewImage(saved.mediaType)
  return (
    <div className="saved-file-viewer">
      <div className="saved-file-viewer-heading">
        <h2>{saved.name}</h2>
        <div className="saved-file-actions">
          <FileActions
            resource={resource}
            mode={mode}
            onSource={props.onSource}
            onPreview={props.onPreview}
          />
          {saved.state === 'ready' && previewText && props.onCompare && (
            <FileCompareMenu {...props} onCompare={props.onCompare} />
          )}
        </div>
      </div>
      {saved.state === 'pending' ? (
        <p role="status">Upload unfinished</p>
      ) : (
        <>
          <p className="saved-files-note">{fileSize(saved.size)}</p>
          {!previewImage && !previewText && (
            <p>
              {mode === 'source'
                ? 'Source is available for text files. Download to open this file.'
                : 'Download to open this file.'}
            </p>
          )}
          {(previewImage || previewText) && resource.contentLoading && (
            <LoadingState>Loading file content…</LoadingState>
          )}
          <ContentError resource={resource} />
          {previewText && resource.data?.text !== undefined && (
            <SavedFileText file={saved} text={resource.data.text} mode={mode} />
          )}
          {previewImage &&
            image?.blob === imageBlob &&
            image &&
            (imageError ? (
              <p role="alert">This image could not be displayed.</p>
            ) : (
              <img
                src={image.url}
                alt={saved.name}
                onError={() => setImageError(true)}
              />
            ))}
        </>
      )}
    </div>
  )
}

export function FileTextDiff({
  before,
  after,
}: {
  before: string
  after: string
}) {
  const result = useMemo(() => compareFileText(before, after), [before, after])
  if (result.status === 'limited') return <p role="status">{result.reason}</p>
  if (result.equal)
    return <p role="status">No changes. The text is identical.</p>
  return (
    <>
      <p className="saved-files-note">
        {result.additions} added · {result.deletions} removed
      </p>
      <div
        className="saved-file-diff-scroll"
        tabIndex={0}
        role="region"
        aria-label="File changes"
      >
        <table className="saved-file-diff">
          <thead>
            <tr>
              <th scope="col">Old</th>
              <th scope="col">New</th>
              <th scope="col">
                <span className="saved-files-status">Change</span>
              </th>
              <th scope="col">Text</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, index) => (
              <tr className={`saved-file-diff-${row.kind}`} key={index}>
                <td className="saved-file-line-number">
                  {row.beforeLine ?? ''}
                </td>
                <td className="saved-file-line-number">
                  {row.afterLine ?? ''}
                </td>
                <td className="saved-file-diff-marker">
                  <span aria-hidden>
                    {row.kind === 'added'
                      ? '+'
                      : row.kind === 'removed'
                        ? '−'
                        : ' '}
                  </span>
                  <span className="saved-files-status">
                    {row.kind === 'added'
                      ? 'Added'
                      : row.kind === 'removed'
                        ? 'Removed'
                        : 'Unchanged'}
                  </span>
                </td>
                <td className="saved-file-diff-text">
                  {row.kind !== 'context' && row.text.startsWith('\ufeff') && (
                    <span className="saved-file-bom">BOM</span>
                  )}
                  <code>{row.text}</code>
                  {(row.kind !== 'context' || row.ending !== 'lf') && (
                    <span className="saved-file-line-ending">
                      {row.ending === 'none'
                        ? 'No final newline'
                        : row.ending.toUpperCase()}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function SavedFileDiffViewer({
  leftFileId,
  rightFileId,
  ...props
}: Omit<SavedFileViewerProps, 'fileId' | 'mode'> & {
  leftFileId: string
  rightFileId: string
}) {
  const left = useSavedFileResource({ ...props, fileId: leftFileId })
  const right = useSavedFileResource({ ...props, fileId: rightFileId })
  if (left.unavailable || right.unavailable)
    return (
      <FileUnavailable
        retry={() => Promise.all([left.retry(), right.retry()])}
      />
    )
  if (!left.saved || !right.saved)
    return (
      <div className="saved-file-viewer">
        <LoadingState>Loading files…</LoadingState>
      </div>
    )
  const supported = [left.saved, right.saved].every(
    (file) => file.state === 'ready' && isTextFile(file.mediaType),
  )
  return (
    <div className="saved-file-viewer">
      {[
        { label: 'Before', resource: left },
        { label: 'After', resource: right },
      ].map(({ label, resource }) => {
        return (
          <div
            className="saved-file-viewer-heading saved-file-diff-heading"
            key={label}
          >
            <span className="saved-file-diff-label">{label}</span>
            <h2>{resource.saved!.name}</h2>
            <div className="saved-file-actions">
              <FileActions resource={resource} onSource={props.onSource} />
            </div>
          </div>
        )
      })}
      {!supported ? (
        <p role="status">Only ready text files can be compared.</p>
      ) : (
        <>
          {(left.contentLoading || right.contentLoading) && (
            <LoadingState>Loading file content…</LoadingState>
          )}
          <ContentError resource={left} />
          <ContentError resource={right} />
          {left.data?.text !== undefined && right.data?.text !== undefined && (
            <FileTextDiff before={left.data.text} after={right.data.text} />
          )}
        </>
      )}
    </div>
  )
}
