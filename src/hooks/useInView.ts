import * as React from 'react'

export function useInView<TElement extends Element>(
  targetRef: React.RefObject<TElement | null>,
  {
    root = null,
    rootMargin = '0px',
    threshold = 0,
  }: IntersectionObserverInit = {},
) {
  const [inView, setInView] = React.useState(false)

  React.useEffect(() => {
    const target = targetRef.current
    if (!target) return

    if (!('IntersectionObserver' in window)) {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { root, rootMargin, threshold },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [root, rootMargin, targetRef, threshold])

  return inView
}
