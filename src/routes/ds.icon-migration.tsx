import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import * as Lucide from 'lucide-react'
import * as Phosphor from '@phosphor-icons/react'
import { ArrowRight, MagnifyingGlass, Warning } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { seo } from '~/utils/seo'
import { DsPage, DsSection } from '~/components/ds/DsKit'

export const Route = createFileRoute('/ds/icon-migration')({
  component: IconMigrationPage,
  head: () => ({
    meta: seo({
      title: 'Icon Migration | TanStack Design System',
      description:
        'Review the lucide-react → Phosphor icon mapping. Compare each old glyph to its new one and flag any that need a better fit.',
    }),
  }),
})

// The full lucide → Phosphor mapping applied site-wide. l = old lucide name,
// p = new Phosphor name, r = renamed (name changed), n = notable (a loose /
// semantic-shift mapping worth a human glance). Generated from the migration.
type Row = { l: string; p: string; r: boolean; n: boolean }
const ROWS: Array<Row> = [
  { l: 'Activity', p: 'Pulse', r: true, n: true },
  { l: 'Award', p: 'Medal', r: true, n: true },
  { l: 'BadgeCheck', p: 'SealCheck', r: true, n: true },
  { l: 'Ban', p: 'Prohibit', r: true, n: true },
  { l: 'Blocks', p: 'SquaresFour', r: true, n: true },
  { l: 'Bot', p: 'Robot', r: true, n: true },
  { l: 'Box', p: 'Package', r: true, n: true },
  { l: 'Boxes', p: 'Stack', r: true, n: true },
  { l: 'BoxSelect', p: 'BoundingBox', r: true, n: true },
  { l: 'Braces', p: 'BracketsCurly', r: true, n: true },
  { l: 'CircleGauge', p: 'Gauge', r: true, n: true },
  { l: 'ClipboardCheck', p: 'ClipboardText', r: true, n: true },
  { l: 'Dock', p: 'AppWindow', r: true, n: true },
  { l: 'FileCheck2', p: 'FileText', r: true, n: true },
  { l: 'FoldHorizontal', p: 'ArrowsInLineHorizontal', r: true, n: true },
  { l: 'GalleryVerticalEnd', p: 'Stack', r: true, n: true },
  { l: 'History', p: 'ClockCounterClockwise', r: true, n: true },
  { l: 'Layers', p: 'Stack', r: true, n: true },
  { l: 'LayoutDashboard', p: 'SquaresFour', r: true, n: true },
  { l: 'Map', p: 'MapTrifold', r: true, n: true },
  { l: 'MessageCircleQuestionMark', p: 'ChatCircleDots', r: true, n: true },
  { l: 'MessageSquare', p: 'ChatCentered', r: true, n: true },
  { l: 'MessageSquarePlus', p: 'ChatCenteredDots', r: true, n: true },
  { l: 'MessageSquareText', p: 'ChatCenteredText', r: true, n: true },
  { l: 'MessagesSquare', p: 'ChatsCircle', r: true, n: true },
  { l: 'Milestone', p: 'MapPinLine', r: true, n: true },
  { l: 'MonitorCog', p: 'MonitorArrowUp', r: true, n: true },
  { l: 'MoveHorizontal', p: 'ArrowsHorizontal', r: true, n: true },
  { l: 'PackageCheck', p: 'Package', r: true, n: true },
  { l: 'PackagePlus', p: 'Package', r: true, n: true },
  { l: 'PanelRight', p: 'Sidebar', r: true, n: true },
  { l: 'PersonStanding', p: 'PersonSimple', r: true, n: true },
  { l: 'Route', p: 'Path', r: true, n: true },
  { l: 'Save', p: 'FloppyDisk', r: true, n: true },
  { l: 'Scaling', p: 'Resize', r: true, n: true },
  { l: 'ScanSearch', p: 'MagnifyingGlass', r: true, n: true },
  { l: 'Send', p: 'PaperPlaneTilt', r: true, n: true },
  { l: 'Server', p: 'HardDrives', r: true, n: true },
  { l: 'ServerCrash', p: 'Warning', r: true, n: true },
  { l: 'Split', p: 'ArrowsSplit', r: true, n: true },
  { l: 'Sprout', p: 'Plant', r: true, n: true },
  { l: 'SquareStack', p: 'Stack', r: true, n: true },
  { l: 'StretchHorizontal', p: 'ArrowsHorizontal', r: true, n: true },
  { l: 'SunMoon', p: 'SunHorizon', r: true, n: true },
  { l: 'TextCursorInput', p: 'TextT', r: true, n: true },
  { l: 'Type', p: 'TextT', r: true, n: true },
  { l: 'UnfoldHorizontal', p: 'ArrowsOutLineHorizontal', r: true, n: true },
  { l: 'WandSparkles', p: 'MagicWand', r: true, n: true },
  { l: 'Workflow', p: 'FlowArrow', r: true, n: true },
  { l: 'AlertCircle', p: 'WarningCircle', r: true, n: false },
  { l: 'AlertTriangle', p: 'Warning', r: true, n: false },
  { l: 'ArrowDownToLine', p: 'ArrowLineDown', r: true, n: false },
  { l: 'ArrowLeftFromLine', p: 'ArrowLineLeft', r: true, n: false },
  { l: 'ArrowRightFromLine', p: 'ArrowLineRight', r: true, n: false },
  { l: 'ArrowRightLeft', p: 'ArrowsLeftRight', r: true, n: false },
  { l: 'AtSign', p: 'At', r: true, n: false },
  { l: 'CheckCircle2', p: 'CheckCircle', r: true, n: false },
  { l: 'ChevronDown', p: 'CaretDown', r: true, n: false },
  { l: 'ChevronLeft', p: 'CaretLeft', r: true, n: false },
  { l: 'ChevronRight', p: 'CaretRight', r: true, n: false },
  { l: 'ChevronsUpDown', p: 'CaretUpDown', r: true, n: false },
  { l: 'ChevronUp', p: 'CaretUp', r: true, n: false },
  { l: 'CircleUser', p: 'UserCircle', r: true, n: false },
  { l: 'Clock3', p: 'Clock', r: true, n: false },
  { l: 'Code2', p: 'Code', r: true, n: false },
  { l: 'CodeXml', p: 'CodeSimple', r: true, n: false },
  { l: 'Columns3', p: 'Columns', r: true, n: false },
  { l: 'CornerDownLeft', p: 'ArrowElbowDownLeft', r: true, n: false },
  { l: 'DatabaseZap', p: 'Database', r: true, n: false },
  { l: 'DollarSign', p: 'CurrencyDollar', r: true, n: false },
  { l: 'Droplet', p: 'Drop', r: true, n: false },
  { l: 'EllipsisVertical', p: 'DotsThreeVertical', r: true, n: false },
  { l: 'ExternalLink', p: 'ArrowSquareOut', r: true, n: false },
  { l: 'EyeOff', p: 'EyeSlash', r: true, n: false },
  { l: 'FileCode2', p: 'FileCode', r: true, n: false },
  { l: 'FileSearch', p: 'FileMagnifyingGlass', r: true, n: false },
  { l: 'Filter', p: 'Funnel', r: true, n: false },
  { l: 'Grid2x2', p: 'GridFour', r: true, n: false },
  { l: 'Grid2X2', p: 'GridFour', r: true, n: false },
  { l: 'Grid3X3', p: 'GridNine', r: true, n: false },
  { l: 'HeartHandshake', p: 'HandHeart', r: true, n: false },
  { l: 'HelpCircle', p: 'Question', r: true, n: false },
  { l: 'Home', p: 'House', r: true, n: false },
  { l: 'LayoutList', p: 'Rows', r: true, n: false },
  { l: 'LifeBuoy', p: 'Lifebuoy', r: true, n: false },
  { l: 'LineChart', p: 'ChartLine', r: true, n: false },
  { l: 'Link2', p: 'LinkSimple', r: true, n: false },
  { l: 'ListFilter', p: 'Funnel', r: true, n: false },
  { l: 'ListOrdered', p: 'ListNumbers', r: true, n: false },
  { l: 'ListTree', p: 'TreeStructure', r: true, n: false },
  { l: 'Loader2', p: 'CircleNotch', r: true, n: false },
  { l: 'LogIn', p: 'SignIn', r: true, n: false },
  { l: 'LogOut', p: 'SignOut', r: true, n: false },
  { l: 'Mail', p: 'Envelope', r: true, n: false },
  { l: 'Maximize', p: 'ArrowsOut', r: true, n: false },
  { l: 'Maximize2', p: 'ArrowsOutSimple', r: true, n: false },
  { l: 'Menu', p: 'List', r: true, n: false },
  { l: 'Mic', p: 'Microphone', r: true, n: false },
  { l: 'Minimize', p: 'ArrowsIn', r: true, n: false },
  { l: 'Minimize2', p: 'ArrowsInSimple', r: true, n: false },
  { l: 'MousePointer2', p: 'Cursor', r: true, n: false },
  { l: 'MousePointerClick', p: 'CursorClick', r: true, n: false },
  { l: 'Paintbrush', p: 'PaintBrush', r: true, n: false },
  { l: 'Pin', p: 'PushPin', r: true, n: false },
  { l: 'PinOff', p: 'PushPinSlash', r: true, n: false },
  { l: 'PlugZap', p: 'Plugs', r: true, n: false },
  { l: 'Pointer', p: 'Cursor', r: true, n: false },
  { l: 'Puzzle', p: 'PuzzlePiece', r: true, n: false },
  { l: 'RefreshCcw', p: 'ArrowsCounterClockwise', r: true, n: false },
  { l: 'RefreshCw', p: 'ArrowsClockwise', r: true, n: false },
  { l: 'RotateCcw', p: 'ArrowCounterClockwise', r: true, n: false },
  { l: 'RotateCw', p: 'ArrowClockwise', r: true, n: false },
  { l: 'Rows3', p: 'Rows', r: true, n: false },
  { l: 'RssIcon', p: 'Rss', r: true, n: false },
  { l: 'ScanLine', p: 'Scan', r: true, n: false },
  { l: 'Search', p: 'MagnifyingGlass', r: true, n: false },
  { l: 'SearchSlash', p: 'MagnifyingGlassMinus', r: true, n: false },
  { l: 'Settings', p: 'Gear', r: true, n: false },
  { l: 'Settings2', p: 'GearSix', r: true, n: false },
  { l: 'ShieldHalf', p: 'ShieldCheckered', r: true, n: false },
  { l: 'Shirt', p: 'TShirt', r: true, n: false },
  { l: 'Smartphone', p: 'DeviceMobile', r: true, n: false },
  { l: 'Sparkles', p: 'Sparkle', r: true, n: false },
  { l: 'SquarePen', p: 'PencilSimpleLine', r: true, n: false },
  { l: 'StickyNote', p: 'Note', r: true, n: false },
  { l: 'Tags', p: 'Tag', r: true, n: false },
  { l: 'TerminalSquare', p: 'Terminal', r: true, n: false },
  { l: 'TextAlignStart', p: 'TextAlignLeft', r: true, n: false },
  { l: 'Trash2', p: 'Trash', r: true, n: false },
  { l: 'TrendingUp', p: 'TrendUp', r: true, n: false },
  { l: 'TriangleAlert', p: 'Warning', r: true, n: false },
  { l: 'Undo2', p: 'ArrowUUpLeft', r: true, n: false },
  { l: 'Zap', p: 'Lightning', r: true, n: false },
  { l: 'ArrowDown', p: 'ArrowDown', r: false, n: false },
  { l: 'ArrowLeft', p: 'ArrowLeft', r: false, n: false },
  { l: 'ArrowRight', p: 'ArrowRight', r: false, n: false },
  { l: 'ArrowUp', p: 'ArrowUp', r: false, n: false },
  { l: 'ArrowUpRight', p: 'ArrowUpRight', r: false, n: false },
  { l: 'BookOpen', p: 'BookOpen', r: false, n: false },
  { l: 'Calendar', p: 'Calendar', r: false, n: false },
  { l: 'Camera', p: 'Camera', r: false, n: false },
  { l: 'ChartLine', p: 'ChartLine', r: false, n: false },
  { l: 'Check', p: 'Check', r: false, n: false },
  { l: 'Circle', p: 'Circle', r: false, n: false },
  { l: 'CircleDashed', p: 'CircleDashed', r: false, n: false },
  { l: 'Clock', p: 'Clock', r: false, n: false },
  { l: 'Code', p: 'Code', r: false, n: false },
  { l: 'Coins', p: 'Coins', r: false, n: false },
  { l: 'Command', p: 'Command', r: false, n: false },
  { l: 'Compass', p: 'Compass', r: false, n: false },
  { l: 'Copy', p: 'Copy', r: false, n: false },
  { l: 'Cpu', p: 'Cpu', r: false, n: false },
  { l: 'Crosshair', p: 'Crosshair', r: false, n: false },
  { l: 'Database', p: 'Database', r: false, n: false },
  { l: 'Download', p: 'Download', r: false, n: false },
  { l: 'Eye', p: 'Eye', r: false, n: false },
  { l: 'FileText', p: 'FileText', r: false, n: false },
  { l: 'Fingerprint', p: 'Fingerprint', r: false, n: false },
  { l: 'Flame', p: 'Flame', r: false, n: false },
  { l: 'Gauge', p: 'Gauge', r: false, n: false },
  { l: 'GitBranch', p: 'GitBranch', r: false, n: false },
  { l: 'GitPullRequest', p: 'GitPullRequest', r: false, n: false },
  { l: 'Globe', p: 'Globe', r: false, n: false },
  { l: 'Hammer', p: 'Hammer', r: false, n: false },
  { l: 'Hand', p: 'Hand', r: false, n: false },
  { l: 'Handshake', p: 'Handshake', r: false, n: false },
  { l: 'HardDrive', p: 'HardDrive', r: false, n: false },
  { l: 'Heart', p: 'Heart', r: false, n: false },
  { l: 'Hourglass', p: 'Hourglass', r: false, n: false },
  { l: 'Infinity', p: 'Infinity', r: false, n: false },
  { l: 'Key', p: 'Key', r: false, n: false },
  { l: 'Keyboard', p: 'Keyboard', r: false, n: false },
  { l: 'Lightbulb', p: 'Lightbulb', r: false, n: false },
  { l: 'Link', p: 'Link', r: false, n: false },
  { l: 'List', p: 'List', r: false, n: false },
  { l: 'ListChecks', p: 'ListChecks', r: false, n: false },
  { l: 'Lock', p: 'Lock', r: false, n: false },
  { l: 'MapPin', p: 'MapPin', r: false, n: false },
  { l: 'Medal', p: 'Medal', r: false, n: false },
  { l: 'Minus', p: 'Minus', r: false, n: false },
  { l: 'Monitor', p: 'Monitor', r: false, n: false },
  { l: 'Moon', p: 'Moon', r: false, n: false },
  { l: 'Network', p: 'Network', r: false, n: false },
  { l: 'Newspaper', p: 'Newspaper', r: false, n: false },
  { l: 'Package', p: 'Package', r: false, n: false },
  { l: 'Palette', p: 'Palette', r: false, n: false },
  { l: 'Pause', p: 'Pause', r: false, n: false },
  { l: 'PauseCircle', p: 'PauseCircle', r: false, n: false },
  { l: 'Pencil', p: 'Pencil', r: false, n: false },
  { l: 'Play', p: 'Play', r: false, n: false },
  { l: 'PlayCircle', p: 'PlayCircle', r: false, n: false },
  { l: 'Plug', p: 'Plug', r: false, n: false },
  { l: 'Plus', p: 'Plus', r: false, n: false },
  { l: 'Radio', p: 'Radio', r: false, n: false },
  { l: 'Rocket', p: 'Rocket', r: false, n: false },
  { l: 'Ruler', p: 'Ruler', r: false, n: false },
  { l: 'Shield', p: 'Shield', r: false, n: false },
  { l: 'ShieldCheck', p: 'ShieldCheck', r: false, n: false },
  { l: 'ShoppingBag', p: 'ShoppingBag', r: false, n: false },
  { l: 'ShoppingCart', p: 'ShoppingCart', r: false, n: false },
  { l: 'SlidersHorizontal', p: 'SlidersHorizontal', r: false, n: false },
  { l: 'Square', p: 'Square', r: false, n: false },
  { l: 'Star', p: 'Star', r: false, n: false },
  { l: 'Sun', p: 'Sun', r: false, n: false },
  { l: 'Table', p: 'Table', r: false, n: false },
  { l: 'Tag', p: 'Tag', r: false, n: false },
  { l: 'Terminal', p: 'Terminal', r: false, n: false },
  { l: 'ThumbsDown', p: 'ThumbsDown', r: false, n: false },
  { l: 'ThumbsUp', p: 'ThumbsUp', r: false, n: false },
  { l: 'Timer', p: 'Timer', r: false, n: false },
  { l: 'Trash', p: 'Trash', r: false, n: false },
  { l: 'Trophy', p: 'Trophy', r: false, n: false },
  { l: 'Upload', p: 'Upload', r: false, n: false },
  { l: 'User', p: 'User', r: false, n: false },
  { l: 'Users', p: 'Users', r: false, n: false },
  { l: 'Video', p: 'Video', r: false, n: false },
  { l: 'Wrench', p: 'Wrench', r: false, n: false },
  { l: 'X', p: 'X', r: false, n: false },
]

type LucideMap = Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
>
type PhosphorMap = Record<string, Icon>

type FilterMode = 'notable' | 'renamed' | 'all'

function IconMigrationPage() {
  const [query, setQuery] = React.useState('')
  const [mode, setMode] = React.useState<FilterMode>('notable')

  const lucide = Lucide as unknown as LucideMap
  const phosphor = Phosphor as unknown as PhosphorMap

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return ROWS.filter((row) => {
      if (mode === 'renamed' && !row.r) return false
      if (mode === 'notable' && !row.n) return false
      if (
        q &&
        !(row.l.toLowerCase().includes(q) || row.p.toLowerCase().includes(q))
      )
        return false
      return true
    })
  }, [query, mode])

  const counts = React.useMemo(
    () => ({
      all: ROWS.length,
      renamed: ROWS.filter((r) => r.r).length,
      notable: ROWS.filter((r) => r.n).length,
    }),
    [],
  )

  const tabClass = (active: boolean) =>
    'rounded-lg px-3 py-1.5 text-ds-label-md transition-colors ' +
    (active
      ? 'bg-background-inverse text-text-inverse'
      : 'text-text-secondary hover:bg-background-subtle')

  return (
    <DsPage
      title="Icon Migration"
      description="Every site icon moved from lucide-react to Phosphor. Below is the old → new mapping, old glyph on the left, its Phosphor replacement on the right. Scan the flagged ones — if a replacement doesn't fit its context, browse the full set at /ds/iconography and tell me the Phosphor name you'd prefer and I'll swap it."
    >
      <DsSection title="Review the mapping">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-border-subtle bg-background-surface p-1">
            <button
              type="button"
              className={tabClass(mode === 'notable')}
              onClick={() => setMode('notable')}
            >
              Flagged ({counts.notable})
            </button>
            <button
              type="button"
              className={tabClass(mode === 'renamed')}
              onClick={() => setMode('renamed')}
            >
              Renamed ({counts.renamed})
            </button>
            <button
              type="button"
              className={tabClass(mode === 'all')}
              onClick={() => setMode('all')}
            >
              All ({counts.all})
            </button>
          </div>

          <div className="flex h-10 items-center gap-2 rounded-lg border border-border-default bg-background-surface px-3">
            <MagnifyingGlass size={16} className="text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search old or new name…"
              className="w-52 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none"
            />
          </div>

          <span className="ml-auto text-ds-body-sm text-text-muted">
            {filtered.length} shown
          </span>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((row) => {
            const Old = lucide[row.l]
            const New = phosphor[row.p]
            return (
              <div
                key={row.l}
                className="flex items-center gap-3 bg-background-default p-4"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-background-subtle text-text-muted">
                  {Old ? <Old size={22} /> : <Warning size={20} />}
                </div>
                <ArrowRight size={16} className="shrink-0 text-text-muted" />
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-background-subtle text-text-primary">
                  {New ? <New size={22} /> : <Warning size={20} />}
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-ds-label-md text-text-secondary line-through decoration-text-muted/50">
                    {row.l}
                  </div>
                  <div className="truncate text-ds-label-md font-medium text-text-primary">
                    {row.p}
                  </div>
                </div>
                {row.n ? (
                  <span className="shrink-0 rounded-full bg-status-warning-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-status-warning">
                    check
                  </span>
                ) : !row.r ? (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-text-muted">
                    same
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </DsSection>
    </DsPage>
  )
}
