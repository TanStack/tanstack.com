import * as React from 'react'
import { twMerge } from 'tailwind-merge'
import {
  PIXEL_SPINNER_FRAMES,
  PIXEL_SPINNER_FRAME_MS,
  PIXEL_SPINNER_PALETTE,
  PIXEL_SPINNER_SIZE,
} from '../pixel-spinner-frames'

/**
 * A branded, pixel-art "headbanger" loading indicator — a 12-frame sprite
 * animation played on a canvas. Like `PalmSpinner`, this is intentionally
 * multi-color and does not inherit `currentColor`. Size it with w-/h-
 * utilities; the canvas renders at the art's native 32×32 and is scaled up
 * with `image-rendering: pixelated` so it stays crisp. Honors
 * `prefers-reduced-motion` by holding on the first frame.
 */
export function PixelSpinner({
  className,
  loops,
  onComplete,
}: {
  className?: string
  loops?: number
  onComplete?: () => void
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const onCompleteRef = React.useRef(onComplete)

  React.useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = PIXEL_SPINNER_SIZE

    const drawFrame = (frame: string) => {
      ctx.clearRect(0, 0, size, size)
      for (let i = 0; i < frame.length; i++) {
        const value = frame.charCodeAt(i) - 48 // '0'..'4' → 0..4
        if (value === 0) continue
        ctx.fillStyle = PIXEL_SPINNER_PALETTE[value - 1]
        ctx.fillRect(i % size, Math.floor(i / size), 1, 1)
      }
    }

    drawFrame(PIXEL_SPINNER_FRAMES[0])

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduced.matches) {
      onCompleteRef.current?.()
      return
    }

    let index = 0
    let elapsedFrames = 0
    const id = window.setInterval(() => {
      index = (index + 1) % PIXEL_SPINNER_FRAMES.length
      drawFrame(PIXEL_SPINNER_FRAMES[index])
      elapsedFrames += 1

      if (
        loops !== undefined &&
        elapsedFrames >= PIXEL_SPINNER_FRAMES.length * loops
      ) {
        window.clearInterval(id)
        onCompleteRef.current?.()
      }
    }, PIXEL_SPINNER_FRAME_MS)

    return () => window.clearInterval(id)
  }, [loops])

  return (
    <canvas
      ref={canvasRef}
      width={PIXEL_SPINNER_SIZE}
      height={PIXEL_SPINNER_SIZE}
      role="status"
      aria-label="Loading"
      className={twMerge('h-8 w-8 [image-rendering:pixelated]', className)}
    />
  )
}
