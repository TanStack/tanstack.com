import type { LibraryId } from '~/libraries'
import { categoryOf, type LibraryCategory } from '~/libraries/categories'

// Server-rendered OG cards cannot resolve CSS custom properties. Keep these
// literals aligned with the category 400 tokens in src/styles/app.css.
const CATEGORY_ACCENT_COLORS = {
  framework: '#39af46',
  data: '#d3481b',
  ui: '#3aa3c4',
  performance: '#ffa216',
  tooling: '#3e3529',
} satisfies Record<LibraryCategory, string>

export function getAccentColor(libraryId: LibraryId): string {
  return CATEGORY_ACCENT_COLORS[categoryOf(libraryId)]
}
