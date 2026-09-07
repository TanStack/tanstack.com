import { useEffect, useRef, useState } from 'react'
import { VoyageEngine } from './engine/VoyageEngine'

interface VoyageSceneProps {
  onLoadingChange?: (loading: boolean) => void
  onEngineReady?: (engine: VoyageEngine | null) => void
}

export function VoyageScene({
  onLoadingChange,
  onEngineReady,
}: VoyageSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<VoyageEngine | null>(null)
  const [isReady, setIsReady] = useState(false)

  // Wait until the container has real dimensions before booting the engine.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const checkSize = () => {
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        setIsReady(true)
      }
    }

    checkSize()
    requestAnimationFrame(checkSize)

    const observer = new ResizeObserver(checkSize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isReady) return
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const width = container.clientWidth
    const height = container.clientHeight
    const dpr = Math.min(window.devicePixelRatio, 2)
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const engine = new VoyageEngine(canvas)
    engineRef.current = engine

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry && engineRef.current) {
        const { width, height } = entry.contentRect
        engineRef.current.resize(width, height)
      }
    })
    resizeObserver.observe(container)

    onLoadingChange?.(true)
    engine
      .init()
      .then(() => {
        engine.start()
        onLoadingChange?.(false)
        onEngineReady?.(engine)
      })
      .catch((err) => {
        console.error('VoyageEngine init failed:', err)
        onLoadingChange?.(false)
      })

    return () => {
      resizeObserver.disconnect()
      onEngineReady?.(null)
      engine.dispose()
      engineRef.current = null
    }
  }, [isReady, onLoadingChange, onEngineReady])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', background: '#04060e' }}
      />
    </div>
  )
}
