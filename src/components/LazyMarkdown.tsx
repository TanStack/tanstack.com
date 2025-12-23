import { Suspense, lazy } from 'react'
import { useIntersectionObserver } from '~/hooks/useIntersectionObserver'

const Markdown = lazy(() =>
  import('./Markdown').then((mod) => ({ default: mod.Markdown })),
)

interface LazyMarkdownProps {
  rawContent: string
  className?: string
}

export function LazyMarkdown({ rawContent, className }: LazyMarkdownProps) {
  const { ref, isIntersecting } = useIntersectionObserver({
    rootMargin: '100px',
    triggerOnce: true,
  })

  return (
    <div ref={ref} className={className}>
      {isIntersecting ? (
        <Suspense fallback={null}>
          <Markdown rawContent={rawContent} />
        </Suspense>
      ) : null}
    </div>
  )
}
