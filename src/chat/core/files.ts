export const maxFileBytes = 2 * 1024 * 1024
export const maxConversationFiles = 100
export const maxConversationFileBytes = 50 * 1024 * 1024

export interface SavedFile {
  conversationId?: string
  id: string
  botId: string
  name: string
  mediaType: string
  size: number
  sha256: string
  source: 'upload' | 'assistant'
  state: 'pending' | 'ready'
  createdAt: number
}

export interface DraftFile extends Omit<SavedFile, 'botId' | 'conversationId'> {
  draftId: string
}

export interface FileScope {
  conversationId?: string
  workspaceId: string
  userId: string
  botId: string
}

export interface DraftFileScope {
  workspaceId: string
  userId: string
  draftId: string
}

export interface SaveFileInput {
  id: string
  name: string
  mediaType: string
  source: SavedFile['source']
}

export function isTextFile(mediaType: string) {
  return (
    mediaType.startsWith('text/') ||
    [
      'application/json',
      'application/javascript',
      'application/xml',
      'application/yaml',
    ].includes(mediaType)
  )
}

/** Browsers leave File.type empty for many ordinary source and text files. */
export function uploadMediaType(name: string, supplied: string) {
  if (supplied && supplied !== 'application/octet-stream') return supplied
  const extension = name.split('.').at(-1)?.toLowerCase()
  const known: Record<string, string> = {
    txt: 'text/plain',
    md: 'text/markdown',
    markdown: 'text/markdown',
    csv: 'text/csv',
    tsv: 'text/tab-separated-values',
    json: 'application/json',
    jsonl: 'text/plain',
    yaml: 'application/yaml',
    yml: 'application/yaml',
    xml: 'application/xml',
    js: 'application/javascript',
    jsx: 'text/plain',
    ts: 'text/plain',
    tsx: 'text/plain',
    py: 'text/plain',
    rb: 'text/plain',
    rs: 'text/plain',
    go: 'text/plain',
    css: 'text/css',
    html: 'text/html',
    sql: 'text/plain',
    sh: 'text/plain',
    log: 'text/plain',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
  }
  return extension && Object.hasOwn(known, extension)
    ? known[extension]
    : 'application/octet-stream'
}

export function isPreviewImage(mediaType: string) {
  return ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(
    mediaType,
  )
}

export function fileViewPath(
  _workspaceId: string,
  botId: string,
  id: string,
  conversationId?: string,
) {
  return `${conversationId ? `/chat/c/${encodeURIComponent(conversationId)}` : `/chat/b/${encodeURIComponent(botId)}`}?panel=${encodeURIComponent(`file:${id}`)}`
}
