// A small, self-contained chess engine for Beach Chess (/beach-chess).
//
// Board layout: a flat 64-element array. Index = rank * 8 + file, where
// rank 0 is the 8th rank (top of the screen, the computer's back rank) and
// rank 7 is the 1st rank (bottom, the player's back rank). file 0 = a-file.
// White (the player) sits at the bottom and moves toward lower indices.

export type Color = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

export interface Piece {
  type: PieceType
  color: Color
}

export type Square = Piece | null
export type Board = Array<Square>

export interface CastlingRights {
  wK: boolean
  wQ: boolean
  bK: boolean
  bQ: boolean
}

export interface Position {
  board: Board
  turn: Color
  castling: CastlingRights
  /** Target square an en-passant capture would land on, or null. */
  epSquare: number | null
}

export interface Move {
  from: number
  to: number
  /** Promotion piece type when a pawn reaches the last rank. */
  promotion?: PieceType
  /** 'K' for king-side, 'Q' for queen-side; present only for castling moves. */
  castle?: 'K' | 'Q'
  /** True when this move is an en-passant capture. */
  enPassant?: boolean
  /** The piece removed by this move (for capture, incl. en passant). */
  captured: Square
}

export type GameStatus =
  | 'playing'
  | 'check'
  | 'checkmate'
  | 'stalemate'
  | 'draw'

export function otherColor(color: Color): Color {
  return color === 'w' ? 'b' : 'w'
}

export function fileOf(index: number): number {
  return index % 8
}

export function rankOf(index: number): number {
  return Math.floor(index / 8)
}

export function squareName(index: number): string {
  const files = 'abcdefgh'
  const file = files[fileOf(index)]
  const rank = 8 - rankOf(index)
  return `${file}${rank}`
}

/** The standard opening position with the player (white) at the bottom. */
export function createInitialPosition(): Position {
  const board: Board = new Array(64).fill(null)

  const backRank: Array<PieceType> = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']

  for (let file = 0; file < 8; file++) {
    board[0 * 8 + file] = { type: backRank[file], color: 'b' } // rank 8
    board[1 * 8 + file] = { type: 'p', color: 'b' } // rank 7
    board[6 * 8 + file] = { type: 'p', color: 'w' } // rank 2
    board[7 * 8 + file] = { type: backRank[file], color: 'w' } // rank 1
  }

  return {
    board,
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    epSquare: null,
  }
}

function cloneBoard(board: Board): Board {
  // Pieces are immutable in practice; a shallow copy of the array is enough
  // because we always replace slots rather than mutating a Piece object.
  return board.slice()
}

// --- Move generation -------------------------------------------------------

const KNIGHT_DELTAS: Array<[number, number]> = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
]

const KING_DELTAS: Array<[number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
]

const BISHOP_DIRS: Array<[number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

const ROOK_DIRS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

function onBoard(file: number, rank: number): boolean {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8
}

function indexFrom(file: number, rank: number): number {
  return rank * 8 + file
}

/**
 * Is `square` attacked by any piece of color `by` in `board`?
 * Used for check detection and castling legality.
 */
export function isSquareAttacked(
  board: Board,
  square: number,
  by: Color,
): boolean {
  const file = fileOf(square)
  const rank = rankOf(square)

  // Pawn attacks. A `by`-colored pawn attacks `square` if it sits one rank
  // "behind" (in its forward direction) on a diagonal.
  // White moves toward lower ranks (up), so white pawns attacking `square`
  // are on rank+1; black pawns are on rank-1.
  const pawnRank = by === 'w' ? rank + 1 : rank - 1
  for (const df of [-1, 1]) {
    const f = file + df
    if (onBoard(f, pawnRank)) {
      const p = board[indexFrom(f, pawnRank)]
      if (p && p.color === by && p.type === 'p') return true
    }
  }

  // Knight attacks.
  for (const [df, dr] of KNIGHT_DELTAS) {
    const f = file + df
    const r = rank + dr
    if (onBoard(f, r)) {
      const p = board[indexFrom(f, r)]
      if (p && p.color === by && p.type === 'n') return true
    }
  }

  // King attacks.
  for (const [df, dr] of KING_DELTAS) {
    const f = file + df
    const r = rank + dr
    if (onBoard(f, r)) {
      const p = board[indexFrom(f, r)]
      if (p && p.color === by && p.type === 'k') return true
    }
  }

  // Sliding attacks: bishops/queens on diagonals.
  for (const [df, dr] of BISHOP_DIRS) {
    let f = file + df
    let r = rank + dr
    while (onBoard(f, r)) {
      const p = board[indexFrom(f, r)]
      if (p) {
        if (p.color === by && (p.type === 'b' || p.type === 'q')) return true
        break
      }
      f += df
      r += dr
    }
  }

  // Sliding attacks: rooks/queens on ranks and files.
  for (const [df, dr] of ROOK_DIRS) {
    let f = file + df
    let r = rank + dr
    while (onBoard(f, r)) {
      const p = board[indexFrom(f, r)]
      if (p) {
        if (p.color === by && (p.type === 'r' || p.type === 'q')) return true
        break
      }
      f += df
      r += dr
    }
  }

  return false
}

export function findKing(board: Board, color: Color): number {
  for (let i = 0; i < 64; i++) {
    const p = board[i]
    if (p && p.type === 'k' && p.color === color) return i
  }
  return -1
}

export function isInCheck(board: Board, color: Color): boolean {
  const king = findKing(board, color)
  if (king === -1) return false
  return isSquareAttacked(board, king, otherColor(color))
}

function addPawnMoves(
  position: Position,
  from: number,
  moves: Array<Move>,
): void {
  const { board } = position
  const piece = board[from]!
  const color = piece.color
  const file = fileOf(from)
  const rank = rankOf(from)
  const dir = color === 'w' ? -1 : 1 // white moves toward rank 0 (up)
  const startRank = color === 'w' ? 6 : 1
  const promoRank = color === 'w' ? 0 : 7

  const pushPawnMove = (to: number, captured: Square, enPassant = false) => {
    if (rankOf(to) === promoRank) {
      for (const promotion of ['q', 'r', 'b', 'n'] as Array<PieceType>) {
        moves.push({ from, to, promotion, captured })
      }
    } else {
      moves.push({ from, to, captured, enPassant: enPassant || undefined })
    }
  }

  // Single push.
  const oneRank = rank + dir
  if (onBoard(file, oneRank)) {
    const one = indexFrom(file, oneRank)
    if (!board[one]) {
      pushPawnMove(one, null)
      // Double push from the starting rank.
      if (rank === startRank) {
        const two = indexFrom(file, rank + 2 * dir)
        if (!board[two]) {
          moves.push({ from, to: two, captured: null })
        }
      }
    }
  }

  // Captures (including en passant).
  for (const df of [-1, 1]) {
    const f = file + df
    const r = rank + dir
    if (!onBoard(f, r)) continue
    const to = indexFrom(f, r)
    const target = board[to]
    if (target && target.color !== color) {
      pushPawnMove(to, target)
    } else if (to === position.epSquare) {
      // En passant: the captured pawn sits beside the moving pawn.
      const capturedIndex = indexFrom(f, rank)
      pushPawnMove(to, board[capturedIndex], true)
    }
  }
}

function addStepMoves(
  board: Board,
  from: number,
  deltas: Array<[number, number]>,
  moves: Array<Move>,
): void {
  const piece = board[from]!
  const file = fileOf(from)
  const rank = rankOf(from)
  for (const [df, dr] of deltas) {
    const f = file + df
    const r = rank + dr
    if (!onBoard(f, r)) continue
    const to = indexFrom(f, r)
    const target = board[to]
    if (!target || target.color !== piece.color) {
      moves.push({ from, to, captured: target ?? null })
    }
  }
}

function addSlidingMoves(
  board: Board,
  from: number,
  dirs: Array<[number, number]>,
  moves: Array<Move>,
): void {
  const piece = board[from]!
  const file = fileOf(from)
  const rank = rankOf(from)
  for (const [df, dr] of dirs) {
    let f = file + df
    let r = rank + dr
    while (onBoard(f, r)) {
      const to = indexFrom(f, r)
      const target = board[to]
      if (!target) {
        moves.push({ from, to, captured: null })
      } else {
        if (target.color !== piece.color) {
          moves.push({ from, to, captured: target })
        }
        break
      }
      f += df
      r += dr
    }
  }
}

function addCastlingMoves(
  position: Position,
  from: number,
  moves: Array<Move>,
): void {
  const { board, castling } = position
  const piece = board[from]!
  const color = piece.color
  const enemy = otherColor(color)

  // King must not currently be in check.
  if (isSquareAttacked(board, from, enemy)) return

  const backRank = color === 'w' ? 7 : 0
  const kingHome = indexFrom(4, backRank)
  if (from !== kingHome) return

  const canK = color === 'w' ? castling.wK : castling.bK
  const canQ = color === 'w' ? castling.wQ : castling.bQ

  // King-side: squares f and g must be empty and unattacked; rook on h.
  if (canK) {
    const f = indexFrom(5, backRank)
    const g = indexFrom(6, backRank)
    const rookSq = indexFrom(7, backRank)
    const rook = board[rookSq]
    if (
      !board[f] &&
      !board[g] &&
      rook &&
      rook.type === 'r' &&
      rook.color === color &&
      !isSquareAttacked(board, f, enemy) &&
      !isSquareAttacked(board, g, enemy)
    ) {
      moves.push({ from, to: g, castle: 'K', captured: null })
    }
  }

  // Queen-side: squares b, c, d empty; c and d unattacked; rook on a.
  if (canQ) {
    const d = indexFrom(3, backRank)
    const c = indexFrom(2, backRank)
    const b = indexFrom(1, backRank)
    const rookSq = indexFrom(0, backRank)
    const rook = board[rookSq]
    if (
      !board[d] &&
      !board[c] &&
      !board[b] &&
      rook &&
      rook.type === 'r' &&
      rook.color === color &&
      !isSquareAttacked(board, d, enemy) &&
      !isSquareAttacked(board, c, enemy)
    ) {
      moves.push({ from, to: c, castle: 'Q', captured: null })
    }
  }
}

/** All pseudo-legal moves for the side to move (may leave the king in check). */
function generatePseudoLegalMoves(position: Position): Array<Move> {
  const { board, turn } = position
  const moves: Array<Move> = []
  for (let i = 0; i < 64; i++) {
    const piece = board[i]
    if (!piece || piece.color !== turn) continue
    switch (piece.type) {
      case 'p':
        addPawnMoves(position, i, moves)
        break
      case 'n':
        addStepMoves(board, i, KNIGHT_DELTAS, moves)
        break
      case 'b':
        addSlidingMoves(board, i, BISHOP_DIRS, moves)
        break
      case 'r':
        addSlidingMoves(board, i, ROOK_DIRS, moves)
        break
      case 'q':
        addSlidingMoves(board, i, [...BISHOP_DIRS, ...ROOK_DIRS], moves)
        break
      case 'k':
        addStepMoves(board, i, KING_DELTAS, moves)
        addCastlingMoves(position, i, moves)
        break
    }
  }
  return moves
}

/**
 * Apply a move and return the resulting position. Does not mutate the input.
 */
export function applyMove(position: Position, move: Move): Position {
  const board = cloneBoard(position.board)
  const piece = board[move.from]!
  const color = piece.color

  // Move the piece.
  board[move.from] = null
  board[move.to] = move.promotion ? { type: move.promotion, color } : piece

  // En passant: remove the pawn that was passed.
  if (move.enPassant) {
    const capturedIndex = indexFrom(fileOf(move.to), rankOf(move.from))
    board[capturedIndex] = null
  }

  // Castling: move the rook too.
  if (move.castle) {
    const backRank = rankOf(move.to)
    if (move.castle === 'K') {
      board[indexFrom(5, backRank)] = board[indexFrom(7, backRank)]
      board[indexFrom(7, backRank)] = null
    } else {
      board[indexFrom(3, backRank)] = board[indexFrom(0, backRank)]
      board[indexFrom(0, backRank)] = null
    }
  }

  // Update castling rights.
  const castling: CastlingRights = { ...position.castling }
  if (piece.type === 'k') {
    if (color === 'w') {
      castling.wK = false
      castling.wQ = false
    } else {
      castling.bK = false
      castling.bQ = false
    }
  }
  // Rook moved from or captured on a corner.
  const clearRights = (sq: number) => {
    if (sq === indexFrom(7, 7)) castling.wK = false
    if (sq === indexFrom(0, 7)) castling.wQ = false
    if (sq === indexFrom(7, 0)) castling.bK = false
    if (sq === indexFrom(0, 0)) castling.bQ = false
  }
  clearRights(move.from)
  clearRights(move.to)

  // New en-passant target: set only on a double pawn push.
  let epSquare: number | null = null
  if (
    piece.type === 'p' &&
    Math.abs(rankOf(move.to) - rankOf(move.from)) === 2
  ) {
    epSquare = indexFrom(
      fileOf(move.from),
      (rankOf(move.from) + rankOf(move.to)) / 2,
    )
  }

  return {
    board,
    turn: otherColor(color),
    castling,
    epSquare,
  }
}

/** Legal moves for the side to move (king safety enforced). */
export function generateLegalMoves(position: Position): Array<Move> {
  const pseudo = generatePseudoLegalMoves(position)
  const legal: Array<Move> = []
  for (const move of pseudo) {
    const next = applyMove(position, move)
    if (!isInCheck(next.board, position.turn)) {
      legal.push(move)
    }
  }
  return legal
}

export function legalMovesFrom(position: Position, from: number): Array<Move> {
  return generateLegalMoves(position).filter((m) => m.from === from)
}

export function getGameStatus(position: Position): GameStatus {
  const legal = generateLegalMoves(position)
  const inCheck = isInCheck(position.board, position.turn)
  if (legal.length === 0) {
    return inCheck ? 'checkmate' : 'stalemate'
  }
  // Draw by insufficient material (K vs K, K+minor vs K).
  if (isInsufficientMaterial(position.board)) return 'draw'
  return inCheck ? 'check' : 'playing'
}

function isInsufficientMaterial(board: Board): boolean {
  const pieces = board.filter(Boolean) as Array<Piece>
  if (pieces.length <= 2) return true // just the two kings
  if (pieces.length === 3) {
    // King + single knight or bishop vs king.
    return pieces.some((p) => p.type === 'n' || p.type === 'b')
  }
  return false
}

// --- Evaluation & AI -------------------------------------------------------

const PIECE_VALUES: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
}

// Piece-square tables from white's perspective (index 0 = a8 ... 63 = h1).
// They nudge the engine toward sensible development and center control.
// prettier-ignore
const PST: Record<PieceType, Array<number>> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
}

/** Static evaluation in centipawns, from the perspective of `color`. */
function evaluate(board: Board, color: Color): number {
  let score = 0
  for (let i = 0; i < 64; i++) {
    const piece = board[i]
    if (!piece) continue
    const value = PIECE_VALUES[piece.type]
    // For black, read the piece-square table from the mirrored square.
    const pstIndex = piece.color === 'w' ? i : 63 - i
    const positional = PST[piece.type][pstIndex]
    const total = value + positional
    score += piece.color === color ? total : -total
  }
  return score
}

/** Order moves so captures are searched first — big win for alpha-beta. */
function orderMoves(moves: Array<Move>): Array<Move> {
  return moves.slice().sort((a, b) => {
    const aScore = a.captured ? PIECE_VALUES[a.captured.type] : 0
    const bScore = b.captured ? PIECE_VALUES[b.captured.type] : 0
    return bScore - aScore
  })
}

function negamax(
  position: Position,
  depth: number,
  alpha: number,
  beta: number,
  rootColor: Color,
): number {
  if (depth === 0) {
    return evaluate(position.board, position.turn)
  }

  const moves = generateLegalMoves(position)
  if (moves.length === 0) {
    // Checkmate (bad) or stalemate (neutral) for the side to move.
    if (isInCheck(position.board, position.turn)) {
      return -100000 - depth // prefer faster mates
    }
    return 0
  }

  let best = -Infinity
  for (const move of orderMoves(moves)) {
    const next = applyMove(position, move)
    const score = -negamax(next, depth - 1, -beta, -alpha, rootColor)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break // beta cut-off
  }
  return best
}

export interface AiSettings {
  /** Search depth (plies). Higher is stronger and slower. */
  depth: number
  /**
   * 0 = always best move. Higher values let the engine occasionally pick a
   * slightly weaker move, making easier levels feel more human/beatable.
   */
  randomness: number
}

/**
 * Choose a move for the side to move. Returns null if there are no legal moves.
 */
export function chooseAiMove(
  position: Position,
  settings: AiSettings,
): Move | null {
  const moves = generateLegalMoves(position)
  if (moves.length === 0) return null

  const rootColor = position.turn
  const scored = orderMoves(moves).map((move) => {
    const next = applyMove(position, move)
    const score = -negamax(
      next,
      settings.depth - 1,
      -Infinity,
      Infinity,
      rootColor,
    )
    return { move, score }
  })

  scored.sort((a, b) => b.score - a.score)

  if (settings.randomness <= 0) {
    return scored[0].move
  }

  // Gather moves within `randomness` centipawns of the best, then pick one at
  // random. Easier levels get a wider window and so blunder more often.
  const bestScore = scored[0].score
  const candidates = scored.filter(
    (s) => bestScore - s.score <= settings.randomness,
  )
  const pick = candidates[Math.floor(Math.random() * candidates.length)]
  return pick.move
}
