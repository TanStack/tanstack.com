export type ImageOptimizationOptions = {
  fit?: 'contain' | 'cover' | 'crop' | 'pad' | 'scale-down'
  format?: 'auto' | 'avif' | 'webp' | 'json'
  height?: number
  quality?: number
  width?: number
}

export function getOptimizedImageUrl(
  src: string,
  options: ImageOptimizationOptions = {},
) {
  if (!shouldTransformImage(src)) {
    return src
  }

  const transformOptions = createCloudflareTransformOptions(options)
  if (!transformOptions) {
    return src
  }

  return `/cdn-cgi/image/${transformOptions}/${encodeURI(src).replace(
    /^%2F/i,
    '/',
  )}`
}

export function getAbsoluteOptimizedImageUrl(
  src: string,
  options: ImageOptimizationOptions = {},
) {
  const optimizedSrc = getOptimizedImageUrl(src, options)
  if (optimizedSrc.startsWith('http')) {
    return optimizedSrc
  }

  const origin = __TANSTACK_SITE_URL__.replace(/\/$/, '')
  const path = optimizedSrc.startsWith('/') ? optimizedSrc : `/${optimizedSrc}`

  return `${origin}${path}`
}

function shouldTransformImage(src: string) {
  if (!__TANSTACK_ENABLE_IMAGE_TRANSFORMATIONS__) {
    return false
  }

  const normalized = src.toLowerCase()

  return (
    src.startsWith('/') &&
    !src.startsWith('/cdn-cgi/image/') &&
    !normalized.startsWith('data:') &&
    !normalized.endsWith('.svg')
  )
}

function createCloudflareTransformOptions(
  options: ImageOptimizationOptions,
): string | undefined {
  const params: Array<string> = []

  if (options.width) {
    params.push(`width=${Math.round(options.width)}`)
  }

  if (options.height) {
    params.push(`height=${Math.round(options.height)}`)
  }

  if (options.fit) {
    params.push(`fit=${options.fit}`)
  }

  params.push(`quality=${Math.round(options.quality ?? 80)}`)
  params.push(`format=${options.format ?? 'auto'}`)

  return params.length > 0 ? params.join(',') : undefined
}
