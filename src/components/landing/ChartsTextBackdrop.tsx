import * as React from 'react'

export function ChartsTextBackdrop({
  children,
}: {
  children: React.ReactNode
}) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [mask, setMask] = React.useState('')
  const [radialBackdrop, setRadialBackdrop] = React.useState(false)

  React.useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const probe = document.createElement('canvas').getContext('2d')
    if (!probe || typeof probe.filter !== 'string') {
      setRadialBackdrop(true)
      return
    }
    let active = true
    let frame = 0
    let revision = 0
    const images = Array.from(content.querySelectorAll('img'))

    const updateMask = () => {
      if (!active) return
      const currentRevision = ++revision
      const bounds = content.getBoundingClientRect()
      const padding = 192
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil((bounds.width + padding * 2) / 2)
      canvas.height = Math.ceil((bounds.height + padding * 2) / 2)
      const context = canvas.getContext('2d')
      if (!context) return
      context.scale(0.5, 0.5)
      context.fillStyle = 'white'
      context.strokeStyle = 'white'
      context.lineWidth = 112
      context.lineJoin = 'round'
      context.textBaseline = 'top'

      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
      const range = document.createRange()
      while (walker.nextNode()) {
        const node = walker.currentNode
        const parent = node.parentElement
        if (!parent || !node.textContent?.trim()) continue
        const style = getComputedStyle(parent)
        context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
        for (let index = 0; index < node.textContent.length; index++) {
          const character = node.textContent[index]
          if (!character.trim()) continue
          range.setStart(node, index)
          range.setEnd(node, index + 1)
          const rect = range.getBoundingClientRect()
          if (!rect.width || !rect.height) continue
          const x = rect.left - bounds.left + padding
          const y = rect.top - bounds.top + padding
          context.strokeText(character, x, y)
          context.fillText(character, x, y)
        }
      }
      for (const image of images) {
        const rect = image.getBoundingClientRect()
        if (!rect.width || !image.complete || !image.naturalWidth) continue
        context.drawImage(
          image,
          rect.left - bounds.left + padding,
          rect.top - bounds.top + padding,
          rect.width,
          rect.height,
        )
      }

      const soft = document.createElement('canvas')
      soft.width = canvas.width
      soft.height = canvas.height
      const softContext = soft.getContext('2d')
      if (!softContext) return
      softContext.filter = 'blur(28px)'
      for (let pass = 0; pass < 4; pass++) softContext.drawImage(canvas, 0, 0)
      soft.toBlob((blob) => {
        if (!blob || !active || revision !== currentRevision) return
        setMask(URL.createObjectURL(blob))
      })
    }

    const scheduleMask = () => {
      if (!active) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updateMask)
    }
    const observer = new ResizeObserver(scheduleMask)
    observer.observe(content)
    for (const image of images) image.addEventListener('load', scheduleMask)
    void document.fonts.ready.then(scheduleMask)
    return () => {
      active = false
      cancelAnimationFrame(frame)
      observer.disconnect()
      for (const image of images)
        image.removeEventListener('load', scheduleMask)
    }
  }, [])

  React.useEffect(
    () => () => {
      if (mask) URL.revokeObjectURL(mask)
    },
    [mask],
  )

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -inset-48 ${radialBackdrop ? 'bg-white/85 dark:bg-black/85' : 'backdrop-blur-3xl'}`}
        style={{
          maskImage: radialBackdrop
            ? 'radial-gradient(ellipse closest-side, black 45%, transparent 100%)'
            : mask
              ? `url(${mask})`
              : undefined,
          visibility: radialBackdrop || mask ? 'visible' : 'hidden',
          maskSize: '100% 100%',
          maskRepeat: 'no-repeat',
        }}
      />
      <div ref={contentRef} className="relative">
        {children}
      </div>
    </div>
  )
}
