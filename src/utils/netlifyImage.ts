/**
 * Build a Netlify Image CDN URL for optimized image delivery.
 * Returns the original src in development or for external URLs, data URIs, and SVGs.
 *
 * @see https://docs.netlify.com/build/image-cdn/overview/
 */
export function getNetlifyImageUrl(
  src: string,
  options: { width?: number; height?: number; quality?: number } = {},
): string {
  // Skip in development - Netlify Image CDN only works in production
  if (import.meta.env.DEV) {
    return src
  }

  if (
    src.startsWith('http') ||
    src.startsWith('data:') ||
    src.endsWith('.svg')
  ) {
    return src
  }

  const { width = 800, quality = 80 } = options
  return `/.netlify/images?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`
}
