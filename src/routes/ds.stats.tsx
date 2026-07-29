import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Download, Star, TrendUp } from '@phosphor-icons/react'
import { seo } from '~/utils/seo'
import { StatsSection, type StatItem } from '~/components/ds/ui'
import { ComponentPreview, DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/stats')({
  component: StatsPage,
  head: () => ({
    meta: seo({
      title: 'Stats Section | TanStack Design System',
      description:
        'Workshop surface for the open-source stats — home and library pages across landscape, stacked, and stacked-landscape layouts.',
    }),
  }),
})

// Sample data so the workshop renders without wiring the npm/GitHub queries.
const stats: Array<StatItem> = [
  {
    key: 'total',
    icon: <TrendUp weight="regular" />,
    value: '2.2B',
    placeholder: '0.0B',
    label: 'Total Downloads',
  },
  {
    key: 'weekly',
    icon: <Download weight="regular" />,
    value: '65,395,147',
    placeholder: '00,000,000',
    label: 'Weekly Downloads',
  },
  {
    key: 'stars',
    icon: <Star weight="regular" />,
    value: '49,973',
    placeholder: '000,000',
    label: 'GitHub Stars',
  },
]

function StatsPage() {
  const [page, setPage] = React.useState<
    'hero' | 'home' | 'library' | 'unified'
  >('hero')
  const [layout, setLayout] = React.useState<
    'landscape' | 'stacked' | 'stacked-landscape'
  >('stacked')

  const appearanceOptions = [
    ['home', 'Cards'],
    ['unified', 'Unified'],
    ['hero', 'Minimal'],
    ['library', 'Inline'],
  ] as const
  const layoutOptions = [
    ['landscape', 'Row'],
    ['stacked', 'Stack'],
    ['stacked-landscape', 'Icon top'],
  ] as const

  return (
    <DsPage
      title="Stats Section"
      description="Open-source metrics with switchable visual treatments and layouts. Values are sample data; the component remains presentational and takes resolved values as props."
    >
      <DsSection
        title="Preview"
        description="Choose an appearance and arrangement to inspect every stats treatment in one place."
      >
        <div className="flex flex-wrap gap-4">
          <div>
            <div className="mb-2 font-ds-mono text-ds-mono-caps-xs uppercase text-text-muted">
              Appearance
            </div>
            <div className="inline-flex rounded-lg border border-border-default bg-background-surface p-1">
              {appearanceOptions.map(([option, label]) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={page === option}
                  onClick={() => setPage(option)}
                  className="rounded-md px-3 py-1.5 text-ds-label-sm text-text-muted transition-colors aria-pressed:bg-background-subtle aria-pressed:text-text-primary"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 font-ds-mono text-ds-mono-caps-xs uppercase text-text-muted">
              Layout
            </div>
            <div className="inline-flex rounded-lg border border-border-default bg-background-surface p-1">
              {layoutOptions.map(([option, label]) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={layout === option}
                  onClick={() => setLayout(option)}
                  className="rounded-md px-3 py-1.5 text-ds-label-sm text-text-muted transition-colors aria-pressed:bg-background-subtle aria-pressed:text-text-primary"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <ComponentPreview
          className={
            page === 'hero'
              ? "block bg-[url('/images/hero-palm-gradient.jpg')] bg-cover bg-center"
              : 'block'
          }
          code={`<StatsSection page="${page}" layout="${layout}" stats={stats} />`}
          codePlacement="side"
        >
          <StatsSection page={page} layout={layout} stats={stats} />
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
