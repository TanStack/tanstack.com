import {
  Brain,
  ClipboardText,
  Crosshair,
  Database,
  Dresser,
  GearSix,
  Goggles,
  PencilRuler,
  SealQuestion,
  Sliders,
  SmileyMelting,
  SunHorizon,
  Table,
  Target,
  TerminalWindow,
  Timer,
  TrafficSign,
  type Icon,
} from '@phosphor-icons/react'

/**
 * Canonical per-library icon map — the single source of truth shared by the
 * navbar Libraries mega-menu (src/components/Navbar.tsx) and the full-screen
 * overlay cards (src/components/LibraryGridCard.tsx). Icons match the Figma
 * "Mega Menu" design (e.g. Devtools = PencilRuler, Intent = Crosshair).
 */
export const libraryIcons: Record<string, Icon> = {
  start: SunHorizon,
  router: TrafficSign,
  query: SealQuestion,
  db: Database,
  store: Dresser,
  ai: Brain,
  table: Table,
  form: ClipboardText,
  hotkeys: SmileyMelting,
  virtual: Goggles,
  pacer: Timer,
  devtools: PencilRuler,
  config: GearSix,
  cli: TerminalWindow,
  intent: Crosshair,
  ranger: Sliders,
}

/** Fallback icon for libraries without a specific mapping. */
export const fallbackLibraryIcon: Icon = Target
