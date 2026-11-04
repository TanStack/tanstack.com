import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Eraser, PenLine, Redo2, Trash2, Undo2, X } from 'lucide-react'
import {
  appendSketchPoint,
  beginSketchStroke,
  cancelSketchStroke,
  clearSketch,
  emptySketch,
  finishSketchStroke,
  hasSketchInk,
  redoSketch,
  sketchColors,
  sketchHeight,
  sketchPngFile,
  sketchPoint,
  sketchPointFromClient,
  sketchStrokeWidth,
  sketchWidth,
  undoSketch,
  visibleSketchStrokes,
  type SketchChange,
  type SketchColor,
  type SketchHistory,
  type SketchPoint,
  type SketchTool,
} from '../core/sketch'
import { IconButton } from './IconButton'
import { PortalContainer } from './PortalContainer'
import './sketch-pad.css'

function paint(canvas: HTMLCanvasElement, history: SketchHistory) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Drawing is unavailable in this browser.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, sketchWidth, sketchHeight)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (const stroke of visibleSketchStrokes(history)) {
    const width = sketchStrokeWidth(stroke.tool)
    context.fillStyle = context.strokeStyle =
      stroke.tool === 'eraser' ? '#ffffff' : stroke.color
    context.lineWidth = width
    context.beginPath()
    const first = stroke.points[0]
    if (stroke.points.length === 1) {
      context.arc(first.x, first.y, width / 2, 0, Math.PI * 2)
      context.fill()
    } else {
      context.moveTo(first.x, first.y)
      for (const point of stroke.points.slice(1))
        context.lineTo(point.x, point.y)
      context.stroke()
    }
  }
}

const colorNames = ['Black', 'Blue', 'Red'] as const
const limits: Record<NonNullable<SketchChange['limit']>, string> = {
  history:
    'Drawing history is full. Undo an action or attach this drawing before starting another.',
  points:
    'Drawing limit reached. The part already drawn is kept. Undo a stroke or attach this drawing.',
  stroke:
    'Stroke limit reached. The part already drawn is kept. Start another stroke or undo.',
}

export function SketchPad({
  open,
  onOpenChange,
  onAttach,
  disabledReason,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAttach: (file: File) => boolean | Promise<boolean>
  disabledReason?: string
}) {
  const [history, setHistory] = useState(emptySketch)
  const historyRef = useRef(history)
  const [tool, setTool] = useState<SketchTool>('pen')
  const [color, setColor] = useState<SketchColor>(sketchColors[0])
  const [notice, setNotice] = useState<string>()
  const [exporting, setExporting] = useState(false)
  const exportingRef = useRef(false)
  const [cursor, setCursor] = useState<SketchPoint>({
    x: sketchWidth / 2,
    y: sketchHeight / 2,
  })
  const cursorRef = useRef(cursor)
  const [cursorVisible, setCursorVisible] = useState(false)
  const [keyboardDrawing, setKeyboardDrawing] = useState(false)
  const keyboardRef = useRef(false)
  const pointer = useRef<number | null>(null)
  const pointerLimited = useRef(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mountCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas
    if (!canvas) return
    // The dialog portal can mount after the open effect. Paint on the actual
    // canvas mount too, including retained strokes when reopening the pad.
    try {
      paint(canvas, historyRef.current)
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Drawing is unavailable in this browser.',
      )
    }
  }, [])
  const popupRef = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)
  const exportGeneration = useRef(0)
  const propsRef = useRef({ open, disabledReason, onAttach, onOpenChange })
  propsRef.current = { open, disabledReason, onAttach, onOpenChange }
  const helpId = useId()
  const statusId = useId()

  function update(next: SketchHistory) {
    historyRef.current = next
    setHistory(next)
  }

  function apply(change: SketchChange) {
    update(change.history)
    if (change.limit) setNotice(limits[change.limit])
    return !change.limit
  }

  function moveCursor(point: SketchPoint) {
    cursorRef.current = point
    setCursor(point)
    setCursorVisible(true)
  }

  function endStroke(cancel = false) {
    const pointerId = pointer.current
    pointer.current = null
    pointerLimited.current = false
    keyboardRef.current = false
    setKeyboardDrawing(false)
    update(
      cancel
        ? cancelSketchStroke(historyRef.current)
        : finishSketchStroke(historyRef.current),
    )
    if (pointerId !== null && canvasRef.current?.hasPointerCapture(pointerId)) {
      canvasRef.current.releasePointerCapture(pointerId)
    }
  }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      exportGeneration.current++
    }
  }, [])

  useEffect(() => {
    if (!open) {
      exportGeneration.current++
      exportingRef.current = false
      setExporting(false)
      pointer.current = null
      keyboardRef.current = false
      setKeyboardDrawing(false)
      const next = finishSketchStroke(historyRef.current)
      historyRef.current = next
      setHistory(next)
      setCursorVisible(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || !canvasRef.current) return
    const frame = requestAnimationFrame(() => {
      if (!canvasRef.current) return
      try {
        paint(canvasRef.current, history)
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : 'Drawing is unavailable in this browser.',
        )
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [history, open])

  function pointFor(event: { clientX: number; clientY: number }) {
    const canvas = canvasRef.current
    return canvas
      ? sketchPointFromClient(
          event.clientX,
          event.clientY,
          canvas.getBoundingClientRect(),
        )
      : null
  }

  function beginPointer(event: PointerEvent<HTMLCanvasElement>) {
    if (
      exportingRef.current ||
      pointer.current !== null ||
      !event.isPrimary ||
      event.button !== 0
    )
      return
    const point = pointFor(event)
    if (!point) return
    event.preventDefault()
    if (keyboardRef.current) endStroke()
    event.currentTarget.focus({ preventScroll: true })
    setNotice(undefined)
    moveCursor(point)
    const change = beginSketchStroke(historyRef.current, point, tool, color)
    if (!apply(change) || !change.history.active) return
    pointer.current = event.pointerId
    pointerLimited.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function movePointer(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== null && pointer.current !== event.pointerId) return
    const point = pointFor(event)
    if (point) moveCursor(point)
    if (pointer.current !== event.pointerId || pointerLimited.current) return
    event.preventDefault()
    const native = event.nativeEvent
    const samples =
      typeof native.getCoalescedEvents === 'function'
        ? native.getCoalescedEvents()
        : []
    for (const sample of samples.length ? samples : [event]) {
      const next = pointFor(sample)
      if (next && !apply(appendSketchPoint(historyRef.current, next))) {
        pointerLimited.current = true
        break
      }
    }
  }

  function finishPointer(
    event: PointerEvent<HTMLCanvasElement>,
    cancel = false,
  ) {
    if (pointer.current !== event.pointerId) return
    if (!cancel && !pointerLimited.current) {
      const point = pointFor(event)
      if (point) apply(appendSketchPoint(historyRef.current, point))
    }
    endStroke(cancel)
    if (cancel) setNotice('The interrupted stroke was cancelled.')
  }

  function keyboard(event: KeyboardEvent<HTMLCanvasElement>) {
    if (event.key === 'Escape' && historyRef.current.active) {
      event.preventDefault()
      event.stopPropagation()
      endStroke(true)
      setNotice('Stroke cancelled.')
      return
    }
    if (
      exportingRef.current ||
      pointer.current !== null ||
      event.altKey ||
      event.metaKey ||
      event.ctrlKey
    )
      return
    if (event.key === ' ') {
      event.preventDefault()
      if (event.repeat) return
      if (keyboardRef.current) endStroke()
      else {
        setNotice(undefined)
        const change = beginSketchStroke(
          historyRef.current,
          cursorRef.current,
          tool,
          color,
        )
        if (apply(change) && change.history.active) {
          keyboardRef.current = true
          setKeyboardDrawing(true)
        }
      }
      return
    }
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    const direction = directions[event.key]
    if (!direction) return
    event.preventDefault()
    const step = event.shiftKey ? 20 : 4
    const point = sketchPoint(
      cursorRef.current.x + direction[0] * step,
      cursorRef.current.y + direction[1] * step,
    )!
    moveCursor(point)
    if (
      keyboardRef.current &&
      !apply(appendSketchPoint(historyRef.current, point))
    )
      endStroke()
  }

  function changeHistory(action: (value: SketchHistory) => SketchHistory) {
    endStroke()
    setNotice(undefined)
    update(action(historyRef.current))
  }

  async function attach() {
    if (
      exportingRef.current ||
      propsRef.current.disabledReason ||
      !propsRef.current.open
    )
      return
    endStroke()
    const snapshot = historyRef.current
    if (!hasSketchInk(snapshot)) return
    const generation = ++exportGeneration.current
    exportingRef.current = true
    setExporting(true)
    setNotice(undefined)
    const current = () =>
      mounted.current &&
      exportGeneration.current === generation &&
      propsRef.current.open
    try {
      const output = document.createElement('canvas')
      output.width = sketchWidth
      output.height = sketchHeight
      paint(output, snapshot)
      const file = await sketchPngFile(output)
      if (!current()) return
      if (propsRef.current.disabledReason) {
        setNotice(propsRef.current.disabledReason)
        return
      }
      const accepted = await propsRef.current.onAttach(file)
      if (!current()) return
      if (accepted) {
        update(emptySketch())
        propsRef.current.onOpenChange(false)
      } else {
        setNotice(
          propsRef.current.disabledReason ||
            'The drawing was not attached. Try again.',
        )
      }
    } catch (error) {
      if (current())
        setNotice(
          error instanceof Error
            ? error.message
            : 'The drawing was not attached. Try again.',
        )
    } finally {
      if (mounted.current && exportGeneration.current === generation) {
        exportingRef.current = false
        setExporting(false)
      }
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next, details) => {
        if (!next && exportingRef.current) {
          details.cancel()
          return
        }
        if (!next) endStroke()
        onOpenChange(next)
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="sketch-backdrop" />
        <Dialog.Popup className="sketch-dialog" ref={popupRef}>
          <PortalContainer.Provider value={popupRef}>
            <div className="sketch-heading">
              <Dialog.Title>Draw</Dialog.Title>
              <Dialog.Close
                render={
                  <IconButton label="Close drawing" disabled={exporting}>
                    <X size={18} aria-hidden />
                  </IconButton>
                }
                disabled={exporting}
              />
            </div>
            <div
              className="sketch-tools"
              role="group"
              aria-label="Drawing tools"
            >
              <IconButton
                label="Pen"
                aria-pressed={tool === 'pen'}
                disabled={exporting}
                onClick={() => {
                  endStroke()
                  setTool('pen')
                }}
              >
                <PenLine size={18} aria-hidden />
              </IconButton>
              <IconButton
                label="Eraser"
                aria-pressed={tool === 'eraser'}
                disabled={exporting}
                onClick={() => {
                  endStroke()
                  setTool('eraser')
                }}
              >
                <Eraser size={18} aria-hidden />
              </IconButton>
              <div
                className="sketch-colors"
                role="group"
                aria-label="Pen color"
              >
                {sketchColors.map((value, index) => (
                  <IconButton
                    key={value}
                    label={colorNames[index]}
                    aria-pressed={color === value && tool === 'pen'}
                    disabled={exporting}
                    onClick={() => {
                      endStroke()
                      setColor(value)
                      setTool('pen')
                    }}
                  >
                    <span
                      className="sketch-color"
                      style={{ backgroundColor: value }}
                      aria-hidden
                    />
                  </IconButton>
                ))}
              </div>
              <div
                className="sketch-history"
                role="group"
                aria-label="Drawing history"
              >
                <IconButton
                  label="Undo"
                  disabled={exporting || (!history.position && !history.active)}
                  onClick={() => changeHistory(undoSketch)}
                >
                  <Undo2 size={18} aria-hidden />
                </IconButton>
                <IconButton
                  label="Redo"
                  disabled={
                    exporting ||
                    !!history.active ||
                    history.position === history.operations.length
                  }
                  onClick={() => changeHistory(redoSketch)}
                >
                  <Redo2 size={18} aria-hidden />
                </IconButton>
                <IconButton
                  label="Clear drawing"
                  disabled={exporting || !visibleSketchStrokes(history).length}
                  onClick={() => {
                    endStroke()
                    setNotice(undefined)
                    apply(clearSketch(historyRef.current))
                  }}
                >
                  <Trash2 size={18} aria-hidden />
                </IconButton>
              </div>
            </div>
            <div className="sketch-surface">
              <canvas
                ref={mountCanvas}
                width={sketchWidth}
                height={sketchHeight}
                tabIndex={0}
                aria-label="Drawing canvas"
                aria-describedby={`${helpId} ${statusId}`}
                aria-disabled={exporting || undefined}
                onPointerDown={beginPointer}
                onPointerMove={movePointer}
                onPointerUp={(event) => finishPointer(event)}
                onPointerCancel={(event) => finishPointer(event, true)}
                onLostPointerCapture={(event) => finishPointer(event, true)}
                onPointerLeave={() => {
                  if (
                    pointer.current === null &&
                    document.activeElement !== canvasRef.current
                  )
                    setCursorVisible(false)
                }}
                onFocus={() => setCursorVisible(true)}
                onBlur={() => {
                  if (keyboardRef.current) endStroke()
                  if (pointer.current === null) setCursorVisible(false)
                }}
                onKeyDown={keyboard}
              >
                Use a browser with canvas support to draw.
              </canvas>
              {cursorVisible && (
                <svg
                  className="sketch-cursor"
                  viewBox={`0 0 ${sketchWidth} ${sketchHeight}`}
                  aria-hidden
                >
                  <circle
                    cx={cursor.x}
                    cy={cursor.y}
                    r={Math.max(5, sketchStrokeWidth(tool) / 2)}
                  />
                </svg>
              )}
            </div>
            <p className="sketch-keyboard-help" id={helpId}>
              Arrow keys move. Space starts or ends a stroke. Escape cancels a
              stroke.
            </p>
            <div className="sketch-footer">
              <p id={statusId} className="sketch-notice" role="status">
                {disabledReason ||
                  notice ||
                  (keyboardDrawing ? 'Drawing. Press Space to finish.' : '')}
              </p>
              <button
                type="button"
                className="sketch-attach"
                disabled={
                  exporting || !!disabledReason || !hasSketchInk(history)
                }
                onClick={() => void attach()}
              >
                {exporting ? 'Attaching…' : 'Attach drawing'}
              </button>
            </div>
          </PortalContainer.Provider>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
