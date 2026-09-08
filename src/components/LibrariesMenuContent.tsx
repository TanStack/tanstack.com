import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { twMerge } from 'tailwind-merge'
import { GridFourIcon } from '@phosphor-icons/react/GridFour'
import { ArrowRightIcon } from '@phosphor-icons/react/ArrowRight'
import { Button } from '~/components/ds/ui'
import { useLibrariesOverlay } from '~/contexts/LibrariesOverlayContext'
import { publicLibraries, type LibrarySlim } from '~/libraries'
import {
  categoryLabels,
  categoryOrder,
  categoryTextColor,
  libraryCategories,
  type LibraryCategory,
} from '~/libraries/categories'
import { fallbackLibraryIcon, libraryIcons } from '~/libraries/icons'

type IconComponent = React.ComponentType<{ className?: string }>

function getLibraryDisplayName(library: LibrarySlim) {
  return library.name.replace(/^TanStack\s+/, '')
}

type LibraryMenuEntry = {
  id: string
  name: string
  to: string
  icon: IconComponent
  /** `group-hover/lib:text-category-*` — recolors the icon to its category. */
  iconHoverColor: string
}

// Full static class strings (Tailwind can't see composed names) mapping each
// category to the hover color applied to a library's icon in the mega-menu.
const categoryIconHoverColor: Record<LibraryCategory, string> = {
  framework: 'group-hover/lib:text-category-framework',
  data: 'group-hover/lib:text-category-data',
  ui: 'group-hover/lib:text-category-ui',
  performance: 'group-hover/lib:text-category-performance',
  tooling: 'group-hover/lib:text-category-tooling',
}

type LibraryMenuColumn = {
  category: LibraryCategory
  label: string
  colorClass: string
  libraries: LibraryMenuEntry[]
}

/**
 * The Libraries mega-menu as five category columns (Framework, Data & State,
 * UI & UX, Performance, Tooling), built from the canonical `libraryCategories`
 * taxonomy. Iterating `libraryCategories` preserves the intended per-category
 * order; only public, navigable libraries are shown.
 */
function getLibraryCategoryColumns(): LibraryMenuColumn[] {
  const byCategory = new Map<LibraryCategory, LibraryMenuEntry[]>(
    categoryOrder.map((category) => [category, []]),
  )

  for (const [id, category] of Object.entries(libraryCategories)) {
    const library = publicLibraries.find((lib) => lib.id === id)
    if (!library || !library.to) continue
    byCategory.get(category)?.push({
      id: library.id,
      name: getLibraryDisplayName(library),
      to: library.to,
      icon: libraryIcons[library.id] ?? fallbackLibraryIcon,
      iconHoverColor: categoryIconHoverColor[category],
    })
  }

  return categoryOrder
    .map((category) => ({
      category,
      label: categoryLabels[category],
      colorClass: categoryTextColor[category],
      libraries: byCategory.get(category) ?? [],
    }))
    .filter((column) => column.libraries.length > 0)
}

export function LibrariesMenuContent({
  onNavigate,
  variant,
}: {
  onNavigate: () => void
  variant: 'desktop' | 'mobile'
}) {
  const { openLibraries } = useLibrariesOverlay()
  const columns = getLibraryCategoryColumns()

  const allLibraries = (
    <Button
      type="button"
      onClick={() => {
        openLibraries()
        onNavigate()
      }}
      variant="subtle-link"
      color="gray"
      className={twMerge(
        'group/all gap-1.5 rounded-lg px-[9px] py-2 text-ds-mono-xs focus:text-text-primary focus:outline-none',
        variant === 'desktop' &&
          'min-[1120px]:gap-[7px] min-[1120px]:rounded-[10px] min-[1120px]:px-[11px] min-[1120px]:py-2.5 min-[1120px]:text-[14px]',
      )}
    >
      <GridFourIcon
        className={twMerge(
          'size-4',
          variant === 'desktop' && 'min-[1120px]:size-[19px]',
        )}
      />
      Browse all libraries
      <ArrowRightIcon
        className={twMerge(
          'size-3.5 transition-transform group-hover/all:translate-x-0.5',
          variant === 'desktop' && 'min-[1120px]:size-[17px]',
        )}
      />
    </Button>
  )

  if (variant === 'mobile') {
    return (
      <div className="grid gap-4">
        {columns.map((column) => (
          <LibraryCategoryColumn
            key={column.category}
            column={column}
            onNavigate={onNavigate}
            variant="mobile"
          />
        ))}
        {allLibraries}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 min-[1120px]:gap-5">
      <div className="flex items-start gap-9 min-[1120px]:gap-12">
        {columns.map((column) => (
          <LibraryCategoryColumn
            key={column.category}
            column={column}
            onNavigate={onNavigate}
            variant="desktop"
          />
        ))}
      </div>
      <div className="flex justify-center border-t border-border-subtle pt-1.5 min-[1120px]:pt-2">
        {allLibraries}
      </div>
    </div>
  )
}

function LibraryCategoryColumn({
  column,
  onNavigate,
  variant,
}: {
  column: LibraryMenuColumn
  onNavigate: () => void
  variant: 'desktop' | 'mobile'
}) {
  return (
    <div
      className={twMerge(
        'flex flex-col',
        variant === 'desktop'
          ? 'w-[120px] gap-4 min-[1120px]:w-36 min-[1120px]:gap-5'
          : 'gap-1',
      )}
    >
      <div
        className={`pl-[9px] font-ds-mono uppercase ${
          variant === 'desktop' ? 'text-ds-mono-sm' : 'text-ds-mono-xs'
        } ${variant === 'desktop' ? 'min-[1120px]:pl-[11px]' : ''} ${column.colorClass}`}
      >
        {column.label}
      </div>
      <div className="flex flex-col items-start gap-1">
        {column.libraries.map((library) => (
          <LibraryMenuRow
            key={library.id}
            library={library}
            onNavigate={onNavigate}
            variant={variant}
          />
        ))}
      </div>
    </div>
  )
}

function LibraryMenuRow({
  library,
  onNavigate,
  variant,
}: {
  library: LibraryMenuEntry
  onNavigate: () => void
  variant: 'desktop' | 'mobile'
}) {
  const Icon = library.icon
  const external = library.to.startsWith('http')
  const className = twMerge(
    // Light mode: an "elevated white" hover — a bright-white pill lifted off the
    // glass with a soft shadow + hairline ring (contrast via depth, not value).
    // Dark mode keeps the subtle white/4% (pressed 12%) overlay, no shadow/ring.
    'group/lib flex items-center gap-2 rounded-[14px] py-2 pl-[9px] pr-4 text-text-secondary transition-[color,background-color,box-shadow] hover:bg-white hover:text-text-primary hover:shadow-sm hover:ring-1 hover:ring-black/5 focus:bg-white focus:text-text-primary focus:shadow-sm focus:ring-1 focus:ring-black/5 focus:outline-none active:bg-white dark:hover:bg-text-primary/[0.04] dark:hover:shadow-none dark:hover:ring-0 dark:focus:bg-text-primary/[0.04] dark:focus:shadow-none dark:focus:ring-0 dark:active:bg-text-primary/[0.12]',
    variant === 'desktop'
      ? 'h-[38px] min-[1120px]:h-[46px] min-[1120px]:gap-2.5 min-[1120px]:rounded-[17px] min-[1120px]:pl-[11px] min-[1120px]:pr-[18px]'
      : 'py-2.5',
  )
  const content = (
    <>
      {/* Plain template string: the category hover color is a `text-*` utility
          and twMerge would drop it against a base color. */}
      <Icon
        className={`size-5 shrink-0 transition-colors ${
          variant === 'desktop' ? 'min-[1120px]:size-6' : ''
        } ${library.iconHoverColor}`}
      />
      <span
        className={twMerge(
          'whitespace-nowrap font-ds-display text-[16px] tracking-[0.32px]',
          variant === 'desktop' &&
            'min-[1120px]:text-[19px] min-[1120px]:tracking-[0.38px]',
        )}
      >
        {library.name}
      </span>
    </>
  )

  if (external) {
    return (
      <a
        href={library.to}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onNavigate}
      >
        {content}
      </a>
    )
  }

  return (
    <Link
      to={library.to}
      onClick={onNavigate}
      preload="intent"
      className={className}
    >
      {content}
    </Link>
  )
}
