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
  return (
    <DsPage
      title="Stats Section"
      description="Open-source stats. Two pages (home / library) across three layouts, modeled on the Figma component set. Values are sample data — the component is presentational and takes resolved values as props, so it can be revised here and propagated back to the homepage and library landings."
    >
      <DsSection
        title="Home · Landscape"
        description="Bordered surface cards in a row, icon leading. The primary homepage treatment."
      >
        <ComponentPreview
          className="block"
          code={`<StatsSection page="home" layout="landscape" stats={stats} />`}
        >
          <StatsSection page="home" layout="landscape" stats={stats} />
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Home · Stacked"
        description="The same cards in a column — for narrow columns and sidebars."
      >
        <ComponentPreview
          className="block"
          code={`<StatsSection page="home" layout="stacked" stats={stats} />`}
        >
          <StatsSection page="home" layout="stacked" stats={stats} />
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Home · Stacked-landscape"
        description="Cards in a row with the icon on top, value and label stacked beneath."
      >
        <ComponentPreview
          className="block"
          code={`<StatsSection page="home" layout="stacked-landscape" stats={stats} />`}
        >
          <StatsSection page="home" layout="stacked-landscape" stats={stats} />
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Library · Stacked"
        description="Borderless value/label rows for a library hero — icon, value, mono-caps label."
      >
        <ComponentPreview
          className="block"
          code={`<StatsSection page="library" layout="stacked" stats={stats} />`}
        >
          <StatsSection page="library" layout="stacked" stats={stats} />
        </ComponentPreview>
      </DsSection>

      <DsSection
        title="Library · Landscape"
        description="All three metrics on a single line — for compact, wide placements."
      >
        <ComponentPreview
          className="block"
          code={`<StatsSection page="library" layout="landscape" stats={stats} />`}
        >
          <StatsSection page="library" layout="landscape" stats={stats} />
        </ComponentPreview>
      </DsSection>
    </DsPage>
  )
}
