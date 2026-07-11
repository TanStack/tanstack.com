import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Brain,
  ClipboardText,
  Database,
  Dresser,
  GearSix,
  Goggles,
  SealQuestion,
  Sliders,
  SmileyMelting,
  SunHorizon,
  Table,
  Target,
  TerminalWindow,
  Timer,
  Toolbox,
  TrafficSign,
  type Icon,
} from '@phosphor-icons/react'
import { twMerge } from 'tailwind-merge'
import type { Library } from '~/libraries'

export type LibraryCategory =
  | 'framework'
  | 'data'
  | 'ui'
  | 'performance'
  | 'tooling'

// Category assignment drives each card's icon tint and the grouped section it
// renders under in the overlay.
export const libraryCategories: Record<string, LibraryCategory> = {
  start: 'framework',
  router: 'framework',
  query: 'data',
  db: 'data',
  store: 'data',
  ai: 'data',
  table: 'ui',
  form: 'ui',
  hotkeys: 'ui',
  virtual: 'performance',
  pacer: 'performance',
  devtools: 'tooling',
  config: 'tooling',
  cli: 'tooling',
  intent: 'tooling',
  ranger: 'tooling',
}

const libraryIcons: Record<string, Icon> = {
  start: SunHorizon,
  router: TrafficSign,
  query: SealQuestion,
  db: Database,
  store: Dresser,
  ai: Brain,
  table: Table,
  form: ClipboardText,
  hotkeys: SmileyMelting,
  ranger: Sliders,
  virtual: Goggles,
  pacer: Timer,
  devtools: Toolbox,
  config: GearSix,
  cli: TerminalWindow,
  intent: Target,
}

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
  const IconComponent = libraryIcons[library.id] ?? Toolbox
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
        // Mobile: a flush list row (dividers come from the grid container).
        // sm+: a standalone card with border, radius, and hover lift. No
        // transitions on hover — state changes snap for a crisp, technical feel.
        'group relative flex flex-col justify-between gap-4 p-6',
        'sm:h-full sm:min-h-[158px] sm:overflow-hidden sm:rounded-xl sm:corner-squircle sm:border sm:p-[30px]',
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1">
          <IconComponent
            className={twMerge('size-9 shrink-0', categoryIconColor[category])}
          />
          <span
            className="font-ds-display text-[28px] font-medium leading-tight text-text-primary/90 group-hover:text-text-primary"
            style={{ viewTransitionName: `library-name-${library.id}` }}
          >
            {name}
          </span>
        </div>
        {/* Persistent affordance that the card is clickable; brightens on hover/focus. */}
        <span className="inline-flex shrink-0 translate-y-0.5 items-center gap-1 rounded-[11px] corner-squircle bg-black/[0.03] px-3 py-1.5 font-ds-display text-sm font-bold text-text-secondary opacity-70 group-hover:text-text-primary group-hover:opacity-100 group-focus-visible:text-text-primary group-focus-visible:opacity-100 dark:bg-white/5">
          Docs
          <ArrowRight className="size-3.5" />
        </span>
      </div>
      <p className="line-clamp-2 font-ds-mono text-xs font-light leading-relaxed text-text-secondary">
        {copy}
      </p>
    </Component>
  )
}
