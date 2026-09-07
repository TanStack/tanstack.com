import { useEffect, useState } from 'react'
import {
  ChevronUp,
  ChevronDown,
  Compass,
  Sparkles,
  Skull,
  Heart,
  Coins,
  Trophy,
  Swords,
  Crown,
} from 'lucide-react'
import { DOUBLOONS_PER_WORLD, useVoyageStore } from '../store'
import { BANDS, TOTAL_PLANETS } from '../planets'
import type { VoyageEngine } from '../engine/VoyageEngine'

export function VoyageHUD({ engine }: { engine: VoyageEngine | null }) {
  return (
    <>
      <Crosshair />
      <IntroOverlay />
      <BandIndicator engine={engine} />
      <DiscoveryProgress />
      <CombatStatus />
      <BossBar />
      <NearbyCard />
      <ChartToast />
      <ShipwreckedOverlay />
      <VictoryOverlay engine={engine} />
      <ArmadaPrompt engine={engine} />
      <ChampionOverlay />
      <TouchControls engine={engine} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Center aim crosshair
// ---------------------------------------------------------------------------
function Crosshair() {
  const shipwrecked = useVoyageStore((s) => s.shipwrecked)
  if (shipwrecked) return null
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
      <div className="relative w-9 h-9">
        <div className="absolute inset-0 rounded-full border border-white/30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/70" />
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-2 h-px bg-white/40" />
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-2 h-px bg-white/40" />
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-2 w-px bg-white/40" />
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 h-2 w-px bg-white/40" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Intro / controls hint
// ---------------------------------------------------------------------------
function IntroOverlay() {
  const [show, setShow] = useState(true)

  useEffect(() => {
    if (!show) return
    const timer = setTimeout(() => setShow(false), 9000)
    const dismiss = () => setShow(false)
    window.addEventListener('keydown', dismiss)
    window.addEventListener('touchstart', dismiss)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', dismiss)
      window.removeEventListener('touchstart', dismiss)
    }
  }, [show])

  if (!show) return null

  return (
    <div className="absolute top-[58%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none px-4">
      <div className="bg-black/45 backdrop-blur-md rounded-2xl p-5 text-white text-center shadow-2xl ring-1 ring-white/10 animate-in fade-in duration-500">
        <p className="text-base font-semibold mb-1">Weigh anchor, captain ⚓</p>
        <p className="text-white/60 text-xs mb-4">
          Chart every TanStack world — and blast the pirates guarding them.
        </p>
        <div className="flex flex-wrap gap-3 items-center justify-center text-sm">
          <Hint keys={['↑', '↓']} label="thrust" />
          <Hint keys={['←', '→']} label="steer" />
          <Hint keys={['Q', 'E']} label="dive / climb" />
          <Hint keys={['Space']} label="fire" />
        </div>
        <p className="mt-3 text-[11px] text-white/40">
          fly close to a world to chart it · click it to visit · press any key
          to begin
        </p>
      </div>
    </div>
  )
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="px-2 py-1 bg-white/15 rounded font-mono text-xs leading-none"
          >
            {k}
          </kbd>
        ))}
      </span>
      <span className="text-white/70">{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Altitude band indicator (the three dimensions)
// ---------------------------------------------------------------------------
function BandIndicator({ engine }: { engine: VoyageEngine | null }) {
  const bandIndex = useVoyageStore((s) => s.bandIndex)
  const altitude = useVoyageStore((s) => s.altitude)

  // Render top band first (high) so the stack reads vertically like altitude.
  const ordered = [...BANDS].reverse()
  const maxIndex = BANDS.length - 1
  // 0 at top, maxIndex at bottom → invert altitude for the marker.
  const markerPct = ((maxIndex - altitude) / maxIndex) * 100

  return (
    <div className="absolute top-4 left-4 z-20 flex items-stretch gap-3">
      {/* Vertical gauge */}
      <div className="relative w-1.5 rounded-full bg-white/10 overflow-visible">
        <div
          className="absolute -left-1 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_10px_2px_rgba(255,255,255,0.6)] -translate-y-1/2 transition-all duration-300"
          style={{ top: `${markerPct}%` }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        {ordered.map((band) => {
          const active = band.index === bandIndex
          return (
            <button
              key={band.index}
              type="button"
              onClick={() => engine?.changeBand(band.index - bandIndex)}
              className={`text-left rounded-lg px-3 py-1.5 backdrop-blur-md ring-1 transition-all ${
                active
                  ? 'bg-black/55 ring-white/30 scale-100'
                  : 'bg-black/30 ring-white/5 opacity-60 hover:opacity-90 scale-95'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: band.color,
                    boxShadow: active ? `0 0 8px ${band.color}` : 'none',
                  }}
                />
                <span className="text-white text-xs font-semibold leading-none">
                  {band.name}
                </span>
              </div>
              <span className="text-white/40 text-[10px] pl-4">
                {band.subtitle}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Discovery progress
// ---------------------------------------------------------------------------
function DiscoveryProgress() {
  const count = useVoyageStore((s) => s.discoveredCount)
  const doubloons = useVoyageStore((s) => s.doubloons)
  const pct = Math.round((count / TOTAL_PLANETS) * 100)
  const complete = count >= TOTAL_PLANETS

  return (
    <div className="absolute top-4 right-4 z-20">
      <div className="bg-black/45 backdrop-blur-md rounded-xl px-4 py-2.5 ring-1 ring-white/10 text-white min-w-[150px]">
        <div className="flex items-center gap-2 text-xs font-semibold">
          {complete ? (
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          ) : (
            <Compass className="w-3.5 h-3.5 text-cyan-300" />
          )}
          <span>{complete ? 'All worlds charted!' : 'Worlds charted'}</span>
        </div>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-2xl font-bold tabular-nums">{count}</span>
          <span className="text-white/40 text-sm">/ {TOTAL_PLANETS}</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-300 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-amber-300">
          <Coins className="w-3.5 h-3.5" />
          <span className="text-sm font-bold tabular-nums">
            {doubloons.toLocaleString()}
          </span>
          <span className="text-white/40 text-[11px]">doubloons</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Combat status — hull integrity + pirates sunk
// ---------------------------------------------------------------------------
function CombatStatus() {
  const health = useVoyageStore((s) => s.health)
  const maxHealth = useVoyageStore((s) => s.maxHealth)
  const piratesSunk = useVoyageStore((s) => s.piratesSunk)
  const pct = Math.max(0, Math.round((health / maxHealth) * 100))
  const low = pct <= 30

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
      <div className="bg-black/45 backdrop-blur-md rounded-xl px-4 py-2.5 ring-1 ring-white/10 text-white flex items-center gap-4">
        {/* Hull */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold mb-1">
            <Heart
              className={`w-3.5 h-3.5 ${low ? 'text-red-400 animate-pulse' : 'text-rose-300'}`}
            />
            <span>Hull</span>
          </div>
          <div className="w-28 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                low
                  ? 'bg-gradient-to-r from-red-600 to-red-400'
                  : 'bg-gradient-to-r from-emerald-500 to-lime-400'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Pirates sunk */}
        <div className="flex items-center gap-2 pl-3 border-l border-white/10">
          <Skull className="w-4 h-4 text-white/70" />
          <span className="text-xl font-bold tabular-nums leading-none">
            {piratesSunk}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shipwrecked overlay
// ---------------------------------------------------------------------------
function ShipwreckedOverlay() {
  const shipwrecked = useVoyageStore((s) => s.shipwrecked)
  if (!shipwrecked) return null
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none bg-red-950/30 backdrop-blur-[2px]">
      <div className="text-center animate-in fade-in zoom-in duration-300">
        <Skull className="w-14 h-14 mx-auto text-red-300 mb-2" />
        <p className="text-white text-2xl font-bold">Shipwrecked!</p>
        <p className="text-white/60 text-sm mt-1">
          Salvaging a new galleon&hellip;
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Nearby planet card
// ---------------------------------------------------------------------------
function NearbyCard() {
  const nearby = useVoyageStore((s) => s.nearby)
  if (!nearby) return null

  return (
    <a
      href={nearby.url}
      className="absolute bottom-28 md:bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto group"
    >
      <div
        className="bg-black/55 backdrop-blur-md rounded-2xl px-5 py-3 ring-1 transition-transform group-hover:scale-[1.03] shadow-2xl max-w-[88vw]"
        style={{
          borderColor: nearby.color,
          boxShadow: `0 0 28px -6px ${nearby.color}`,
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{
              backgroundColor: nearby.color,
              boxShadow: `0 0 10px ${nearby.color}`,
            }}
          />
          <div className="min-w-0">
            <div className="text-white font-bold leading-tight truncate">
              {nearby.name}
            </div>
            <div className="text-white/55 text-xs truncate max-w-[60ch]">
              {nearby.tagline}
            </div>
          </div>
          <span className="ml-2 text-[11px] font-semibold text-white/80 whitespace-nowrap rounded-full bg-white/10 px-3 py-1 group-hover:bg-white/20">
            Visit →
          </span>
        </div>
      </div>
    </a>
  )
}

// ---------------------------------------------------------------------------
// "World charted" reward toast
// ---------------------------------------------------------------------------
function ChartToast() {
  const lastCharted = useVoyageStore((s) => s.lastCharted)
  const [visible, setVisible] = useState(false)
  const tick = lastCharted?.tick ?? 0

  useEffect(() => {
    if (!tick) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 3200)
    return () => clearTimeout(t)
  }, [tick])

  if (!lastCharted || !visible) return null

  return (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      <div
        className="bg-black/70 backdrop-blur-md rounded-2xl px-5 py-3 ring-1 shadow-2xl text-center animate-in fade-in slide-in-from-top-2 duration-300"
        style={{
          borderColor: lastCharted.color,
          boxShadow: `0 0 32px -4px ${lastCharted.color}`,
        }}
      >
        <div className="flex items-center justify-center gap-2 text-white font-bold">
          <Sparkles className="w-4 h-4" style={{ color: lastCharted.color }} />
          <span>New world charted!</span>
        </div>
        <div
          className="text-sm font-semibold mt-0.5"
          style={{ color: lastCharted.color }}
        >
          {lastCharted.name}
        </div>
        <div className="mt-1 flex items-center justify-center gap-1 text-amber-300 text-xs font-semibold">
          <Coins className="w-3.5 h-3.5" />
          <span>+{DOUBLOONS_PER_WORLD} doubloons</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Victory overlay — all worlds charted, unlocks the boss gauntlet
// ---------------------------------------------------------------------------
function VictoryOverlay({ engine }: { engine: VoyageEngine | null }) {
  const completed = useVoyageStore((s) => s.completed)
  const gauntletActive = useVoyageStore((s) => s.gauntletActive)
  const champion = useVoyageStore((s) => s.champion)
  const piratesSunk = useVoyageStore((s) => s.piratesSunk)
  const doubloons = useVoyageStore((s) => s.doubloons)
  const [dismissed, setDismissed] = useState(false)

  if (!completed || dismissed || gauntletActive || champion) return null

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-gradient-to-b from-[#171033] to-[#0a0820] ring-1 ring-amber-300/30 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-in fade-in zoom-in duration-400">
        <Trophy className="w-16 h-16 mx-auto text-amber-300 mb-3 drop-shadow-[0_0_18px_rgba(252,211,77,0.6)]" />
        <h2 className="text-white text-2xl font-bold">Voyage Complete!</h2>
        <p className="text-white/60 text-sm mt-1">
          You&rsquo;ve charted every TanStack world. But the Pirate Armada
          awaits&hellip;
        </p>

        <div className="grid grid-cols-3 gap-2 mt-6 text-white">
          <Stat label="Worlds" value={`${TOTAL_PLANETS}`} />
          <Stat label="Pirates sunk" value={`${piratesSunk}`} />
          <Stat label="Doubloons" value={doubloons.toLocaleString()} />
        </div>

        <button
          type="button"
          onClick={() => {
            engine?.startGauntlet()
            setDismissed(true)
          }}
          className="mt-6 w-full rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold py-2.5 transition-colors flex items-center justify-center gap-2"
        >
          <Swords className="w-4 h-4" /> Face the Pirate Armada
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="mt-2 w-full rounded-xl bg-white/10 hover:bg-white/20 text-white/80 font-semibold py-2 transition-colors text-sm"
        >
          Keep sailing ⚓
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Boss health bar (shown during the gauntlet)
// ---------------------------------------------------------------------------
function BossBar() {
  const boss = useVoyageStore((s) => s.boss)
  const bossHp = useVoyageStore((s) => s.bossHp)
  if (!boss) return null
  const pct = Math.max(0, Math.round((bossHp / boss.maxHp) * 100))

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 w-[min(440px,84vw)] pointer-events-none">
      <div
        className="bg-black/55 backdrop-blur-md rounded-xl px-4 py-2 ring-1 shadow-2xl"
        style={{
          borderColor: boss.color,
          boxShadow: `0 0 26px -6px ${boss.color}`,
        }}
      >
        <div className="flex items-center justify-between text-white text-xs font-bold mb-1.5">
          <span className="flex items-center gap-1.5">
            <Skull className="w-4 h-4" style={{ color: boss.color }} />
            {boss.name}
          </span>
          <span className="text-white/50">
            Boss {boss.level}/{boss.total}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{
              width: `${pct}%`,
              backgroundColor: boss.color,
              boxShadow: `0 0 12px ${boss.color}`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// "Face the Armada" prompt — re-offer the gauntlet after dismissing victory
// ---------------------------------------------------------------------------
function ArmadaPrompt({ engine }: { engine: VoyageEngine | null }) {
  const completed = useVoyageStore((s) => s.completed)
  const gauntletActive = useVoyageStore((s) => s.gauntletActive)
  const champion = useVoyageStore((s) => s.champion)
  if (!completed || gauntletActive || champion) return null

  return (
    <button
      type="button"
      onClick={() => engine?.startGauntlet()}
      className="absolute bottom-6 right-4 z-30 pointer-events-auto rounded-xl bg-red-500/80 hover:bg-red-400 text-white font-bold px-4 py-2.5 shadow-2xl ring-1 ring-red-300/40 flex items-center gap-2 animate-pulse"
    >
      <Swords className="w-4 h-4" /> Face the Armada
    </button>
  )
}

// ---------------------------------------------------------------------------
// Grand Champion overlay — gauntlet cleared
// ---------------------------------------------------------------------------
function ChampionOverlay() {
  const champion = useVoyageStore((s) => s.champion)
  const piratesSunk = useVoyageStore((s) => s.piratesSunk)
  const bossesDefeated = useVoyageStore((s) => s.bossesDefeated)
  const doubloons = useVoyageStore((s) => s.doubloons)
  const [dismissed, setDismissed] = useState(false)

  if (!champion || dismissed) return null

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 backdrop-blur-sm px-4">
      <div className="bg-gradient-to-b from-[#2a1d05] to-[#0a0820] ring-1 ring-amber-300/50 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-in fade-in zoom-in duration-400">
        <Crown className="w-16 h-16 mx-auto text-amber-300 mb-3 drop-shadow-[0_0_22px_rgba(252,211,77,0.8)]" />
        <h2 className="text-amber-200 text-2xl font-bold">Grand Champion!</h2>
        <p className="text-white/60 text-sm mt-1">
          The Pirate Armada is vanquished. The cosmos is yours, captain.
        </p>

        <div className="grid grid-cols-3 gap-2 mt-6 text-white">
          <Stat label="Bosses" value={`${bossesDefeated}`} />
          <Stat label="Pirates sunk" value={`${piratesSunk}`} />
          <Stat label="Doubloons" value={doubloons.toLocaleString()} />
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="mt-6 w-full rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold py-2.5 transition-colors"
        >
          Sail on, legend ⚓
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-xl py-3">
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-white/45 text-[10px] mt-0.5">{label}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Touch controls (mobile / pointer)
// ---------------------------------------------------------------------------
function TouchControls({ engine }: { engine: VoyageEngine | null }) {
  if (!engine) return null

  const hold = (code: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      engine.setKey(code, true)
    },
    onPointerUp: () => engine.setKey(code, false),
    onPointerLeave: () => engine.setKey(code, false),
    onPointerCancel: () => engine.setKey(code, false),
  })

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 md:hidden pointer-events-none select-none">
      <div className="flex items-end justify-between p-4">
        {/* Left: movement d-pad */}
        <div className="grid grid-cols-3 gap-1.5 pointer-events-auto">
          <span />
          <TouchBtn label="▲" {...hold('ArrowUp')} />
          <span />
          <TouchBtn label="◀" {...hold('ArrowLeft')} />
          <span />
          <TouchBtn label="▶" {...hold('ArrowRight')} />
          <span />
          <TouchBtn label="▼" {...hold('ArrowDown')} />
          <span />
        </div>

        {/* Right: fire + climb/dive */}
        <div className="flex items-end gap-2 pointer-events-auto">
          <div className="flex flex-col gap-1.5">
            <TouchBtn
              label={<ChevronUp className="w-5 h-5" />}
              onClick={() => engine.changeBand(1)}
            />
            <TouchBtn
              label={<ChevronDown className="w-5 h-5" />}
              onClick={() => engine.changeBand(-1)}
            />
          </div>
          <button
            type="button"
            className="w-20 h-20 rounded-full bg-red-600/70 backdrop-blur-md ring-2 ring-red-300/40 text-white text-sm font-bold flex items-center justify-center active:bg-red-500 touch-none"
            {...hold('Space')}
          >
            FIRE
          </button>
        </div>
      </div>
    </div>
  )
}

function TouchBtn({
  label,
  ...props
}: {
  label: React.ReactNode
} & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className="w-12 h-12 rounded-full bg-black/45 backdrop-blur-md ring-1 ring-white/15 text-white text-lg font-bold flex items-center justify-center active:bg-white/25 touch-none"
      {...props}
    >
      {label}
    </button>
  )
}
