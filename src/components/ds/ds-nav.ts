export interface DsNavItem {
  label: string
  to: string
  sections?: Array<string>
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
      { label: 'Overview', to: '/ds', sections: ['How to use this'] },
      {
        label: 'Logos',
        to: '/ds/logos',
        sections: ['Brand logos', 'Social logos', 'Favicons', 'Usage'],
      },
      {
        label: 'Colors',
        to: '/ds/colors',
        sections: [
          'Brand & neutral ramps',
          'Text',
          'Background',
          'Border',
          'Icon',
          'Action',
          'Status',
          'Accent',
        ],
      },
      {
        label: 'Typography',
        to: '/ds/typography',
        sections: ['Font families', 'Documentation roles', 'Semantic headings'],
      },
      {
        label: 'Iconography',
        to: '/ds/iconography',
        sections: ['Browse'],
      },
      {
        label: 'Shadows',
        to: '/ds/shadows',
        sections: ['Elevation scale'],
      },
      {
        label: 'Effects',
        to: '/ds/effects',
        sections: ['Animated gradient text', 'Glass surface'],
      },
    ],
  },
  {
    title: 'Figma Tokens',
    items: [
      {
        label: 'Palette',
        to: '/ds/palette',
        sections: [
          'Green',
          'Terracotta',
          'Blue',
          'Purple',
          'Amber',
          'Neutral',
          'Neutral tint (cool)',
          'Category colors',
          'Library brand colors',
        ],
      },
      {
        label: 'Semantic Tokens',
        to: '/ds/semantic',
        sections: [
          'Text',
          'Background',
          'Border',
          'Icon',
          'Action',
          'Status',
          'Accent',
        ],
      },
    ],
  },
  {
    title: 'Components',
    items: [
      {
        label: 'Buttons',
        to: '/ds/buttons',
        sections: [
          'Variants',
          'Gradient (landing CTA)',
          'Colors',
          'Sizes',
          'Link buttons',
          'Icon buttons',
          'Rounded',
          'With icons & states',
          'Button group',
          'Leading & trailing icons',
          'Split button',
        ],
      },
      {
        label: 'Badges',
        to: '/ds/badges',
        sections: ['Variants', 'Corner styles', 'In context'],
      },
      {
        label: 'Eyebrow',
        to: '/ds/eyebrow',
        sections: ['Context', 'Tones', 'With icon', 'Brand accent'],
      },
      {
        label: 'Inputs',
        to: '/ds/inputs',
        sections: [
          'Default',
          'Focus rings',
          'With a label & disabled',
          'Progressive search',
          'Persistent search',
          'Large search target',
        ],
      },
      {
        label: 'Dropdown',
        to: '/ds/dropdown',
        sections: ['Basic menu'],
      },
      {
        label: 'Avatar',
        to: '/ds/avatar',
        sections: [
          'Sizes',
          'Fallbacks',
          'Maintainer card',
          'Responsive maintainer grid',
        ],
      },
      {
        label: 'Spinner',
        to: '/ds/spinner',
        sections: ['Sizes & color', 'Headbanger'],
      },
      {
        label: 'Collapsible',
        to: '/ds/collapsible',
        sections: ['Disclosure'],
      },
      {
        label: 'Breadcrumbs',
        to: '/ds/breadcrumbs',
        sections: ['Section + on-this-page'],
      },
      {
        label: 'Cards & Surfaces',
        to: '/ds/cards',
        sections: ['Card', 'Inline code', 'Blog post card', 'Tooltip'],
      },
      {
        label: 'Stats Section',
        to: '/ds/stats',
        sections: ['Preview'],
      },
      {
        label: 'Navbar',
        to: '/ds/navbar',
        sections: [
          'Anatomy',
          'Mega menu item',
          'Menu variants',
          'Regions',
          'Layout & spacing',
          'Responsive behavior',
          'Source',
        ],
      },
    ],
  },
]

export function toDsSectionId(title: string) {
  return title
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
