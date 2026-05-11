import { twMerge } from 'tailwind-merge'
import { gradientBackgroundCss } from '~/utils/ogGradient'

type CoverFallbackProps = {
  slug: string
  className?: string
  style?: React.CSSProperties
}

export function CoverFallback({ slug, className, style }: CoverFallbackProps) {
  return (
    <div
      aria-hidden="true"
      className={twMerge(
        'bg-gray-100 dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-800',
        className,
      )}
      style={{
        ...style,
        backgroundImage: gradientBackgroundCss(slug),
      }}
    />
  )
}
