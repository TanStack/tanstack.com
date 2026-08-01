import type { LibraryId } from '~/libraries'
import { categoryOf, type LibraryCategory } from '~/libraries/categories'

export type OgTheme = 'light' | 'dark'

export const OG_THEMES = ['light', 'dark'] as const

// Server-rendered OG cards cannot resolve CSS custom properties. Keep these
// literals aligned with the category 400 tokens in src/styles/app.css.
const CATEGORY_ACCENT_COLORS = {
  framework: '#39af46',
  data: '#d3481b',
  ui: '#3aa3c4',
  performance: '#ffa216',
  tooling: '#3e3529',
} satisfies Record<LibraryCategory, string>

// Category accents flip to the 300 step on dark surfaces, mirroring the
// `html.dark` overrides in src/styles/app.css so a dark banner matches the
// site's own dark mode rather than inventing a second palette.
const CATEGORY_ACCENT_COLORS_DARK = {
  framework: '#69bc75',
  data: '#e06e49',
  ui: '#61adbf',
  performance: '#f4d648',
  // Deliberately --color-ds-neutral-tint-200 rather than the site's dark
  // tooling token (--color-ds-neutral-200, #aea691). On the site that accent
  // sits next to differently-coloured text; here it would land on the same
  // value as `secondaryText` below, flattening the name and tagline into one
  // colour. The tint step keeps the hierarchy readable.
  tooling: '#c5c3bf',
} satisfies Record<LibraryCategory, string>

export function getAccentColor(
  libraryId: LibraryId,
  theme: OgTheme = 'light',
): string {
  const palette =
    theme === 'dark' ? CATEGORY_ACCENT_COLORS_DARK : CATEGORY_ACCENT_COLORS
  return palette[categoryOf(libraryId)]
}

type ThemeSurface = {
  background: string
  /** The `TanStack` prefix line and the tagline. */
  secondaryText: string
}

// background-default / text-secondary from the same app.css token sets.
const THEME_SURFACES = {
  light: { background: '#eeebd4', secondaryText: '#3e3529' },
  dark: { background: '#111111', secondaryText: '#aea691' },
} satisfies Record<OgTheme, ThemeSurface>

export function getThemeSurface(theme: OgTheme): ThemeSurface {
  return THEME_SURFACES[theme]
}

export function isOgTheme(value: string): value is OgTheme {
  return (OG_THEMES as ReadonlyArray<string>).includes(value)
}
