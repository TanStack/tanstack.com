import * as React from 'react'
import {
  CaretDownIcon as CaretDown,
  CheckIcon as Check,
  CopyIcon as Copy,
  DownloadSimpleIcon as DownloadSimple,
} from '@phosphor-icons/react'
import { DsSection } from '~/components/ds/DsKit'
import { useToast } from '~/components/ToastProvider'
import { copyTextToClipboard, useTemporaryFlag } from '~/utils/browser-effects'
import {
  Button,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
} from '~/components/ds/ui'

type LogoTone = 'black' | 'charcoal' | 'cream' | 'white'

interface GalleryAsset {
  name: string
  category: string
  preview: string
  alt: string
  onDark: boolean
  imgClass: string
  downloads: Array<{ format: 'SVG'; href: string }>
}

const BRAND_LOGOS = [
  {
    value: 'stacked',
    label: 'Stacked',
    colors: ['black', 'charcoal', 'cream', 'white'],
  },
  {
    value: 'landscape',
    label: 'Landscape',
    colors: ['black', 'charcoal', 'white'],
  },
  {
    value: 'emblem',
    label: 'Emblem',
    colors: ['black', 'charcoal', 'cream', 'white'],
  },
] as const

const BRAND_COLORS: Array<{
  value: LogoTone
  label: string
  swatch: string
}> = [
  { value: 'black', label: 'Black', swatch: '#111111' },
  { value: 'charcoal', label: 'Charcoal', swatch: '#444444' },
  { value: 'cream', label: 'Cream', swatch: '#eeebd4' },
  { value: 'white', label: 'White', swatch: '#ffffff' },
]

const BRAND_FORMATS = [
  { value: 'svg', label: 'SVG' },
  { value: 'png', label: 'PNG · 2×' },
] as const

type BrandLogo = (typeof BRAND_LOGOS)[number]
type BrandColor = (typeof BRAND_COLORS)[number]
type BrandFormat = (typeof BRAND_FORMATS)[number]

type DissolveAsset = {
  src: string
  alt: string
}

function CopyAssetButton({
  className,
  format,
  href,
  label,
}: {
  className: string
  format: 'svg' | 'png'
  href: string
  label: string
}) {
  const copied = useTemporaryFlag(1500)
  const { notify } = useToast()

  const copyAsset = async () => {
    try {
      const response = await fetch(href)
      if (!response.ok) throw new Error('Asset unavailable')

      if (format === 'svg') {
        await copyTextToClipboard(await response.text())
      } else {
        const blob = await response.blob()
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ])
      }

      copied.trigger()
      notify(<div className="font-medium">Copied {label}</div>, {
        id: 'brand-asset-copied',
      })
    } catch {
      notify(<div className="font-medium">Could not copy {label}</div>, {
        id: 'brand-asset-copy-failed',
      })
    }
  }

  return (
    <Button
      type="button"
      variant="icon"
      size="icon-md"
      className={className}
      aria-label={`Copy ${label} to clipboard`}
      title={copied.active ? 'Copied' : `Copy ${format.toUpperCase()}`}
      onClick={copyAsset}
    >
      {copied.active ? (
        <Check size={18} aria-hidden="true" />
      ) : (
        <Copy size={18} aria-hidden="true" />
      )}
    </Button>
  )
}

function DissolvingLogoPreview({
  src,
  alt,
  className,
}: DissolveAsset & { className: string }) {
  const [current, setCurrent] = React.useState<DissolveAsset>({ src, alt })
  const [incoming, setIncoming] = React.useState<DissolveAsset | null>(null)
  const [incomingVisible, setIncomingVisible] = React.useState(false)
  const requestId = React.useRef(0)

  React.useEffect(() => {
    if (src === current.src) return

    const activeRequest = ++requestId.current
    const image = new Image()
    image.onload = () => {
      if (activeRequest !== requestId.current) return

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setCurrent({ src, alt })
        setIncoming(null)
        setIncomingVisible(false)
        return
      }

      setIncoming({ src, alt })
      setIncomingVisible(false)
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (activeRequest === requestId.current) setIncomingVisible(true)
        })
      })
    }
    image.src = src

    return () => {
      requestId.current += 1
    }
  }, [alt, current.src, src])

  const finishDissolve = (event: React.TransitionEvent<HTMLImageElement>) => {
    if (event.propertyName !== 'opacity' || !incoming || !incomingVisible) {
      return
    }

    setCurrent(incoming)
    setIncoming(null)
    setIncomingVisible(false)
  }

  return (
    <div className={`relative ${className}`}>
      <img
        src={current.src}
        alt={incoming ? '' : current.alt}
        aria-hidden={Boolean(incoming)}
        className={`absolute inset-0 size-full object-contain transition-opacity duration-[140ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
          incomingVisible ? 'opacity-0' : 'opacity-100'
        }`}
      />
      {incoming ? (
        <img
          src={incoming.src}
          alt={incoming.alt}
          onTransitionEnd={finishDissolve}
          className={`absolute inset-0 size-full object-contain transition-opacity duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
            incomingVisible ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : null}
    </div>
  )
}

function BrandLogoPicker() {
  const [logo, setLogo] = React.useState<BrandLogo>(BRAND_LOGOS[0])
  const [color, setColor] = React.useState<BrandColor>(BRAND_COLORS[0])
  const [format, setFormat] = React.useState<BrandFormat>(BRAND_FORMATS[0])
  const availableColors = BRAND_COLORS.filter((option) =>
    logo.colors.some((value) => value === option.value),
  )
  const extension = format.value === 'png' ? '@2x.png' : '.svg'
  const assetName = `tanstack-${logo.value}-${color.value}`
  const href = `/images/brand/${assetName}${extension}`
  const onDark = color.value === 'cream' || color.value === 'white'
  const actionClassName = `hover:bg-transparent max-[899px]:bg-transparent ${
    onDark
      ? 'text-ds-neutral-100 hover:text-ds-neutral-100/70'
      : 'text-ds-neutral-500 hover:text-ds-neutral-500/70'
  }`

  const selectLogo = (option: BrandLogo) => {
    setLogo(option)
    if (!option.colors.some((value) => value === color.value)) {
      const nextColor = BRAND_COLORS.find(
        (candidate) => candidate.value === option.colors[0],
      )
      if (nextColor) setColor(nextColor)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border-default bg-background-surface">
      <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-3 p-4">
        <Dropdown>
          <DropdownTrigger>
            <button type="button" className={socialControlClass}>
              <span>{logo.label}</span>
              <CaretDown size={13} className="text-text-muted" />
            </button>
          </DropdownTrigger>
          <DropdownContent align="start" className="min-w-44">
            {BRAND_LOGOS.map((option) => (
              <DropdownItem
                key={option.value}
                onSelect={() => selectLogo(option)}
              >
                <span className="flex-1">{option.label}</span>
                {option.value === logo.value ? (
                  <Check size={14} className="text-text-accent" />
                ) : null}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>

        <Dropdown>
          <DropdownTrigger>
            <button type="button" className={socialControlClass}>
              <span
                aria-hidden="true"
                className="size-4 rounded-full border border-border-default"
                style={{ background: color.swatch }}
              />
              <span>{color.label}</span>
              <CaretDown size={13} className="text-text-muted" />
            </button>
          </DropdownTrigger>
          <DropdownContent align="start" className="min-w-44">
            {availableColors.map((option) => (
              <DropdownItem
                key={option.value}
                onSelect={() => setColor(option)}
              >
                <span
                  aria-hidden="true"
                  className="size-4 rounded-full border border-border-default"
                  style={{ background: option.swatch }}
                />
                <span className="flex-1">{option.label}</span>
                {option.value === color.value ? (
                  <Check size={14} className="text-text-accent" />
                ) : null}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>

        <Dropdown>
          <DropdownTrigger>
            <button type="button" className={socialControlClass}>
              <span>{format.label}</span>
              <CaretDown size={13} className="text-text-muted" />
            </button>
          </DropdownTrigger>
          <DropdownContent align="start" className="min-w-36">
            {BRAND_FORMATS.map((option) => (
              <DropdownItem
                key={option.value}
                onSelect={() => setFormat(option)}
              >
                <span className="flex-1">{option.label}</span>
                {option.value === format.value ? (
                  <Check size={14} className="text-text-accent" />
                ) : null}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>

        <div className="ml-auto flex items-center gap-2">
          <CopyAssetButton
            className={actionClassName}
            format={format.value}
            href={href}
            label={`${logo.label} ${color.label} ${format.label}`}
          />
          <Button
            as="a"
            href={href}
            download={`${assetName}${extension}`}
            variant="icon"
            size="icon-md"
            className={actionClassName}
            aria-label={`Download ${logo.label} ${color.label} as ${format.label}`}
            title={`Download ${format.label}`}
          >
            <DownloadSimple size={18} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div
        className={`grid min-h-[28rem] place-items-center p-10 sm:p-16 ${
          onDark ? 'bg-ds-neutral-500' : 'bg-ds-neutral-100'
        }`}
      >
        <DissolvingLogoPreview
          src={href}
          alt={`TanStack ${logo.label.toLowerCase()} logo in ${color.label.toLowerCase()}`}
          className={
            logo.value === 'emblem'
              ? 'h-72 w-48'
              : logo.value === 'landscape'
                ? 'aspect-[6.4/1] w-full max-w-2xl'
                : 'aspect-[2.53/1] w-full max-w-lg'
          }
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-default px-4 py-3">
        <div>
          <div className="text-sm font-medium text-text-primary">
            {logo.label} · {color.label}
          </div>
          <p className="mt-0.5 font-ds-mono text-[10px] uppercase tracking-wider text-text-muted">
            Brand logo · {format.label}
          </p>
        </div>
        <code className="text-xs text-text-muted">{assetName}</code>
      </div>
    </div>
  )
}

const SOCIAL_ORIENTATIONS = [
  { value: 'naked-mark', label: 'Naked mark' },
  { value: 'mark', label: 'Tablet' },
  { value: 'stacked', label: 'Stacked' },
] as const

const SOCIAL_COLORS = [
  { value: 'dark', label: 'Dark', swatch: '#111111' },
  { value: 'light', label: 'Light', swatch: '#eeebd4' },
  {
    value: 'green',
    label: 'Green',
    swatch: 'linear-gradient(135deg, #2fbf71, #087f5b)',
  },
  {
    value: 'ocean',
    label: 'Ocean',
    swatch: 'linear-gradient(135deg, #38bdf8, #2563eb)',
  },
  {
    value: 'purple',
    label: 'Purple',
    swatch: 'linear-gradient(135deg, #c084fc, #7c3aed)',
  },
  { value: 'yellow', label: 'Yellow', swatch: '#ffed6a' },
] as const

const SOCIAL_FORMATS = [
  { value: 'svg', label: 'SVG' },
  { value: 'png', label: 'PNG · 2×' },
] as const

type SocialOrientation = (typeof SOCIAL_ORIENTATIONS)[number]
type SocialColor = (typeof SOCIAL_COLORS)[number]
type SocialFormat = (typeof SOCIAL_FORMATS)[number]

const socialControlClass =
  'inline-flex h-10 items-center gap-2 rounded-lg border border-border-default bg-background-surface px-3 text-sm text-text-primary transition-colors hover:bg-background-subtle'

function SocialLogoPicker() {
  const [orientation, setOrientation] = React.useState<SocialOrientation>(
    SOCIAL_ORIENTATIONS[1],
  )
  const [color, setColor] = React.useState<SocialColor>(SOCIAL_COLORS[0])
  const [format, setFormat] = React.useState<SocialFormat>(SOCIAL_FORMATS[0])
  const extension = format.value === 'png' ? '@2x.png' : '.svg'
  const assetName = `${orientation.value}-${color.value}`
  const href = `/images/brand/social/${assetName}${extension}`

  return (
    <div className="relative overflow-hidden rounded-xl border border-border-default bg-background-surface">
      <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-3 p-4">
        <Dropdown>
          <DropdownTrigger>
            <button type="button" className={socialControlClass}>
              <span>{orientation.label}</span>
              <CaretDown size={13} className="text-text-muted" />
            </button>
          </DropdownTrigger>
          <DropdownContent align="start" className="min-w-44">
            {SOCIAL_ORIENTATIONS.map((option) => (
              <DropdownItem
                key={option.value}
                onSelect={() => setOrientation(option)}
              >
                <span className="flex-1">{option.label}</span>
                {option.value === orientation.value ? (
                  <Check size={14} className="text-text-accent" />
                ) : null}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>

        <Dropdown>
          <DropdownTrigger>
            <button type="button" className={socialControlClass}>
              <span
                aria-hidden="true"
                className="size-4 rounded-full border border-border-default"
                style={{ background: color.swatch }}
              />
              <span>{color.label}</span>
              <CaretDown size={13} className="text-text-muted" />
            </button>
          </DropdownTrigger>
          <DropdownContent align="start" className="min-w-44">
            {SOCIAL_COLORS.map((option) => (
              <DropdownItem
                key={option.value}
                onSelect={() => setColor(option)}
              >
                <span
                  aria-hidden="true"
                  className="size-4 rounded-full border border-border-default"
                  style={{ background: option.swatch }}
                />
                <span className="flex-1">{option.label}</span>
                {option.value === color.value ? (
                  <Check size={14} className="text-text-accent" />
                ) : null}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>

        <Dropdown>
          <DropdownTrigger>
            <button type="button" className={socialControlClass}>
              <span>{format.label}</span>
              <CaretDown size={13} className="text-text-muted" />
            </button>
          </DropdownTrigger>
          <DropdownContent align="start" className="min-w-36">
            {SOCIAL_FORMATS.map((option) => (
              <DropdownItem
                key={option.value}
                onSelect={() => setFormat(option)}
              >
                <span className="flex-1">{option.label}</span>
                {option.value === format.value ? (
                  <Check size={14} className="text-text-accent" />
                ) : null}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>

        <div className="ml-auto flex items-center gap-2">
          <CopyAssetButton
            className="text-text-primary hover:bg-transparent hover:text-text-secondary max-[899px]:bg-transparent"
            format={format.value}
            href={href}
            label={`${orientation.label} ${color.label} ${format.label}`}
          />
          <Button
            as="a"
            href={href}
            download={`${assetName}${extension}`}
            variant="icon"
            size="icon-md"
            className="text-text-primary hover:bg-transparent hover:text-text-secondary max-[899px]:bg-transparent"
            aria-label={`Download ${orientation.label} ${color.label} as ${format.label}`}
            title={`Download ${format.label}`}
          >
            <DownloadSimple size={18} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="grid min-h-[28rem] place-items-center bg-background-default p-6 sm:p-10">
        <DissolvingLogoPreview
          src={href}
          alt={`TanStack ${orientation.label.toLowerCase()} social logo in ${color.label.toLowerCase()}`}
          className="aspect-square w-full max-w-md overflow-hidden rounded-xl shadow-lg"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-default px-4 py-3">
        <div>
          <div className="text-sm font-medium text-text-primary">
            {orientation.label} · {color.label}
          </div>
          <p className="mt-0.5 font-ds-mono text-[10px] uppercase tracking-wider text-text-muted">
            Social logo · {format.label}
          </p>
        </div>
        <code className="text-xs text-text-muted">{assetName}</code>
      </div>
    </div>
  )
}

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
            <React.Fragment key={download.href}>
              <CopyAssetButton
                className="text-white hover:bg-transparent hover:text-white/70 max-[899px]:bg-transparent"
                format="svg"
                href={download.href}
                label={`${asset.name} ${download.format}`}
              />
              <Button
                as="a"
                href={download.href}
                download
                variant="icon"
                size="icon-md"
                aria-label={`Download ${asset.name} as ${download.format}`}
                title={`Download ${download.format}`}
                className="text-white hover:bg-transparent hover:text-white/70 max-[899px]:bg-transparent"
              >
                <DownloadSimple size={14} aria-hidden="true" />
              </Button>
            </React.Fragment>
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
      <DsSection
        title="Brand logos"
        description="Choose the lockup, color, and file format for the TanStack brand logo."
      >
        <BrandLogoPicker />
      </DsSection>

      <DsSection
        title="Social logos"
        description="Choose an orientation, color, and file format for avatars, profile images, and social posts."
      >
        <SocialLogoPicker />
      </DsSection>

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
