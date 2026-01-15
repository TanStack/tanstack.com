/**
 * CodeViewer - Displays file content with syntax highlighting
 * Uses the same CodeBlock component as the rest of the site
 */

import * as React from 'react'
import { CodeBlock } from '~/components/markdown'

type CodeViewerProps = {
  filePath: string | null
  content: string | null
}

export function CodeViewer({ filePath, content }: CodeViewerProps) {
  if (!filePath || content == null) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <p className="text-sm">Select a file to view its contents</p>
      </div>
    )
  }

  // Get file extension for language detection
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const language = getLanguage(ext)

  return (
    <div className="builder-code-viewer flex flex-col h-full min-w-0 overflow-hidden">
      <CodeBlock
        className="h-full flex-1 min-w-0 rounded-none border-0 [&>div:first-child]:rounded-none"
        isEmbedded
        dataCodeTitle={filePath.replace(/^\.\//, '')}
      >
        <code className={`language-${language}`}>{content}</code>
      </CodeBlock>
    </div>
  )
}

function getLanguage(ext: string): string {
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'tsx'
    case 'js':
    case 'jsx':
      return 'jsx'
    case 'json':
      return 'json'
    case 'css':
      return 'css'
    case 'html':
      return 'html'
    case 'md':
      return 'markdown'
    case 'svg':
      return 'html'
    case 'yaml':
    case 'yml':
      return 'yaml'
    default:
      return 'plaintext'
  }
}
