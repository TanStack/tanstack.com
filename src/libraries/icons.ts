import {
  BrainIcon,
  ChartLineUpIcon,
  ClipboardTextIcon,
  CrosshairIcon,
  DatabaseIcon,
  DresserIcon,
  GearSixIcon,
  GogglesIcon,
  HighlighterIcon,
  MarkdownLogoIcon,
  PencilRulerIcon,
  SealQuestionIcon,
  SlidersIcon,
  SmileyMeltingIcon,
  SunHorizonIcon,
  TableIcon,
  TargetIcon,
  TerminalWindowIcon,
  TimerIcon,
  TrafficSignIcon,
  type Icon,
} from '@phosphor-icons/react'

/**
 * Canonical per-library icon map — the single source of truth shared by the
 * navbar Libraries mega-menu (src/components/Navbar.tsx) and the full-screen
 * overlay cards (src/components/LibraryGridCard.tsx). Icons match the Figma
 * "Mega Menu" design (e.g. Devtools = PencilRuler, Intent = Crosshair).
 */
export const libraryIcons: Record<string, Icon> = {
  start: SunHorizonIcon,
  router: TrafficSignIcon,
  query: SealQuestionIcon,
  db: DatabaseIcon,
  store: DresserIcon,
  ai: BrainIcon,
  table: TableIcon,
  charts: ChartLineUpIcon,
  form: ClipboardTextIcon,
  hotkeys: SmileyMeltingIcon,
  markdown: MarkdownLogoIcon,
  highlight: HighlighterIcon,
  virtual: GogglesIcon,
  pacer: TimerIcon,
  devtools: PencilRulerIcon,
  config: GearSixIcon,
  cli: TerminalWindowIcon,
  intent: CrosshairIcon,
  ranger: SlidersIcon,
}

/** Fallback icon for libraries without a specific mapping. */
export const fallbackLibraryIcon: Icon = TargetIcon
