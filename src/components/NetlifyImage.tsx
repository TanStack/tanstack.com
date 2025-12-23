import * as React from 'react'

type NetlifyImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'src'
> & {
  src: string
  width?: number
  height?: number
  quality?: number
  format?: 'avif' | 'webp' | 'jpg' | 'png' | 'gif'
  fit?: 'contain' | 'cover' | 'fill'
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

/**
 * Optimized image component using Netlify Image CDN.
 * Automatically transforms images on-demand with:
 * - Format conversion (auto webp/avif based on browser support)
 * - Resizing to specified dimensions
 * - Quality optimization
 * - Edge caching
 *
 * @see https://docs.netlify.com/build/image-cdn/overview/
 */
export function NetlifyImage({
  src,
  width,
  height,
  quality = 75,
  format,
  fit,
  position,
  alt = '',
  loading = 'lazy',
  decoding = 'async',
  ...props
}: NetlifyImageProps) {
  const optimizedSrc = React.useMemo(() => {
    // Skip optimization for external URLs, data URIs, or SVGs
    if (
      src.startsWith('http') ||
      src.startsWith('data:') ||
      src.endsWith('.svg')
    ) {
      return src
    }

    const params = new URLSearchParams()
    params.set('url', src)

    if (width) params.set('w', String(width))
    if (height) params.set('h', String(height))
    if (quality !== 75) params.set('q', String(quality))
    if (format) params.set('fm', format)
    if (fit) params.set('fit', fit)
    if (position) params.set('position', position)

    return `/.netlify/images?${params.toString()}`
  }, [src, width, height, quality, format, fit, position])

  return (
    <img
      src={optimizedSrc}
      width={width}
      height={height}
      alt={alt}
      loading={loading}
      decoding={decoding}
      {...props}
    />
  )
}
