import { memo } from 'react'
import {
  normalizeLanguage,
  tokenize,
  renderTokens,
  renderNodesToHtml,
} from '@tanstack/highlight'
import type { SavedFile } from '../core/files'
import { MessageMarkdown } from './MessageMarkdown'

export const fileDisplayCharacters = 65_536

export function fileLanguage(file: Pick<SavedFile, 'name' | 'mediaType'>) {
  const extension = file.name.split('.').at(-1)?.toLowerCase()
  const mediaLanguages: Record<string, string> = {
    'application/json': 'json',
    'application/javascript': 'js',
    'application/xml': 'xml',
    'application/yaml': 'yaml',
    'text/markdown': 'markdown',
    'text/html': 'html',
    'text/css': 'css',
  }
  const language = normalizeLanguage(extension)
  return language === 'plaintext'
    ? mediaLanguages[file.mediaType] || language
    : language
}

export function isMarkdownFile(file: Pick<SavedFile, 'name' | 'mediaType'>) {
  return (
    file.mediaType === 'text/markdown' || /\.(md|markdown)$/i.test(file.name)
  )
}

export function isHtmlFile(file: Pick<SavedFile, 'name' | 'mediaType'>) {
  return file.mediaType === 'text/html' || /\.html?$/i.test(file.name)
}

const htmlPreviewPolicy =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"

export const SavedFileText = memo(function SavedFileText({
  file,
  text,
  mode,
}: {
  file: Pick<SavedFile, 'name' | 'mediaType'>
  text: string
  mode: 'preview' | 'source'
}) {
  const visible = text.slice(0, fileDisplayCharacters)
  return (
    <>
      {text.length > fileDisplayCharacters && (
        <p className="saved-files-note" role="status">
          Showing the first {fileDisplayCharacters.toLocaleString()} characters.
          Copy or download for the full file.
        </p>
      )}
      {mode === 'preview' && isHtmlFile(file) ? (
        <iframe
          className="saved-file-html-preview"
          title={`Preview of ${file.name}`}
          sandbox=""
          referrerPolicy="no-referrer"
          srcDoc={`<meta http-equiv="Content-Security-Policy" content="${htmlPreviewPolicy}">${visible}`}
        />
      ) : mode === 'preview' && isMarkdownFile(file) ? (
        <div className="saved-file-markdown">
          <MessageMarkdown allowImages={false}>{visible}</MessageMarkdown>
        </div>
      ) : (
        <pre className="saved-file-source" aria-label="File source">
          <code
            // Highlight escapes source text before adding its own token spans.
            dangerouslySetInnerHTML={{
              __html: renderNodesToHtml(
                renderTokens(
                  tokenize(visible, { lang: fileLanguage(file) }).tokens,
                ),
              ),
            }}
          />
        </pre>
      )}
    </>
  )
})
