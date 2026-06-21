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
      ? `${numericWidth} / ${numericHeight}`
      : src?.toLowerCase().endsWith('.svg')
        ? '3 / 1'
        : '16 / 9'
  const fallbackWidth = src?.toLowerCase().endsWith('.svg') ? 600 : 800
  const fallbackHeight = src?.toLowerCase().endsWith('.svg') ? 200 : 450

  return (
    <img
      {...props}
      src={src ? getNetlifyImageUrl(src) : undefined}
      alt={alt ?? ''}
      width={resolvedWidth ?? fallbackWidth}
      height={resolvedHeight ?? fallbackHeight}
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
