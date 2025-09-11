import * as React from 'react'
import { useEffect } from 'react'

export function useResizeObserver({
  ref,
  selector,
  onResize,
}: {
  ref: React.RefObject<HTMLElement>
  selector?: (element?: HTMLElement) => any
  onResize: (rect: DOMRect) => void
}) {
  const rerender = React.useReducer(() => ({}), {})[1]
  const element = selector?.(ref.current!) ?? ref.current

  useEffect(() => {
    const interval = setInterval(() => {
      rerender()
    }, 500)

    return () => {
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!element) {
      return
    }

    const observer = new ResizeObserver(() => {
      onResize(element.getBoundingClientRect())
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [element])
}
