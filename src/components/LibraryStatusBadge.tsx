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
  // Status badges are intentionally neutral: the word (ALPHA / BETA / RC…)
  // carries the meaning, color carries none. A single quiet chip never competes
  // with a library's brand color and reads consistently across every surface.
  return (
    <Badge
      variant="default"
      rounded="md"
      className={twMerge(
        'border border-border-subtle font-ds-mono text-ds-mono-caps-xs uppercase',
        className,
      )}
    >
      {badge}
    </Badge>
  )
}
