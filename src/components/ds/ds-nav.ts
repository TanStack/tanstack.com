export interface DsNavItem {
  label: string
  to: string
}

export interface DsNavSection {
  title: string
  items: Array<DsNavItem>
}

/**
 * Left-hand tree navigation for the Design System (`/ds`).
 *
 * This is the single source of truth for the sidebar. Adding a new page is a
 * two-step change: drop a `ds.<name>.tsx` route in `src/routes` and add an
 * entry here. Keep `Brand & Styles` (tokens & assets) above `Components`
 * (rendered UI).
 */
export const dsNav: Array<DsNavSection> = [
  {
    title: 'Brand & Styles',
    items: [
      { label: 'Overview', to: '/ds' },
      { label: 'Logos', to: '/ds/logos' },
      { label: 'Colors', to: '/ds/colors' },
      { label: 'Typography', to: '/ds/typography' },
      { label: 'Iconography', to: '/ds/iconography' },
      { label: 'Icon Migration', to: '/ds/icon-migration' },
      { label: 'Shadows', to: '/ds/shadows' },
      { label: 'Effects', to: '/ds/effects' },
    ],
  },
  {
    title: 'Figma Tokens',
    items: [
      { label: 'Palette', to: '/ds/palette' },
      { label: 'Semantic Tokens', to: '/ds/semantic' },
    ],
  },
  {
    title: 'Components',
    items: [
      { label: 'Buttons', to: '/ds/buttons' },
      { label: 'Badges', to: '/ds/badges' },
      { label: 'Eyebrow', to: '/ds/eyebrow' },
      { label: 'Inputs', to: '/ds/inputs' },
      { label: 'Dropdown', to: '/ds/dropdown' },
      { label: 'Avatar', to: '/ds/avatar' },
      { label: 'Spinner', to: '/ds/spinner' },
      { label: 'Collapsible', to: '/ds/collapsible' },
      { label: 'Breadcrumbs', to: '/ds/breadcrumbs' },
      { label: 'Cards & Surfaces', to: '/ds/cards' },
      { label: 'Navbar', to: '/ds/navbar' },
    ],
  },
]
