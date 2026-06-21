import * as React from 'react'
import type { HTMLProps } from 'react'
import { getNetlifyImageUrl } from '~/utils/netlifyImage'
import { getPublicImageDimensions } from '~/utils/publicImageDimensions'

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
  const sourceDimensions = src ? getPublicImageDimensions(src) : undefined
  const providedWidth = parseDimension(width)
  const providedHeight = parseDimension(height)
  const inferredWidth =
    sourceDimensions && width === undefined
      ? Math.min(sourceDimensions.width, 800)
      : providedWidth
  const inferredHeight =
    sourceDimensions && height === undefined && inferredWidth
      ? Math.round(
          inferredWidth * (sourceDimensions.height / sourceDimensions.width),
        )
      : providedHeight
  const resolvedWidth = width ?? inferredWidth
  const resolvedHeight = height ?? inferredHeight
  const numericWidth =
    typeof resolvedWidth === 'number' ? resolvedWidth : parseDimension(width)
  const numericHeight =
    typeof resolvedHeight === 'number' ? resolvedHeight : parseDimension(height)
  const aspectRatio =
    numericWidth && numericHeight
      ? `auto ${numericWidth} / ${numericHeight}`
      : src?.toLowerCase().endsWith('.svg')
        ? 'auto 3 / 1'
        : 'auto 16 / 9'

  return (
    <img
      {...props}
      src={src ? getNetlifyImageUrl(src) : undefined}
      alt={alt ?? ''}
      width={resolvedWidth}
      height={resolvedHeight}
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

function parseDimension(value: HTMLProps<HTMLImageElement>['width']) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value !== 'string') {
    return undefined
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : undefined
}
