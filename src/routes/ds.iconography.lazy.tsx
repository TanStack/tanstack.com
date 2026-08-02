import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import { createLazyFileRoute } from '@tanstack/react-router'
import {
  CaretDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  StarIcon,
} from '@phosphor-icons/react'
import type { IconWeight } from '@phosphor-icons/react'
import { copyTextToClipboard } from '~/utils/browser-effects'
import { DsPage, DsSection } from '~/components/ds/DsKit'
import { phosphorIconRegistry } from '~/components/ds/phosphor-icons.generated'
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
} from '~/components/ds/ui'

export const Route = createLazyFileRoute('/ds/iconography')({
  component: IconographyPage,
})

const WEIGHTS: Array<IconWeight> = [
  'thin',
  'light',
  'regular',
  'bold',
  'fill',
  'duotone',
]
const SIZES = [16, 20, 24, 32, 48]
const PAGE_SIZE = 120

const triggerClass =
  'inline-flex h-10 items-center gap-2 rounded-lg border border-border-default bg-background-surface px-3 text-sm text-text-primary transition-colors hover:bg-background-subtle'

// A small square that scales with the icon size — the visual size cue.
function SizeGlyph({ px }: { px: number }) {
  const box = Math.max(8, Math.min(22, Math.round(px * 0.5)))
  return (
    <span
      style={{ width: box, height: box }}
      className="inline-block shrink-0 rounded-[3px] border-2 border-current"
    />
  )
}

function IconographyPage() {
  const [weight, setWeight] = React.useState<IconWeight>('regular')
  const [size, setSize] = React.useState(24)
  const [query, setQuery] = React.useState('')
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [copied, setCopied] = React.useState<string | null>(null)
  const [visible, setVisible] = React.useState(PAGE_SIZE)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  const closeSearch = React.useCallback(() => {
    setQuery('')
    setSearchOpen(false)
  }, [])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return phosphorIconRegistry
    return phosphorIconRegistry.filter((icon) =>
      icon.name.toLowerCase().includes(q),
    )
  }, [query])

  // Reset paging when the result set changes.
  React.useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [query])

  const shown = filtered.slice(0, visible)

  const handleCopy = React.useCallback(async (name: string) => {
    await copyTextToClipboard(`<${name} />`)
    setCopied(name)
    window.setTimeout(() => setCopied(null), 1200)
  }, [])

  return (
    <DsPage
      title="Iconography"
      description="Phosphor Icons is the systematic icon library for TanStack — the full set, in six weights (thin, light, regular, bold, fill, duotone). Import from @phosphor-icons/react. Click any icon to copy its JSX."
    >
      <DsSection title="Browse">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {/* Style (weight) — dropdown with a live preview per weight */}
          <Dropdown>
            <DropdownTrigger>
              <button type="button" className={triggerClass}>
                <StarIcon weight={weight} size={17} />
                <span className="capitalize">{weight}</span>
                <CaretDownIcon size={13} className="text-text-muted" />
              </button>
            </DropdownTrigger>
            <DropdownContent align="start" className="min-w-44">
              {WEIGHTS.map((w) => (
                <DropdownItem key={w} onSelect={() => setWeight(w)}>
                  <StarIcon weight={w} size={18} />
                  <span className="flex-1 capitalize">{w}</span>
                  {w === weight ? (
                    <CheckIcon size={14} className="text-text-accent" />
                  ) : null}
                </DropdownItem>
              ))}
            </DropdownContent>
          </Dropdown>

          {/* Size — dropdown with a scaling size glyph per option */}
          <Dropdown>
            <DropdownTrigger>
              <button type="button" className={triggerClass}>
                <SizeGlyph px={size} />
                <span className="tabular-nums">{size}px</span>
                <CaretDownIcon size={13} className="text-text-muted" />
              </button>
            </DropdownTrigger>
            <DropdownContent align="start" className="min-w-40">
              {SIZES.map((s) => (
                <DropdownItem key={s} onSelect={() => setSize(s)}>
                  <span className="flex w-6 justify-center">
                    <SizeGlyph px={s} />
                  </span>
                  <span className="flex-1 tabular-nums">{s}px</span>
                  {s === size ? (
                    <CheckIcon size={14} className="text-text-accent" />
                  ) : null}
                </DropdownItem>
              ))}
            </DropdownContent>
          </Dropdown>

          {/* Expanding search — icon grows on hover, opens into a field */}
          <div
            className={twMerge(
              'group flex h-10 items-center overflow-hidden rounded-lg border bg-background-surface transition-[width,border-color] duration-300 ease-out',
              searchOpen
                ? 'w-60 border-border-focus'
                : 'w-10 border-border-default',
            )}
          >
            <button
              type="button"
              aria-label={searchOpen ? 'Close search' : 'Search icons'}
              onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
              className="flex h-10 w-10 shrink-0 items-center justify-center text-text-muted transition-colors hover:text-text-primary"
            >
              <MagnifyingGlassIcon
                size={18}
                weight="bold"
                className={twMerge(
                  'transition-transform duration-200',
                  !searchOpen && 'group-hover:scale-125',
                )}
              />
            </button>
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
              placeholder="Search icons…"
              className={twMerge(
                'min-w-0 flex-1 bg-transparent pr-3 text-sm text-text-primary placeholder-text-muted outline-none transition-opacity duration-200',
                searchOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
              )}
            />
          </div>

          <span className="ml-auto text-ds-body-sm text-text-muted">
            {filtered.length.toLocaleString()} icons
          </span>
        </div>

        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {shown.map(({ name, Cmp }) => (
            <button
              key={name}
              type="button"
              onClick={() => handleCopy(name)}
              title={`Copy <${name} />`}
              className="group flex flex-col items-center gap-2.5 bg-background-default p-5 text-center transition-colors hover:bg-background-subtle"
            >
              <span className="flex h-12 items-center justify-center">
                <Cmp
                  size={size}
                  weight={weight}
                  className="text-text-secondary"
                />
              </span>
              <span className="w-full truncate text-[11px] text-text-muted group-hover:text-text-secondary">
                {copied === name ? 'Copied!' : name}
              </span>
            </button>
          ))}
        </div>

        {shown.length < filtered.length ? (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="rounded-lg border border-border-strong px-5 py-2.5 text-ds-label-md text-text-primary transition-colors hover:bg-background-subtle"
            >
              Load more ({(filtered.length - shown.length).toLocaleString()}{' '}
              remaining)
            </button>
          </div>
        ) : null}
      </DsSection>
    </DsPage>
  )
}
