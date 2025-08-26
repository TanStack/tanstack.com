import { useEffect, useRef, useState } from 'react'

export interface UseIntersectionObserverOptions {
  root?: Element | null
  rootMargin?: string
  threshold?: number | number[]
  triggerOnce?: boolean
}

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
) {
  const {
    root = null,
    rootMargin = '50%', // Half viewport height - triggers when about half a page away
    threshold = 0,
    triggerOnce = true,
  } = options

  const [isIntersecting, setIsIntersecting] = useState(false)
  const [hasTriggered, setHasTriggered] = useState(false)
  const targetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    // If already triggered and triggerOnce is true, don't create observer
    if (triggerOnce && hasTriggered) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isCurrentlyIntersecting = entry.isIntersecting
        setIsIntersecting(isCurrentlyIntersecting)

        if (isCurrentlyIntersecting && triggerOnce) {
          setHasTriggered(true)
        }
      },
      {
        root,
        rootMargin,
        threshold,
      }
    )

    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [root, rootMargin, threshold, triggerOnce, hasTriggered])

  return {
    ref: targetRef,
    isIntersecting: triggerOnce
      ? hasTriggered || isIntersecting
      : isIntersecting,
    hasTriggered,
  }
}
