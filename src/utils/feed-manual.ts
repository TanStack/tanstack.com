/**
 * Generate a unique ID for a manual feed entry
 */
export function generateManualEntryId(): string {
  return `announcement:${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 9)}`
}
