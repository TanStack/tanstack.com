import { createFileRoute } from '@tanstack/react-router'
import { seo } from '~/utils/seo'
import { DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/shadows')({
  component: ShadowsPage,
  head: () => ({
    meta: seo({
      title: 'Shadows | TanStack Design System',
      description: 'Elevation tokens — the shadow scale.',
    }),
  }),
})

const SHADOWS = [
  { cls: 'shadow-xs', token: '--shadow-xs' },
  { cls: 'shadow-sm', token: '--shadow-sm' },
  { cls: 'shadow-md', token: '--shadow-md' },
  { cls: 'shadow-lg', token: '--shadow-lg' },
  { cls: 'shadow-xl', token: '--shadow-xl' },
  { cls: 'shadow-2xl', token: '--shadow-2xl' },
  { cls: 'shadow-3xl', token: '--shadow-3xl' },
  { cls: 'shadow-inset', token: '--shadow-inset' },
]

function ShadowsPage() {
  return (
    <DsPage
      title="Shadows"
      description="Elevation tokens defined in app.css and applied via Tailwind utilities (e.g. shadow-lg). Use them to layer surfaces — cards, popovers, modals — consistently."
    >
      <DsSection title="Elevation scale">
        <div className="grid grid-cols-2 gap-8 rounded-xl border border-border-default bg-background-subtle p-10 sm:grid-cols-3 lg:grid-cols-4">
          {SHADOWS.map((shadow) => (
            <div key={shadow.cls} className="text-center">
              <div
                className={`mx-auto h-20 w-full rounded-xl border border-border-default bg-background-surface ${shadow.cls}`}
              />
              <div className="mt-3 text-xs font-medium text-text-primary">
                {shadow.cls}
              </div>
              <div className="font-ds-mono text-[11px] text-text-muted">
                {shadow.token}
              </div>
            </div>
          ))}
        </div>
      </DsSection>
    </DsPage>
  )
}
