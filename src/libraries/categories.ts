// Canonical library-category model.
//
// Libraries are grouped into five categories, and each library inherits its
// category's color as its core brand color. The color values live at the
// system level as `--color-category-*` tokens in src/styles/app.css (400 in
// light, 300 in dark); here we map each library id to a category and expose the
// literal Tailwind class strings that the library objects consume.
//
// NOTE: the class strings below are written out in full (not composed at
// runtime) so Tailwind's scanner can see them statically.

export type LibraryCategory =
  | 'framework'
  | 'data'
  | 'ui'
  | 'performance'
  | 'tooling'

// Library id → category. Any id not listed defaults to 'tooling' (see categoryOf).
export const libraryCategories: Record<string, LibraryCategory> = {
  start: 'framework',
  router: 'framework',
  query: 'data',
  db: 'data',
  store: 'data',
  ai: 'data',
  table: 'ui',
  charts: 'ui',
  form: 'ui',
  hotkeys: 'ui',
  markdown: 'ui',
  highlight: 'ui',
  virtual: 'performance',
  pacer: 'performance',
  devtools: 'tooling',
  config: 'tooling',
  cli: 'tooling',
  intent: 'tooling',
  ranger: 'tooling',
  mcp: 'tooling',
  workflow: 'tooling',
  'react-charts': 'tooling',
  'create-tsrouter-app': 'tooling',
}

export function categoryOf(id: string): LibraryCategory {
  return libraryCategories[id] ?? 'tooling'
}

// Display order + labels for the five categories (used by the navbar Libraries
// mega-menu and the full-screen overlay).
export const categoryOrder: ReadonlyArray<LibraryCategory> = [
  'framework',
  'data',
  'ui',
  'performance',
  'tooling',
]

export const categoryLabels: Record<LibraryCategory, string> = {
  framework: 'Framework',
  data: 'Data & State',
  ui: 'UI & UX',
  performance: 'Performance',
  tooling: 'Tooling',
}

// Mode-aware category text color utility (400 in light, 300/200 in dark).
export const categoryTextColor: Record<LibraryCategory, string> = {
  framework: 'text-category-framework',
  data: 'text-category-data',
  ui: 'text-category-ui',
  performance: 'text-category-performance',
  tooling: 'text-category-tooling',
}

// The subset of LibrarySlim color fields that are now category-derived.
export interface CategoryStyle {
  cardStyles: string
  bgStyle: string
  borderStyle: string
  textStyle: string
  textColor: string
  colorFrom: string
  colorTo: string
  bgRadial: string
  badgeTextStyle: string
  accentColorFrom?: string
  accentColorTo?: string
  accentTextColor?: string
}

export const categoryStyles: Record<LibraryCategory, CategoryStyle> = {
  framework: {
    cardStyles: 'text-category-framework hover:border-current',
    bgStyle: 'bg-category-framework',
    borderStyle: 'border-category-framework/50',
    textStyle: 'text-category-framework',
    textColor: 'text-category-framework',
    colorFrom: 'from-category-framework',
    colorTo: 'to-category-framework',
    bgRadial:
      'from-category-framework via-category-framework/60 to-transparent',
    badgeTextStyle: 'text-white',
  },
  data: {
    cardStyles: 'text-category-data hover:border-current',
    bgStyle: 'bg-category-data',
    borderStyle: 'border-category-data/50',
    textStyle: 'text-category-data',
    textColor: 'text-category-data',
    colorFrom: 'from-category-data',
    colorTo: 'to-category-data',
    bgRadial: 'from-category-data via-category-data/60 to-transparent',
    badgeTextStyle: 'text-white',
  },
  ui: {
    cardStyles: 'text-category-ui hover:border-current',
    bgStyle: 'bg-category-ui',
    borderStyle: 'border-category-ui/50',
    textStyle: 'text-category-ui',
    textColor: 'text-category-ui',
    colorFrom: 'from-category-ui',
    colorTo: 'to-category-ui',
    bgRadial: 'from-category-ui via-category-ui/60 to-transparent',
    badgeTextStyle: 'text-white',
  },
  performance: {
    cardStyles: 'text-category-performance hover:border-current',
    bgStyle: 'bg-category-performance',
    borderStyle: 'border-category-performance/50',
    textStyle: 'text-category-performance',
    textColor: 'text-category-performance',
    colorFrom: 'from-category-performance',
    colorTo: 'to-category-performance',
    bgRadial:
      'from-category-performance via-category-performance/60 to-transparent',
    badgeTextStyle: 'text-white',
  },
  tooling: {
    cardStyles: 'text-category-tooling hover:border-current',
    bgStyle: 'bg-category-tooling',
    borderStyle: 'border-category-tooling/50',
    textStyle: 'text-category-tooling',
    textColor: 'text-category-tooling',
    colorFrom: 'from-category-tooling',
    colorTo: 'to-category-tooling',
    bgRadial: 'from-category-tooling via-category-tooling/60 to-transparent',
    badgeTextStyle: 'text-white',
    // No accent override: tooling reads neutral everywhere (menu, landing, docs)
    // from the single-source category token, which is contrast-tuned per mode.
  },
}

// Convenience: the category color for a library id, as class-string fields.
export function categoryStyleFor(id: string): CategoryStyle {
  return categoryStyles[categoryOf(id)]
}
