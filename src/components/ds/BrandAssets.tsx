import { DownloadSimple } from '@phosphor-icons/react'
import { DsSection } from '~/components/ds/DsKit'

type LogoTone = 'black' | 'charcoal' | 'cream' | 'white'

interface LogoAsset {
  tone: LogoTone
  file: string
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

const EMBLEM: Array<LogoAsset> = [
  { tone: 'black', file: 'tanstack-emblem-black.svg', onDark: false },
  { tone: 'charcoal', file: 'tanstack-emblem-charcoal.svg', onDark: false },
  { tone: 'cream', file: 'tanstack-emblem-cream.svg', onDark: true },
  { tone: 'white', file: 'tanstack-emblem-white.svg', onDark: true },
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

export function CurrentBrandAssets() {
  return (
    <>
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

      <DsSection
        title="Emblem"
        description="The palm-island mark on its own — for avatars, favicons, and tight squares where the wordmark would not read."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EMBLEM.map((asset) => (
            <LogoCard
              key={asset.file}
              asset={asset}
              lockup="emblem"
              imgClass="h-16"
            />
          ))}
        </div>
      </DsSection>

      <DsSection title="Usage">
        <ul className="list-disc space-y-2 pl-5 text-ds-body-sm text-text-secondary">
          <li>Keep the original proportions.</li>
          <li>Leave clear space around the mark.</li>
          <li>
            Use dark marks on light surfaces and light marks on dark surfaces.
          </li>
        </ul>
      </DsSection>
    </>
  )
}
