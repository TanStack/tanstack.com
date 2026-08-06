import { Brain as BrainIcon } from '@phosphor-icons/react/Brain'
import { ChartLineUp as ChartLineUpIcon } from '@phosphor-icons/react/ChartLineUp'
import { ClipboardText as ClipboardTextIcon } from '@phosphor-icons/react/ClipboardText'
import { Crosshair as CrosshairIcon } from '@phosphor-icons/react/Crosshair'
import { Database as DatabaseIcon } from '@phosphor-icons/react/Database'
import { Dresser as DresserIcon } from '@phosphor-icons/react/Dresser'
import { GearSix as GearSixIcon } from '@phosphor-icons/react/GearSix'
import { Goggles as GogglesIcon } from '@phosphor-icons/react/Goggles'
import { Highlighter as HighlighterIcon } from '@phosphor-icons/react/Highlighter'
import { MarkdownLogo as MarkdownLogoIcon } from '@phosphor-icons/react/MarkdownLogo'
import { PencilRuler as PencilRulerIcon } from '@phosphor-icons/react/PencilRuler'
import { SealQuestion as SealQuestionIcon } from '@phosphor-icons/react/SealQuestion'
import { Sliders as SlidersIcon } from '@phosphor-icons/react/Sliders'
import { SmileyMelting as SmileyMeltingIcon } from '@phosphor-icons/react/SmileyMelting'
import { SunHorizon as SunHorizonIcon } from '@phosphor-icons/react/SunHorizon'
import { Table as TableIcon } from '@phosphor-icons/react/Table'
import { Target as TargetIcon } from '@phosphor-icons/react/Target'
import { TerminalWindow as TerminalWindowIcon } from '@phosphor-icons/react/TerminalWindow'
import { Timer as TimerIcon } from '@phosphor-icons/react/Timer'
import { TrafficSign as TrafficSignIcon } from '@phosphor-icons/react/TrafficSign'
import type { Icon } from '@phosphor-icons/react'

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
