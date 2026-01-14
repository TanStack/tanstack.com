import * as React from 'react'
import type { HTMLProps } from 'react'
import { getNetlifyImageUrl } from '~/utils/netlifyImage'

export const MarkdownImg = React.memo(function MarkdownImg({
  alt,
  src,
  className,
  children: _,
  ...props
}: HTMLProps<HTMLImageElement>) {
  return (
    <img
      {...props}
      src={src ? getNetlifyImageUrl(src) : undefined}
      alt={alt ?? ''}
      className={`max-w-full h-auto rounded-lg shadow-md ${className ?? ''}`}
      loading="lazy"
      decoding="async"
    />
  )
})
