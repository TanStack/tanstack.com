import { describe, expect, it } from 'vitest'
import { maxFileBytes } from '../../src/chat/core/files'
import {
  appendSketchPoint,
  beginSketchStroke,
  cancelSketchStroke,
  clearSketch,
  emptySketch,
  finishSketchStroke,
  hasSketchInk,
  maxSketchOperations,
  maxSketchPoints,
  maxSketchStrokePoints,
  redoSketch,
  sketchColors,
  sketchHeight,
  sketchPngFile,
  sketchPoint,
  sketchPointFromClient,
  sketchWidth,
  undoSketch,
  visibleSketchStrokes,
  type SketchHistory,
  type SketchStroke,
} from '../../src/chat/core/sketch'

const start = (history = emptySketch(), x = 10) =>
  beginSketchStroke(history, { x, y: 20 }, 'pen', sketchColors[0]).history
const dot = (history = emptySketch(), x = 10) =>
  finishSketchStroke(start(history, x))
const points = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    x: i % sketchWidth,
    y: i % sketchHeight,
  }))
const stroke = (count: number): SketchStroke => ({
  kind: 'stroke',
  tool: 'pen',
  color: sketchColors[0],
  points: points(count),
})

describe('sketch geometry', () => {
  it('maps the same positions on narrow and wide displays to fixed output coordinates', () => {
    for (const width of [320, 512, 1024, 1536]) {
      const height = (width * sketchHeight) / sketchWidth
      const bounds = { left: 31, top: 70, width, height }
      expect(sketchPointFromClient(bounds.left, bounds.top, bounds)).toEqual({
        x: 0,
        y: 0,
      })
      expect(
        sketchPointFromClient(
          bounds.left + width / 2,
          bounds.top + height / 2,
          bounds,
        ),
      ).toEqual({ x: 512, y: 320 })
      expect(
        sketchPointFromClient(bounds.left + width, bounds.top + height, bounds),
      ).toEqual({ x: 1024, y: 640 })
    }
  })

  it('clamps captured pointers beyond the drawing surface and rejects invalid geometry', () => {
    const bounds = { left: 10, top: 20, width: 512, height: 320 }
    expect(sketchPointFromClient(-20, 1000, bounds)).toEqual({ x: 0, y: 640 })
    expect(sketchPoint(-1, 10000)).toEqual({ x: 0, y: 640 })
    for (const invalid of [NaN, Infinity, -Infinity]) {
      expect(sketchPoint(invalid, 0)).toBeNull()
      expect(sketchPoint(0, invalid)).toBeNull()
      expect(
        sketchPointFromClient(0, 0, { ...bounds, left: invalid }),
      ).toBeNull()
      expect(
        sketchPointFromClient(0, 0, { ...bounds, width: invalid }),
      ).toBeNull()
    }
    expect(sketchPointFromClient(0, 0, { ...bounds, width: 0 })).toBeNull()
    expect(sketchPointFromClient(0, 0, { ...bounds, height: -1 })).toBeNull()
  })
})

describe('sketch draft and history', () => {
  it('preserves a single tap as a one-point stroke and does not charge duplicate samples', () => {
    const active = start()
    expect(appendSketchPoint(active, { x: 10, y: 20 }).history).toBe(active)
    expect(appendSketchPoint(active, { x: NaN, y: 20 }).history).toBe(active)
    const finished = finishSketchStroke(active)
    expect(visibleSketchStrokes(finished)).toEqual([
      {
        kind: 'stroke',
        tool: 'pen',
        color: sketchColors[0],
        points: [{ x: 10, y: 20 }],
      },
    ])
    expect(hasSketchInk(finished)).toBe(true)
    expect(finished.active).toBeNull()
  })

  it('cancels only the unfinished stroke and retains the redo branch', () => {
    const twoDots = dot(dot(), 30)
    const undone = undoSketch(twoDots)
    const replacement = appendSketchPoint(start(undone, 50), {
      x: 80,
      y: 90,
    }).history
    expect(cancelSketchStroke(replacement)).toEqual(undone)
    expect(redoSketch(cancelSketchStroke(replacement))).toEqual(twoDots)
    expect(undoSketch(replacement)).toEqual(undone)
    expect(twoDots.operations).toHaveLength(2)
  })

  it('replaces redo only after committing a new stroke', () => {
    const original = dot(dot(), 30)
    const replacement = finishSketchStroke(start(undoSketch(original), 70))
    expect(replacement.position).toBe(2)
    expect(
      visibleSketchStrokes(replacement).map((item) => item.points[0].x),
    ).toEqual([10, 70])
    expect(redoSketch(replacement)).toBe(replacement)
    expect(
      visibleSketchStrokes(original).map((item) => item.points[0].x),
    ).toEqual([10, 30])
  })

  it('keeps pen color and eraser order through undo and redo', () => {
    const blue = finishSketchStroke(
      beginSketchStroke(dot(), { x: 10, y: 20 }, 'pen', sketchColors[1])
        .history,
    )
    const erased = finishSketchStroke(
      beginSketchStroke(blue, { x: 10, y: 20 }, 'eraser', sketchColors[2])
        .history,
    )
    expect(
      visibleSketchStrokes(erased).map((item) => [item.tool, item.color]),
    ).toEqual([
      ['pen', sketchColors[0]],
      ['pen', sketchColors[1]],
      ['eraser', sketchColors[2]],
    ])
    expect(undoSketch(erased)).toEqual({ ...erased, position: 2 })
    expect(visibleSketchStrokes(undoSketch(erased))).toEqual(
      visibleSketchStrokes(blue),
    )
    expect(redoSketch(undoSketch(erased))).toEqual(erased)
    expect(
      hasSketchInk(
        finishSketchStroke(
          beginSketchStroke(
            emptySketch(),
            { x: 1, y: 1 },
            'eraser',
            sketchColors[0],
          ).history,
        ),
      ),
    ).toBe(false)
  })

  it('makes clear reversible and does not add repeated empty clears', () => {
    const original = dot(dot(), 40)
    const cleared = clearSketch(original).history
    expect(visibleSketchStrokes(cleared)).toEqual([])
    expect(hasSketchInk(cleared)).toBe(false)
    expect(clearSketch(cleared).history).toBe(cleared)
    expect(visibleSketchStrokes(undoSketch(cleared))).toEqual(
      visibleSketchStrokes(original),
    )
    expect(redoSketch(undoSketch(cleared))).toEqual(cleared)
    expect(
      visibleSketchStrokes(dot(cleared, 50)).map((item) => item.points[0].x),
    ).toEqual([50])
  })

  it('does not replace an active stroke or clear it implicitly', () => {
    const active = start()
    expect(
      beginSketchStroke(active, { x: 99, y: 99 }, 'eraser', sketchColors[1])
        .history,
    ).toBe(active)
    expect(clearSketch(active).history).toBe(active)
    expect(redoSketch(active)).toBe(active)
    expect(finishSketchStroke(emptySketch())).toEqual(emptySketch())
    expect(undoSketch(emptySketch())).toEqual(emptySketch())
  })
})

describe('bounded sketches', () => {
  it('reports a full history without losing strokes, and undo makes room', () => {
    let full = emptySketch()
    for (let i = 0; i < maxSketchOperations; i++) full = dot(full, i)
    expect(
      beginSketchStroke(full, { x: 10, y: 20 }, 'pen', sketchColors[0]),
    ).toEqual({ history: full, limit: 'history' })
    expect(clearSketch(full)).toEqual({ history: full, limit: 'history' })
    expect(visibleSketchStrokes(full)).toHaveLength(maxSketchOperations)
    const replacement = dot(undoSketch(full), 99)
    expect(replacement.operations).toHaveLength(maxSketchOperations)
    expect(visibleSketchStrokes(replacement).at(-1)?.points[0].x).toBe(99)
  })

  it('retains every accepted point when a long stroke reaches its limit', () => {
    const history: SketchHistory = {
      ...emptySketch(),
      active: stroke(maxSketchStrokePoints - 1),
    }
    const last = appendSketchPoint(history, { x: 333, y: 444 }).history
    expect(last.active?.points).toHaveLength(maxSketchStrokePoints)
    expect(appendSketchPoint(last, { x: 334, y: 444 })).toEqual({
      history: last,
      limit: 'stroke',
    })
    expect(visibleSketchStrokes(finishSketchStroke(last))[0].points).toEqual(
      last.active?.points,
    )
    expect(cancelSketchStroke(last)).toEqual(emptySketch())
  })

  it('bounds the whole drawing including reversible cleared history', () => {
    const operations = Array.from({ length: 5 }, () => stroke(4000))
    operations.push(stroke(maxSketchPoints - 20_000 - 1))
    const almostFull: SketchHistory = {
      operations,
      position: operations.length,
      active: null,
    }
    const active = start(almostFull)
    expect(appendSketchPoint(active, { x: 11, y: 20 })).toEqual({
      history: active,
      limit: 'points',
    })
    const full = finishSketchStroke(active)
    expect(
      beginSketchStroke(full, { x: 12, y: 20 }, 'pen', sketchColors[0]),
    ).toEqual({ history: full, limit: 'points' })
    const cleared = clearSketch(full).history
    expect(visibleSketchStrokes(cleared)).toHaveLength(0)
    expect(
      beginSketchStroke(cleared, { x: 12, y: 20 }, 'pen', sketchColors[0])
        .limit,
    ).toBe('points')
    expect(visibleSketchStrokes(undoSketch(cleared))).toEqual(
      visibleSketchStrokes(full),
    )
    expect(
      beginSketchStroke(
        undoSketch(full),
        { x: 12, y: 20 },
        'pen',
        sketchColors[0],
      ).limit,
    ).toBeUndefined()
  })
})

describe('sketch PNG export contract', () => {
  it('waits for real PNG bytes and preserves them in the attachment File', async () => {
    let finish: BlobCallback | undefined
    const promise = sketchPngFile(
      {
        toBlob(callback, type) {
          expect(type).toBe('image/png')
          finish = callback
        },
      },
      123456,
    )
    const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    finish!(new Blob([pngBytes], { type: 'image/png' }))
    const file = await promise
    expect(file.name).toBe('sketch-123456.png')
    expect(file.type).toBe('image/png')
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(pngBytes)
  })

  it('accepts the file size boundary and rejects oversized output without truncating it', async () => {
    const canvas = (size: number) => ({
      toBlob(callback: BlobCallback) {
        callback(new Blob([new Uint8Array(size)], { type: 'image/png' }))
      },
    })
    expect((await sketchPngFile(canvas(maxFileBytes))).size).toBe(maxFileBytes)
    await expect(sketchPngFile(canvas(maxFileBytes + 1))).rejects.toThrow(
      'exceeds 2 MiB',
    )
  })

  it('surfaces unsupported, empty and failed canvas exports', async () => {
    for (const value of [
      null,
      new Blob([], { type: 'image/png' }),
      new Blob(['not png'], { type: 'image/jpeg' }),
    ]) {
      await expect(
        sketchPngFile({
          toBlob(callback) {
            callback(value)
          },
        }),
      ).rejects.toThrow('could not be exported')
    }
    const failure = new Error('Canvas failed')
    await expect(
      sketchPngFile({
        toBlob() {
          throw failure
        },
      }),
    ).rejects.toBe(failure)
  })
})
