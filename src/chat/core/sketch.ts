import { maxFileBytes } from './files'

export const sketchWidth = 1024
export const sketchHeight = 640
export const maxSketchOperations = 256
export const maxSketchPoints = 24_000
export const maxSketchStrokePoints = 4_096
export const sketchColors = ['#18201c', '#2864c7', '#c13943'] as const

export type SketchColor = (typeof sketchColors)[number]
export type SketchPoint = { x: number; y: number }
export type SketchTool = 'pen' | 'eraser'
export type SketchStroke = {
  kind: 'stroke'
  tool: SketchTool
  color: SketchColor
  points: SketchPoint[]
}
export type SketchOperation = SketchStroke | { kind: 'clear' }
export type SketchHistory = {
  operations: SketchOperation[]
  position: number
  active: SketchStroke | null
}
export type SketchChange = {
  history: SketchHistory
  limit?: 'history' | 'points' | 'stroke'
}

export function emptySketch(): SketchHistory {
  return { operations: [], position: 0, active: null }
}

export function sketchPoint(x: number, y: number): SketchPoint | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return {
    x: Math.max(0, Math.min(sketchWidth, x)),
    y: Math.max(0, Math.min(sketchHeight, y)),
  }
}

export function sketchPointFromClient(
  x: number,
  y: number,
  bounds: { left: number; top: number; width: number; height: number },
): SketchPoint | null {
  if (
    ![bounds.left, bounds.top, bounds.width, bounds.height].every(
      Number.isFinite,
    ) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return null
  }
  return sketchPoint(
    ((x - bounds.left) / bounds.width) * sketchWidth,
    ((y - bounds.top) / bounds.height) * sketchHeight,
  )
}

function appliedPoints(history: SketchHistory) {
  return history.operations
    .slice(0, history.position)
    .reduce(
      (count, operation) =>
        count + (operation.kind === 'stroke' ? operation.points.length : 0),
      0,
    )
}

export function beginSketchStroke(
  history: SketchHistory,
  point: SketchPoint,
  tool: SketchTool,
  color: SketchColor,
): SketchChange {
  const validPoint = sketchPoint(point.x, point.y)
  if (history.active || !validPoint) return { history }
  if (history.position >= maxSketchOperations) {
    return { history, limit: 'history' }
  }
  if (appliedPoints(history) >= maxSketchPoints) {
    return { history, limit: 'points' }
  }
  return {
    history: {
      ...history,
      active: { kind: 'stroke', tool, color, points: [validPoint] },
    },
  }
}

export function appendSketchPoint(
  history: SketchHistory,
  point: SketchPoint,
): SketchChange {
  const validPoint = sketchPoint(point.x, point.y)
  const active = history.active
  if (!active || !validPoint) return { history }
  const previous = active.points[active.points.length - 1]
  if (previous.x === validPoint.x && previous.y === validPoint.y) {
    return { history }
  }
  if (active.points.length >= maxSketchStrokePoints) {
    return { history, limit: 'stroke' }
  }
  if (appliedPoints(history) + active.points.length >= maxSketchPoints) {
    return { history, limit: 'points' }
  }
  return {
    history: {
      ...history,
      active: { ...active, points: [...active.points, validPoint] },
    },
  }
}

export function finishSketchStroke(history: SketchHistory): SketchHistory {
  if (!history.active) return history
  // Keep redo until a replacement stroke is committed, so cancelling a stroke
  // never destroys redo. The temporary stroke has its own bounded point count.
  const operations = [
    ...history.operations.slice(0, history.position),
    history.active,
  ]
  return { operations, position: operations.length, active: null }
}

export function cancelSketchStroke(history: SketchHistory): SketchHistory {
  return history.active ? { ...history, active: null } : history
}

export function undoSketch(history: SketchHistory): SketchHistory {
  if (history.active) return cancelSketchStroke(history)
  return history.position
    ? { ...history, position: history.position - 1 }
    : history
}

export function redoSketch(history: SketchHistory): SketchHistory {
  if (history.active || history.position === history.operations.length) {
    return history
  }
  return { ...history, position: history.position + 1 }
}

export function visibleSketchStrokes(history: SketchHistory): SketchStroke[] {
  const strokes: SketchStroke[] = []
  for (const operation of history.operations.slice(0, history.position)) {
    if (operation.kind === 'clear') strokes.length = 0
    else strokes.push(operation)
  }
  if (history.active) strokes.push(history.active)
  return strokes
}

export function hasSketchInk(history: SketchHistory): boolean {
  return visibleSketchStrokes(history).some((stroke) => stroke.tool === 'pen')
}

export function clearSketch(history: SketchHistory): SketchChange {
  if (history.active || !visibleSketchStrokes(history).length)
    return { history }
  if (history.position >= maxSketchOperations) {
    return { history, limit: 'history' }
  }
  const operations: SketchOperation[] = [
    ...history.operations.slice(0, history.position),
    { kind: 'clear' },
  ]
  return { history: { operations, position: operations.length, active: null } }
}

export function sketchStrokeWidth(tool: SketchTool): number {
  return tool === 'eraser' ? 24 : 4
}

export async function sketchPngFile(
  canvas: {
    toBlob: (callback: (blob: Blob | null) => void, type?: string) => void
  },
  timestamp = Date.now(),
): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    try {
      canvas.toBlob(resolve, 'image/png')
    } catch (error) {
      reject(error)
    }
  })
  if (!blob || blob.type !== 'image/png' || !blob.size) {
    throw new Error('The drawing could not be exported. Try again.')
  }
  if (blob.size > maxFileBytes) {
    throw new Error(
      'The drawing exceeds 2 MiB. Undo some strokes and try again.',
    )
  }
  return new File([blob], `sketch-${timestamp}.png`, { type: 'image/png' })
}
