import CodeMirror from '@uiw/react-codemirror'
import CodeMirrorMerge from 'react-codemirror-merge'

import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'

import { githubDarkInit } from '@uiw/codemirror-theme-github'

const theme = githubDarkInit({
  settings: {
    background: 'oklch(0.07 0.005 285.823)',
    foreground: '#c9d1d9',
    gutterBackground: 'oklch(0.22 0.005 285.823)',
  },
})

export default function FileViewer({
  originalFile,
  modifiedFile,
  filePath,
}: {
  originalFile?: string
  modifiedFile: string
  filePath: string
}) {
  function getLanguage(file: string) {
    if (file.endsWith('.js') || file.endsWith('.jsx')) {
      return javascript({ jsx: true })
    }
    if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      return javascript({ typescript: true, jsx: true })
    }
    if (file.endsWith('.json')) {
      return json()
    }
    if (file.endsWith('.css')) {
      return css()
    }
    if (file.endsWith('.html')) {
      return html()
    }
    return javascript()
  }

  function getImageExtension(
    filePath: string,
    base64Content: string
  ): string | null {
    // First try to get extension from file path
    const pathExtension = filePath.match(
      /\.(png|jpg|jpeg|gif|bmp|webp|svg)$/i
    )?.[1]
    if (pathExtension) {
      return pathExtension.toLowerCase()
    }

    // Try to detect from base64 data header
    const base64Data = base64Content.replace(/^base64::/, '')
    try {
      // Decode first few bytes to check magic numbers
      const binaryString = atob(base64Data.substring(0, 20))
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // Check magic numbers for common image formats
      if (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
      ) {
        return 'png'
      }
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'jpg'
      }
      if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
        return 'gif'
      }
      if (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46
      ) {
        return 'webp'
      }
      if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
        return 'bmp'
      }
      if (
        bytes[0] === 0x3c &&
        bytes[1] === 0x3f &&
        bytes[2] === 0x78 &&
        bytes[3] === 0x6d
      ) {
        return 'svg'
      }
    } catch (e) {
      // If base64 decoding fails, fall back to common extensions
    }

    // Default fallback
    return 'png'
  }

  function isBase64Image(content: string): boolean {
    return content.startsWith('base64::')
  }

  const language = getLanguage(filePath)

  // Check if this is a base64 image
  if (isBase64Image(modifiedFile)) {
    const extension = getImageExtension(filePath, modifiedFile)
    const base64Data = modifiedFile.replace(/^base64::/, '')
    const dataUrl = `data:image/${extension};base64,${base64Data}`

    return (
      <div className="flex items-center justify-center h-full bg-gray-900 p-4">
        <img
          src={dataUrl}
          alt={filePath}
          className="max-w-full max-h-full object-contain"
          style={{ maxHeight: '90vh', maxWidth: '90vw' }}
        />
      </div>
    )
  }

  if (!originalFile || originalFile === modifiedFile) {
    return (
      <CodeMirror
        value={modifiedFile}
        theme={theme}
        height="100vh"
        width="100%"
        readOnly
        extensions={[language]}
        className="text-lg"
      />
    )
  }
  return (
    <CodeMirrorMerge orientation="a-b" theme={theme} className="text-lg">
      <CodeMirrorMerge.Original value={originalFile} extensions={[language]} />
      <CodeMirrorMerge.Modified value={modifiedFile} extensions={[language]} />
    </CodeMirrorMerge>
  )
}
