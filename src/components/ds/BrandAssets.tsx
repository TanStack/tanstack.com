import { DownloadSimpleIcon } from '@phosphor-icons/react'
import { DsSection } from '~/components/ds/DsKit'

type LogoTone = 'black' | 'charcoal' | 'cream' | 'white'

interface LogoAsset {
  tone: LogoTone
  file: string
  onDark: boolean
}

interface GalleryAsset {
  name: string
  category: string
  preview: string
  alt: string
  onDark: boolean
  imgClass: string
  downloads: Array<{ format: string; href: string }>
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

function brandGalleryAssets(
  lockup: string,
  assets: Array<LogoAsset>,
  imgClass: string,
): Array<GalleryAsset> {
  return assets.map((asset) => {
    const src = `/images/brand/${asset.file}`
    const tone = TONE_LABEL[asset.tone]

    return {
      name: `${lockup} · ${tone}`,
      category: 'Brand logo',
      preview: src,
      alt: `TanStack ${lockup.toLowerCase()} logo — ${tone}`,
      onDark: asset.onDark,
      imgClass,
      downloads: [{ format: 'SVG', href: src }],
    }
  })
}

const SOCIAL_LOGOS: Array<GalleryAsset> = [
  ['Mark · Dark', 'mark-dark'],
  ['Mark · Light', 'mark-light'],
  ['Stacked · Dark', 'stacked-dark'],
  ['Stacked · Light', 'stacked-light'],
].map(([name, file]) => ({
  name,
  category: 'Social logo',
  preview: `/images/brand/social/${file}.svg`,
  alt: `TanStack social logo — ${name}`,
  onDark: false,
  imgClass: 'h-full w-full',
  downloads: [
    { format: 'SVG', href: `/images/brand/social/${file}.svg` },
    { format: 'PNG · 2×', href: `/images/brand/social/${file}@2x.png` },
  ],
}))

const FAVICONS: Array<GalleryAsset> = [
  {
    name: 'Favicon · Light mode',
    category: 'Favicon',
    preview: '/favicon-light.svg',
    alt: 'TanStack favicon for light browser themes',
    onDark: false,
    imgClass: 'h-24 w-24',
    downloads: [{ format: 'SVG', href: '/favicon-light.svg' }],
  },
  {
    name: 'Favicon · Dark mode',
    category: 'Favicon',
    preview: '/favicon-dark.svg',
    alt: 'TanStack favicon for dark browser themes',
    onDark: true,
    imgClass: 'h-24 w-24',
    downloads: [{ format: 'SVG', href: '/favicon-dark.svg' }],
  },
]

const BRAND_LOGO_FORMATS = [
  {
    name: 'Stacked',
    assets: brandGalleryAssets('Stacked', STACKED, 'h-20 max-w-full'),
  },
  {
    name: 'Landscape',
    assets: brandGalleryAssets('Landscape', LANDSCAPE, 'h-10 max-w-full'),
  },
  {
    name: 'Emblem',
    assets: brandGalleryAssets('Emblem', EMBLEM, 'h-16 max-w-full'),
  },
]

function AssetCard({ asset }: { asset: GalleryAsset }) {
  return (
    <article className="group overflow-hidden rounded-xl border border-border-default bg-background-surface">
      <div
        className={`relative flex aspect-square items-center justify-center overflow-hidden p-8 ${
          asset.onDark ? 'bg-ds-neutral-500' : 'bg-ds-neutral-100'
        }`}
      >
        <img src={asset.preview} alt={asset.alt} className={asset.imgClass} />
        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/45 to-transparent p-3 pt-10 opacity-100 transition-opacity duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          {asset.downloads.map((download) => (
            <a
              key={download.href}
              href={download.href}
              download
              className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-background-surface px-3 py-2 text-xs font-medium text-text-primary hover:bg-background-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <DownloadSimpleIcon size={14} aria-hidden="true" />
              {download.format}
            </a>
          ))}
        </div>
      </div>
      <div className="border-t border-border-default px-4 py-3">
        <div className="text-sm font-medium text-text-primary">
          {asset.name}
        </div>
        <p className="mt-0.5 font-ds-mono text-[10px] uppercase tracking-wider text-text-muted">
          {asset.category}
        </p>
      </div>
    </article>
  )
}

export function BrandAssetGallery() {
  return (
    <>
      <div className="space-y-8">
        {BRAND_LOGO_FORMATS.map((format) => (
          <section key={format.name} className="space-y-3">
            <h2 className="text-ds-heading-4 font-semibold text-text-primary">
              {format.name}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {format.assets.map((asset) => (
                <AssetCard
                  key={`${asset.category}-${asset.name}`}
                  asset={asset}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <DsSection
        title="Favicons"
        description="Theme-aware marks for browser tabs and compact product surfaces."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {FAVICONS.map((asset) => (
            <AssetCard key={`${asset.category}-${asset.name}`} asset={asset} />
          ))}
        </div>
      </DsSection>

      <DsSection
        title="Social logos"
        description="Square artwork for avatars, profile images, and social posts."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {SOCIAL_LOGOS.map((asset) => (
            <AssetCard key={`${asset.category}-${asset.name}`} asset={asset} />
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

export { BrandAssetGallery as CurrentBrandAssets }
