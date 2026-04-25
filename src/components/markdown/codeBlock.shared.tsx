import * as React from 'react'

export type CodeBlockProps = React.HTMLProps<HTMLPreElement> & {
  dataCodeTitle?: string
  isEmbedded?: boolean
  showTypeCopyButton?: boolean
}

export type RenderedCodeBlockData = {
  copyText: string
  htmlMarkup: string
  lang: string
  title?: string
}

export function getCodeLanguageFromPath(filePath: string) {
  const ext = filePath.split('.').pop()

  if (!ext) return 'txt'
  if (['cts', 'mts'].includes(ext)) return 'ts'
  if (['cjs', 'mjs'].includes(ext)) return 'js'
  if (['prettierrc', 'babelrc', 'webmanifest'].includes(ext)) return 'json'
  if (['env', 'example'].includes(ext)) return 'sh'
  if (
    [
      'gitignore',
      'prettierignore',
      'log',
      'gitattributes',
      'editorconfig',
      'lock',
      'opts',
      'Dockerfile',
      'dockerignore',
      'npmrc',
      'nvmrc',
    ].includes(ext)
  ) {
    return 'txt'
  }

  return ext
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function buildPlainCodeBlockHtml(code: string) {
  return `<pre class="shiki h-full github-light dark:aurora-x"><code>${escapeHtml(
    code,
  )}</code></pre>`
}

export function extractCodeBlockData(props: CodeBlockProps) {
  const rawTitle = ((props as { dataCodeTitle?: string })?.dataCodeTitle ||
    (props as { 'data-code-title'?: string })?.['data-code-title']) as
    | string
    | undefined

  const title =
    rawTitle && rawTitle !== 'undefined' && rawTitle.trim().length > 0
      ? rawTitle.trim()
      : undefined

  const childElement = props.children as
    | undefined
    | { props?: { children?: string; className?: string } }
  const lang =
    childElement?.props?.className?.replace('language-', '') || 'plaintext'
  const code = childElement?.props?.children || ''

  return {
    code,
    lang,
    title,
  }
}

export function getCodeBlockLanguageFromFilePath(filePath: string) {
  const ext = filePath.split('.').pop()?.toLowerCase()

  if (!ext) {
    return 'txt'
  }

  if (['cts', 'mts'].includes(ext)) return 'ts'
  if (['cjs', 'mjs'].includes(ext)) return 'js'
  if (['prettierrc', 'babelrc', 'webmanifest'].includes(ext)) return 'json'
  if (['env', 'example'].includes(ext)) return 'sh'

  if (
    [
      'gitignore',
      'prettierignore',
      'log',
      'gitattributes',
      'editorconfig',
      'lock',
      'opts',
      'dockerfile',
      'dockerignore',
      'npmrc',
      'nvmrc',
    ].includes(ext)
  ) {
    return 'txt'
  }

  return ext
}
