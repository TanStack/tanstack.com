// Beach Chess (/beach-chess) — a day-at-the-beach chess set where you (the
// sunny daytime crew) play against the computer (the sunset tiki crew).
// You pick your difficulty (how rough the surf gets) and the "master" title
// you're playing under before the first coconut rolls.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Board } from './Board'
import {
  applyMove,
  chooseAiMove,
  createInitialPosition,
  findKing,
  getGameStatus,
  legalMovesFrom,
} from './engine'
import {
  BEACH_PIECES,
  DIFFICULTIES,
  MASTERS,
  getDifficulty,
  getMaster,
} from './theme'
import type { GameStatus, Move, PieceType, Position } from './engine'
import type { DifficultyId, MasterId } from './theme'

type Phase = 'setup' | 'playing'

interface HistoryEntry {
  position: Position
  move: Move
}

interface PendingPromotion {
  from: number
  to: number
}

const PROMO_CHOICES: Array<PieceType> = ['q', 'r', 'b', 'n']

export default function BeachChess() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [difficultyId, setDifficultyId] = useState<DifficultyId>('breezy')
  const [masterId, setMasterId] = useState<MasterId>('novice')

  const [position, setPosition] = useState<Position>(createInitialPosition)
  const [history, setHistory] = useState<Array<HistoryEntry>>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [lastMove, setLastMove] = useState<Move | null>(null)
  const [thinking, setThinking] = useState(false)
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null)

  const difficulty = getDifficulty(difficultyId)
  const master = getMaster(masterId)

  const status: GameStatus = useMemo(() => getGameStatus(position), [position])
  const gameOver =
    status === 'checkmate' || status === 'stalemate' || status === 'draw'

  const legalTargets = useMemo(
    () => (selected === null ? [] : legalMovesFrom(position, selected)),
    [position, selected],
  )

  const checkSquare = useMemo(() => {
    if (status !== 'check' && status !== 'checkmate') return null
    return findKing(position.board, position.turn)
  }, [position, status])

  // Captured pieces, derived from the move history.
  const captured = useMemo(() => {
    const out: Record<'w' | 'b', Array<PieceType>> = { w: [], b: [] }
    for (const { move } of history) {
      if (move.captured) {
        out[move.captured.color].push(move.captured.type)
      }
    }
    return out
  }, [history])

  const commitMove = useCallback((prev: Position, move: Move) => {
    setHistory((h) => [...h, { position: prev, move }])
    setPosition(applyMove(prev, move))
    setLastMove(move)
    setSelected(null)
  }, [])

  // Drive the computer (black) whenever it's its turn and the game is live.
  useEffect(() => {
    if (phase !== 'playing') return
    if (position.turn !== 'b') return
    if (gameOver) return

    let cancelled = false
    setThinking(true)
    // Defer so the player's move paints before we run the (blocking) search.
    const timer = setTimeout(() => {
      const move = chooseAiMove(position, difficulty.ai)
      if (cancelled) return
      setThinking(false)
      if (move) commitMove(position, move)
    }, 220)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [phase, position, gameOver, difficulty.ai, commitMove])

  const handleSquareClick = useCallback(
    (index: number) => {
      if (phase !== 'playing' || gameOver || thinking) return
      if (position.turn !== 'w') return // not the player's turn

      const piece = position.board[index]

      // Re-select one of your own pieces.
      if (piece && piece.color === 'w') {
        setSelected(index === selected ? null : index)
        return
      }

      if (selected === null) return

      const moves = legalMovesFrom(position, selected).filter(
        (m) => m.to === index,
      )
      if (moves.length === 0) {
        setSelected(null)
        return
      }

      // A promotion offers four target pieces for the same square.
      if (moves.length > 1 && moves.every((m) => m.promotion)) {
        setPendingPromotion({ from: selected, to: index })
        return
      }

      commitMove(position, moves[0])
    },
    [phase, gameOver, thinking, position, selected, commitMove],
  )

  const choosePromotion = useCallback(
    (promotion: PieceType) => {
      if (!pendingPromotion) return
      const move = legalMovesFrom(position, pendingPromotion.from).find(
        (m) => m.to === pendingPromotion.to && m.promotion === promotion,
      )
      setPendingPromotion(null)
      if (move) commitMove(position, move)
    },
    [pendingPromotion, position, commitMove],
  )

  const startGame = useCallback(() => {
    setPosition(createInitialPosition())
    setHistory([])
    setSelected(null)
    setLastMove(null)
    setThinking(false)
    setPendingPromotion(null)
    setPhase('playing')
  }, [])

  const resetToSetup = useCallback(() => {
    setPhase('setup')
    setThinking(false)
    setPendingPromotion(null)
  }, [])

  // Undo takes back the last full round (your move + the computer's reply).
  const undo = useCallback(() => {
    if (thinking) return
    setHistory((h) => {
      if (h.length === 0) return h
      // Walk back to the most recent position where it was the player's turn.
      let next = [...h]
      let restored = next[next.length - 1].position
      next = next.slice(0, -1)
      if (restored.turn !== 'w' && next.length > 0) {
        restored = next[next.length - 1].position
        next = next.slice(0, -1)
      }
      setPosition(restored)
      setLastMove(next.length > 0 ? next[next.length - 1].move : null)
      setSelected(null)
      setPendingPromotion(null)
      return next
    })
  }, [thinking])

  if (phase === 'setup') {
    return (
      <SetupScreen
        difficultyId={difficultyId}
        masterId={masterId}
        onDifficulty={setDifficultyId}
        onMaster={setMasterId}
        onStart={startGame}
      />
    )
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#cdeffd] via-[#eaf6e9] to-[#f6edd2] dark:from-[#0b2b3a] dark:via-[#0d2430] dark:to-[#1b1a10] text-slate-800 dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-10">
          {/* Board column */}
          <div className="flex-1 flex flex-col items-center">
            <RivalBar
              label="Tiki Crew"
              sublabel={`${difficulty.emoji} ${difficulty.name}`}
              captured={captured.w}
              side="b"
              thinking={thinking}
            />
            <Board
              board={position.board}
              selected={selected}
              legalTargets={legalTargets}
              lastMove={lastMove}
              checkSquare={checkSquare}
              onSquareClick={handleSquareClick}
              disabled={gameOver || thinking || position.turn !== 'w'}
            />
            <RivalBar
              label={master.title}
              sublabel={`${master.emoji} You — the sunny crew`}
              captured={captured.b}
              side="w"
              thinking={false}
            />
          </div>

          {/* Side panel */}
          <aside className="w-full lg:w-72 shrink-0 space-y-4">
            <StatusCard
              status={status}
              turn={position.turn}
              thinking={thinking}
              master={master}
            />

            <div className="rounded-2xl bg-white/70 dark:bg-white/5 backdrop-blur ring-1 ring-black/5 p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  Surf level
                </span>
                <span className="font-semibold">
                  {difficulty.emoji} {difficulty.name}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={undo}
                  disabled={history.length === 0 || thinking || gameOver}
                  className="flex-1 rounded-xl bg-white dark:bg-white/10 ring-1 ring-black/10 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ↩ Undo
                </button>
                <button
                  type="button"
                  onClick={resetToSetup}
                  className="flex-1 rounded-xl bg-teal-600 text-white px-3 py-2 text-sm font-medium hover:bg-teal-700 transition-colors"
                >
                  New game
                </button>
              </div>
            </div>

            <Legend />
          </aside>
        </div>
      </div>

      {/* Promotion picker */}
      {pendingPromotion && (
        <Overlay>
          <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl text-center">
            <h3 className="text-lg font-semibold mb-1">
              Promote your coconut!
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              It reached the far shore — pick its new form.
            </p>
            <div className="flex gap-3 justify-center">
              {PROMO_CHOICES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => choosePromotion(type)}
                  className="w-16 h-16 rounded-xl bg-[#f7e9c6] hover:bg-amber-200 ring-1 ring-black/10 flex items-center justify-center text-3xl transition-colors"
                  aria-label={BEACH_PIECES.w[type].label}
                >
                  {BEACH_PIECES.w[type].emoji}
                </button>
              ))}
            </div>
          </div>
        </Overlay>
      )}

      {/* Game-over result */}
      {gameOver && (
        <ResultOverlay
          status={status}
          turn={position.turn}
          master={master}
          onPlayAgain={startGame}
          onNewSetup={resetToSetup}
        />
      )}
    </div>
  )
}

// --- Setup screen ----------------------------------------------------------

interface SetupScreenProps {
  difficultyId: DifficultyId
  masterId: MasterId
  onDifficulty: (id: DifficultyId) => void
  onMaster: (id: MasterId) => void
  onStart: () => void
}

function SetupScreen({
  difficultyId,
  masterId,
  onDifficulty,
  onMaster,
  onStart,
}: SetupScreenProps) {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#cdeffd] via-[#eaf6e9] to-[#f6edd2] dark:from-[#0b2b3a] dark:via-[#0d2430] dark:to-[#1b1a10] text-slate-800 dark:text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <header className="text-center mb-10">
          <div className="text-5xl mb-3">🏖️♟️🌴</div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Beach Chess
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300 max-w-xl mx-auto">
            Coconuts, dolphins and bikini queens take on the tiki crew. Set the
            surf, claim your title, and play the computer — move the sunny crew
            up the beach.
          </p>
        </header>

        <section className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
            How rough is the surf? (difficulty)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DIFFICULTIES.map((d) => {
              const active = d.id === difficultyId
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onDifficulty(d.id)}
                  className={`text-left rounded-2xl p-4 ring-1 transition-all ${
                    active
                      ? 'bg-teal-600 text-white ring-teal-600 shadow-md'
                      : 'bg-white/70 dark:bg-white/5 ring-black/10 hover:ring-teal-400'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="text-xl">{d.emoji}</span>
                    {d.name}
                  </div>
                  <p
                    className={`mt-1 text-sm ${
                      active
                        ? 'text-white/80'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {d.blurb}
                  </p>
                </button>
              )
            })}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
            What kind of master are you?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MASTERS.map((m) => {
              const active = m.id === masterId
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onMaster(m.id)}
                  className={`text-left rounded-2xl p-4 ring-1 transition-all ${
                    active
                      ? 'bg-amber-500 text-white ring-amber-500 shadow-md'
                      : 'bg-white/70 dark:bg-white/5 ring-black/10 hover:ring-amber-400'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="text-xl">{m.emoji}</span>
                    {m.title}
                  </div>
                  <p
                    className={`mt-1 text-sm ${
                      active
                        ? 'text-white/85'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {m.blurb}
                  </p>
                </button>
              )
            })}
          </div>
        </section>

        <div className="text-center">
          <button
            type="button"
            onClick={onStart}
            className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 text-white px-8 py-4 text-lg font-bold hover:bg-teal-700 shadow-lg shadow-teal-600/20 transition-colors"
          >
            🏄 Hit the beach
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Supporting UI ---------------------------------------------------------

function RivalBar({
  label,
  sublabel,
  captured,
  side,
  thinking,
}: {
  label: string
  sublabel: string
  captured: Array<PieceType>
  side: 'w' | 'b'
  thinking: boolean
}) {
  return (
    <div className="w-full max-w-[560px] flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="font-semibold truncate flex items-center gap-2">
          {label}
          {thinking && (
            <span className="text-xs font-normal text-teal-600 dark:text-teal-300 animate-pulse">
              reading the waves…
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
          {sublabel}
        </div>
      </div>
      <div className="flex items-center gap-0.5 text-lg min-h-[1.5rem]">
        {captured.map((type, i) => (
          <span key={i} className="opacity-80">
            {BEACH_PIECES[side][type].emoji}
          </span>
        ))}
      </div>
    </div>
  )
}

function StatusCard({
  status,
  turn,
  thinking,
  master,
}: {
  status: GameStatus
  turn: 'w' | 'b'
  thinking: boolean
  master: ReturnType<typeof getMaster>
}) {
  let headline: string
  let tone = 'text-slate-700 dark:text-slate-200'

  if (status === 'checkmate') {
    const youWon = turn === 'b'
    headline = youWon ? 'Checkmate — you win! 🏆' : 'Checkmate — tide wins 🌊'
    tone = youWon ? 'text-teal-600' : 'text-red-500'
  } else if (status === 'stalemate') {
    headline = 'Stalemate — dead calm'
  } else if (status === 'draw') {
    headline = 'Draw — not enough crew left'
  } else if (status === 'check') {
    headline = turn === 'w' ? 'You’re in check! 🌊' : 'Tiki king in check!'
    tone = 'text-amber-600'
  } else if (thinking) {
    headline = 'Tiki crew is plotting…'
  } else {
    headline = turn === 'w' ? 'Your move' : 'Tiki crew’s move'
  }

  return (
    <div className="rounded-2xl bg-white/70 dark:bg-white/5 backdrop-blur ring-1 ring-black/5 p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
        {master.emoji} {master.title}
      </div>
      <div className={`text-lg font-bold ${tone}`}>{headline}</div>
    </div>
  )
}

function Legend() {
  return (
    <div className="rounded-2xl bg-white/70 dark:bg-white/5 backdrop-blur ring-1 ring-black/5 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
        Your crew
      </div>
      <div className="grid grid-cols-2 gap-y-1.5 text-sm">
        {(['k', 'q', 'r', 'b', 'n', 'p'] as Array<PieceType>).map((t) => (
          <div key={t} className="flex items-center gap-2">
            <span className="text-lg">{BEACH_PIECES.w[t].emoji}</span>
            <span className="text-slate-600 dark:text-slate-300">
              {BEACH_PIECES.w[t].label.replace(/ \(.*\)/, '')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      {children}
    </div>
  )
}

function ResultOverlay({
  status,
  turn,
  master,
  onPlayAgain,
  onNewSetup,
}: {
  status: GameStatus
  turn: 'w' | 'b'
  master: ReturnType<typeof getMaster>
  onPlayAgain: () => void
  onNewSetup: () => void
}) {
  const youWon = status === 'checkmate' && turn === 'b'
  const youLost = status === 'checkmate' && turn === 'w'

  let emoji = '🤝'
  let title = 'Dead calm'
  let message = 'A drawn game — the tide refused to break either way.'

  if (youWon) {
    emoji = '🏆'
    title = 'You rule the beach!'
    message = `Checkmate. ${master.title} sends the tiki crew packing.`
  } else if (youLost) {
    emoji = '🌊'
    title = 'Swept out to sea'
    message = 'The tiki crew found checkmate. Regroup and ride again.'
  } else if (status === 'stalemate') {
    emoji = '😮‍💨'
    title = 'Stalemate'
    message = 'No legal moves left, but no one is in check. Dead calm.'
  }

  return (
    <Overlay>
      <div className="rounded-2xl bg-white dark:bg-slate-800 p-8 shadow-xl text-center max-w-sm">
        <div className="text-6xl mb-3">{emoji}</div>
        <h2 className="text-2xl font-black mb-1">{title}</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={onPlayAgain}
            className="rounded-xl bg-teal-600 text-white px-5 py-2.5 font-semibold hover:bg-teal-700 transition-colors"
          >
            Rematch
          </button>
          <button
            type="button"
            onClick={onNewSetup}
            className="rounded-xl bg-white dark:bg-white/10 ring-1 ring-black/10 px-5 py-2.5 font-semibold hover:bg-slate-50 dark:hover:bg-white/15 transition-colors"
          >
            Change setup
          </button>
        </div>
      </div>
    </Overlay>
  )
}
