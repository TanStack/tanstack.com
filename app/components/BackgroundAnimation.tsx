import * as React from 'react'
import { usePrefersReducedMotion } from '~/utils/usePrefersReducedMotion'
import { twMerge } from 'tailwind-merge'
import { useMounted } from '~/hooks/useMounted'
import { useRouterState } from '@tanstack/react-router'

export function BackgroundAnimation() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const mounted = useMounted()
  const isHomePage = useRouterState({
    select: (s) => s.location.pathname === '/',
  })

  React.useEffect(() => {
    if (prefersReducedMotion !== false) {
      return
    }

    const canvas = canvasRef.current

    const morphDuration = 4000
    const waitDuration = 1000 * 60 * 2

    function easeInOutCubic(t: number, b: number, c: number, d: number) {
      if ((t /= d / 2) < 1) return (c / 2) * t * t * t + b
      return (c / 2) * ((t -= 2) * t * t + 2) + b
    }

    if (canvas) {
      const ctx = canvas.getContext('2d')!

      let rafId: ReturnType<typeof requestAnimationFrame> | null = null
      let timeout: ReturnType<typeof setTimeout> | null = null
      let startTime = performance.now()

      function createBlobs() {
        return shuffle([
          {
            color: { h: 10, s: 100, l: 50 },
          },
          {
            color: { h: 40, s: 100, l: 50 },
          },
          {
            color: { h: 150, s: 100, l: 50 },
          },
          {
            color: { h: 200, s: 100, l: 50 },
          },
        ]).map((blob) => ({
          ...blob,
          x: Math.random() * canvas!.width,
          y: Math.random() * canvas!.height,
          r: Math.random() * 500 + 700,
          colorH: blob.color.h,
          colorS: blob.color.s,
          colorL: blob.color.l,
        }))
      }

      function shuffle<T>(array: T[]) {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[array[i], array[j]] = [array[j], array[i]]
        }
        return array
      }

      let currentBlobs = createBlobs()
      let interBlobs = currentBlobs
      let targetBlobs: ReturnType<typeof createBlobs> = []

      function start() {
        if (timeout) {
          clearTimeout(timeout)
        }
        if (rafId) {
          cancelAnimationFrame(rafId)
        }
        const parent = canvas!.parentElement
        canvas!.width = parent!.clientWidth
        canvas!.height = parent!.clientHeight

        currentBlobs = interBlobs
        targetBlobs = createBlobs()
        startTime = performance.now()
        animate()
      }

      function animate() {
        ctx.clearRect(0, 0, canvas!.width, canvas!.height)

        const time = performance.now() - startTime
        const progress = easeInOutCubic(time, 0, 1, morphDuration)

        // Draw the blobs
        currentBlobs.forEach((blob, i) => {
          const targetBlob = targetBlobs[i]
          interBlobs[i].x = blob.x + (targetBlob.x - blob.x) * progress
          interBlobs[i].y = blob.y + (targetBlob.y - blob.y) * progress

          const gradient = ctx.createRadialGradient(
            interBlobs[i].x,
            interBlobs[i].y,
            0,
            interBlobs[i].x,
            interBlobs[i].y,
            interBlobs[i].r
          )

          interBlobs[i].colorH =
            blob.colorH + (targetBlob.colorH - blob.colorH) * progress
          interBlobs[i].colorS =
            blob.colorS + (targetBlob.colorS - blob.colorS) * progress
          interBlobs[i].colorL =
            blob.colorL + (targetBlob.colorL - blob.colorL) * progress

          gradient.addColorStop(
            0,
            `hsla(${interBlobs[i].colorH}, ${interBlobs[i].colorS}%, ${interBlobs[i].colorL}%, 1)`
          )
          gradient.addColorStop(
            1,
            `hsla(${interBlobs[i].colorH}, ${interBlobs[i].colorS}%, ${interBlobs[i].colorL}%, 0)`
          )

          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(
            interBlobs[i].x,
            interBlobs[i].y,
            interBlobs[i].r,
            0,
            Math.PI * 2
          )
          ctx.fill()
        })

        if (progress < 1) {
          rafId = requestAnimationFrame(animate)
        } else {
          timeout = setTimeout(() => {
            start()
          }, waitDuration)
        }
      }

      start()
      window.addEventListener('resize', start)

      return () => {
        if (rafId) {
          cancelAnimationFrame(rafId)
        }
        if (timeout) {
          clearTimeout(timeout)
        }
        window.removeEventListener('resize', start)
      }
    }
  }, [prefersReducedMotion])

  return (
    <div
      className={twMerge(
        'fixed inset-0 z-0 opacity-20 pointer-events-none',
        'transition-opacity duration-[2s] ease-linear',
        '[&+*]:relative',
        mounted
          ? isHomePage
            ? 'opacity-10 dark:opacity-20'
            : 'opacity-10 dark:opacity-20'
          : 'opacity-0'
      )}
    >
      <canvas ref={canvasRef} />
    </div>
  )
}
