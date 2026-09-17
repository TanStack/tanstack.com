import { twMerge } from 'tailwind-merge'
import { Badge } from '~/components/ds/ui'
import type { LibrarySlim } from '~/libraries'

type LibraryBadge = NonNullable<LibrarySlim['badge']>

export function LibraryStatusBadge({
  badge,
  className,
}: {
  badge: LibraryBadge
  className?: string
}) {
  const isRc = badge.toUpperCase() === 'RC'

  // ALPHA / BETA stay quiet. RC is the current ship state, so it uses the
  // library accent and a slow glow. Reduced-motion users still get the fill.
  return (
    <Badge
      variant="default"
      rounded="md"
      className={twMerge(
        'border border-border-subtle font-ds-mono text-ds-mono-caps-xs uppercase',
        isRc &&
          'library-status-badge-rc border-transparent px-2.5 py-1 font-ds-mono text-ds-mono-caps text-white',
        className,
      )}
    >
      {badge}
    </Badge>
  )
}
