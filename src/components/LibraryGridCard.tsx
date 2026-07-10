import { Link } from '@tanstack/react-router'
import {
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

type LibraryCategory = 'framework' | 'data' | 'ui' | 'performance' | 'tooling'

// Category assignment drives each card's icon tint (see the /libraries design).
// Ranger isn't in the design breakdown; it slots into UI & UX as a slider primitive.
const libraryCategories: Record<string, LibraryCategory> = {
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
  const copy = library.description ?? library.tagline

  const isExternal = library.to?.startsWith('http')
  const Component = isExternal ? 'a' : Link
  const props = isExternal
    ? { href: library.to, target: '_blank', rel: 'noopener noreferrer' }
    : { to: library.to ?? '#' }

  return (
    <Component
      {...props}
      className={twMerge(
        // No transitions on hover: state changes snap instantly for a crisp,
        // technical feel (per design direction).
        'group relative flex h-full min-h-[158px] flex-col justify-between gap-4 overflow-hidden rounded-xl corner-squircle border p-[30px]',
        'bg-background-surface dark:bg-[#0a0a0a]',
        'border-border-subtle dark:border-ds-neutral-400',
        'hover:-translate-y-0.5 hover:shadow-lg',
        'hover:bg-background-subtle dark:hover:bg-[#151515]',
        categoryHoverBorder[category],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconComponent
            className={twMerge('size-9 shrink-0', categoryIconColor[category])}
          />
          <span
            className="font-ds-display text-[28px] font-medium leading-tight text-text-primary/70 group-hover:text-text-primary"
            style={{ viewTransitionName: `library-name-${library.id}` }}
          >
            {name}
          </span>
        </div>
        <span className="shrink-0 translate-y-0.5 rounded-[11px] corner-squircle bg-black/[0.03] px-4 py-2 font-ds-display text-sm font-bold text-text-primary opacity-0 group-hover:opacity-100 dark:bg-white/5">
          Docs
        </span>
      </div>
      <p className="line-clamp-4 font-ds-mono text-xs font-light leading-relaxed text-text-secondary">
        {copy}
      </p>
    </Component>
  )
}
