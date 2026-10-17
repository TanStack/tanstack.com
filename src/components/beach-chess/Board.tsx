// The 8x8 Beach Chess board. Pure presentation: it renders squares and pieces
// and reports clicks; all rules and state live in BeachChess.tsx.

import { fileOf, rankOf } from './engine'
import { BEACH_PIECES } from './theme'
import type { Board as BoardType, Move } from './engine'

interface BoardProps {
  board: BoardType
  selected: number | null
  legalTargets: Array<Move>
  lastMove: Move | null
  checkSquare: number | null
  onSquareClick: (index: number) => void
  disabled: boolean
}

const FILES = 'abcdefgh'

export function Board({
  board,
  selected,
  legalTargets,
  lastMove,
  checkSquare,
  onSquareClick,
  disabled,
}: BoardProps) {
  const targetSet = new Set(legalTargets.map((m) => m.to))

  return (
    <div
      className="relative w-full max-w-[560px] aspect-square rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(20,80,120,0.18)] ring-1 ring-black/5"
      role="grid"
      aria-label="Beach chess board"
    >
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {board.map((piece, index) => {
          const file = fileOf(index)
          const rank = rankOf(index)
          const isLight = (file + rank) % 2 === 0
          const isSelected = selected === index
          const isTarget = targetSet.has(index)
          const isCaptureTarget = isTarget && piece !== null
          const isLastFrom = lastMove?.from === index
          const isLastTo = lastMove?.to === index
          const isCheck = checkSquare === index

          // Sand for light squares, turquoise shallows for dark squares.
          const base = isLight
            ? 'bg-[#f7e9c6] dark:bg-[#e9d6a8]'
            : 'bg-[#6fc2c0] dark:bg-[#4fa3a6]'

          return (
            <button
              key={index}
              type="button"
              role="gridcell"
              disabled={disabled}
              onClick={() => onSquareClick(index)}
              aria-label={`${FILES[file]}${8 - rank}${
                piece ? `, ${piece.color === 'w' ? 'your' : 'rival'} piece` : ''
              }`}
              className={`relative flex items-center justify-center ${base} transition-colors duration-150 ${
                disabled ? 'cursor-default' : 'cursor-pointer'
              } ${isSelected ? 'outline outline-[3px] -outline-offset-[3px] outline-amber-500/90 z-10' : ''}`}
            >
              {/* Last-move trail */}
              {(isLastFrom || isLastTo) && (
                <span className="absolute inset-0 bg-amber-400/25" />
              )}

              {/* King-in-check glow */}
              {isCheck && (
                <span className="absolute inset-0 bg-red-500/35 animate-pulse" />
              )}

              {/* Piece */}
              {piece && (
                <span
                  className={`relative z-[1] select-none leading-none drop-shadow-sm ${
                    isCaptureTarget ? 'scale-110' : ''
                  }`}
                  style={{ fontSize: 'clamp(18px, 7vw, 44px)' }}
                >
                  {BEACH_PIECES[piece.color][piece.type].emoji}
                </span>
              )}

              {/* Legal-move hint: dot for empty, ring for capture */}
              {isTarget && !piece && (
                <span className="absolute w-[22%] h-[22%] rounded-full bg-teal-900/35" />
              )}
              {isCaptureTarget && (
                <span className="absolute inset-[6%] rounded-full ring-[3px] ring-teal-900/40" />
              )}

              {/* Edge coordinates */}
              {file === 0 && (
                <span className="absolute left-0.5 top-0.5 text-[9px] sm:text-[10px] font-semibold text-black/35">
                  {8 - rank}
                </span>
              )}
              {rank === 7 && (
                <span className="absolute right-0.5 bottom-0.5 text-[9px] sm:text-[10px] font-semibold text-black/35">
                  {FILES[file]}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
