/**
 * Normalizes markdown link paths for TanStack website routing
 * 
 * GitHub markdown links work differently from our router structure:
 * - In GitHub: ./guides/foo.md works from docs/overview.md
 * - In our router: we need ../guides/foo because the current path is /lib/version/docs/overview (not overview/)
 * 
 * @param path The original markdown link path
 * @returns The normalized path for website routing
 */
export function normalizeMarkdownPath(path: string | undefined): string | undefined {
  if (!path) return path
  
  // Don't modify:
  // - Absolute paths (/)
  // - Paths already using ../
  // - External links (http/https)
  // - Hash-only links (#)
  // - Special protocols (mailto:, javascript:, etc)
  if (
    path.startsWith('/') || 
    path.startsWith('../') || 
    path.startsWith('http') ||
    path.startsWith('#') ||
    path.includes(':')  // Catches mailto:, javascript:, etc
  ) {
    return path
  }
  
  // Convert ./path to ../path (GitHub style to website style)
  if (path.startsWith('./')) {
    return '../' + path.slice(2)
  }
  
  // Handle bare paths (no ./ prefix)
  // These are treated as siblings, so prepend ../
  // This covers:
  // - "foo" (same directory file)
  // - "guides/foo" (subdirectory)
  return '../' + path
}