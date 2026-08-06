import { BrainIcon } from '@phosphor-icons/react/Brain'
import { ChartLineUpIcon } from '@phosphor-icons/react/ChartLineUp'
import { ClipboardTextIcon } from '@phosphor-icons/react/ClipboardText'
import { CrosshairIcon } from '@phosphor-icons/react/Crosshair'
import { DatabaseIcon } from '@phosphor-icons/react/Database'
import { DresserIcon } from '@phosphor-icons/react/Dresser'
import { GearSixIcon } from '@phosphor-icons/react/GearSix'
import { GogglesIcon } from '@phosphor-icons/react/Goggles'
import { HighlighterIcon } from '@phosphor-icons/react/Highlighter'
import { MarkdownLogoIcon } from '@phosphor-icons/react/MarkdownLogo'
import { PencilRulerIcon } from '@phosphor-icons/react/PencilRuler'
import { SealQuestionIcon } from '@phosphor-icons/react/SealQuestion'
import { SlidersIcon } from '@phosphor-icons/react/Sliders'
import { SmileyMeltingIcon } from '@phosphor-icons/react/SmileyMelting'
import { SunHorizonIcon } from '@phosphor-icons/react/SunHorizon'
import { TableIcon } from '@phosphor-icons/react/Table'
import { TargetIcon } from '@phosphor-icons/react/Target'
import { TerminalWindowIcon } from '@phosphor-icons/react/TerminalWindow'
import { TimerIcon } from '@phosphor-icons/react/Timer'
import { TrafficSignIcon } from '@phosphor-icons/react/TrafficSign'
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
