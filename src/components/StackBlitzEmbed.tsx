import * as React from 'react'
import { useIsDark } from '~/hooks/useIsDark'

type StackBlitzEmbedProps = {
  repo: string
  branch: string
  examplePath: string
  file?: string
  preset?: 'node'
  height?: string | number
  title?: string
}

export function StackBlitzEmbed({
  repo,
  branch,
  examplePath,
  file,
  preset = 'node',
  height = '80vh',
  title,
}: StackBlitzEmbedProps) {
  const isDark = useIsDark()
  const themeParam = isDark ? 'dark' : 'light'
  const fileParam = file ? `&file=${encodeURIComponent(file)}` : ''

  const src = `https://stackblitz.com/github/${repo}/tree/${branch}/${examplePath}?embed=1&theme=${themeParam}&preset=${preset}${fileParam}`

  return (
    <iframe
      key={`${examplePath}-${themeParam}`}
      src={src}
      title={title || `${repo}: ${examplePath}`}
      sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
      className="shadow-2xl"
      loading="lazy"
      style={{ width: '100%', height, border: '0' }}
    />
  )
}
