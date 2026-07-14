import { Link } from '@tanstack/react-router'
import { ArrowRight, CaretRight } from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import type { Library } from '~/libraries'
import { libraryCategories, type LibraryCategory } from '~/libraries/categories'
import { fallbackLibraryIcon, libraryIcons } from '~/libraries/icons'

// The canonical category type + library→category map live in
// ~/libraries/categories; the shared icon map in ~/libraries/icons.

// Static class strings (not composed at runtime) so Tailwind can see them.
// On hover the icon steps one shade brighter up the DS ramp (100 = lightest).
const categoryIconColor: Record<LibraryCategory, string> = {
  framework:
    'text-ds-green-400 group-hover:text-ds-green-300 dark:text-ds-green-300 dark:group-hover:text-ds-green-200',
  data: 'text-ds-terracotta-400 group-hover:text-ds-terracotta-300 dark:text-ds-terracotta-300 dark:group-hover:text-ds-terracotta-200',
  ui: 'text-ds-blue-400 group-hover:text-ds-blue-300 dark:text-ds-blue-300 dark:group-hover:text-ds-blue-200',
  performance:
    'text-ds-amber-400 group-hover:text-ds-amber-300 dark:text-ds-amber-300 dark:group-hover:text-ds-amber-200',
  tooling:
    'text-ds-neutral-300 group-hover:text-ds-neutral-200 dark:text-ds-neutral-200 dark:group-hover:text-ds-neutral-100',
}

const categoryHoverBorder: Record<LibraryCategory, string> = {
  framework: 'hover:border-ds-green-400/60',
  data: 'hover:border-ds-terracotta-400/60',
  ui: 'hover:border-ds-blue-400/60',
  performance: 'hover:border-ds-amber-400/60',
  tooling: 'hover:border-ds-neutral-300/60',
}

export default function LibraryGridCard({ library }: { library: Library }) {
  const category = libraryCategories[library.id] ?? 'tooling'
  const IconComponent = libraryIcons[library.id] ?? fallbackLibraryIcon
  const name = library.name.replace(/^TanStack\s+/, '')
  // Short tagline drives scanning; the full description lives on the library page.
  const copy = library.tagline || library.description

  const isExternal = library.to?.startsWith('http')
  const Component = isExternal ? 'a' : Link
  const props = isExternal
    ? { href: library.to, target: '_blank', rel: 'noopener noreferrer' }
    : { to: library.to ?? '#' }

  return (
    <Component
      {...props}
      className={twMerge(
        // Mobile: a compact single-line list row (icon + name + caret); the
        // description is dropped and dividers come from the grid container.
        // sm+: a standalone card with description, border, radius, and hover
        // lift. No transitions on hover — state snaps for a crisp, technical feel.
        'group relative flex items-center gap-3 px-5 py-4',
        'sm:h-full sm:min-h-[158px] sm:flex-col sm:items-stretch sm:justify-between sm:gap-4 sm:overflow-hidden sm:rounded-xl sm:corner-squircle sm:border sm:p-[30px]',
        'sm:border-black/[0.06] sm:dark:border-white/[0.06]',
        // 20% translucent fill at every breakpoint (mobile list rows + sm+ cards).
        'bg-background-surface/20 dark:bg-[#0a0a0a]/20',
        'sm:hover:-translate-y-0.5 sm:hover:shadow-lg',
        'sm:hover:bg-background-subtle sm:dark:hover:bg-[#151515]',
        // Visible keyboard focus (whole card is the link).
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/40',
        categoryHoverBorder[category],
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:w-full sm:items-start sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconComponent
            className={twMerge(
              'size-7 shrink-0 sm:size-9',
              categoryIconColor[category],
            )}
          />
          <span
            className="truncate font-ds-display text-[20px] font-medium leading-tight text-text-primary/90 group-hover:text-text-primary sm:whitespace-normal sm:text-[28px]"
            style={{ viewTransitionName: `library-name-${library.id}` }}
          >
            {name}
          </span>
        </div>
        {/* Persistent affordance that the card is clickable; sm+ only. */}
        <span className="hidden shrink-0 translate-y-0.5 items-center gap-1 rounded-[11px] corner-squircle bg-black/[0.03] px-3 py-1.5 font-ds-display text-sm font-bold text-text-secondary opacity-70 group-hover:text-text-primary group-hover:opacity-100 group-focus-visible:text-text-primary group-focus-visible:opacity-100 dark:bg-white/5 sm:inline-flex">
          Docs
          <ArrowRight className="size-3.5" />
        </span>
      </div>
      {/* Compact-row caret (mobile only); the full card uses the Docs pill above. */}
      <CaretRight className="size-5 shrink-0 text-text-muted sm:hidden" />
      <p className="hidden font-sans text-ds-body-md text-text-secondary sm:line-clamp-2 sm:block">
        {copy}
      </p>
    </Component>
  )
}
