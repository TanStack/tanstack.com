/**
 * Helper functions for manual feed entry creation and validation
 */

export interface NormalizedFeedEntry {
  id: string
  source: string
  title: string
  content: string
  excerpt?: string
  publishedAt: number
  metadata?: any
  libraryIds: string[]
  partnerIds?: string[]
  tags: string[]
  category: 'release' | 'announcement' | 'blog' | 'partner' | 'update' | 'other'
  isVisible: boolean
  featured?: boolean
  autoSynced: boolean
}

/**
 * Generate a unique ID for an announcement feed entry
 */
export function generateManualEntryId(): string {
  return `announcement:${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 9)}`
}

/**
 * Auto-generate excerpt from content if not provided
 */
export function generateExcerpt(
  content: string,
  maxLength: number = 200
): string {
  // Remove markdown headers, links, etc. for a cleaner excerpt
  const plainText = content
    .replace(/^#+\s+/gm, '') // Remove headers
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Convert links to text
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '') // Remove images
    .replace(/\*\*([^\*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^\*]+)\*/g, '$1') // Remove italic
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .trim()

  if (plainText.length <= maxLength) {
    return plainText
  }

  // Find the last space before maxLength to avoid cutting words
  const truncated = plainText.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  const excerpt = lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated

  return excerpt + '...'
}

/**
 * Validate and normalize a manual feed entry
 */
export function validateManualEntry(entry: Partial<NormalizedFeedEntry>): {
  valid: boolean
  normalized?: NormalizedFeedEntry
  errors?: string[]
} {
  const errors: string[] = []

  if (!entry.title || entry.title.trim().length === 0) {
    errors.push('Title is required')
  }

  if (!entry.content || entry.content.trim().length === 0) {
    errors.push('Content is required')
  }

  if (!entry.publishedAt || entry.publishedAt <= 0) {
    errors.push('Published date is required')
  }

  if (!entry.category) {
    errors.push('Category is required')
  }

  if (!entry.libraryIds || entry.libraryIds.length === 0) {
    errors.push('At least one library must be selected')
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  const normalized: NormalizedFeedEntry = {
    id: entry.id || generateManualEntryId(),
    source: entry.source || 'announcement',
    title: entry.title!.trim(),
    content: entry.content!.trim(),
    excerpt: entry.excerpt || generateExcerpt(entry.content!),
    publishedAt: entry.publishedAt!,
    metadata: entry.metadata,
    libraryIds: entry.libraryIds!,
    partnerIds: entry.partnerIds,
    tags: entry.tags || [],
    category: entry.category!,
    isVisible: entry.isVisible ?? true,
    featured: entry.featured ?? false,
    autoSynced: false,
  }

  return { valid: true, normalized }
}
