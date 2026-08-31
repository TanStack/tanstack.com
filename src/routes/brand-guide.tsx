import { CaretDownIcon, DownloadSimpleIcon } from '@phosphor-icons/react'
import { createFileRoute } from '@tanstack/react-router'
import { CurrentBrandAssets } from '~/components/ds/BrandAssets'
import { DsPage } from '~/components/ds/DsKit'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/brand-guide')({
  component: BrandGuidePage,
  head: () => ({
    meta: seo({
      title: 'TanStack Brand Assets',
      description: 'Download the current TanStack logos and brand assets.',
    }),
  }),
})

interface PreviousAsset {
  name: string
  file: string
  onDark?: boolean
  tall?: boolean
}

const PREVIOUS_ASSETS: Array<PreviousAsset> = [
  { name: 'Color mark · 600px', file: 'logo-color-600.png' },
  { name: 'Color mark · 100px', file: 'logo-color-100.png' },
  { name: 'Color landscape · 600px', file: 'logo-color-banner-600.png' },
  { name: 'Color landscape · 100px', file: 'logo-color-banner-100.png' },
  { name: 'Black mark', file: 'logo-black.svg' },
  { name: 'White mark', file: 'logo-white.svg', onDark: true },
  { name: 'Black wordmark', file: 'logo-word-black.svg' },
  { name: 'White wordmark', file: 'logo-word-white.svg', onDark: true },
  { name: 'Light splash', file: 'splash-light.png', tall: true },
  { name: 'Dark splash', file: 'splash-dark.png', onDark: true, tall: true },
  { name: 'Toy Palm Chair', file: 'toy-palm-chair.png', tall: true },
]

function PreviousAssetCard({ asset }: { asset: PreviousAsset }) {
  const src = `/images/logos/${asset.file}`
  const format = asset.file.split('.').at(-1)?.toUpperCase()

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-background-surface">
      <div
        className={`flex h-48 items-center justify-center p-6 ${
          asset.onDark ? 'bg-ds-neutral-500' : 'bg-ds-neutral-100'
        }`}
      >
        <img
          src={src}
          alt={asset.name}
          loading="lazy"
          className={
            asset.tall
              ? 'max-h-full max-w-full object-contain'
              : 'max-h-20 max-w-full object-contain'
          }
        />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border-default px-4 py-3">
        <span className="text-sm text-text-secondary">{asset.name}</span>
        <a
          href={src}
          download
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background-subtle hover:text-text-primary"
        >
          <DownloadSimpleIcon size={14} />
          {format}
        </a>
      </div>
    </div>
  )
}

function BrandGuidePage() {
  return (
    <DsPage
      title="TanStack Brand Assets"
      description="Download the current TanStack marks. Use previous assets only for existing integrations."
    >
      <CurrentBrandAssets />

      <details className="group border-t border-border-default pt-8">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-ds-heading-lg font-semibold text-text-primary [&::-webkit-details-marker]:hidden">
          Previous Assets
          <CaretDownIcon
            aria-hidden
            className="transition-transform group-open:rotate-180"
          />
        </summary>
        <p className="mt-3 text-ds-body-sm text-text-secondary">
          Legacy marks retained for existing integrations.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PREVIOUS_ASSETS.map((asset) => (
            <PreviousAssetCard key={asset.file} asset={asset} />
          ))}
        </div>
      </details>
    </DsPage>
  )
}
