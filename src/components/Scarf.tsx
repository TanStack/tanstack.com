import { useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

export function Scarf({ id, path }: { id: string; path: string }) {
  const visit = useRouterState({
    select: (state) => {
      const location = state.resolvedLocation
      if (
        state.status !== 'idle' ||
        !location ||
        location.href !== state.location.href ||
        (location.pathname !== path &&
          (path === '/' || !location.pathname.startsWith(`${path}/`)))
      ) {
        return null
      }

      return `${id}:${location.state.key}:${location.href}`
    },
  })
  const lastVisit = useRef<string | null>(null)
  const [pixel, setPixel] = useState<{ visit: string; src: string } | null>(
    null,
  )

  useEffect(() => {
    if (!visit || lastVisit.current === visit) return
    lastVisit.current = visit
    setPixel({
      visit,
      src: `https://static.scarf.sh/a.png?x-pxid=${encodeURIComponent(id)}&key=${crypto.randomUUID()}`,
    })
  }, [id, visit])

  return pixel && pixel.visit === visit ? (
    <img
      key={pixel.src}
      alt=""
      width="1"
      height="1"
      referrerPolicy="no-referrer-when-downgrade"
      src={pixel.src}
      className="fixed bottom-0 left-0 opacity-0 pointer-events-none"
    />
  ) : null
}
