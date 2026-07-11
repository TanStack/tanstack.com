import { createFileRoute } from '@tanstack/react-router'
import { DownloadSimple } from '@phosphor-icons/react'
import { seo } from '~/utils/seo'
import { DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/logos')({
  component: LogosPage,
  head: () => ({
    meta: seo({
      title: 'Logos | TanStack Design System',
      description:
        'Download the TanStack logo lockups — stacked and landscape, in every brand color.',
    }),
  }),
})

type LogoTone = 'black' | 'charcoal' | 'cream' | 'white'

interface LogoAsset {
  tone: LogoTone
  file: string
  // Light marks (cream/white) need a dark backdrop to stay visible.
  onDark: boolean
}

const TONE_LABEL: Record<LogoTone, string> = {
  black: 'Black',
  charcoal: 'Charcoal',
  cream: 'Cream',
  white: 'White',
}

const STACKED: Array<LogoAsset> = [
  { tone: 'black', file: 'tanstack-stacked-black.svg', onDark: false },
  { tone: 'charcoal', file: 'tanstack-stacked-charcoal.svg', onDark: false },
  { tone: 'cream', file: 'tanstack-stacked-cream.svg', onDark: true },
  { tone: 'white', file: 'tanstack-stacked-white.svg', onDark: true },
]

const LANDSCAPE: Array<LogoAsset> = [
  { tone: 'black', file: 'tanstack-landscape-black.svg', onDark: false },
  { tone: 'charcoal', file: 'tanstack-landscape-charcoal.svg', onDark: false },
  { tone: 'white', file: 'tanstack-landscape-white.svg', onDark: true },
]

function LogoCard({
  asset,
  lockup,
  imgClass,
}: {
  asset: LogoAsset
  lockup: string
  imgClass: string
}) {
  const src = `/images/brand/${asset.file}`

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-background-surface">
      {/* Fixed backdrops — a mark's color is fixed, so its preview surface must
          not flip with the page theme. Light marks on neutral-500, dark marks on
          neutral-100. */}
      <div
        className={`flex items-center justify-center px-8 py-12 ${
          asset.onDark ? 'bg-ds-neutral-500' : 'bg-ds-neutral-100'
        }`}
      >
        <img
          src={src}
          alt={`TanStack ${lockup} logo — ${TONE_LABEL[asset.tone]}`}
          className={`w-auto max-w-full ${imgClass}`}
        />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border-default px-4 py-3">
        <span className="font-ds-mono text-xs text-text-secondary">
          {TONE_LABEL[asset.tone]}
        </span>
        <a
          href={src}
          download
          className="inline-flex items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background-subtle hover:text-text-primary"
        >
          <DownloadSimple size={14} />
          SVG
        </a>
      </div>
    </div>
  )
}

function LogosPage() {
  return (
    <DsPage
      title="Logos"
      description="The TanStack brand marks. Use the stacked lockup where vertical room allows and the landscape lockup for navbars and wide, short spaces. Pick the color that keeps the mark legible on its background — dark marks on light surfaces, light marks on dark. Every mark is an SVG; download the one you need below."
    >
      <DsSection
        title="Stacked"
        description="Emblem over the wordmark — the primary lockup."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STACKED.map((asset) => (
            <LogoCard
              key={asset.file}
              asset={asset}
              lockup="stacked"
              imgClass="h-20"
            />
          ))}
        </div>
      </DsSection>

      <DsSection
        title="Landscape"
        description="Emblem beside the wordmark — for headers and horizontal space."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LANDSCAPE.map((asset) => (
            <LogoCard
              key={asset.file}
              asset={asset}
              lockup="landscape"
              imgClass="h-10"
            />
          ))}
        </div>
      </DsSection>
    </DsPage>
  )
}
