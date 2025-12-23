import * as React from 'react'
import { getNetlifyImageUrl } from '~/utils/netlifyImage'

type NetlifyImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'src'
> & {
  src: string
  width?: number
  height?: number
  quality?: number
}

/**
 * Optimized image component using Netlify Image CDN.
 * @see https://docs.netlify.com/build/image-cdn/overview/
 */
export function NetlifyImage({
  src,
  width,
  height,
  quality,
  alt = '',
  loading = 'lazy',
  decoding = 'async',
  ...props
}: NetlifyImageProps) {
  const optimizedSrc = React.useMemo(
    () => getNetlifyImageUrl(src, { width, height, quality }),
    [src, width, height, quality],
  )

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
