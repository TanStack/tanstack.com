import * as React from 'react'
import type { HTMLProps } from 'react'
import { getNetlifyImageUrl } from '~/utils/netlifyImage'

export const MarkdownImg = React.memo(function MarkdownImg({
  alt,
  src,
  className,
  width,
  height,
  style,
  children: _,
  ...props
}: HTMLProps<HTMLImageElement>) {
  const numericWidth =
    typeof width === 'number'
      ? width
      : typeof width === 'string'
        ? Number(width)
        : undefined
  const numericHeight =
    typeof height === 'number'
      ? height
      : typeof height === 'string'
        ? Number(height)
        : undefined
  const aspectRatio =
    numericWidth && numericHeight
      ? `${numericWidth} / ${numericHeight}`
      : src?.toLowerCase().endsWith('.svg')
        ? 'auto 3 / 1'
        : 'auto 16 / 9'

  return (
    <img
      {...props}
      src={src ? getNetlifyImageUrl(src) : undefined}
      alt={alt ?? ''}
      width={width}
      height={height}
      style={{
        aspectRatio,
        ...style,
      }}
      className={`block max-w-full h-auto rounded-lg shadow-md ${className ?? ''}`}
      loading="lazy"
      decoding="async"
    />
  )
})
